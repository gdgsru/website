const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

async function main() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9232',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  http.get('http://127.0.0.1:9232/json/list', (res) => {
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
        // Emulate mobile device 390x844 with scale factor 2
        await send('Emulation.setDeviceMetricsOverride', {
          width: 390,
          height: 844,
          deviceScaleFactor: 2,
          mobile: true
        });

        await send('Page.navigate', { url: 'file:///d:/Drafts/Blogs/website/cloudflare-pages-site/member-badge/index.html' });
        await new Promise(r => setTimeout(r, 2000));

        // Unlock passcode in localStorage or simulate click
        await send('Runtime.evaluate', {
          expression: `localStorage.setItem('gdg_pass_unlocked', '1'); location.reload();`
        });
        await new Promise(r => setTimeout(r, 1500));

        const shot = await send('Page.captureScreenshot', { format: 'png' });
        const buf = Buffer.from(shot.data, 'base64');
        const outPath = 'C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\member_badge_true_mobile.png';
        fs.writeFileSync(outPath, buf);
        console.log('Saved true mobile screenshot to', outPath);

        chrome.kill();
        process.exit(0);
      };
    });
  });
}
main();
