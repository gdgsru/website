const { spawn } = require('child_process');
const http = require('http');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9222;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
  }
  async connect() {
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
  close() { this.ws.close(); }
}

async function testTransition() {
  const chromeProc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--no-default-browser-check'
  ]);
  await sleep(1500);

  try {
    const tabs = await fetchJson(`http://localhost:${PORT}/json/list`);
    const tab = tabs.find(t => t.type === 'page') || await fetchJson(`http://localhost:${PORT}/json/new?about:blank`);
    const cdp = new CDPClient(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');

    console.log('Testing transition animation on https://gdgsru.pages.dev ...');
    
    await cdp.send('Page.navigate', { url: 'https://gdgsru.pages.dev/' });
    await sleep(1500);

    // Trigger click on Events link
    await cdp.send('Runtime.evaluate', {
      expression: `document.querySelector('a[href="/events/"]').click()`
    });

    // Check if pt-out class was added immediately upon click
    const ptOutRes = await cdp.send('Runtime.evaluate', {
      expression: `document.documentElement.classList.contains('pt-out')`
    });
    console.log('Transition screen triggered on click:', ptOutRes.result.value);

    // Wait for the new page to load and reveal
    await sleep(700);
    const navUrlRes = await cdp.send('Runtime.evaluate', { expression: 'location.pathname' });
    console.log('Arrived on page:', navUrlRes.result.value);
    
    cdp.close();
  } finally {
    chromeProc.kill();
  }
}

testTransition().catch(console.error);
