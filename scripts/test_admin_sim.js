const fs = require('fs');
const code = fs.readFileSync('cloudflare-pages-site/assets/admin/certificates-admin.js', 'utf8');

function makeElem(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    value: '',
    textContent: '',
    innerHTML: '',
    style: { setProperty: () => {} },
    dataset: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    children: [],
    addEventListener: () => {},
    removeEventListener: () => {},
    setAttribute: () => {},
    getAttribute: () => null,
    appendChild: (c) => el.children.push(c),
    querySelector: (sel) => makeElem('div'),
    querySelectorAll: (sel) => [],
    getBoundingClientRect: () => ({ width: 1123, height: 794, clientWidth: 1123, clientHeight: 794 }),
    elements: { id: { value: '' }, name: { value: '' }, is_active: { checked: false } }
  };
  return el;
}

global.window = global;
global.window.addEventListener = () => {};
global.window.removeEventListener = () => {};
global.document = {
  head: makeElem('head'),
  body: makeElem('body'),
  createElement: makeElem,
  getElementById: (id) => makeElem('div'),
  querySelector: (sel) => makeElem('div'),
  querySelectorAll: (sel) => []
};

eval(code);

const mockSb = {
  from: (table) => ({
    select: () => ({
      order: () => ({
        limit: () => Promise.resolve({ data: [] }),
        range: () => Promise.resolve({ data: [] })
      }),
      eq: () => ({
        range: () => Promise.resolve({ data: [] }),
        maybeSingle: () => Promise.resolve({ data: null })
      }),
      then: (fn) => Promise.resolve({ data: [] }).then(fn)
    })
  })
};

const ctx = {
  sb: mockSb,
  $: (sel) => makeElem('div'),
  $$: (sel) => [],
  setWorkspace: (title, html) => {},
  adminMessage: (msg) => console.log('AdminMsg:', msg),
  authErrorText: (e) => String(e),
  audit: () => Promise.resolve(),
  msg: (t) => t,
  adminUser: { email: 'admin@sru.edu.in' }
};

window.GDGCertAdmin.renderCertificates(ctx).then(() => {
  console.log('renderCertificates completed successfully with 0 errors!');
  return window.GDGCertAdmin.renderAttendance(ctx);
}).then(() => {
  console.log('renderAttendance completed successfully with 0 errors!');
}).catch(err => {
  console.error('Test failed:', err);
});
