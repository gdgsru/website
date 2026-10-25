/* Easter egg triggers, loaded on every public page.
 * Each egg is detected from normal use of the site and recorded with GDGEggs.find(id).
 * Points are checked and entered by the team in Mission Control; this file never sends points.
 * Eggs 9 (Swipe Sprint) and 17 (Launch Hour) are not wired yet. */
(() => {
  'use strict';
  if (window.__GDG_EGG_TRIGGERS__) return;
  window.__GDG_EGG_TRIGGERS__ = true;

  const KEY = 'gdg-egg-found';
  const eggs = Array.isArray(window.GDG_EGGS) ? window.GDG_EGGS : [];
  const eggName = (id) => (eggs.find((e) => e.id === id) || {}).name || 'Easter egg';

  /* ---------- core store: used unless the hunt page has already provided its own ---------- */
  if (!window.GDGEggs) {
    const readFound = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
        return Array.isArray(raw) ? raw.filter(Number.isInteger) : [];
      } catch (e) { return []; }
    };
    let found = readFound();
    window.GDGEggs = {
      find(id) {
        const n = Number(id);
        if (!eggs.some((e) => e.id === n) || found.includes(n)) return false;
        found = [...found, n];
        try { localStorage.setItem(KEY, JSON.stringify(found)); } catch (e) { /* private mode */ }
        toast(`Egg found: ${eggName(n)}`);
        document.dispatchEvent(new CustomEvent('gdg-egg-found', { detail: { id: n } }));
        return true;
      },
      found: () => [...found],
      count: () => found.length,
      total: () => eggs.length
    };
  }

  const find = (id) => { try { return window.GDGEggs.find(id); } catch (e) { return false; } };

  /* ---------- helpers ---------- */
  const route = () => (document.body && document.body.dataset.route) || '';
  const isHome = () => route() === 'home';
  // Phones change their visible height when the address bar moves, so allow a margin.
  const atBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60;
  const pathNoSlash = () => location.pathname.replace(/\/+$/, '') || '/';
  const closest = (e, sel) => (e.target && e.target.closest) ? e.target.closest(sel) : null;

  // Calls onDone after `n` taps inside `windowMs`.
  function tapCounter(n, windowMs, onDone) {
    let times = [];
    return () => {
      const now = Date.now();
      times = times.filter((t) => now - t <= windowMs);
      times.push(now);
      if (times.length >= n) { times = []; onDone(); }
    };
  }

  /* ---------- styles for the toast and the two small footer additions ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .egg-toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--ink,#1f1f23);color:var(--bg,#fff);padding:12px 18px;border-radius:999px;font-weight:600;font-size:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);z-index:60;max-width:calc(100% - 32px);text-align:center;transition:opacity .4s ease}
    .egg-toast.out{opacity:0}
    .egg-dots{display:inline-flex;gap:8px;align-items:center;margin-left:12px;vertical-align:middle}
    .egg-dot{width:10px;height:10px;border-radius:50%;border:0;padding:0;cursor:pointer;opacity:.9}
    .egg-share{font:inherit;font-size:12px;background:none;border:1px solid currentColor;border-radius:999px;padding:4px 10px;margin-left:12px;color:inherit;opacity:.8;cursor:pointer}
    .egg-shake-btn{position:fixed;left:16px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:40;font-family:inherit;font-size:13px;font-weight:600;background:var(--ink,#1f1f23);color:var(--bg,#fff);border:0;border-radius:999px;padding:11px 16px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.2)}
    #hero-discord-btn,.hero-blue-word{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}
    @media (prefers-reduced-motion: reduce){.egg-toast{transition:none}}
  `;
  document.head.appendChild(style);

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'egg-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2200);
    setTimeout(() => el.remove(), 2700);
  }

  /* ---------- 1. Android Shake: turn on shake, then shake three times ---------- */
  function setupShake() {
    if (!isHome() || !('DeviceMotionEvent' in window)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'egg-shake-btn';
    btn.textContent = 'Turn on shake';
    btn.addEventListener('click', async () => {
      try {
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          const result = await DeviceMotionEvent.requestPermission();
          if (result !== 'granted') { btn.textContent = 'Motion access denied'; return; }
        }
      } catch (e) { btn.textContent = 'Shake not available'; return; }
      btn.textContent = 'Shake your phone';
      listenForShake(btn);
    });
    document.body.appendChild(btn);
  }

  function listenForShake(btn) {
    let spikes = [];
    let last = 0;
    const onMotion = (e) => {
      const a = e.accelerationIncludingGravity;
      if (!a) return;
      const mag = Math.sqrt((a.x || 0) ** 2 + (a.y || 0) ** 2 + (a.z || 0) ** 2);
      const now = Date.now();
      if (Math.abs(mag - 9.8) > 14 && now - last > 200) {
        last = now;
        spikes = spikes.filter((t) => now - t < 1500);
        spikes.push(now);
        if (spikes.length >= 3) {
          window.removeEventListener('devicemotion', onMotion);
          find(1);
          btn.remove();
        }
      }
    };
    window.addEventListener('devicemotion', onMotion, { passive: true });
  }

  /* ---------- 2. Inspect Element: five taps on the logo; the logo scrolls to top on home ---------- */
  const logoTaps = tapCounter(5, 2000, () => find(2));

  /* ---------- 3, 5, 12: long presses ---------- */
  let hold = null;
  let swallowNextClick = false;

  function startHold(egg, ms, x, y) {
    cancelHold();
    hold = {
      egg, x, y,
      timer: setTimeout(() => {
        find(egg);
        swallowNextClick = true;
        setTimeout(() => { swallowNextClick = false; }, 600);
        hold = null;
      }, ms)
    };
  }
  function cancelHold() {
    if (hold) { clearTimeout(hold.timer); hold = null; }
  }

  document.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    if (closest(e, '.hero-blue-word')) { startHold(3, 1500, e.clientX, e.clientY); return; }
    if (closest(e, '#hero-discord-btn')) { startHold(12, 2000, e.clientX, e.clientY); return; }
    if (isHome() && atBottom()) startHold(5, 2000, e.clientX, e.clientY);
  }, { passive: true });
  document.addEventListener('pointerup', cancelHold, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 24) cancelHold();
  }, { passive: true });
  // While a hold is running, stop text selection and the phone's long-press menu.
  // Do not cancel the hold here: Android sends contextmenu during a long press.
  document.addEventListener('selectstart', (e) => { if (hold) e.preventDefault(); }, true);
  document.addEventListener('contextmenu', (e) => { if (hold) e.preventDefault(); }, true);

  /* ---------- click-based eggs ---------- */
  const heroBuild = tapCounter(3, 1500, () => find(19));
  const heroLearn = tapCounter(3, 1500, () => find(25));
  const avatarTaps = tapCounter(3, 1500, () => find(23));

  // Four colours: tap blue, red, yellow, green in order (footer dots).
  const dotOrder = [0, 1, 2, 3];
  let dotSeq = [];
  // Context Switch: opened the Discord link, then came back within a minute.
  let discordOpenedAt = 0;

  document.addEventListener('click', (e) => {
    // Hold eggs: swallow the click that follows a completed long press.
    if (swallowNextClick && (closest(e, '.hero-blue-word') || closest(e, '#hero-discord-btn'))) {
      e.preventDefault();
      e.stopPropagation();
      swallowNextClick = false;
      return;
    }

    const logo = closest(e, 'a.lg');
    if (logo) {
      logoTaps();
      if (isHome()) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
    }

    if (closest(e, '.hero-proof-spark')) find(18);
    if (closest(e, '.home-hero-title > span:first-child')) heroBuild();
    if (closest(e, '.label-learn') || closest(e, '.home-hero-title > span:nth-child(2)')) heroLearn();
    if (closest(e, '.avatar-stack')) avatarTaps();

    const teamCard = closest(e, '.tm-card');
    if (teamCard && route() === 'team') {
      flippedCards.add(teamCard);
      if (flippedCards.size >= 3) find(8);
    }
    if (closest(e, '.tm-ecosystem-icon')) find(27);

    const dot = closest(e, '.egg-dot');
    if (dot) {
      const idx = Number(dot.dataset.i);
      if (idx === dotOrder[dotSeq.length]) {
        dotSeq = [...dotSeq, idx];
        if (dotSeq.length === dotOrder.length) { find(7); dotSeq = []; }
      } else {
        dotSeq = idx === dotOrder[0] ? [idx] : [];
      }
    }

    if (closest(e, '.egg-share')) {
      const data = { title: document.title, url: location.href };
      if (navigator.share) navigator.share(data).catch(() => {});
      else if (navigator.clipboard) navigator.clipboard.writeText(location.href).catch(() => {});
      find(15);
    }

    if (closest(e, '.discord-promo-cta') || closest(e, 'a[href*="discord.gg"]')) {
      discordOpenedAt = Date.now();
    }

    // Version Tap: two taps on the footer copyright line.
    const foot = closest(e, '.v18-foot');
    if (foot && e.target.children && e.target.children.length === 0 && (e.target.textContent || '').includes('©')) {
      versionTaps();
    }
  }, true);

  const flippedCards = new Set();
  const versionTaps = tapCounter(2, 1000, () => find(20));

  // Hello World and SRU: typing in the team search box.
  // The search box with "Find yourself" is on the Leaderboard page.
  document.addEventListener('input', (e) => {
    if (!e.target || !['q', 'tm-search'].includes(e.target.id)) return;
    if (route() !== 'leaderboard' && route() !== 'team') return;
    const v = (e.target.value || '').trim();
    if (v.toLowerCase() === 'hello') find(14);
    if (v.toUpperCase() === 'SRU') find(29);
  });

  // Dark Mode Toggle: switch theme five times within a minute.
  (() => {
    const themeTaps = tapCounter(5, 60000, () => find(13));
    let lastTheme = document.documentElement.dataset.theme || '';
    new MutationObserver(() => {
      const now = document.documentElement.dataset.theme || '';
      if (now !== lastTheme) { lastTheme = now; themeTaps(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  })();

  // Context Switch: return to the site after opening Discord.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !discordOpenedAt) return;
    if (Date.now() - discordOpenedAt <= 60000) find(28);
    discordOpenedAt = 0;
  });

  /* ---------- scroll-based eggs ---------- */
  let topAt = window.scrollY <= 5 ? Date.now() : 0; // Page Speed starts when the guest is at the top
  let pageSpeedDone = false;
  let blogDone = false;
  let privacyDone = false;

  // Loading Bar: scroll past halfway on any page, then back to the top.
  let passedHalf = false;
  window.addEventListener('scroll', () => {
    const range = document.documentElement.scrollHeight - window.innerHeight;
    if (range > 0 && window.scrollY >= range / 2) passedHalf = true;
    if (passedHalf && window.scrollY <= 5) { passedHalf = false; find(21); }
  }, { passive: true });

  window.addEventListener('scroll', () => {
    if (window.scrollY <= 5) topAt = Date.now();
    if (!atBottom()) return;

    if (isHome() && !pageSpeedDone && topAt && Date.now() - topAt <= 15000) {
      pageSpeedDone = true;
      find(26);
    }
    if (route() === 'blogs' && pathNoSlash() !== '/blog' && !blogDone) {
      blogDone = true;
      find(10);
    }
    if (route() === 'privacy' && !privacyDone) {
      privacyDone = true;
      find(30);
    }
  }, { passive: true });

  /* ---------- Pull to Refresh: pull down more than 120px from the top of home ---------- */
  let pullStartY = null;
  document.addEventListener('touchstart', (e) => {
    pullStartY = isHome() && window.scrollY <= 0 ? e.touches[0].clientY : null;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (pullStartY === null) return;
    const threshold = Math.max(80, window.innerHeight * 0.15);
    if (e.touches[0].clientY - pullStartY > threshold) { pullStartY = null; find(4); }
  }, { passive: true });
  document.addEventListener('touchend', () => { pullStartY = null; }, { passive: true });

  /* ---------- 6. Landscape Mode on home (phones) ---------- */
  function checkLandscape() {
    if (!isHome()) return;
    if (matchMedia('(orientation: landscape)').matches && matchMedia('(pointer: coarse)').matches) find(6);
  }

  /* ---------- Offline Dino helpers ---------- */
  const KNOWN_FIRST = ['', 'index.html', 'events', 'event', 'event.html', 'team', 'blog', 'blogs', 'join', 'contact',
    'certificates', 'verify', 'leaderboard', 'resources', 'perks', 'privacy', 'member-badge', 'member-badge.html',
    'easter-eggs', 'wheel', 'admin', 'mission-control', 'portal', 'about', 'gallery', 'hello'];
  function isUnknownAddress() {
    const first = location.pathname.split('/').filter(Boolean)[0] || '';
    return !KNOWN_FIRST.includes(first.toLowerCase());
  }
  // The router draws unknown addresses as a .page-404 block, so watch for that as well.
  function watchFor404() {
    const check = () => {
      if (document.querySelector('.pg.page-404, .page-404')) { find(11); return true; }
      return false;
    };
    if (check()) return;
    const observer = new MutationObserver(() => { if (check()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ---------- on page load ---------- */
  function onLoad() {
    // Late Night Coding: visit between midnight and 5 AM on the device clock.
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) find(24);

    // Route Found: the /hello address.
    if (pathNoSlash() === '/hello') find(22);

    // Offline Dino: any address the site does not know. Checked now, and again when the router renders.
    if (isUnknownAddress() || /page not found/i.test(document.title) || route() === '404') find(11);
    watchFor404();

    // Home page only: stop the phone's own pull-to-refresh so Pull to Refresh can count.
    if (isHome()) document.documentElement.style.overscrollBehaviorY = 'contain';

    checkLandscape();
    window.addEventListener('orientationchange', checkLandscape, { passive: true });
    window.addEventListener('resize', checkLandscape, { passive: true });

    setupShake();
    injectFooterExtras();
  }

  // Four colours dots and a share button, added to the footer of every page.
  function injectFooterExtras() {
    const inner = document.querySelector('.v18-foot-in');
    if (!inner || inner.querySelector('.egg-dots')) return;
    const colours = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
    const wrap = document.createElement('span');
    wrap.className = 'egg-dots';
    wrap.setAttribute('aria-hidden', 'true');
    colours.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'egg-dot';
      b.tabIndex = -1;
      b.dataset.i = String(i);
      b.style.background = c;
      wrap.appendChild(b);
    });
    const share = document.createElement('button');
    share.type = 'button';
    share.className = 'egg-share';
    share.textContent = 'Share GDG SRU';
    const row = document.createElement('div');
    row.className = 'egg-row';
    row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px';
    row.append(wrap, share);
    inner.appendChild(row);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onLoad, { once: true });
  } else {
    onLoad();
  }
})();
