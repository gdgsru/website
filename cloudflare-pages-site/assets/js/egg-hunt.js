/* Easter egg hunt page logic.
 * - Rules and countdown are read from easter_egg_settings (set in Mission Control).
 * - Found eggs are remembered on this device (localStorage).
 * - Points are awarded based on the 8 live-event eggs.
 * - Other pages call window.GDGEggs.find(id) when a guest triggers an egg. */
(() => {
  'use strict';

  const KEY = 'gdg-egg-found';
  const eggs = Array.isArray(window.GDG_EGGS) ? window.GDG_EGGS : [];
  const $ = (sel) => document.querySelector(sel);

  /* ---- found-egg store (device only) ---- */
  function readFound() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(raw) ? raw.filter((n) => Number.isInteger(n)) : [];
    } catch (e) { return []; }
  }
  function writeFound(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode */ }
  }
  let found = readFound();

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

  function find(id) {
    const n = Number(id);
    const egg = eggs.find((e) => e.id === n);
    if (!egg || found.includes(n)) return false;
    found = [...found, n];
    writeFound(found);
    toast(`${egg.icon || '🎉'} Egg Found: ${egg.name} (+${egg.points || 100} pts)`);
    render();
    document.dispatchEvent(new CustomEvent('gdg-egg-found', { detail: { id: n } }));
    return true;
  }

  window.GDGEggs = {
    find,
    found: () => [...found],
    count: () => found.length,
    total: () => eggs.length,
    points: () => found.reduce((a, id) => {
      const e = eggs.find((x) => x.id === id);
      return a + (e ? (e.points || 100) : 0);
    }, 0)
  };

  /* ---- egg grid ---- */
  function render() {
    const grid = $('#egg-grid');
    const summary = $('#egg-summary');
    const totalPts = eggs.reduce((a, e) => a + (e.points || 100), 0);
    const earnedPts = found.reduce((a, id) => {
      const e = eggs.find((x) => x.id === id);
      return a + (e ? (e.points || 100) : 0);
    }, 0);

    if (summary) {
      summary.textContent = `${found.length} of ${eggs.length} eggs found · ${earnedPts} / ${totalPts} points banked`;
    }
    if (!grid) return;
    grid.replaceChildren(...eggs.map((egg) => {
      const li = document.createElement('li');
      const isFound = found.includes(egg.id);
      li.className = isFound ? 'egg is-found' : 'egg';
      li.style.cssText = isFound
        ? 'border:1px solid var(--g,#34a853);background:color-mix(in srgb,var(--g,#34a853) 14%,var(--cd,#1a1a1c));box-shadow:0 8px 24px rgba(52,168,83,0.15);'
        : '';

      const topRow = document.createElement('div');
      topRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;';

      const num = document.createElement('span');
      num.className = 'egg-num';
      num.textContent = `${egg.icon || '🥚'} #${String(egg.id).padStart(2, '0')}`;

      const pts = document.createElement('span');
      pts.style.cssText = 'font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;background:' + (isFound ? 'var(--g,#34a853);color:#fff;' : 'rgba(255,255,255,0.08);color:var(--mut,#888);');
      pts.textContent = `+${egg.points || 100} pts`;

      topRow.append(num, pts);

      const name = document.createElement('strong');
      name.style.cssText = 'font-size:15px;margin:2px 0;';
      name.textContent = isFound ? egg.name : '???';

      const hint = document.createElement('small');
      hint.style.cssText = 'color:' + (isFound ? 'var(--g,#34a853)' : 'var(--mut,#888)');
      hint.textContent = isFound ? 'Unlocked & Banked! 🎉' : `Hint: ${egg.hint}`;

      li.append(topRow, name, hint);
      return li;
    }));
  }

  /* ---- countdown ---- */
  let countdownTimer = null;
  let endsAt = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function tickCountdown() {
    const box = $('#egg-countdown');
    const out = $('#egg-countdown-value');
    if (!box || !out || !endsAt) return;
    const ms = endsAt - Date.now();
    if (ms <= 0) {
      out.textContent = 'Hunt is over';
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    out.textContent = d > 0
      ? `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`
      : `${pad(h)}:${pad(m)}:${pad(sec)}`;
  }

  function applySettings(row) {
    const rules = $('#egg-rules');
    if (rules) {
      rules.textContent = (row && row.rules_text) ? row.rules_text : 'Find secret features hidden across the site during the launch event! Points will be synced directly to the chapter leaderboard.';
    }
    const box = $('#egg-countdown');
    const title = $('#egg-countdown-title');
    const ends = row && row.countdown_ends_at ? Date.parse(row.countdown_ends_at) : NaN;
    const show = !!(row && row.countdown_enabled && Number.isFinite(ends));
    if (box) { box.hidden = !show; box.style.display = show ? '' : 'none'; }
    if (!show) {
      endsAt = null;
      clearInterval(countdownTimer);
      countdownTimer = null;
      return;
    }
    if (title) title.textContent = row.countdown_title || 'Hunt ends in';
    endsAt = ends;
    clearInterval(countdownTimer);
    tickCountdown();
    countdownTimer = setInterval(tickCountdown, 1000);
  }

  /* ---- load settings from Supabase ---- */
  async function loadSettings() {
    const url = window.SUPABASE_URL;
    const key = window.SUPABASE_ANON_KEY;
    if (!url || !key || !window.supabase?.createClient) {
      applySettings(null);
      return;
    }
    try {
      const sb = window.supabaseClient || window.supabase.createClient(url, key);
      const { data, error } = await sb
        .from('easter_egg_settings')
        .select('rules_text,countdown_title,countdown_ends_at,countdown_enabled')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      applySettings(data);
    } catch (e) {
      applySettings(null);
    }
  }

  let started = false;
  function start() {
    if (started || !$('#egg-grid')) return false;
    started = true;
    render();
    loadSettings();
    setInterval(loadSettings, 120000);
    return true;
  }
  if (!start()) {
    const observer = new MutationObserver(() => { if (start()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
