const { spawn } = require('child_process');
const http = require('http');

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9229',
    '--disable-gpu',
    '--window-size=380,680',
    'file:///d:/Drafts/Blogs/website/scripts/test_bento.html'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  http.get('http://127.0.0.1:9229/json/list', res => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', async () => {
      const targets = JSON.parse(raw);
      const wsUrl = targets[0].webSocketDebuggerUrl;
      const ws = new WebSocket(wsUrl);
      let id = 1;
      const send = (m, p = {}) => new Promise(resolve => {
        const i = id++;
        const h = e => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); resolve(d.result); } };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id: i, method: m, params: p }));
      });
      ws.onopen = async () => {
        await send('Runtime.enable');
        const r = await send('Runtime.evaluate', {
          expression: `JSON.stringify({
            bodyW: document.body.offsetWidth,
            rowW: document.querySelector('.g16-row').offsetWidth,
            cards: [...document.querySelectorAll('.g16-tl')].map(c => ({
              w: c.offsetWidth,
              h: c.offsetHeight,
              left: c.getBoundingClientRect().left,
              right: c.getBoundingClientRect().right
            }))
          })`,
          returnByValue: true
        });
        console.log('Result:', JSON.parse(r.result.value));
        ws.close();
        chrome.kill();
        process.exit(0);
      };
    });
  });
}
test();
