const { spawnSync } = require('child_process');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlUrl = 'file:///C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_fix_preview.html';
const outPath = 'C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\mobile_fix_preview.png';

console.log('Capturing screenshot...');
const res = spawnSync(chromePath, [
  '--headless=new',
  '--screenshot=' + outPath,
  '--window-size=390,844',
  '--hide-scrollbars',
  htmlUrl
]);

console.log('Done, exit code:', res.status);
