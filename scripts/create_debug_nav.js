const { spawnSync } = require('child_process');

// Run headless Chrome and evaluate computed styles of .top-nav, .brand-logo, .nav-actions
const htmlUrl = 'file:///d:/Drafts/Blogs/website/cloudflare-pages-site/member-badge/index.html';

const script = `
const nav = document.querySelector('.top-nav');
const logo = document.querySelector('.brand-logo');
const actions = document.querySelector('.nav-actions');
console.log('BODY width:', document.body.clientWidth);
console.log('NAV width:', nav.offsetWidth, 'scrollWidth:', nav.scrollWidth);
console.log('LOGO width:', logo.offsetWidth);
console.log('ACTIONS width:', actions.offsetWidth, 'children:', actions.children.length);
Array.from(actions.children).forEach(c => console.log('ACTION BTN:', c.className, c.offsetWidth, c.textContent.trim()));
`;

fs = require('fs');
fs.writeFileSync('scripts/debug_nav.js', script);
console.log('debug script written');
