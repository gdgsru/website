const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;
const BASE_URL = 'http://localhost:8080';

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
  '/member-badge/',
  '/admin/',
  '/404.html'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method && this.eventListeners.has(msg.method)) {
        this.eventListeners.get(msg.method).forEach(cb => cb(msg.params));
      }
    };
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, cb) {
    if (!this.eventListeners.has(method)) {
      this.eventListeners.set(method, []);
    }
    this.eventListeners.get(method).push(cb);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function runAudit() {
  console.log('--- STARTING HEADLESS CHROMIUM AUDIT ON ALL ROUTES ---');

  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1200,900'
  ]);

  await sleep(1500);

  try {
    const tabs = await fetchJson(`http://localhost:${PORT}/json/list`);
    let tab = tabs.find(t => t.type === 'page');
    if (!tab) {
      tab = await fetchJson(`http://localhost:${PORT}/json/new?about:blank`);
    }

    const cdp = new CDPClient(tab.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');

    const results = [];

    for (const route of ROUTES) {
      const fullUrl = `${BASE_URL}${route}`;
      const errors = [];
      const warnings = [];
      const netFailures = [];

      const onConsole = (p) => {
        const text = p.args.map(a => a.value || a.description || '').join(' ');
        // Filter out expected Supabase offline / cross-origin sandbox notices
        if (p.type === 'error') {
          errors.push(text);
        } else if (p.type === 'warning') {
          warnings.push(text);
        }
      };

      const onException = (p) => {
        errors.push(`Uncaught: ${p.exceptionDetails.text} (${p.exceptionDetails.url || ''}:${p.exceptionDetails.lineNumber || ''})`);
      };

      const onResponse = (p) => {
        const u = p.response.url;
        const status = p.response.status;
        if (status >= 400 && u.startsWith(BASE_URL)) {
          netFailures.push(`${status} on ${u}`);
        }
      };

      cdp.eventListeners.set('Runtime.consoleAPICalled', [onConsole]);
      cdp.eventListeners.set('Runtime.exceptionThrown', [onException]);
      cdp.eventListeners.set('Network.responseReceived', [onResponse]);

      // Set Desktop Viewport
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 1200,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });

      await cdp.send('Page.navigate', { url: fullUrl });
      await sleep(1200);

      // Check horizontal overflow on desktop
      const desktopOverflowRes = await cdp.send('Runtime.evaluate', {
        expression: 'document.documentElement.scrollWidth > window.innerWidth'
      });
      const desktopOverflow = desktopOverflowRes.result.value;

      // Switch to Mobile Viewport (iPhone 14 width: 390px)
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 2,
        mobile: true
      });
      await sleep(400);

      const mobileOverflowRes = await cdp.send('Runtime.evaluate', {
        expression: 'document.documentElement.scrollWidth > window.innerWidth'
      });
      const mobileOverflow = mobileOverflowRes.result.value;

      // Check Heading Hierarchy
      const headingsRes = await cdp.send('Runtime.evaluate', {
        expression: `
          Array.from(document.querySelectorAll('h1, h2, h3, h4')).map(el => ({
            tag: el.tagName.toLowerCase(),
            text: el.innerText.trim().slice(0, 40)
          }))
        `,
        returnByValue: true
      });
      const headings = headingsRes.result.value || [];

      results.push({
        route,
        desktopOverflow,
        mobileOverflow,
        errors,
        warnings,
        netFailures,
        headingsCount: headings.length
      });
    }

    cdp.close();

    console.log('\n--- AUDIT RESULTS TABLE ---');
    console.log('Route              | Errors | Warnings | Net Failures | Desktop Overflow | Mobile Overflow');
    console.log('-------------------|--------|----------|--------------|------------------|----------------');
    for (const r of results) {
      console.log(
        `${r.route.padEnd(19)}| ${String(r.errors.length).padEnd(7)}| ${String(r.warnings.length).padEnd(9)}| ${String(r.netFailures.length).padEnd(13)}| ${String(r.desktopOverflow).padEnd(17)}| ${String(r.mobileOverflow)}`
      );
      if (r.errors.length) {
        r.errors.forEach(e => console.log(`   [ERROR] ${e}`));
      }
      if (r.netFailures.length) {
        r.netFailures.forEach(f => console.log(`   [NET FAIL] ${f}`));
      }
    }

  } finally {
    chromeProc.kill();
  }
}

runAudit().catch(err => {
  console.error('Audit failed with error:', err);
  process.exit(1);
});
