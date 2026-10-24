const fs = require('fs');
const path = require('path');

// 1. Update card-system.js
const cardSystemPath = 'cloudflare-pages-site/assets/js/card-system.js';
let cs = fs.readFileSync(cardSystemPath, 'utf8');

// Update track function signature and body to include idx
cs = cs.replace(
  'function track(k,title,text){',
  'function track(k,title,text,idx){'
);

cs = cs.replace(
  'var ACT=[["Events","/events/",CAL],["Resources","/resources/",BOOK],["Join","/join/",USERS]];',
  'var ACT=[["Events","/events/",CAL],["Resources","/resources/",BOOK],["Join","/join/",USERS]];'
);

cs = cs.replace(
  '<div class="g16-tl-bottom"><div class="g16-tl-acts">',
  '<div class="g16-tl-bottom"><span class="g16-tl-num">0\'+((idx||0)+1)+\'</span><div class="g16-tl-acts">'
);

// Update trackRow to pass index i
cs = cs.replace(
  'function trackRow(list){return \'<div class="g16-row">\'+list.map(function(t){return track(t[0],t[1],t[2])}).join("")+\'</div>\'}',
  'function trackRow(list){return \'<div class="g16-row">\'+list.map(function(t,i){return track(t[0],t[1],t[2],i)}).join("")+\'</div>\'}'
);

// Also make entire track card clickable to /join/ or track link
// We keep <a class="g16-tl-card" or keep div

fs.writeFileSync(cardSystemPath, cs);
console.log('card-system.js updated with track indexing!');
