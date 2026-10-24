const { spawnSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlUrl = 'file:///C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html';
const outPath = 'C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\nav_test.png';

const res = spawnSync(chromePath, [
  '--headless=new',
  '--screenshot=' + outPath,
  '--window-size=390,200',
  '--hide-scrollbars',
  htmlUrl
]);

console.log('Saved nav_test.png, exit code:', res.status);
