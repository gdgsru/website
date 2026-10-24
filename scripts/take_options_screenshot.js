const { spawnSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlUrl = 'file:///C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_options_preview.html';
const outPath = 'C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\mobile_options_preview.png';

const res = spawnSync(chromePath, [
  '--headless=new',
  '--screenshot=' + outPath,
  '--window-size=390,750',
  '--hide-scrollbars',
  htmlUrl
]);

console.log('Done, exit code:', res.status);
