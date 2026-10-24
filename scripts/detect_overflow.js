const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--window-size=390,844',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  http.get('http://127.0.0.1:9231/json/list', (res) => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', async () => {
      const targets = JSON.parse(raw);
      const wsUrl = targets[0].webSocketDebuggerUrl;
      const ws = new WebSocket(wsUrl);

      let id = 1;
      const send = (method, params = {}) => {
        return new Promise((resolve) => {
          const reqId = id++;
          const handler = (evt) => {
            const data = JSON.parse(evt.data);
            if (data.id === reqId) {
              ws.removeEventListener('message', handler);
              resolve(data.result);
            }
          };
          ws.addEventListener('message', handler);
          ws.send(JSON.stringify({ id: reqId, method, params }));
        });
      };

      ws.onopen = async () => {
        await send('Page.enable');
        await send('Page.navigate', { url: 'file:///d:/Drafts/Blogs/website/cloudflare-pages-site/member-badge/index.html' });
        await new Promise(r => setTimeout(r, 2000));

        const r = await send('Runtime.evaluate', {
          expression: `(() => {
            const docW = document.documentElement.scrollWidth;
            const bodyW = document.body.scrollWidth;
            const winW = window.innerWidth;
            const overflows = [];
            document.querySelectorAll('*').forEach(el => {
              if (el.scrollWidth > winW || el.offsetWidth > winW) {
                overflows.push({ tag: el.tagName, class: el.className, id: el.id, offsetW: el.offsetWidth, scrollW: el.scrollWidth });
              }
            });
            return { winW, docW, bodyW, overflows: overflows.slice(0, 15) };
          })()`,
          returnByValue: true
        });

        console.log('RESULT:', JSON.stringify(r.result.value, null, 2));
        chrome.kill();
        process.exit(0);
      };
    });
  });
}
main();
