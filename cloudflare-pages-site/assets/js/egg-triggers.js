/* Easter egg triggers, loaded on every public page.
 * Each egg is detected from normal use of the site and recorded with GDGEggs.find(id).
 * Points are checked and entered by the team in Mission Control; this file never sends points.
 * All 30 eggs wired with full mobile touchscreen & desktop support. */
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
  const isHome = () => route() === 'home' || location.pathname === '/' || location.pathname === '/index.html';
  // Allow 160px buffer for mobile dynamic browser bars (URL bar & bottom nav)
  const atBottom = () => (window.innerHeight + Math.ceil(window.scrollY)) >= (document.documentElement.scrollHeight - 160);
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

  /* ---------- styles for the toast and footer additions ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .egg-toast {
      position: fixed;
      left: 50%;
      bottom: calc(24px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%) translateY(0);
      background: rgba(31, 31, 35, 0.94);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.16);
      padding: 12px 22px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: -0.01em;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.35);
      z-index: 1000;
      max-width: calc(100% - 32px);
      text-align: center;
      pointer-events: none;
      animation: eggToastIn .3s cubic-bezier(.16, 1, .3, 1);
      transition: opacity .35s ease, transform .35s ease;
    }
    .egg-toast.out {
      opacity: 0;
      transform: translateX(-50%) translateY(10px);
    }
    @keyframes eggToastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(14px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
    .egg-dots {
      display: inline-flex;
      gap: 12px;
      align-items: center;
      margin-left: 12px;
      vertical-align: middle;
    }
    .egg-dot {
      position: relative;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 0;
      padding: 0;
      cursor: pointer;
      opacity: .9;
      touch-action: manipulation;
      transition: transform .15s ease, opacity .15s ease;
    }
    /* Generous 40px invisible touch target for mobile fingertips */
    .egg-dot::before {
      content: '';
      position: absolute;
      inset: -14px;
    }
    .egg-dot:active {
      transform: scale(1.4);
      opacity: 1;
    }
    .egg-share {
      font: inherit;
      font-size: 12px;
      background: none;
      border: 1px solid currentColor;
      border-radius: 999px;
      padding: 5px 12px;
      margin-left: 12px;
      color: inherit;
      opacity: .85;
      cursor: pointer;
      touch-action: manipulation;
      transition: opacity .15s ease, transform .15s ease;
    }
    .egg-share:active {
      transform: scale(.96);
    }
    #hero-discord-btn, .hero-blue-word {
      -webkit-touch-callout: none;
      -webkit-user-select: none;
      user-select: none;
      touch-action: manipulation;
    }
    @media (prefers-reduced-motion: reduce) {
      .egg-toast { animation: none; transition: none; }
    }
  `;
  document.head.appendChild(style);

  function toast(text) {
    if (navigator.vibrate) {
      try { navigator.vibrate([35, 45, 35]); } catch (_) {}
    }
    const el = document.createElement('div');
    el.className = 'egg-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2400);
    setTimeout(() => el.remove(), 2900);
  }

  /* ---------- 1. Android Shake: silent background accelerometer & mobile touch wiggle fallback ---------- */
  let shakeListening = false;
  function startShakeListener() {
    if (shakeListening || !('DeviceMotionEvent' in window)) return;
    shakeListening = true;
    let spikes = [];
    let last = 0;
    const onMotion = (e) => {
      if (!isHome()) return;
      const a = e.accelerationIncludingGravity || e.acceleration;
      if (!a) return;
      const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
      const now = Date.now();
      if (Math.abs(mag - 9.8) > 13 && now - last > 180) {
        last = now;
        spikes = spikes.filter((t) => now - t < 1500);
        spikes.push(now);
        if (spikes.length >= 3) {
          window.removeEventListener('devicemotion', onMotion);
          find(1);
        }
      }
    };
    window.addEventListener('devicemotion', onMotion, { passive: true });
  }

  function setupShake() {
    if (!('DeviceMotionEvent' in window)) return;
    // Android / modern browsers without permission gate: listen immediately
    if (typeof DeviceMotionEvent.requestPermission !== 'function') {
      startShakeListener();
    } else {
      // iOS Safari requires a user gesture for permission
      const reqOnce = () => {
        try {
          DeviceMotionEvent.requestPermission().then((res) => {
            if (res === 'granted') startShakeListener();
          }).catch(() => {});
        } catch (_) {}
      };
      window.addEventListener('pointerdown', reqOnce, { once: true, passive: true });
    }
  }

  /* Touch Gesture Shake / Wiggle fallback (rapid back-and-forth swipe on home screen) */
  let touchShakeStartX = 0;
  let touchShakeLastDir = 0;
  let touchShakeReversals = 0;
  let touchShakeLastTime = 0;

  document.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    touchShakeStartX = e.touches[0].clientX;
    touchShakeLastDir = 0;
    touchShakeReversals = 0;
    touchShakeLastTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!isHome() || !e.touches || e.touches.length !== 1) return;
    const now = Date.now();
    if (now - touchShakeLastTime > 1400) {
      touchShakeReversals = 0;
      touchShakeLastDir = 0;
      touchShakeStartX = e.touches[0].clientX;
    }
    touchShakeLastTime = now;

    const x = e.touches[0].clientX;
    const dx = x - touchShakeStartX;

    if (Math.abs(dx) > 24) {
      const currentDir = dx > 0 ? 1 : -1;
      if (touchShakeLastDir !== 0 && currentDir !== touchShakeLastDir) {
        touchShakeReversals++;
        if (touchShakeReversals >= 3) {
          find(1);
          touchShakeReversals = 0;
          touchShakeLastDir = 0;
        }
      }
      touchShakeLastDir = currentDir;
      touchShakeStartX = x;
    }
  }, { passive: true });

  /* ---------- 2. Inspect Element: five taps on the logo ---------- */
  const logoTaps = tapCounter(5, 2200, () => find(2));

  /* ---------- 3, 5, 12: long presses with mobile finger tolerance ---------- */
  let hold = null;
  let swallowNextClick = false;

  function startHold(egg, ms, x, y, maxMove = 52) {
    cancelHold();
    hold = {
      egg, x, y, maxMove,
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
    const maxMove = e.pointerType === 'touch' ? 52 : 28;
    if (closest(e, '.hero-blue-word')) { startHold(3, 1200, e.clientX, e.clientY, maxMove); return; }
    if (closest(e, '#hero-discord-btn')) { startHold(12, 1300, e.clientX, e.clientY, maxMove); return; }
    if (isHome() && atBottom()) startHold(5, 1300, e.clientX, e.clientY, maxMove);
  }, { passive: true });

  document.addEventListener('pointerup', cancelHold, { passive: true });
  document.addEventListener('pointercancel', cancelHold, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > hold.maxMove) cancelHold();
  }, { passive: true });

  document.addEventListener('selectstart', (e) => { if (hold) e.preventDefault(); }, true);
  document.addEventListener('contextmenu', (e) => { if (hold) e.preventDefault(); }, true);

  /* ---------- 9. Swipe Sprint: rapid horizontal swipe on Events page ---------- */
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeCount = 0;
  let swipeWindowStart = 0;

  document.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const isEvents = route() === 'events' || pathNoSlash().startsWith('/events');
    if (!isEvents) return;
    const dx = e.changedTouches[0].clientX - swipeStartX;
    const dy = e.changedTouches[0].clientY - swipeStartY;
    const now = Date.now();
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (now - swipeWindowStart > 2200) {
        swipeCount = 0;
        swipeWindowStart = now;
      }
      swipeCount++;
      if (swipeCount >= 2) {
        find(9);
        swipeCount = 0;
      }
    }
  }, { passive: true });

  /* ---------- click-based eggs ---------- */
  const heroBuild = tapCounter(3, 1500, () => find(19));
  const heroLearn = tapCounter(3, 1500, () => find(25));
  const avatarTaps = tapCounter(3, 1500, () => find(23));

  // Four colours: tap blue, red, yellow, green in order (footer dots).
  const dotOrder = [0, 1, 2, 3];
  let dotSeq = [];
  let discordOpenedAt = 0;

  document.addEventListener('click', (e) => {
    // Hold eggs: swallow click following completed hold
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

    // 16. Calendar Reminder: tapping countdown on /easter-eggs/ or home
    if (closest(e, '#egg-countdown, #egg-countdown-value, #egg-countdown-title, #countdown-cell, #cd, .info-coming-soon')) {
      find(16);
    }

    // 17. Launch Hour: tapping season badge, live session label, or launch/summary badge
    if (closest(e, '.event-side-index, #ef-meta-label, #next-event-label, .event-live-dot, .event-feature-side, #egg-summary')) {
      find(17);
    }

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

    // Version Tap: two taps on footer copyright text
    const foot = closest(e, '.v18-foot');
    if (foot && e.target.children && e.target.children.length === 0 && (e.target.textContent || '').includes('©')) {
      versionTaps();
    }
  }, true);

  const flippedCards = new Set();
  const versionTaps = tapCounter(2, 1000, () => find(20));

  // Hello World and SRU: typing in team search / leaderboard search box
  document.addEventListener('input', (e) => {
    if (!e.target || !['q', 'tm-search'].includes(e.target.id)) return;
    if (route() !== 'leaderboard' && route() !== 'team') return;
    const v = (e.target.value || '').trim();
    if (v.toLowerCase() === 'hello') find(14);
    if (v.toUpperCase() === 'SRU') find(29);
  });

  // Dark Mode Toggle: switch theme five times within a minute
  (() => {
    const themeTaps = tapCounter(5, 60000, () => find(13));
    let lastTheme = document.documentElement.dataset.theme || '';
    new MutationObserver(() => {
      const now = document.documentElement.dataset.theme || '';
      if (now !== lastTheme) { lastTheme = now; themeTaps(); }
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  })();

  // Context Switch: return to site after opening Discord
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !discordOpenedAt) return;
    if (Date.now() - discordOpenedAt <= 60000) find(28);
    discordOpenedAt = 0;
  });

  /* ---------- scroll-based eggs ---------- */
  let topAt = window.scrollY <= 5 ? Date.now() : 0;
  let pageSpeedDone = false;
  let blogDone = false;
  let privacyDone = false;

  // Loading Bar: scroll past halfway on any page, then back to the top
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

  /* ---------- Pull to Refresh: pull down > 80px from top of home ---------- */
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
    // 24. Late Night Coding: visit between midnight and 5 AM
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 5) find(24);

    // 17. Launch Hour: visit during launch hour (10:00 or 18:00)
    if (hour === 10 || hour === 18) find(17);

    // 22. Route Found: the /hello address
    if (pathNoSlash() === '/hello') find(22);

    // 11. Offline Dino: unknown page address
    if (isUnknownAddress() || /page not found/i.test(document.title) || route() === '404') find(11);
    watchFor404();

    // Home page overscroll behavior
    if (isHome()) document.documentElement.style.overscrollBehaviorY = 'contain';

    checkLandscape();
    window.addEventListener('orientationchange', checkLandscape, { passive: true });
    window.addEventListener('resize', checkLandscape, { passive: true });

    setupShake();
    injectFooterExtras();
  }

  // Four colours dots and share button, added to footer
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
