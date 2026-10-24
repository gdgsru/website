const fs = require('fs');

const csPath = 'cloudflare-pages-site/assets/js/card-system.js';
let lines = fs.readFileSync(csPath, 'utf8').split('\n');

// 1. Update line with track definition
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('function track(k,title,text){')) {
    lines[i] = lines[i].replace('function track(k,title,text){', 'function track(k,title,text,idx){');
  }
  if (lines[i].includes('<div class="g16-tl-bottom"><div class="g16-tl-acts">')) {
    lines[i] = lines[i].replace(
      '<div class="g16-tl-bottom"><div class="g16-tl-acts">',
      '<div class="g16-tl-bottom"><span class="g16-tl-num">0\'+((idx||0)+1)+\'</span><div class="g16-tl-acts">'
    );
  }
  if (lines[i].includes('function trackRow(list){return \'<div class="g16-row">\'+list.map(function(t){return track(t[0],t[1],t[2])}')) {
    lines[i] = lines[i].replace(
      'function(t){return track(t[0],t[1],t[2])}',
      'function(t,i){return track(t[0],t[1],t[2],i)}'
    );
  }
}

// 2. Add style injection directly with template literal or clean string
const mobileCss = [
  '.g16-tk-badge.live{background:#ea4335!important;color:#fff!important;display:inline-flex;align-items:center;gap:5px;font-weight:700}',
  '.g16-live-dot{width:6px;height:6px;border-radius:50%;background:#fff;display:inline-block;animation:g16LivePulse 1.4s ease-in-out infinite}',
  '@keyframes g16LivePulse{0%,100%{transform:scale(0.85);opacity:1}50%{transform:scale(1.35);opacity:0.4}}',
  '.g16-tk-btn.g16-tk-live{background:#ea4335!important;color:#fff!important;border-color:#ea4335!important;animation:g16BtnPulse 2.5s infinite}',
  '@keyframes g16BtnPulse{0%,100%{box-shadow:0 0 0 0 rgba(234,67,53,0.4)}50%{box-shadow:0 0 0 6px rgba(234,67,53,0)}}',
  '.g16-tk-live-bar{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;font-weight:600;color:#ea4335}',
  '.g16-tk-live-bar small{font:700 9.5px/1 var(--f-mono,monospace);text-transform:uppercase;color:var(--mut)}',
  '@media(max-width:680px){',
  '.g16-row,.event-format-grid,.event-format-grid.g16-row,.grid.g16-row,#home-tracks .g16-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;justify-items:stretch!important;align-items:stretch!important;width:100%!important;max-width:100%!important;margin-top:14px!important}',
  '.g16-row.g16-tickets,[data-runtime-events],.editorial-grid.g16-row.g16-tickets,.editorial-grid.g16-row[data-runtime-events]{display:grid!important;grid-template-columns:1fr!important;gap:14px!important;width:100%!important}',
  '.g16-tl,.g16-tl.g16-tl-info,.grid>.g16-tl,.g16-row>.g16-tl{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;display:flex!important}',
  '.g16-tl-card,.g16-tl-info .g16-tl-card,.g16-tl-info.g16-long .g16-tl-card,.g16-pkcard .g16-tl-card{min-height:135px!important;height:100%!important;border-radius:18px!important;padding:12px!important;overflow:hidden!important;box-shadow:0 4px 14px rgba(17,27,46,0.08)!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;position:relative!important}',
  '.g16-tl-glass{position:relative!important;inset:auto!important;height:100%!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;pointer-events:auto!important;min-width:0!important}',
  '.g16-tl-bottom{position:static!important;inset:auto!important;order:-1!important;margin-bottom:8px!important;display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:6px!important}',
  '.g16-tl .g16-tl-acts,.g16-tl:not(.g16-tl-info) .g16-tl-more{display:none!important}',
  '.g16-tl-num{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:24px!important;height:20px!important;font-size:9.5px!important;font-weight:800!important;padding:0 6px!important;border-radius:99px!important;box-shadow:none!important;line-height:20px!important;background:rgba(255,255,255,0.85)!important;color:#1f1f23!important}',
  ':root[data-theme="dark"] .g16-tl-num{background:rgba(255,255,255,0.15)!important;color:#ffffff!important}',
  '.g16-tl-content{position:static!important;inset:auto!important;display:flex!important;flex-direction:column!important;min-width:0!important}',
  '.g16-tl-title{font-size:14.5px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:-0.02em!important;color:#111b2e!important;word-break:break-word!important}',
  ':root[data-theme="dark"] .g16-tl-title{color:#ffffff!important}',
  '.g16-tl-text{font-size:10.5px!important;line-height:1.35!important;margin-top:4px!important;color:#5f6368!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}',
  ':root[data-theme="dark"] .g16-tl-text{color:rgba(255,255,255,0.68)!important}',
  '.g16-tl-logo{position:absolute!important;top:10px!important;right:10px!important;width:28px!important;height:28px!important;margin:0!important;transform:none!important}',
  '.g16-tl-c1,.g16-tl-c2,.g16-tl-c3,.g16-tl-c4{display:none!important}',
  '.g16-tl-c5{position:relative!important;inset:auto!important;width:28px!important;height:28px!important;margin:0!important;display:grid!important;place-content:center!important;border-radius:50%!important;box-shadow:0 0 10px color-mix(in srgb,var(--a) 60%,transparent)!important}',
  '.g16-tl-c5 svg{width:14px!important;height:14px!important}',
  '.g16-tl-more{font-size:10px!important;padding:3px 8px!important;margin-left:auto!important;border-radius:99px!important}',
  '.g16-row>.g16-tl:nth-child(3):last-child{grid-column:1/-1!important}',
  '.g16-tk,.g16-pgm-card{grid-column:1/-1!important;width:100%!important;max-width:100%!important;display:block!important;margin:0!important}',
  '.g16-tk-card{display:grid!important;grid-template-columns:minmax(0,1fr) 100px!important;border-radius:18px!important;min-height:145px!important;width:100%!important;overflow:hidden!important;box-shadow:0 4px 16px rgba(17,27,46,0.08)!important}',
  '.g16-tk-main{padding:13px 10px 13px 14px!important;gap:4px!important;min-width:0!important;border-radius:18px 0 0 18px!important}',
  '.g16-tk-main h3{font-size:16px!important;line-height:1.2!important;letter-spacing:-0.02em!important;white-space:normal!important;margin:2px 0!important}',
  '.g16-tk-main p{font-size:11px!important;line-height:1.3!important}',
  '.g16-tk-meta{margin-bottom:2px!important;gap:6px!important}',
  '.g16-tk-kind{font-size:9.5px!important;padding:2px 7px!important}',
  '.g16-tk-speaker{margin:2px 0!important;font-size:11px!important}',
  '.g16-tk-speaker small{font-size:8px!important}',
  '.g16-tk-live-bar{margin-top:2px!important;gap:5px!important}',
  '.g16-tk-live-bar small{font-size:8px!important}',
  '.g16-tk-cd{gap:2.5px!important}',
  '.g16-tk-cd span{padding:2px 4px!important;font-size:7.5px!important;border-radius:4px!important;max-width:none!important}',
  '.g16-tk-cd b{font-size:11.5px!important;line-height:1!important}',
  '.g16-tk-img{max-height:40px!important;width:auto!important;border-radius:6px!important}',
  '.g16-tk-stub{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;padding:10px 4px!important;border-radius:0 18px 18px 0!important;text-align:center!important}',
  '.g16-tk-d{font-size:30px!important;line-height:0.92!important}',
  '.g16-tk-m{font-size:10.5px!important;letter-spacing:0.1em!important}',
  '.g16-tk-btn{padding:5px 9px!important;font-size:10.5px!important;white-space:nowrap!important;margin-top:3px!important}',
  '.g16-tk-no{font-size:8.5px!important}',
  '}',
  '@media(min-width:681px){.g16-tl:not(.g16-tl-info) .g16-tl-num{display:none!important}}'
].join('');

for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('st.textContent =')) {
    // replace lines[i] and possibly lines[i+1]
    lines[i] = '    st.textContent = ' + JSON.stringify(mobileCss) + ';';
    if (lines[i+1] && lines[i+1].includes('@media')) {
      lines[i+1] = '';
    }
    break;
  }
}

fs.writeFileSync(csPath, lines.filter(Boolean).join('\n'));
console.log('card-system.js cleanly updated!');
