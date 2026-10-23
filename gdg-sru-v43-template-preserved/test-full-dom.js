const fs = require('fs');
const path = require('path');

// Read app.js P.leaderboard string
const appJs = fs.readFileSync(path.join(__dirname, 'site', 'assets', 'js', 'app.js'), 'utf8');
const lbStart = appJs.indexOf('leaderboard:()=>{');
const lbEnd = appJs.indexOf(',perks:()=>', lbStart);
const fnStr = appJs.slice(lbStart + 'leaderboard:'.length, lbEnd);
const pLeaderboard = eval('(' + fnStr + ')');
const initialHtml = pLeaderboard();

console.log('Initial HTML returned by P.leaderboard():');
console.log(initialHtml);
