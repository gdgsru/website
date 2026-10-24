const fs = require('fs');

// Check the events page HTML
const eventsHtml = fs.readFileSync('cloudflare-pages-site/events/index.html', 'utf8');
console.log('Events HTML loaded, length:', eventsHtml.length);
