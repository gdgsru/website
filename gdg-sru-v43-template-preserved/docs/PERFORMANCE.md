# GDG SRU website — performance optimization

## High-impact, quality-preserving changes

- Moved embedded images to independent files without changing bytes: 18 team portraits, four team-icon images, loader logo, and campus illustration (24 assets in total).
- Kept image pixels identical: SHA-256 comparison of the payloads from the previous batch HTML and extracted assets matched all 24 payloads. No lossy recompression or image downscaling was performed.
- Reduced homepage HTML from 1,561,367 bytes to 581,297 bytes (62.8% smaller). Static images can now be cached independently and requested only when their relevant route/component needs them.
- Added preload hints for the loader logo and campus illustration.
- Removed the duplicate font stylesheet request; the remaining Google Fonts stylesheet is non-render-blocking with `display=swap` to avoid making first paint wait for remote font CSS.
- Revalidated HTML on each visit, set a short cache for unhashed JS/CSS/config, and a one-hour cache for separate static artwork using Cloudflare Pages `_headers`.

## Visual-quality guarantee scope

This optimization pass does not lower image quality, image dimensions, particle count, animation frame rate, card effects, font choices, or other visual settings. The only visual changes present are the design changes requested in the preceding batch: smaller cards, warmer palette, smaller Featured Event, removal of floating icons, shorter intro, and viewport-triggered lotus bloom.

## Validation

- 24/24 embedded image payloads match extracted asset files byte-for-byte.
- All root-relative `/assets/` references exist.
- Main app/loader JavaScript and extracted executable inline scripts passed `node --check`.
- ZIP integrity check passed.
- Browser screenshot comparison and Lighthouse testing were not available in this environment; do not interpret the HTML-size reduction as a verified live-load metric.

## Pass 2 — zero-visual-change speedups

- Preloaded the four most-used Google Sans Flex weights (400/600/700/800) so text no longer waits for CSS to discover the fonts (fonts use `font-display:block`).
- Preconnected to cdn.jsdelivr.net and preloaded the Supabase script so it downloads in parallel with CSS instead of after it. Script order/blocking behaviour is unchanged.
- Removed a duplicate `fonts.css` request on `/team/`.
- Lossless PNG recompression (oxipng): gdg-logo 33.2→20.9 KB, loader logo 19.0→5.9 KB, SRU wordmarks 4.2/4.6→2.0 KB each. Pixel data verified identical.
- Countdown timer (`gdg-v16.js`) no longer rewrites the DOM every second while the tab is hidden; it refreshes immediately when the tab becomes visible.
- Cache rules: fonts are now `immutable` for one year; images/brand art cached 7 days with stale-while-revalidate; JS/CSS stay at 1 hour so releases propagate. Rules do not overlap (Cloudflare merges duplicate headers).

## Pass 3 — scripts and CSS bundles

- `card-system`, `app`, `config-loader`, `effects` are `defer`; the blocking supabase-js tag is gone and `config-loader.js` loads it in parallel with `config.js`.
- CSS: one generated bundle per route instead of 10-11 requests. Raw size: home 629 → 369 KB, most inner pages 625 → ~363 KB, team 625 → 490 KB. Source in `css-src/`, built by `scripts/build-css.py`.
- Measured with headless Chromium, 4x CPU and slow-4G throttling, home page, median of 3 (not Lighthouse):

| | FCP before → after | LCP before → after | requests | transferred |
|---|---|---|---|---|
| Uncompressed server | 6.3 s → 4.7 s | 7.2 s → 4.7 s | 40 → 30 | 1,356 → 1,094 KB |
| gzip server | 2.6 s → 2.0 s | 3.3 s → 3.4 s (run-to-run range 2.8-4.5 s) | 41 → 31 | 843 → 785 KB |

- With compression the LCP change is within noise. Re-measure with Lighthouse on the deployed Cloudflare URL.
- Verification: computed styles for all elements, both themes, desktop, compared old vs new on 10 pages (11 pages were built); open-menu state and 40 hover targets on team/events. Remaining differences also appear when the old build is compared with itself (scroll-reveal timing, pointer-tilt jitter). Not tested: mobile viewport comparison, live Supabase data, the home page against a second old run.
- Not done: the home page is still rendered by `app.js` at runtime (`<main id="app">` is empty in the HTML); pre-rendering it is the main remaining first-paint win.
