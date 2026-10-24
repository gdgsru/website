const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function main() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--window-size=1280,800',
    '--user-data-dir=C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\chrome_test_profile2',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  http.get('http://127.0.0.1:9226/json/list', (res) => {
    let raw = '';
    res.on('data', d => raw += d);
    res.on('end', async () => {
      const targets = JSON.parse(raw);
      const pageTarget = targets.find(t => t.type === 'page') || targets[0];
      const wsUrl = pageTarget.webSocketDebuggerUrl;
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

        console.log('Navigating to https://gdgsru.pages.dev/ ...');
        await send('Page.navigate', { url: 'https://gdgsru.pages.dev/' });

        await new Promise(r => setTimeout(r, 4000));

        const screenshot = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\live_banner_screenshot.png', Buffer.from(screenshot.data, 'base64'));
        console.log('Screenshot captured to live_banner_screenshot.png');

        ws.close();
        chrome.kill();
        process.exit(0);
      };
    });
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
