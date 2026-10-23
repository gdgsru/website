const fs = require('fs');
const path = require('path');

const jsDir = path.join(__dirname, 'site', 'assets', 'js');
const files = [
  'card-system.js',
  'app.js',
  'config-loader.js',
  'leaderboard.js'
];

// Mock realistic DOM for browser load
const storage = {};
global.localStorage = {
  getItem: k => storage[k] || null,
  setItem: (k, v) => storage[k] = v,
  removeItem: k => delete storage[k]
};
global.sessionStorage = {
  getItem: () => null,
  removeItem: () => {}
};
global.window = global;
global.window.GDG_MULTIPAGE = true;
global.window.location = {
  href: 'http://localhost:8080/leaderboard/',
  pathname: '/leaderboard/',
  hash: '',
  search: '',
  replaceState: () => {},
  assign: () => {}
};

const appEl = {
  id: 'app',
  innerHTML: '',
  addEventListener: () => {},
  appendChild: () => {},
  querySelectorAll: () => [],
  querySelector: () => null
};

const domElements = {
  app: appEl,
  board: { innerHTML: '', querySelectorAll: () => [], querySelector: () => null, classList: { add: ()=>{}, remove: ()=>{} } },
  stats: { innerHTML: '', querySelectorAll: () => [] },
  seg: { innerHTML: '', querySelectorAll: () => [] },
  q: { value: '', addEventListener: () => {} },
  me: { innerHTML: '', addEventListener: () => {}, querySelectorAll: () => [], style: { setProperty: ()=>{} }, classList: { add: ()=>{}, remove: ()=>{} } },
  toast: { innerHTML: '', classList: { add: ()=>{}, remove: ()=>{} } }
};

global.document = {
  readyState: 'complete',
  documentElement: {
    dataset: { pt: '', theme: 'dark' },
    classList: { add: () => {}, remove: () => {} },
    style: { setProperty: () => {} }
  },
  body: {
    dataset: { route: 'leaderboard', multipage: 'true' },
    appendChild: () => {}
  },
  head: {
    appendChild: () => {}
  },
  getElementById: (id) => domElements[id] || { innerHTML: '', querySelectorAll: () => [], addEventListener: () => {} },
  querySelector: (sel) => {
    if (sel === '#app') return appEl;
    if (sel.startsWith('#')) return domElements[sel.slice(1)] || null;
    return null;
  },
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    style: { setProperty: () => {} },
    classList: { add: () => {}, remove: () => {} },
    appendChild: () => {},
    addEventListener: () => {}
  })
};

global.matchMedia = () => ({ matches: false });
global.performance = { now: () => 100 };
global.requestAnimationFrame = (cb) => setTimeout(cb, 0);
global.MutationObserver = class {
  observe() {}
  disconnect() {}
};

for (const f of files) {
  try {
    const code = fs.readFileSync(path.join(jsDir, f), 'utf8');
    eval(code);
    console.log(`[PASS] ${f} executed without error`);
  } catch (err) {
    console.error(`[FAIL] ${f} threw error:`, err);
  }
}

console.log('Final #app innerHTML length:', appEl.innerHTML.length);
console.log('#app snippet:', appEl.innerHTML.slice(0, 300));
