const cp = require('child_process');

const SIZES = [
  { name: 'Desktop (1440x900)', width: 1440, height: 900 },
  { name: 'Tablet (768x1024)', width: 768, height: 1024 },
  { name: 'Mobile (375x812)', width: 375, height: 812 }
];

const PAGES = ['/', '/events/', '/team/', '/certificates/', '/join/', '/leaderboard/'];

async function runResponsiveAudit() {
  console.log('=== STARTING RESPONSIVE & HORIZONTAL OVERFLOW AUDIT ===');
  const port = 9385;
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

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    callbacks.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  for (const size of SIZES) {
    console.log(`\nTesting Viewport: ${size.name}`);
    await send('Emulation.setDeviceMetricsOverride', {
      width: size.width,
      height: size.height,
      deviceScaleFactor: 1,
      mobile: size.width < 768
    });

    for (const page of PAGES) {
      await send('Page.navigate', { url: `http://localhost:8080${page}` });
      await new Promise(r => setTimeout(r, 1200));

      const overflow = await (new Promise(async (resolve) => {
        const res = await send('Runtime.evaluate', {
          expression: `(() => {
            const docWidth = document.documentElement.offsetWidth;
            const scrollWidth = document.documentElement.scrollWidth;
            const diff = scrollWidth - docWidth;
            return {
              hasOverflow: diff > 2,
              diff,
              docWidth,
              scrollWidth
            };
          })()`,
          returnByValue: true
        });
        resolve(res?.result?.value);
      }));

      const status = overflow?.hasOverflow ? `[WARN - Overflow ${overflow.diff}px]` : `[PASS - No Overflow]`;
      console.log(`   ${page.padEnd(20)} ${status}`);
    }
  }

  ws.close();
  chrome.kill();
  console.log('\n=== RESPONSIVE AUDIT FINISHED ===');
}

runResponsiveAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
