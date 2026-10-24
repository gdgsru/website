const fs = require('fs');
const css = fs.readFileSync('cloudflare-pages-site/assets/css/page-events.css', 'utf8');
const mediaMatches = css.match(/@media[^{]+\{([\s\S]+?\}\s*\})/g) || [];
mediaMatches.forEach(m => {
  if (m.includes('g16-tk')) {
    console.log('MATCH:', m.slice(0, 500));
  }
});
console.log('Done searching media queries');
