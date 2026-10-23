const cp = require('child_process');
const fs = require('fs');

const ROUTES = [
  '/',
  '/events/',
  '/team/',
  '/blog/',
  '/join/',
  '/certificates/',
  '/verify/',
  '/leaderboard/',
  '/resources/',
  '/privacy/',
  '/404.html',
  '/member-badge/',
  '/mission-control.html'
];

async function runAudit() {
  console.log('=== STARTING RUNTIME CHROME ROUTE AUDIT ===');
  const port = 9370;
  const chrome = cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`
  ]);

  let tab = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:8080/`, { method: 'PUT' });
      tab = await res.json();
      break;
    } catch {}
  }
  if (!tab) { chrome.kill(); throw new Error('Chrome did not start'); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();

  let currentErrors = [];
  let current404s = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg);
      callbacks.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      currentErrors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.method === 'Network.responseReceived') {
      const res = msg.params.response;
      if (res.status >= 400 && !res.url.includes('/favicon.ico')) {
        current404s.push(`${res.status} ${res.url}`);
      }
    }
  };

  await new Promise(res => ws.onopen = res);
  const send = (method, params = {}) => new Promise(res => {
    const reqId = id++;
    callbacks.set(reqId, res);
    ws.send(JSON.stringify({ id: reqId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');

  const results = [];

  for (const route of ROUTES) {
    currentErrors = [];
    current404s = [];
    const url = `http://localhost:8080${route}`;
    process.stdout.write(`Testing ${route.padEnd(25)} `);

    await send('Page.navigate', { url });
    await new Promise(r => setTimeout(r, 1800));

    const evalRes = await send('Runtime.evaluate', {
      expression: `(() => {
        return {
          title: document.title,
          h1: document.querySelector('h1')?.textContent?.trim() || '',
          appContent: (document.getElementById('app')?.textContent || document.body.textContent || '').trim().length,
          navLinks: document.querySelectorAll('header nav a').length
        };
      })()`,
      returnByValue: true
    });

    const info = evalRes.result?.value || {};
    const pass = currentErrors.length === 0 && current404s.length === 0;

    if (pass) {
      console.log(`[PASS] (${info.title || 'No Title'})`);
    } else {
      console.log(`[WARN]`);
      if (currentErrors.length) console.log(`   Errors:`, currentErrors);
      if (current404s.length) console.log(`   Failed HTTP:`, current404s);
    }

    results.push({
      route,
      title: info.title,
      h1: info.h1,
      errors: [...currentErrors],
      networkFailures: [...current404s],
      pass
    });
  }

  chrome.kill();

  fs.writeFileSync('d:/Drafts/Blogs/website/gdg-sru-v43-template-preserved/scripts/runtime_route_results.json', JSON.stringify(results, null, 2));
  console.log('\n=== RUNTIME AUDIT COMPLETED ===');
}

runAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
