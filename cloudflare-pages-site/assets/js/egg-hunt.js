/* Easter egg hunt page logic.
 * - Rules and countdown are read from easter_egg_settings (set in Mission Control).
 * - Found eggs are remembered on this device (localStorage).
 * - Points are awarded manually by the team; this file never sends points anywhere.
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
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) { /* private mode: keep in memory */ }
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
    toast(`Egg found: ${egg.name}`);
    render();
    document.dispatchEvent(new CustomEvent('gdg-egg-found', { detail: { id: n } }));
    return true;
  }

  window.GDGEggs = {
    find,
    found: () => [...found],
    count: () => found.length,
    total: () => eggs.length
  };

  /* ---- egg grid ---- */
  function render() {
    const grid = $('#egg-grid');
    const summary = $('#egg-summary');
    if (summary) summary.textContent = `${found.length} of ${eggs.length} eggs found`;
    if (!grid) return;
    grid.replaceChildren(...eggs.map((egg) => {
      const li = document.createElement('li');
      const isFound = found.includes(egg.id);
      li.className = isFound ? 'egg is-found' : 'egg';
      const num = document.createElement('span');
      num.className = 'egg-num';
      num.textContent = String(egg.id).padStart(2, '0');
      const name = document.createElement('strong');
      name.textContent = isFound ? egg.name : '???';
      const hint = document.createElement('small');
      hint.textContent = isFound ? 'Found' : `Hint: ${egg.hint}`;
      li.append(num, name, hint);
      return li;
    }));
  }

  /* ---- countdown (recomputed from timestamps, so it survives sleep and tab switches) ---- */
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
      rules.textContent = (row && row.rules_text) ? row.rules_text : 'Rules will appear here soon.';
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

  /* ---- load settings from Supabase (page still works offline) ---- */
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

  // The router renders the page into #app, so wait until the egg grid exists.
  let started = false;
  function start() {
    if (started || !$('#egg-grid')) return false;
    started = true;
    render();
    loadSettings();
    setInterval(loadSettings, 120000); // refresh rules and countdown every two minutes
    return true;
  }
  if (!start()) {
    const observer = new MutationObserver(() => { if (start()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
