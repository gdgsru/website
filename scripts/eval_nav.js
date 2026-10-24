const { spawnSync } = require('child_process');

// Run node script to evaluate innerWidth and element positions
const res = spawnSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  '--window-size=390,200',
  '--dump-dom',
  'file:///C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html'
]);
