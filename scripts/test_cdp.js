const { spawn } = require('child_process');
const http = require('http');

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--disable-gpu',
    'about:blank'
  ]);

  // wait 1s for port
  await new Promise(r => setTimeout(r, 1200));

  // get ws url
  http.get('http://127.0.0.1:9222/json', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', async () => {
      const list = JSON.parse(body);
      const wsUrl = list[0].webSocketDebuggerUrl;
      console.log('Debugger URL:', wsUrl);

      // Connect with WebSocket
      const WebSocket = require('stream'); // wait, let's see if ws exists or use raw socket
      chrome.kill();
    });
  });
}
run();
