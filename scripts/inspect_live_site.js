const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-extensions',
    '--user-data-dir=C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\chrome_test_profile',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  http.get('http://127.0.0.1:9225/json/list', (res) => {
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
        await send('Console.enable');
        await send('Runtime.enable');
        await send('Network.enable');

        ws.onmessage = (evt) => {
          const msg = JSON.parse(evt.data);
          if (msg.method === 'Console.messageAdded') {
            console.log('[BROWSER CONSOLE]', msg.params.message.level, msg.params.message.text);
          }
          if (msg.method === 'Runtime.consoleAPICalled') {
            console.log('[CONSOLE API]', msg.params.type, msg.params.args.map(a => a.value !== undefined ? a.value : a.description).join(' '));
          }
          if (msg.method === 'Runtime.exceptionThrown') {
            console.error('[EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
          }
        };

        console.log('Navigating to https://gdgsru.pages.dev/ ...');
        await send('Page.navigate', { url: 'https://gdgsru.pages.dev/' });

        // Wait 5 seconds
        await new Promise(r => setTimeout(r, 5000));

        const evalRes = await send('Runtime.evaluate', {
          expression: `({
            url: window.location.href,
            title: document.title,
            announcementEl: !!document.getElementById('gdg-announcement-bar'),
            announcementHtml: document.getElementById('gdg-announcement-bar')?.outerHTML,
            announcementVisible: document.getElementById('gdg-announcement-bar') ? !document.getElementById('gdg-announcement-bar').hidden : false,
            header: !!document.getElementById('hd'),
            siteDefaults: typeof window.GDG_SITE_DEFAULTS !== 'undefined',
            announcementBarInDefaults: window.GDG_SITE_DEFAULTS?.announcementBar,
            configLoaderReady: window.__GDG_CONFIG_LOADER_READY__,
            supabaseLoaded: typeof window.supabase !== 'undefined',
            localStorageDismissed: localStorage.getItem('gdg_announcement_dismissed_id')
          })`,
          returnByValue: true
        });

        console.log('Evaluation result:\n', JSON.stringify(evalRes.result.value, null, 2));

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
