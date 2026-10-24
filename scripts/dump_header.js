const { spawnSync } = require('child_process');

const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=390,844',
  '--dump-dom',
  'file:///d:/Drafts/Blogs/website/cloudflare-pages-site/member-badge/index.html'
]);

const dom = res.stdout.toString('utf8');
const headerMatch = dom.match(/<header[\s\S]+?<\/header>/);
console.log(headerMatch ? headerMatch[0] : 'Header not found');
