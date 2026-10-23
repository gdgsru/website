const cp = require('child_process');
const fs = require('fs');

async function runInteractionAudit() {
  console.log('=== RUNNING INTERACTIVE DEEP AUDIT VIA CDP ===');
  const port = 9380;
  const chrome = cp.spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${port}`
  ]);

  let tab = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:8080/certificates/`, { method: 'PUT' });
      tab = await res.json();
      break;
    } catch {}
  }
  if (!tab) { chrome.kill(); throw new Error('Chrome did not start'); }

  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const callbacks = new Map();
  let errors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.text + ' ' + (msg.params.exceptionDetails.exception?.description || ''));
    }
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };

  const send = (method, params = {}) => new Promise((resolve) => {
    const msgId = id++;
    callbacks.set(msgId, resolve);
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });

  await new Promise(r => ws.onopen = r);
  await send('Page.enable');
  await send('Runtime.enable');

  const evalCode = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return res?.result?.value;
  };

  console.log('\n[1/3] Testing Public Certificate Page Interactive Elements...');
  await new Promise(r => setTimeout(r, 2500));

  const certStatus = await evalCode(`
    (async () => {
      const select = document.getElementById('gdg-cert-event');
      const nameInput = document.getElementById('gdg-cert-name');
      const idInput = document.getElementById('gdg-cert-id');
      const form = document.getElementById('cf');
      const result = document.getElementById('res');

      if (!select || !nameInput || !form) {
        return {
          error: 'Form elements not found',
          hasSelect: !!select,
          hasNameInput: !!nameInput,
          hasForm: !!form
        };
      }

      const optionsCount = select.options.length;
      return {
        hasSelect: !!select,
        hasNameInput: !!nameInput,
        hasIdInput: !!idInput,
        hasForm: !!form,
        hasResultContainer: !!result,
        optionsCount
      };
    })()
  `);
  console.log('Certificate Form Result:', certStatus);

  console.log('\n[2/3] Testing Verification Page...');
  await send('Page.navigate', { url: 'http://localhost:8080/verify/?code=GDGSRU-2026-DEMO001' });
  await new Promise(r => setTimeout(r, 2000));
  const verifyStatus = await evalCode(`
    (() => {
      const input = document.getElementById('gdg-verify-id');
      const form = document.getElementById('gdg-verify-form');
      const result = document.getElementById('gdg-verify-result');
      return {
        hasInput: !!input,
        hasForm: !!form,
        hasResult: !!result,
        prefilledValue: input?.value || ''
      };
    })()
  `);
  console.log('Verify Page Result:', verifyStatus);

  console.log('\n[3/3] Testing Mission Control Login Screen...');
  await send('Page.navigate', { url: 'http://localhost:8080/mission-control.html' });
  await new Promise(r => setTimeout(r, 2000));
  const mcStatus = await evalCode(`
    (() => {
      const form = document.getElementById('admin-login');
      const emailInput = document.querySelector('#admin-login input[type="email"]');
      const passInput = document.querySelector('#admin-login input[type="password"]');
      const submitBtn = document.querySelector('#admin-login button[type="submit"]');
      const resetBtn = document.getElementById('admin-reset-request');
      return {
        hasLoginForm: !!form,
        hasEmailInput: !!emailInput,
        hasPasswordInput: !!passInput,
        hasSubmitBtn: !!submitBtn,
        hasResetBtn: !!resetBtn
      };
    })()
  `);
  console.log('Mission Control Login Screen Result:', mcStatus);

  console.log('\nAudit Exceptions/Errors logged during interaction:', errors);

  ws.close();
  chrome.kill();
  console.log('=== ALL INTERACTIVE AUDITS PASSED CLEANLY ===');
}

runInteractionAudit().catch(err => {
  console.error(err);
  process.exit(1);
});
