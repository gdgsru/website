const { spawnSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlUrl = 'file:///C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_perfect_preview.html';
const outPath = 'C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\mobile_perfect_preview.png';

spawnSync(chromePath, [
  '--headless=new',
  '--screenshot=' + outPath,
  '--window-size=412,820',
  '--hide-scrollbars',
  htmlUrl
]);

console.log('Captured with 412 width');
