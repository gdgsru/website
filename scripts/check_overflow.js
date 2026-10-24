const { spawnSync } = require('child_process');

const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=390,844',
  '--run-all-compositor-stages-before-draw',
  '--virtual-time-budget=1000',
  'file:///d:/Drafts/Blogs/website/cloudflare-pages-site/member-badge/index.html'
]);

// Let's write a small script that opens CDP or runs an evaluation
console.log('done');
