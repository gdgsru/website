const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  const port = 9388;
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chrome = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + path.resolve(__dirname, '../tmp_chrome_icon')
  ]);

  try {
    await new Promise(r => setTimeout(r, 1500));
    const versionRes = await fetch(`http://127.0.0.1:${port}/json/version`);
    const version = await versionRes.json();
    console.log('Connected to Chrome:', version['User-Agent']);

    const newTabRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    const tab = await newTabRes.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);

    await new Promise(r => ws.onopen = r);

    let id = 1;
    function send(method, params = {}) {
      return new Promise((resolve) => {
        const msgId = id++;
        const onMsg = (event) => {
          const data = JSON.parse(event.data);
          if (data.id === msgId) {
            ws.removeEventListener('message', onMsg);
            resolve(data.result);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify({ id: msgId, method, params }));
      });
    }

    await send('Page.enable');
    await send('Runtime.enable');

    const svgFile = path.resolve(__dirname, '../gdg-sru-v43-template-preserved/site/assets/brand/gdg-logo.svg');
    const svg = fs.readFileSync(svgFile, 'utf8');

    const sizes = [
      { size: 192, name: 'icon-192.png' },
      { size: 512, name: 'icon-512.png' },
      { size: 180, name: 'apple-touch-icon.png' }
    ];

    for (const item of sizes) {
      const size = item.size;
      await send('Emulation.setDeviceMetricsOverride', {
        width: size,
        height: size,
        deviceScaleFactor: 1,
        mobile: false
      });

      const iconPadding = Math.round(size * 0.18);
      const logoSize = size - (iconPadding * 2);

      const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: ${size}px;
    height: ${size}px;
    background: #121316;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .wrapper {
    width: ${logoSize}px;
    height: ${logoSize}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
</style>
</head>
<body>
  <div class="wrapper">
    ${svg}
  </div>
</body>
</html>`;

      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      await send('Page.navigate', { url: dataUrl });
      await new Promise(r => setTimeout(r, 600));

      const screenshot = await send('Page.captureScreenshot', {
        format: 'png',
        clip: { x: 0, y: 0, width: size, height: size, scale: 1 }
      });

      const outPath = path.resolve(__dirname, '../gdg-sru-v43-template-preserved/site/assets/brand', item.name);
      fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
      console.log(`Saved ${item.name} (${size}x${size}) -> ${outPath}`);
    }

    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
