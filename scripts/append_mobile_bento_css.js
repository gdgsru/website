const fs = require('fs');

const cssRule = `

/* GDG SRU · Mobile 2x2 Bento Grid for Info & Track Cards */
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
  .g16-tl-info.g16-long .g16-tl-card,
  .g16-pkcard .g16-tl-card {
    min-height: 140px !important;
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
    align-items: center !important;
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
  .g16-tl-more {
    font-size: 10px !important;
    padding: 3px 8px !important;
    margin-left: auto !important;
    border-radius: 99px !important;
  }
  .g16-row > .g16-tl:nth-child(3):last-child {
    grid-column: 1 / -1 !important;
  }
}
`;

const targets = [
  'cloudflare-pages-site/assets/css/page-events.css',
  'cloudflare-pages-site/assets/css/page-home.css',
  'cloudflare-pages-site/assets/css/page-certificates.css',
  'cloudflare-pages-site/assets/css/page-blogs.css',
  'cloudflare-pages-site/assets/css/page-join.css',
  'cloudflare-pages-site/assets/css/page-perks.css'
];

for (const file of targets) {
  if (fs.existsSync(file)) {
    fs.appendFileSync(file, cssRule);
    console.log(`Appended to ${file}`);
  }
}
console.log('Finished appending mobile bento CSS.');
