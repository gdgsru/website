/* Public prize wheel (/wheel/). Shows the number reel and the prize wheel on every screen.
 * The winner is chosen by the server when Mission Control presses Stop; this file only displays it. */
(() => {
  'use strict';

  const COLOURS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
  const SPIN_MS = 4200;
  const REEL_MS = 80;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let sb = null;
  let state = null;          // easter_egg_wheel_state row
  let prizes = [];           // all prizes (ordered)
  let numbers = [];          // numbers still in the draw
  let spinPrizes = [];       // prizes on the wheel for the current spin
  let reelTimer = null;
  let spinningFor = null;    // winner number currently being shown, avoids replaying the same spin
  let mounted = false;

  const $ = (sel) => document.querySelector(sel);
  const pad = (n) => String(n).padStart(3, '0');

  function el(tag, attrs = {}, text) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  /* ---------- wheel drawing ---------- */
  function drawWheel(list) {
    const svg = $('#wheel-svg');
    if (!svg) return;
    svg.replaceChildren();
    svg.style.transition = 'none';
    svg.style.transform = 'rotate(0deg)';
    const n = list.length;
    if (!n) {
      svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 100, fill: 'none', stroke: 'currentColor', 'stroke-opacity': '.25', 'stroke-width': '2' }));
      return;
    }
    const slice = 360 / n;
    list.forEach((p, i) => {
      const a0 = i * slice - 90;
      const a1 = (i + 1) * slice - 90;
      const mid = (a0 + a1) / 2;
      if (n === 1) {
        svg.appendChild(svgEl('circle', { cx: 0, cy: 0, r: 100, fill: COLOURS[i % 4] }));
      } else {
        const p0 = polar(a0, 100);
        const p1 = polar(a1, 100);
        const large = slice > 180 ? 1 : 0;
        svg.appendChild(svgEl('path', {
          d: `M0 0 L${p0.x} ${p0.y} A100 100 0 ${large} 1 ${p1.x} ${p1.y} Z`,
          fill: COLOURS[i % 4]
        }));
      }
      const label = polar(mid, 58);
      const text = svgEl('text', {
        x: label.x, y: label.y,
        transform: `rotate(${mid + 90} ${label.x} ${label.y})`,
        'text-anchor': 'middle', 'dominant-baseline': 'middle',
        fill: COLOURS[i % 4] === '#fbbc04' ? '#1f1f23' : '#ffffff',
        'font-size': n > 2 ? '9' : '11', 'font-weight': '700'
      });
      text.textContent = truncate(p.title, 16);
      svg.appendChild(text);
    });
  }

  function polar(deg, r) {
    const rad = (deg * Math.PI) / 180;
    return { x: +(r * Math.cos(rad)).toFixed(2), y: +(r * Math.sin(rad)).toFixed(2) };
  }

  function truncate(s, max) {
    const t = String(s || '');
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  // Spin so the winning prize's slice lands under the pointer at the top.
  function spinTo(prizeId) {
    const svg = $('#wheel-svg');
    const idx = spinPrizes.findIndex((p) => p.id === prizeId);
    if (!svg || idx < 0) return;
    const slice = 360 / spinPrizes.length;
    const target = 360 * 6 - (idx * slice + slice / 2);
    svg.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.17,.67,.2,1)`;
    svg.style.transform = `rotate(${target}deg)`;
  }

  /* ---------- number reel ---------- */
  function startReel() {
    stopReel();
    const pool = numbers.length ? numbers : [];
    const reel = $('#wheel-reel');
    const tick = () => {
      if (!reel) return;
      const n = pool.length
        ? pool[Math.floor(Math.random() * pool.length)]
        : Math.floor(Math.random() * 999) + 1;
      reel.textContent = pad(n);
    };
    tick();
    reelTimer = setInterval(tick, REEL_MS);
  }
  function stopReel() {
    if (reelTimer) { clearInterval(reelTimer); reelTimer = null; }
  }

  /* ---------- render from state ---------- */
  function setStatus(text) {
    const s = $('#wheel-status');
    if (s) s.textContent = text;
  }

  function showResult(number, prizeTitle) {
    const box = $('#wheel-result');
    if (!box) return;
    box.hidden = false;
    box.replaceChildren(
      el('span', { class: 'wheel-result-number' }, `#${pad(number)}`),
      el('span', { class: 'wheel-result-prize' }, prizeTitle || 'Prize')
    );
  }

  function hideResult() {
    const box = $('#wheel-result');
    if (box) { box.hidden = true; box.replaceChildren(); }
  }

  function renderMeta() {
    const meta = $('#wheel-meta');
    if (!meta) return;
    const left = prizes.filter((p) => p.status !== 'won').length;
    meta.textContent = `${numbers.length} numbers in the draw · ${left} prize${left === 1 ? '' : 's'} left`;
  }

  async function refresh() {
    if (!sb) return;
    const [s, p, n] = await Promise.all([
      sb.from('easter_egg_wheel_state').select('*').eq('id', 1).maybeSingle(),
      sb.from('easter_egg_prizes').select('*').order('position'),
      sb.from('easter_egg_wheel_numbers').select('wheel_number')
    ]);
    if (s.error || p.error || n.error) return;
    prizes = p.data || [];
    numbers = (n.data || []).map((r) => r.wheel_number);
    state = s.data || { status: 'idle' };
    renderMeta();

    const available = prizes.filter((x) => x.status === 'available');

    if (state.status === 'rolling') {
      hideResult();
      if (spinningFor !== 'rolling') {
        spinPrizes = available;
        spinningFor = 'rolling';
        drawWheel(spinPrizes);
        startReel();
        setStatus('Spinning…');
      }
      return;
    }

    if (state.status === 'stopped' && state.winner_number) {
      const key = `${state.winner_number}-${state.updated_at}`;
      if (spinningFor !== key) {
        // Results from the server: land the wheel on the winning prize.
        if (!spinPrizes.some((x) => x.id === state.winner_prize_id)) {
          spinPrizes = prizes.filter((x) => x.id === state.winner_prize_id || x.status === 'available');
          drawWheel(spinPrizes);
        }
        stopReel();
        const reel = $('#wheel-reel');
        if (reel) reel.textContent = pad(state.winner_number);
        setStatus('Winner');
        requestAnimationFrame(() => spinTo(state.winner_prize_id));
        showResult(state.winner_number, state.winner_prize_title);
        spinningFor = key;
        // Redraw with the remaining prizes after the spin finishes.
        setTimeout(() => {
          spinPrizes = prizes.filter((x) => x.status === 'available');
          drawWheel(spinPrizes);
        }, SPIN_MS + 1500);
      }
      return;
    }

    // idle
    stopReel();
    spinningFor = null;
    spinPrizes = available;
    drawWheel(spinPrizes);
    hideResult();
    const reel = $('#wheel-reel');
    if (reel) reel.textContent = '---';
    setStatus(available.length ? 'Waiting for the spin' : 'All prizes have been awarded');
  }

  /* ---------- connect ---------- */
  function connect() {
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;
    if (!url || !key || !window.supabase?.createClient) {
      setStatus('Waiting for the spin');
      return;
    }
    sb = window.supabaseClient || window.supabase.createClient(url, key);
    refresh();
    try {
      sb.channel('easter-egg-wheel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'easter_egg_wheel_state' }, () => refresh())
        .subscribe();
    } catch (e) { /* realtime unavailable: the fallback poll still runs */ }
    setInterval(refresh, 10000);
  }

  function mount() {
    if (mounted || !$('#wheel-root')) return false;
    mounted = true;
    connect();
    return true;
  }

  if (!mount()) {
    const observer = new MutationObserver(() => { if (mount()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
