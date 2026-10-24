const fs = require('fs');

// Mock window and document to load card-system.js in node
global.window = {};
global.document = {
  head: { appendChild: () => {} },
  getElementById: () => null,
  createElement: () => ({ id: '', textContent: '' }),
  addEventListener: () => {},
  querySelectorAll: () => []
};
global.matchMedia = () => ({ matches: false });

require('../cloudflare-pages-site/assets/js/card-system.js');
const GDG16 = global.window.GDG16;

const cardsHtml = `
  <div class="g16-row event-format-grid">
    ${GDG16.info({ key: 'b', icon: 'code', num: '01', title: 'Workshops', text: 'Hands-on sessions that walk through a tool or concept, one practical step at a time.' })}
    ${GDG16.info({ key: 'r', icon: 'mic', num: '02', title: 'Tech talks', text: 'Fresh perspectives from builders, researchers, alumni, and people working in tech.' })}
    ${GDG16.info({ key: 'y', icon: 'chat', num: '03', title: 'Study jams', text: 'Focused group learning with small goals, shared notes, and time to ask questions.' })}
    ${GDG16.info({ key: 'g', icon: 'bolt', num: '04', title: 'Build sessions', text: 'Bring an idea, find collaborators, and turn a rough prototype into a working demo.' })}
  </div>
`;

const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mobile Bento Test</title>
<link rel="stylesheet" href="../cloudflare-pages-site/assets/fonts/fonts.css">
<link rel="stylesheet" href="../cloudflare-pages-site/assets/css/page-events.css">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #fdfdfd;
    padding: 20px 16px;
    font-family: "Google Sans Flex", "Google Sans", system-ui, sans-serif;
  }
  .sec-cap {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #5f6368;
    margin-bottom: 4px;
  }
  h2 { font-size: 22px; font-weight: 800; margin-bottom: 6px; color: #111b2e; }
  .lead { font-size: 13px; color: #5f6368; margin-bottom: 16px; line-height: 1.4; }

  @media (max-width: 680px) {
    .g16-row,
    .event-format-grid,
    .event-format-grid.g16-row,
    .editorial-grid.g16-row,
    .grid.g16-row,
    #home-tracks .g16-row {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 10px !important;
      justify-items: stretch !important;
      align-items: stretch !important;
      width: 100% !important;
      max-width: 100% !important;
      margin-top: 14px !important;
    }
    .g16-tl,
    .g16-tl.g16-tl-info,
    .grid > .g16-tl,
    .g16-row > .g16-tl {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
      margin: 0 !important;
      display: flex !important;
    }
    .g16-tl-card,
    .g16-tl-info .g16-tl-card,
    .g16-tl-info.g16-long .g16-tl-card {
      min-height: 145px !important;
      height: 100% !important;
      border-radius: 18px !important;
      padding: 12px !important;
      overflow: hidden !important;
      box-shadow: 0 4px 14px rgba(17, 27, 46, 0.08) !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      position: relative !important;
    }
    .g16-tl-glass {
      position: relative !important;
      inset: auto !important;
      height: 100% !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
      pointer-events: auto !important;
      min-width: 0 !important;
    }
    .g16-tl-bottom {
      position: static !important;
      inset: auto !important;
      order: -1 !important;
      margin-bottom: 8px !important;
      display: flex !important;
      justify-content: flex-start !important;
      gap: 6px !important;
    }
    .g16-tl-num {
      min-width: 24px !important;
      height: 20px !important;
      font-size: 9.5px !important;
      font-weight: 800 !important;
      padding: 0 6px !important;
      border-radius: 99px !important;
      box-shadow: none !important;
      line-height: 20px !important;
    }
    .g16-tl-content {
      position: static !important;
      inset: auto !important;
      display: flex !important;
      flex-direction: column !important;
      min-width: 0 !important;
    }
    .g16-tl-title {
      font-size: 14.5px !important;
      line-height: 1.2 !important;
      font-weight: 800 !important;
      letter-spacing: -0.02em !important;
      color: #111b2e !important;
      word-break: break-word !important;
    }
    :root[data-theme="dark"] .g16-tl-title {
      color: #ffffff !important;
    }
    .g16-tl-text {
      font-size: 10.5px !important;
      line-height: 1.35 !important;
      margin-top: 4px !important;
      color: #5f6368 !important;
      display: -webkit-box !important;
      -webkit-line-clamp: 2 !important;
      -webkit-box-orient: vertical !important;
      overflow: hidden !important;
    }
    :root[data-theme="dark"] .g16-tl-text {
      color: rgba(255, 255, 255, 0.68) !important;
    }
    .g16-tl-logo {
      position: absolute !important;
      top: 10px !important;
      right: 10px !important;
      width: 28px !important;
      height: 28px !important;
      margin: 0 !important;
      transform: none !important;
    }
    .g16-tl-c1, .g16-tl-c2, .g16-tl-c3, .g16-tl-c4 {
      display: none !important;
    }
    .g16-tl-c5 {
      position: relative !important;
      inset: auto !important;
      width: 28px !important;
      height: 28px !important;
      margin: 0 !important;
      display: grid !important;
      place-content: center !important;
      border-radius: 50% !important;
      box-shadow: 0 0 10px color-mix(in srgb, var(--a) 60%, transparent) !important;
    }
    .g16-tl-c5 svg {
      width: 14px !important;
      height: 14px !important;
    }
    .g16-row > .g16-tl:nth-child(3):last-child {
      grid-column: 1 / -1 !important;
    }
  }
</style>
</head>
<body>
  <div class="sec-cap">WAYS TO TAKE PART</div>
  <h2>Learn by doing.</h2>
  <p class="lead">Different formats, same idea: leave with something you understand better.</p>
  ${cardsHtml}
</body>
</html>`;

fs.writeFileSync('scripts/test_bento.html', fullHtml);
console.log('Generated test_bento.html successfully!');
