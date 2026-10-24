const { spawnSync } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const htmlUrl = 'file:///d:/Drafts/Blogs/website/cloudflare-pages-site/member-badge/index.html';
const outPath = 'C:\\Users\\Narayan Bora\\.gemini\\antigravity\\brain\\88b431b3-07a3-41f7-bed6-96a805f27d93\\member_badge_mobile_after.png';

spawnSync(chromePath, [
  '--headless=new',
  '--screenshot=' + outPath,
  '--window-size=390,844',
  '--hide-scrollbars',
  htmlUrl
]);

console.log('Saved after screenshot to', outPath);
