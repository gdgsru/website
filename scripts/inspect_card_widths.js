const { spawn } = require('child_process');
const http = require('http');

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--disable-gpu',
    '--window-size=400,680',
    'file:///d:/Drafts/Blogs/website/scripts/test_bento.html'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  http.get('http://127.0.0.1:9231/json/list', res => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', async () => {
      const targets = JSON.parse(raw);
      const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
      let id = 1;
      const send = (m, p = {}) => new Promise(resolve => {
        const i = id++;
        const h = e => { const d = JSON.parse(e.data); if (d.id === i) { ws.removeEventListener('message', h); resolve(d.result); } };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id: i, method: m, params: p }));
      });
      ws.onopen = async () => {
        await send('Page.enable');
        await send('Runtime.enable');
        await send('Page.navigate', { url: 'file:///d:/Drafts/Blogs/website/scripts/test_bento.html' });
        await new Promise(r => setTimeout(r, 1000));
        const r = await send('Runtime.evaluate', {
          expression: `
            JSON.stringify((() => {
              try {
                const row = document.querySelector('.g16-row');
                const card = document.querySelector('.g16-tl');
                const cardInner = card ? card.querySelector('.g16-tl-card') : null;
                return {
                  rowW: row ? row.offsetWidth : null,
                  cardW: card ? card.offsetWidth : null,
                  cardInnerW: cardInner ? cardInner.offsetWidth : null,
                  gridCols: row ? window.getComputedStyle(row).gridTemplateColumns : null
                };
              } catch (e) {
                return { error: e.message };
              }
            })())
          `,
          returnByValue: true
        });
        console.log('Metrics:', JSON.parse(r.result.value));
        ws.close();
        chrome.kill();
        process.exit(0);
      };
    });
  });
}
test();
