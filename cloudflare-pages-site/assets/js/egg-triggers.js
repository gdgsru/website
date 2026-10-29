/* GDG SRU · Live-Event Easter Eggs (12 High-Energy Interactive Secrets)
 * Double-digit points, refined mobile touch triggers, Web Audio API synthesis. */
(() => {
  'use strict';
  if (window.__GDG_EGG_TRIGGERS__) return;
  window.__GDG_EGG_TRIGGERS__ = true;

  const KEY = 'gdg-egg-found';
  const eggs = Array.isArray(window.GDG_EGGS) ? window.GDG_EGGS : [];
  const getEgg = (id) => eggs.find((e) => e.id === Number(id)) || { id, name: 'Secret Egg', points: 15, icon: '✨' };

  /* ---------- Core Store (device local) ---------- */
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
        const egg = getEgg(n);
        if (found.includes(n)) return false;
        found = [...found, n];
        try { localStorage.setItem(KEY, JSON.stringify(found)); } catch (e) {}
        toast(`${egg.icon || '🎉'} Egg #${n} Found: ${egg.name} (+${egg.points} pts)`);
        if (navigator.vibrate) {
          try { navigator.vibrate([40, 50, 40]); } catch (_) {}
        }
        document.dispatchEvent(new CustomEvent('gdg-egg-found', { detail: { id: n, egg } }));
        return true;
      },
      found: () => [...found],
      count: () => found.length,
      total: () => eggs.length,
      points: () => found.reduce((acc, id) => acc + (getEgg(id).points || 15), 0)
    };
  }

  const find = (id) => { try { return window.GDGEggs.find(id); } catch (e) { return false; } };

  /* ---------- Helpers ---------- */
  const route = () => (document.body && document.body.dataset.route) || '';
  const isHome = () => route() === 'home' || location.pathname === '/' || location.pathname === '/index.html';
  const closest = (e, sel) => (e.target && e.target.closest) ? e.target.closest(sel) : null;

  // Calls onDone after `n` clicks/taps within `windowMs`
  function multiTap(n, windowMs, onDone) {
    let times = [];
    return () => {
      const now = Date.now();
      times = times.filter((t) => now - t <= windowMs);
      times.push(now);
      if (times.length >= n) { times = []; onDone(); }
    };
  }

  /* ---------- Web Audio Synthesizer (Zero Audio Files) ---------- */
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  function getAudio() {
    if (!audioCtx && AudioCtx) {
      try { audioCtx = new AudioCtx(); } catch (_) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function playCoinSound() {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, now); // B5
      osc.frequency.setValueAtTime(1318.51, now + 0.08); // E6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }

  function playFanfare() {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const now = ctx.currentTime + i * 0.09;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.24);
      });
    } catch (_) {}
  }

  function playSynthTone(freq, dur = 0.25) {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur);
    } catch (_) {}
  }

  function playWhoosh() {
    const ctx = getAudio();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.35);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.85);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.85);
    } catch (_) {}
  }

  /* ---------- Modern Glass Toast Notification & Styles ---------- */
  const style = document.createElement('style');
  style.textContent = `
    .egg-toast {
      position: fixed;
      left: 50%;
      bottom: calc(24px + env(safe-area-inset-bottom, 0px));
      transform: translateX(-50%) translateY(0);
      background: rgba(22, 23, 27, 0.95);
      -webkit-backdrop-filter: blur(16px);
      backdrop-filter: blur(16px);
      color: #fff;
      border: 1px solid rgba(255, 255, 255, 0.18);
      padding: 12px 22px;
      border-radius: 999px;
      font-weight: 600;
      font-size: 14px;
      letter-spacing: -0.01em;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.45);
      z-index: 2147483640;
      max-width: calc(100% - 32px);
      text-align: center;
      pointer-events: none;
      animation: eggToastIn .32s cubic-bezier(.16, 1, .3, 1);
      transition: opacity .35s ease, transform .35s ease;
    }
    .egg-toast.out {
      opacity: 0;
      transform: translateX(-50%) translateY(12px);
    }
    @keyframes eggToastIn {
      from { opacity: 0; transform: translateX(-50%) translateY(16px); }
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
      opacity: .92;
      touch-action: manipulation;
      transition: transform .18s ease, filter .18s ease;
    }
    .egg-dot::before {
      content: '';
      position: absolute;
      inset: -14px;
    }
    .egg-dot:active {
      transform: scale(1.45);
      filter: brightness(1.3);
    }
    .egg-coin-hop {
      position: fixed;
      pointer-events: none;
      z-index: 2147483640;
      animation: coinHopAnim .8s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    @keyframes coinHopAnim {
      0% { transform: translateY(0) scale(0.6); opacity: 1; }
      50% { transform: translateY(-75px) scale(1.15); opacity: 1; }
      100% { transform: translateY(-110px) scale(1); opacity: 0; }
    }
    .rave-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483630;
      animation: raveBorder 1.5s ease infinite alternate;
    }
    @keyframes raveBorder {
      0% { box-shadow: inset 0 0 80px rgba(66, 133, 244, 0.7); }
      33% { box-shadow: inset 0 0 80px rgba(234, 67, 53, 0.7); }
      66% { box-shadow: inset 0 0 80px rgba(251, 188, 4, 0.7); }
      100% { box-shadow: inset 0 0 80px rgba(52, 168, 83, 0.7); }
    }
    .crt-off {
      animation: crtOffAnim .75s ease-in-out forwards !important;
    }
    @keyframes crtOffAnim {
      0% { filter: brightness(1); transform: scale(1); }
      50% { transform: scale(1, 0.003); filter: brightness(2.5); }
      80% { transform: scale(0.003, 0.003); filter: brightness(4); }
      100% { transform: scale(1, 1); filter: brightness(1); }
    }
    .hero-rumble {
      animation: heroRumbleAnim .2s linear infinite;
    }
    @keyframes heroRumbleAnim {
      0% { transform: translate(1px, 1px) rotate(0deg); }
      25% { transform: translate(-1px, -1px) rotate(-0.5deg); }
      50% { transform: translate(-1px, 1px) rotate(0.5deg); }
      75% { transform: translate(1px, -1px) rotate(0deg); }
      100% { transform: translate(1px, 1px) rotate(0deg); }
    }
  `;
  document.head.appendChild(style);

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'egg-toast';
    el.setAttribute('role', 'status');
    el.textContent = text;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2500);
    setTimeout(() => el.remove(), 2900);
  }

  /* ---------- Visual Confetti Cannon ---------- */
  function fireConfetti() {
    const COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483635';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);

    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: W * 0.5 + (Math.random() - 0.5) * 160,
        y: H * 0.45 + (Math.random() - 0.5) * 80,
        vx: (Math.random() - 0.5) * 18,
        vy: -Math.random() * 15 - 4,
        size: Math.random() * 9 + 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 12,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        life: 1,
        decay: Math.random() * 0.009 + 0.009
      });
    }

    let raf = 0;
    function render() {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.42;
        p.vx *= 0.985;
        p.rotation += p.rSpeed;
        p.life -= p.decay;
        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
      if (alive) {
        raf = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    }
    render();
  }

  /* =========================================================================
   * EGG 1: Confetti Rave (+20 pts)
   * Mobile: 4-Way Rapid Horizontal Wiggle (← → ← →)
   * Laptop: Konami Code (ArrowUp ArrowUp ArrowDown ArrowDown ArrowLeft ArrowRight ArrowLeft ArrowRight B A)
   * ========================================================================= */
  function triggerEgg1() {
    playFanfare();
    fireConfetti();
    const rave = document.createElement('div');
    rave.className = 'rave-overlay';
    document.body.appendChild(rave);
    setTimeout(() => rave.remove(), 3200);
    find(1);
  }

  // Mobile 4-Stroke Horizontal Wiggle (Zero vertical scroll interference!)
  let wiggleStartX = 0, wiggleLastDir = 0, wiggleFlips = 0, wiggleLastTime = 0;
  document.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    wiggleStartX = e.touches[0].clientX;
    wiggleLastDir = 0;
    wiggleFlips = 0;
    wiggleLastTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    const now = Date.now();
    if (now - wiggleLastTime > 1300) {
      wiggleFlips = 0;
      wiggleLastDir = 0;
      wiggleStartX = e.touches[0].clientX;
    }
    wiggleLastTime = now;

    const x = e.touches[0].clientX;
    const dx = x - wiggleStartX;
    if (Math.abs(dx) > 22) {
      const curDir = dx > 0 ? 1 : -1;
      if (wiggleLastDir !== 0 && curDir !== wiggleLastDir) {
        wiggleFlips++;
        if (wiggleFlips >= 3) {
          triggerEgg1();
          wiggleFlips = 0;
          wiggleLastDir = 0;
        }
      }
      wiggleLastDir = curDir;
      wiggleStartX = x;
    }
  }, { passive: true });

  // Laptop Konami Code
  const KONAMI_KEYS = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let keySeq = [];
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const key = e.key.toLowerCase();
    if (key === KONAMI_KEYS[keySeq.length]) {
      keySeq.push(key);
      if (keySeq.length === KONAMI_KEYS.length) {
        triggerEgg1();
        keySeq = [];
      }
    } else {
      keySeq = key === KONAMI_KEYS[0] ? [key] : [];
    }
  });

  /* =========================================================================
   * EGG 2: Google Gravity (+30 pts)
   * Mobile: Hold hero title for 1.1s (with rumble)
   * Laptop: Press 'G' key
   * ========================================================================= */
  let gravityActive = false;
  function triggerEgg2() {
    if (gravityActive || !isHome()) return;
    gravityActive = true;
    find(2);

    const elements = document.querySelectorAll(
      '.hero-reference-copy h1, .hero-reference-lead, .home-hero-actions, .hero-social-proof, .hero-art-label, .card'
    );
    const restoreBtn = document.createElement('button');
    restoreBtn.type = 'button';
    restoreBtn.innerHTML = '↺ Restore Gravity';
    restoreBtn.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      z-index:2147483640;background:#4285f4;color:#fff;font-weight:700;
      padding:12px 24px;border:0;border-radius:999px;box-shadow:0 10px 30px rgba(66,133,244,0.4);
      cursor:pointer;font-family:inherit;font-size:14px;animation:eggToastIn .3s ease;
    `;

    const originalStyles = new Map();
    elements.forEach((el) => {
      const rect = el.getBoundingClientRect();
      originalStyles.set(el, el.style.cssText);
      const randX = (Math.random() - 0.5) * 60;
      const randRot = (Math.random() - 0.5) * 28;
      const dropDistance = window.innerHeight - rect.bottom + (Math.random() * 40 - 20);

      el.style.transition = 'transform 0.9s cubic-bezier(0.25, 1.4, 0.5, 1)';
      el.style.transform = `translate(${randX}px, ${Math.max(80, dropDistance)}px) rotate(${randRot}deg)`;
      el.style.cursor = 'grab';

      let startX = 0, startY = 0, curX = randX, curY = dropDistance;
      const onMove = (me) => {
        const clientX = me.touches ? me.touches[0].clientX : me.clientX;
        const clientY = me.touches ? me.touches[0].clientY : me.clientY;
        const nx = curX + (clientX - startX);
        const ny = curY + (clientY - startY);
        el.style.transform = `translate(${nx}px, ${ny}px) rotate(${randRot}deg)`;
      };
      const onEnd = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onEnd);
      };
      el.addEventListener('pointerdown', (pe) => {
        startX = pe.clientX;
        startY = pe.clientY;
        el.style.transition = 'none';
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onEnd);
      }, { passive: true });
    });

    restoreBtn.addEventListener('click', () => {
      elements.forEach((el) => {
        el.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        el.style.transform = 'none';
        setTimeout(() => {
          el.style.cssText = originalStyles.get(el) || '';
        }, 650);
      });
      restoreBtn.remove();
      gravityActive = false;
    });

    document.body.appendChild(restoreBtn);
  }

  // Hold hero title for 1.1s with rumble
  let heroHoldTimer = null;
  document.addEventListener('pointerdown', (e) => {
    if (!isHome()) return;
    const heroTitle = closest(e, '.home-hero-title, .hero-reference-copy h1');
    if (heroTitle) {
      heroTitle.classList.add('hero-rumble');
      heroHoldTimer = setTimeout(() => {
        heroTitle.classList.remove('hero-rumble');
        triggerEgg2();
      }, 1100);
    }
  }, { passive: true });

  const cancelHeroHold = () => {
    if (heroHoldTimer) {
      clearTimeout(heroHoldTimer);
      heroHoldTimer = null;
      const hero = document.querySelector('.home-hero-title, .hero-reference-copy h1');
      if (hero) hero.classList.remove('hero-rumble');
    }
  };
  document.addEventListener('pointerup', cancelHeroHold, { passive: true });
  document.addEventListener('pointercancel', cancelHeroHold, { passive: true });

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'g' || e.key === 'G') triggerEgg2();
  });

  /* =========================================================================
   * EGG 3: 8-Bit Mario Coin (+15 pts)
   * Mobile & Laptop: Rapid triple-tap on GDG bracket logo </>
   * ========================================================================= */
  function triggerEgg3(targetEl) {
    playCoinSound();
    find(3);

    const rect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: 120 };
    const coin = document.createElement('div');
    coin.className = 'egg-coin-hop';
    coin.style.left = `${rect.left + (rect.width ? rect.width / 2 : 0) - 20}px`;
    coin.style.top = `${rect.top}px`;
    coin.innerHTML = `
      <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#ffe066,#f59f00);border:2px solid #fff;display:grid;place-items:center;box-shadow:0 4px 16px rgba(245,159,0,0.6);font-size:18px;">🪙</div>
      <b style="color:#f59f00;font-size:16px;text-shadow:0 2px 8px rgba(0,0,0,0.4);font-family:var(--f-mono,monospace);">+15</b>
    `;
    document.body.appendChild(coin);
    setTimeout(() => coin.remove(), 850);
  }

  const logoTapTrigger = multiTap(3, 1000, () => {
    const logo = document.querySelector('.lg, #lgs, .hero-code');
    triggerEgg3(logo);
  });
  document.addEventListener('click', (e) => {
    if (closest(e, '.lg, #lgs, .hero-code')) logoTapTrigger();
  });

  /* =========================================================================
   * EGG 4: Root Hacker Terminal (+35 pts)
   * Mobile: TRIPLE-TAP Footer Copyright (Replaced long-press! 100% reliable)
   * Laptop: Press ` or ~ key
   * ========================================================================= */
  let terminalOpen = false;
  function openHackerTerminal() {
    if (terminalOpen) return;
    terminalOpen = true;
    find(4);

    const term = document.createElement('div');
    term.id = 'gdg-hacker-term';
    term.style.cssText = `
      position:fixed;inset:0;background:rgba(8,10,14,0.96);z-index:2147483645;
      display:flex;flex-direction:column;font-family:var(--f-mono,monospace);color:#34a853;
      padding:calc(16px + env(safe-area-inset-top,0px)) 16px calc(16px + env(safe-area-inset-bottom,0px));
      box-sizing:border-box;animation:eggToastIn .3s ease;
    `;

    term.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(52,168,83,0.3);padding-bottom:10px;">
        <span style="font-weight:700;letter-spacing:1px;font-size:13px;">● ● ● GDG SRU ROOT SHELL ~ v2.4</span>
        <button id="term-close-btn" style="background:#ea4335;color:#fff;border:0;border-radius:999px;padding:4px 12px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;">EXIT</button>
      </div>
      <div id="term-body" style="flex:1;overflow-y:auto;padding:12px 0;font-size:13px;line-height:1.6;color:#a8f0b4;">
        <p style="color:#4285f4;margin:0 0 6px;">[SYSTEM READY] Welcome, developer. Unauthorized curiosity encouraged.</p>
        <p style="color:#fbbc04;margin:0 0 12px;">Type commands or tap quick pills below:</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;padding:8px 0;border-top:1px solid rgba(52,168,83,0.2);">
        <button class="term-pill" data-cmd="help" style="background:#173b25;color:#a8f0b4;border:1px solid #34a853;border-radius:6px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;">help</button>
        <button class="term-pill" data-cmd="matrix" style="background:#173b25;color:#a8f0b4;border:1px solid #34a853;border-radius:6px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;">matrix</button>
        <button class="term-pill" data-cmd="roast" style="background:#173b25;color:#a8f0b4;border:1px solid #34a853;border-radius:6px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;">roast</button>
        <button class="term-pill" data-cmd="cat secret" style="background:#173b25;color:#a8f0b4;border:1px solid #34a853;border-radius:6px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;">cat secret</button>
        <button class="term-pill" data-cmd="clear" style="background:#173b25;color:#a8f0b4;border:1px solid #34a853;border-radius:6px;padding:6px 10px;font:inherit;font-size:12px;cursor:pointer;">clear</button>
      </div>
      <form id="term-form" style="display:flex;gap:8px;margin-top:6px;">
        <span style="color:#34a853;font-weight:700;">&gt;</span>
        <input id="term-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="type command..." style="flex:1;background:transparent;border:0;color:#fff;font:inherit;font-size:14px;outline:none;" />
      </form>
    `;
    document.body.appendChild(term);

    const bodyEl = term.querySelector('#term-body');
    const inputEl = term.querySelector('#term-input');
    const closeBtn = term.querySelector('#term-close-btn');

    function logLine(msg, color = '#a8f0b4') {
      const p = document.createElement('p');
      p.style.margin = '4px 0';
      p.style.color = color;
      p.innerHTML = msg;
      bodyEl.appendChild(p);
      bodyEl.scrollTop = bodyEl.scrollHeight;
    }

    function execCommand(cmd) {
      const c = (cmd || '').trim().toLowerCase();
      logLine(`guest@gdgsru:~$ ${c}`, '#fff');
      if (c === 'help') {
        logLine('Available commands:<br>  help       - show this manual<br>  matrix     - toggle phosphor matrix filter<br>  roast      - get roasted by AI<br>  cat secret - unveil launch secrets<br>  clear      - wipe output<br>  exit       - close root terminal');
      } else if (c === 'matrix') {
        window.gdg && window.gdg.matrix ? window.gdg.matrix() : null;
        logLine('⚡ Matrix hacker visual active.', '#34a853');
      } else if (c === 'roast') {
        triggerEgg8();
      } else if (c === 'crt') {
        triggerEgg10();
        logLine('📺 CRT monitor power cycling...', '#fbbc04');
      } else if (c === 'cat secret') {
        logLine('🎉 CHAPTER SECRET: <i>"The best way to learn software is to ship it before you feel ready."</i> - GDG SRU Core Team', '#fbbc04');
      } else if (c === 'clear') {
        bodyEl.innerHTML = '';
      } else if (c === 'exit') {
        closeTerm();
      } else {
        logLine(`bash: ${c}: command not found. Type <b>help</b> for command list.`, '#ea4335');
      }
    }

    term.querySelectorAll('.term-pill').forEach((btn) => {
      btn.addEventListener('click', () => execCommand(btn.dataset.cmd));
    });

    term.querySelector('#term-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const val = inputEl.value;
      inputEl.value = '';
      execCommand(val);
    });

    function closeTerm() {
      term.remove();
      terminalOpen = false;
    }
    closeBtn.addEventListener('click', closeTerm);
  }

  // TRIPLE-TAP ON FOOTER COPYRIGHT (Zero mobile text-select issues!)
  const footTapTrigger = multiTap(3, 1000, openHackerTerminal);
  document.addEventListener('click', (e) => {
    if (closest(e, '.v18-foot, .v18-foot-in, footer')) footTapTrigger();
  });

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === '`' || e.key === '~') openHackerTerminal();
  });

  /* =========================================================================
   * EGG 5: Bugdroid Runner (+30 pts)
   * Tap cloud / sun in hero art, or dino on 404
   * ========================================================================= */
  let runnerActive = false;
  function openBugdroidRunner() {
    if (runnerActive) return;
    runnerActive = true;
    find(5);

    const overlay = document.createElement('div');
    overlay.id = 'gdg-runner-modal';
    overlay.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2147483645;
      display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
      backdrop-filter:blur(12px);animation:eggToastIn .25s ease;
    `;

    overlay.innerHTML = `
      <div style="background:var(--cd,#1a1a1c);border:1px solid rgba(255,255,255,0.15);border-radius:24px;width:min(440px,100%);overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);display:flex;flex-direction:column;">
        <div style="padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid rgba(255,255,255,0.08);">
          <b style="font-size:15px;color:var(--ink,#fff);">🤖 Bugdroid Jump</b>
          <button id="runner-close" style="background:none;border:0;color:var(--mut,#888);font-size:20px;cursor:pointer;padding:0 4px;">✕</button>
        </div>
        <div style="position:relative;background:#0d0e12;height:200px;display:grid;place-items:center;">
          <canvas id="runner-canvas" width="400" height="200" style="width:100%;height:100%;display:block;"></canvas>
          <div id="runner-msg" style="position:absolute;font-size:14px;font-weight:700;color:#fff;background:rgba(0,0,0,0.65);padding:6px 14px;border-radius:999px;pointer-events:none;">TAP SCREEN TO JUMP</div>
        </div>
        <div style="padding:12px 18px;display:flex;justify-content:space-between;align-items:center;font-size:13px;color:var(--mut,#888);">
          <span>Score: <b id="runner-score" style="color:var(--g,#34a853);">0</b></span>
          <span style="font-size:12px;">Controls: Tap anywhere or Space</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#runner-canvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = overlay.querySelector('#runner-score');
    const msgEl = overlay.querySelector('#runner-msg');
    const closeBtn = overlay.querySelector('#runner-close');

    let running = true, score = 0;
    let py = 150, vy = 0, gravity = 0.65;
    let obstacles = [{ x: 420, w: 18, h: 28 }];

    function jump() {
      if (py >= 148) {
        vy = -11;
        playSynthTone(587.33, 0.1);
        msgEl.style.display = 'none';
      }
    }

    overlay.addEventListener('pointerdown', (e) => {
      if (e.target !== closeBtn) jump();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') { e.preventDefault(); jump(); }
    });

    let animId = 0;
    function loop() {
      if (!running) return;
      ctx.clearRect(0, 0, 400, 200);

      ctx.strokeStyle = '#34a853';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 178);
      ctx.lineTo(400, 178);
      ctx.stroke();

      vy += gravity;
      py += vy;
      if (py > 150) { py = 150; vy = 0; }

      ctx.fillStyle = '#34a853';
      ctx.fillRect(40, py, 26, 26);
      ctx.fillStyle = '#fff';
      ctx.fillRect(56, py + 5, 4, 4);

      obstacles.forEach((ob) => {
        ob.x -= 4.2;
        ctx.fillStyle = '#ea4335';
        ctx.fillRect(ob.x, 178 - ob.h, ob.w, ob.h);

        if (ob.x < 66 && ob.x + ob.w > 40 && py + 26 > 178 - ob.h) {
          msgEl.textContent = `GAME OVER · SCORE: ${score}`;
          msgEl.style.display = 'block';
          playSynthTone(180, 0.3);
          setTimeout(() => {
            obstacles = [{ x: 420, w: 18, h: 28 }];
            score = 0;
            scoreEl.textContent = '0';
          }, 1400);
        }
      });

      if (obstacles[0].x < -30) {
        obstacles.shift();
        obstacles.push({ x: 400 + Math.random() * 120, w: 18, h: 24 + Math.random() * 14 });
        score += 10;
        scoreEl.textContent = score;
      }

      animId = requestAnimationFrame(loop);
    }
    loop();

    function closeGame() {
      running = false;
      cancelAnimationFrame(animId);
      overlay.remove();
      runnerActive = false;
    }
    closeBtn.addEventListener('click', closeGame);
  }

  document.addEventListener('click', (e) => {
    if (closest(e, '.hero-art-cloud, .hero-art-sun')) openBugdroidRunner();
  });

  /* =========================================================================
   * EGG 6: Google 4-Color Synth (+20 pts)
   * Tap 4 footer dots in sequence (B-R-Y-G)
   * ========================================================================= */
  const TONE_FREQS = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
  let synthTaps = [];

  document.addEventListener('click', (e) => {
    const dot = closest(e, '.egg-dot');
    if (!dot) return;
    const idx = Number(dot.dataset.i);
    if (Number.isInteger(idx) && idx >= 0 && idx < 4) {
      playSynthTone(TONE_FREQS[idx], 0.3);
      if (idx === synthTaps.length) {
        synthTaps.push(idx);
        if (synthTaps.length === 4) {
          setTimeout(playFanfare, 250);
          find(6);
          synthTaps = [];
        }
      } else {
        synthTaps = idx === 0 ? [0] : [];
      }
    }
  });

  /* =========================================================================
   * EGG 7: Do a Barrel Roll (+25 pts)
   * Search "barrel roll", double-tap navbar pill, or press 'R'
   * ========================================================================= */
  let rolling = false;
  function triggerEgg7() {
    if (rolling) return;
    rolling = true;
    find(7);
    playWhoosh();
    if (navigator.vibrate) {
      try { navigator.vibrate([30, 40, 50, 60, 70]); } catch (_) {}
    }

    const app = document.querySelector('#app') || document.body;
    app.style.transition = 'transform 1.3s cubic-bezier(0.25, 1, 0.5, 1)';
    app.style.transform = 'rotate(360deg)';

    setTimeout(() => {
      app.style.transition = 'none';
      app.style.transform = 'none';
      rolling = false;
    }, 1350);
  }

  // Double tap floating navbar pill
  const navTapTrigger = multiTap(2, 600, triggerEgg7);
  document.addEventListener('click', (e) => {
    if (closest(e, 'header#hd .nv, .nv-pill')) navTapTrigger();
  });

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.key === 'r' || e.key === 'R') triggerEgg7();
  });

  /* =========================================================================
   * EGG 8: Gemini AI Roast (+20 pts)
   * Hold the sparkle icon ✳ in hero
   * ========================================================================= */
  const ROASTS = [
    "Gemini analysis: You have 42 tabs open and 38 of them are StackOverflow answers from 2017.",
    "Your code compiles on the first try... in another multiverse.",
    "A legendary developer once said: 'It worked on localhost.' Today, that developer is you.",
    "Gemini predicts: You will spend 3 hours debugging today, only to find a missing semicolon.",
    "Your commit message 'fixed stuff' has officially been logged into Google Cloud.",
    "404: Motivation not found. Have you tried coffee and turning yourself off and on again?",
    "You don't need tests if your users test it directly in production.",
    "Gemini insight: 99% of web development is centering a div and praying it stays there."
  ];

  function triggerEgg8() {
    find(8);
    playSynthTone(783.99, 0.2);

    const card = document.createElement('div');
    card.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:2147483645;
      display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
      backdrop-filter:blur(14px);animation:eggToastIn .3s ease;
    `;

    function getQuote() {
      return ROASTS[Math.floor(Math.random() * ROASTS.length)];
    }

    card.innerHTML = `
      <div style="background:var(--cd,#1a1a1c);border:1px solid rgba(66,133,244,0.3);border-radius:24px;width:min(420px,100%);padding:24px;box-shadow:0 24px 70px rgba(66,133,244,0.25);position:relative;text-align:center;">
        <span style="font-size:36px;display:block;margin-bottom:8px;">✨</span>
        <b style="font-size:18px;color:#4285f4;letter-spacing:-0.02em;display:block;">Gemini Chapter Oracle</b>
        <p id="oracle-quote" style="margin:16px 0 20px;font-size:15px;line-height:1.55;color:var(--ink,#fff);font-style:italic;">"${getQuote()}"</p>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button id="oracle-next" style="background:#4285f4;color:#fff;border:0;border-radius:999px;padding:9px 18px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;">🎲 Another</button>
          <button id="oracle-close" style="background:rgba(255,255,255,0.1);color:#fff;border:0;border-radius:999px;padding:9px 18px;font:inherit;font-size:13px;font-weight:600;cursor:pointer;">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(card);

    const quoteEl = card.querySelector('#oracle-quote');
    card.querySelector('#oracle-next').addEventListener('click', () => {
      quoteEl.textContent = `"${getQuote()}"`;
      playSynthTone(880, 0.15);
    });
    card.querySelector('#oracle-close').addEventListener('click', () => card.remove());
  }

  let sparkTimer = null;
  document.addEventListener('pointerdown', (e) => {
    if (closest(e, '.hero-proof-spark, .art-glyph')) {
      sparkTimer = setTimeout(triggerEgg8, 700);
    }
  }, { passive: true });
  document.addEventListener('pointerup', () => { if (sparkTimer) clearTimeout(sparkTimer); }, { passive: true });
  document.addEventListener('pointercancel', () => { if (sparkTimer) clearTimeout(sparkTimer); }, { passive: true });

  /* =========================================================================
   * EGG 9: Speed Tap Combo (+15 pts) [NEW]
   * Rapidly tap "Join the Community" 5 times
   * ========================================================================= */
  const joinTapTrigger = multiTap(5, 1500, () => {
    find(9);
    playCoinSound();
    const btn = document.querySelector('#hero-discord-btn, .discord-promo-cta');
    if (btn) {
      const spark = document.createElement('span');
      spark.textContent = '⚡ 5x COMBO!';
      spark.style.cssText = `
        position:absolute;top:-26px;left:50%;transform:translateX(-50%);
        background:#fbbc04;color:#000;font-weight:800;font-size:11px;
        padding:2px 8px;border-radius:999px;box-shadow:0 4px 12px rgba(251,188,4,0.6);
        animation:coinHopAnim .9s ease forwards;
      `;
      btn.style.position = 'relative';
      btn.appendChild(spark);
      setTimeout(() => spark.remove(), 950);
    }
  });
  document.addEventListener('click', (e) => {
    if (closest(e, '#hero-discord-btn, .discord-promo-cta')) joinTapTrigger();
  });

  /* =========================================================================
   * EGG 10: CRT TV Power-Down (+20 pts) [NEW]
   * Rapidly triple-tap the Menu button, or type "crt" in search/terminal
   * ========================================================================= */
  function triggerEgg10() {
    find(10);
    playSynthTone(120, 0.4);
    document.documentElement.classList.add('crt-off');
    setTimeout(() => {
      document.documentElement.classList.remove('crt-off');
    }, 850);
  }

  const crtTapTrigger = multiTap(3, 1600, triggerEgg10);
  document.addEventListener('click', (e) => {
    if (closest(e, '.mn, .dts, .menu-close, [aria-label*="menu" i], #theme-toggle, .theme-toggle, [aria-label*="theme"]')) {
      crtTapTrigger();
    }
  });

  /* =========================================================================
   * EGG 11: 404 Dino Discovery (+15 pts) [NEW]
   * Visit 404 page & tap Dino
   * ========================================================================= */
  document.addEventListener('click', (e) => {
    if (closest(e, '.pg.page-404, .page-404, .page-404-canvas, .dino-wrapper')) {
      playCoinSound();
      find(11);
    }
  });

  /* =========================================================================
   * EGG 12: Chapter Passcode (+10 pts) [NEW]
   * Type "sru" or "gdg" in search
   * ========================================================================= */
  document.addEventListener('input', (e) => {
    if (!e.target || !['q', 'tm-search', 'cmd-input'].includes(e.target.id)) return;
    const v = (e.target.value || '').trim().toLowerCase();
    if (v === 'barrel roll') triggerEgg7();
    if (v === 'crt') triggerEgg10();
    if (v === 'sru' || v === 'gdg') find(12);
  });

  /* ---------- Footer Extras (Google 4-Dots) ---------- */
  function injectFooterExtras() {
    const inner = document.querySelector('.v18-foot-in');
    if (!inner || inner.querySelector('.egg-dots')) return;
    const colours = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
    const wrap = document.createElement('span');
    wrap.className = 'egg-dots';
    wrap.setAttribute('aria-label', 'Google colours synth piano');
    colours.forEach((c, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'egg-dot';
      b.dataset.i = String(i);
      b.style.background = c;
      wrap.appendChild(b);
    });
    inner.appendChild(wrap);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectFooterExtras, { once: true });
  } else {
    injectFooterExtras();
  }
})();
