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

async function checkHeadings() {
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
    const tab = tabs.find(t => t.type === 'page') || await fetchJson(`http://localhost:${PORT}/json/new?about:blank`);
    const cdp = new CDPClient(tab.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    console.log('\n--- HEADING HIERARCHY AUDIT ---');
    for (const route of ROUTES) {
      await cdp.send('Page.navigate', { url: `${BASE_URL}${route}` });
      await sleep(1200);

      const res = await cdp.send('Runtime.evaluate', {
        expression: `
          Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(el => {
            return {
              tag: el.tagName.toLowerCase(),
              level: parseInt(el.tagName[1], 10),
              text: el.innerText.trim().slice(0, 30),
              hidden: el.classList.contains('visually-hidden') || el.offsetParent === null
            };
          })
        `,
        returnByValue: true
      });

      const headings = res.result.value || [];
      const levels = headings.map(h => `${h.tag}${h.hidden ? '(hidden)' : ''}`).join(' -> ');
      
      // Check for level skips (e.g. 1 -> 3)
      let skips = [];
      let prev = 0;
      for (const h of headings) {
        if (prev > 0 && h.level > prev + 1) {
          skips.push(`Skipped from h${prev} to h${h.level} ("${h.text}")`);
        }
        prev = h.level;
      }

      console.log(`Route ${route.padEnd(16)}: ${headings.length} headings | Skips: ${skips.length ? skips.join(', ') : 'None (Clean)'}`);
    }
    cdp.close();
  } finally {
    chromeProc.kill();
  }
}

checkHeadings().catch(console.error);
