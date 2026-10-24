const fs = require('fs');
const css = fs.readFileSync('cloudflare-pages-site/assets/css/page-events.css', 'utf8');
const matches = css.match(/\.g16-tk[^{]*\{[^}]*\}/g) || [];
console.log('Total rules:', matches.length);
matches.slice(0, 30).forEach(m => console.log(m));
