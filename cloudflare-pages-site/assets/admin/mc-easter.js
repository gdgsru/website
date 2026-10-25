/* Mission Control → Easter Egg Hunt (launch-day console).
 * Four tabs: Console (live wheel + top 10), Players (points entry), Prizes, Setup (rules + countdown).
 * Nothing is computed by the server except the wheel winner: the team enters what it needs.
 * Needs migrations 20261025120000, 20261025130000 and 20261025140000. */
(() => {
  'use strict';
  const MC = window.MC;
  const sb = MC.sb;
  const { $, $$, esc, icon, setWorkspace, audit, toast, confirmDialog, withSaving, authErrorText, istToIso, isoToIst, when } = MC;

  const WHEEL_MIN = 1;
  const WHEEL_MAX = 999;
  const TOP_N = 10;
  const MAX_POINTS = Array.isArray(window.GDG_EGGS) && window.GDG_EGGS.length ? window.GDG_EGGS.length : 30;
  const TABS = [['console', 'Console', 'spark'], ['players', 'Players', 'users'], ['prizes', 'Prizes', 'award'], ['setup', 'Setup', 'settings']];

  let tab = 'console';
  let channel = null;
  let ticker = null;
  let S = null; // { settings, prizes, people, wheel }
  let query = '';

  /* ---------- helpers ---------- */
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const normRoll = (v) => String(v || '').trim().replace(/\s+/g, '').toUpperCase();
  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rank = (people) => [...people].sort((a, b) => (b.hunt_points - a.hunt_points) || a.full_name.localeCompare(b.full_name));
  const usedNumbers = (exceptId = null) => new Set(S.people.filter((p) => p.wheel_number && p.id !== exceptId).map((p) => p.wheel_number));
  function randomUnused(used) {
    const pool = [];
    for (let n = WHEEL_MIN; n <= WHEEL_MAX; n++) if (!used.has(n)) pool.push(n);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
  }
  function flash(text, bad = false) {
    const el = $('#ee-status');
    if (el) { el.textContent = text; el.dataset.state = bad ? 'error' : 'ok'; }
    toast(text, !bad);
  }
  const rpcRow = (r) => (Array.isArray(r.data) ? r.data[0] : r.data);
  const rpcHint = (e) => (/function .* does not exist|schema cache/i.test(e?.message || '')
    ? 'Run the newest migration (20261025140000_easter_egg_console.sql) in Supabase, then try again.' : authErrorText(e));

  /* ---------- data ---------- */
  async function load() {
    const [settings, prizes, people, wheel] = await Promise.all([
      sb.from('easter_egg_settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('easter_egg_prizes').select('*').order('position').order('created_at'),
      sb.from('easter_egg_participants').select('*').order('hunt_points', { ascending: false }).order('full_name'),
      sb.from('easter_egg_wheel_state').select('*').eq('id', 1).maybeSingle()
    ]);
    const err = settings.error || prizes.error || people.error || wheel.error;
    if (err) throw err;
    S = {
      settings: settings.data || { rules_text: '', countdown_title: 'Hunt ends in', countdown_ends_at: null, countdown_enabled: false },
      prizes: prizes.data || [],
      people: people.data || [],
      wheel: wheel.data || { status: 'idle' }
    };
  }
  async function reload(message = '') {
    await load();
    paint();
    if (message) flash(message);
  }

  /* ---------- derived numbers ---------- */
  function stats() {
    const entrants = S.people.filter((p) => p.wheel_entrant);
    const inDraw = entrants.filter((p) => p.wheel_number && !p.has_won);
    return {
      players: S.people.length,
      points: S.people.reduce((a, p) => a + (p.hunt_points || 0), 0),
      entrants: entrants.length,
      inDraw: inDraw.length,
      noNumber: entrants.filter((p) => !p.wheel_number).length,
      prizesLeft: S.prizes.filter((p) => p.status === 'available').length,
      prizesTotal: S.prizes.length
    };
  }
  function remaining(iso) {
    const m = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 60000));
    const d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${m % 60}m` : `${m}m`;
  }
  function countdownText() {
    const s = S.settings;
    if (!s.countdown_enabled) return { t: 'Hidden', cls: '' };
    if (!s.countdown_ends_at) return { t: 'On, but no end time', cls: 'warn' };
    return new Date(s.countdown_ends_at) > new Date()
      ? { t: `${remaining(s.countdown_ends_at)} left`, cls: 'ok' } : { t: 'Finished', cls: '' };
  }

  /* ---------- rendering ---------- */
  function paint() {
    const st = stats();
    const open = tab;
    setWorkspace('Easter Egg Hunt', `
      <p id="ee-status" class="admin-status" data-state="ok" role="status" aria-live="polite"></p>
      <div class="ee-tabs" role="tablist" aria-label="Easter egg hunt sections">
        ${TABS.map(([id, label, ic]) => `<button type="button" role="tab" id="ee-tab-${id}" data-ee-tab="${id}" aria-selected="${id === open}" aria-controls="ee-pane-${id}" class="ee-tab">${icon(ic)}<span>${label}</span>${id === 'players' ? `<em>${st.players}</em>` : id === 'prizes' ? `<em>${st.prizesLeft}/${st.prizesTotal}</em>` : ''}</button>`).join('')}
      </div>
      <section id="ee-pane-console" role="tabpanel" aria-labelledby="ee-tab-console" ${open === 'console' ? '' : 'hidden'}>${consoleHtml(st)}</section>
      <section id="ee-pane-players" role="tabpanel" aria-labelledby="ee-tab-players" ${open === 'players' ? '' : 'hidden'}>${playersHtml()}</section>
      <section id="ee-pane-prizes" role="tabpanel" aria-labelledby="ee-tab-prizes" ${open === 'prizes' ? '' : 'hidden'}>${prizesHtml()}</section>
      <section id="ee-pane-setup" role="tabpanel" aria-labelledby="ee-tab-setup" ${open === 'setup' ? '' : 'hidden'}>${setupHtml()}</section>`);
    bind();
    startTicker();
  }

  function wheelCardHtml() {
    const w = S.wheel, st = stats();
    const rolling = w.status === 'rolling', stopped = w.status === 'stopped';
    const headline = rolling ? 'Spinning now' : stopped ? `Winner: #${esc(String(w.winner_number))}` : 'Ready';
    const sub = rolling ? 'Press Stop when the room is ready. The server picks the number.'
      : stopped ? `${esc(w.winner_prize_title || 'Prize')} · ${esc(MC.ago(w.updated_at))}`
      : st.prizesLeft ? `${st.inDraw} numbers in the draw · ${st.prizesLeft} prize${st.prizesLeft === 1 ? '' : 's'} left` : 'No prizes left to give';
    const blocked = !st.prizesLeft ? 'Add a prize first.' : !st.inDraw ? 'No numbers in the draw.' : '';
    return `<div class="ee-wheel ${rolling ? 'rolling' : stopped ? 'stopped' : ''}">
      <div class="ee-wheel-state"><span class="ee-pulse" aria-hidden="true"></span><div><b>${headline}</b><small>${sub}</small></div></div>
      <div class="admin-actions">
        <button type="button" id="ee-wheel-start" ${rolling || blocked ? 'disabled' : ''} title="${esc(blocked)}">${icon('refresh')}<span>Start spin</span></button>
        <button type="button" id="ee-wheel-stop" class="danger solid" ${rolling ? '' : 'disabled'}>Stop and pick winner</button>
        <button type="button" id="ee-wheel-redraw" class="button-outline" ${stopped && w.winner_number ? '' : 'disabled'} title="Winner is not in the room: put them back and free the prize">Winner absent, redraw</button>
        <button type="button" id="ee-wheel-reset" class="button-outline" ${w.status === 'idle' ? 'disabled' : ''}>Reset</button>
      </div>
    </div>`;
  }

  function consoleHtml(st) {
    const cd = countdownText();
    const top = rank(S.people).slice(0, TOP_N);
    const cutoff = rank(S.people)[TOP_N] || null;
    const tie = top.length === TOP_N && cutoff && cutoff.hunt_points === top[TOP_N - 1].hunt_points;
    const problems = [];
    if (S.settings.countdown_enabled && !S.settings.countdown_ends_at) problems.push('The countdown is on but has no end time.');
    if (!st.prizesTotal) problems.push('No prizes entered.');
    if (st.noNumber) problems.push(`${st.noNumber} wheel entrant${st.noNumber === 1 ? ' has' : 's have'} no wheel number.`);
    if (!st.players) problems.push('No players entered yet.');
    return `
      <div class="ee-stats">
        <div class="ee-stat"><b>${st.players}</b><span>Players</span></div>
        <div class="ee-stat"><b>${st.points}</b><span>Points entered</span></div>
        <div class="ee-stat"><b>${st.inDraw}</b><span>In the draw</span></div>
        <div class="ee-stat"><b>${st.prizesLeft}<small>/${st.prizesTotal}</small></b><span>Prizes left</span></div>
        <div class="ee-stat ${cd.cls}"><b class="ee-cd">${esc(cd.t)}</b><span>Countdown</span></div>
      </div>
      ${problems.length ? `<div class="ee-alert" role="note">${icon('alert')}<ul>${problems.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>` : ''}
      <section class="admin-panel"><div class="mc-card-head"><h2>Prize wheel</h2><span class="muted small"><a href="/wheel/" target="_blank" rel="noopener noreferrer">Projector view</a> · <a href="/easter-eggs/" target="_blank" rel="noopener noreferrer">Egg page</a></span></div><div id="ee-wheel-card">${wheelCardHtml()}</div></section>
      <section class="admin-panel">
        <div class="mc-card-head"><h2>Top ${TOP_N}</h2>
          <button type="button" id="ee-auto-top" class="button-outline" ${top.length ? '' : 'disabled'}>Mark top ${TOP_N} as entrants</button></div>
        ${tie ? `<p class="ee-note warn">${icon('alert')}<span>${esc(top[TOP_N - 1].full_name)} and ${esc(cutoff.full_name)} are tied on ${cutoff.hunt_points} points at the cut-off. Settle it in person, then adjust points or entrants by hand.</span></p>` : ''}
        ${top.length ? `<ol class="ee-top">${top.map((p, i) => `<li class="${p.wheel_entrant ? 'in' : ''}"><span class="ee-rank">${i + 1}</span><div><b>${esc(p.full_name)}</b><small>${esc(p.roll_number)}</small></div><span class="ee-pts">${p.hunt_points} pts</span>${p.has_won ? '<span class="mc-badge green">Won</span>' : p.wheel_entrant ? `<span class="mc-badge blue">${p.wheel_number ? '#' + p.wheel_number : 'No number'}</span>` : '<span class="mc-badge">Not entered</span>'}</li>`).join('')}</ol>`
          : '<p class="admin-empty">Enter players in the Players tab.</p>'}
      </section>`;
  }

  function playersHtml() {
    return `
      <section class="admin-panel">
        <div class="mc-card-head"><h2>Add or update a player</h2></div>
        <form id="ee-person-form" class="admin-form" autocomplete="off" novalidate>
          <input type="hidden" name="person_id">
          <div class="two-fields">
            <label>Roll number<input name="roll_number" required maxlength="40" autocapitalize="characters" spellcheck="false"></label>
            <label>Full name<input name="full_name" required maxlength="120"></label>
            <label>Hunt points (0–${MAX_POINTS})<input name="hunt_points" type="number" min="0" max="${MAX_POINTS}" inputmode="numeric" value="0" required></label>
            <label>Wheel number (${WHEEL_MIN}–${WHEEL_MAX})
              <span class="admin-inline"><input name="wheel_number" type="number" min="${WHEEL_MIN}" max="${WHEEL_MAX}" inputmode="numeric"><button type="button" id="ee-random-number" class="button-outline">Random</button></span></label>
          </div>
          <label class="admin-check"><input name="wheel_entrant" type="checkbox"> Wheel entrant (top ${TOP_N})</label>
          <div class="admin-actions"><button type="submit">Save player</button><button type="button" id="ee-person-clear" class="button-outline">Clear form</button></div>
        </form>
        <p class="muted small">Saving a roll number that already exists updates that player. A wheel number is assigned automatically if a wheel entrant has none.</p>
      </section>

      <details class="admin-panel ee-bulk">
        <summary><b>Bulk add from a list</b></summary>
        <form id="ee-bulk-form" class="admin-form">
          <label>One player per line: <code>roll number, name, points</code>
            <textarea name="bulk" rows="6" placeholder="21A91A0501, Asha Rao, 17&#10;21A91A0532, Vikram Singh, 14"></textarea></label>
          <div class="admin-actions"><button type="submit">Import list</button></div>
          <p id="ee-bulk-note" class="muted small" role="status"></p>
        </form>
      </details>

      <section class="admin-panel">
        <div class="mc-card-head"><h2>Leaderboard <small>(${S.people.length})</small></h2>
          <div class="admin-actions"><input id="ee-search" type="search" class="ee-search" placeholder="Search name or roll number" aria-label="Search players" value="${esc(query)}"><button type="button" id="ee-export" class="button-outline" ${S.people.length ? '' : 'disabled'}>${icon('download')}<span>CSV</span></button></div></div>
        <div id="ee-people">${peopleListHtml()}</div>
      </section>`;
  }

  function peopleListHtml() {
    if (!S.people.length) return '<p class="admin-empty">No players yet.</p>';
    const q = query.trim().toLowerCase();
    const ranked = rank(S.people);
    const rows = ranked.map((p, i) => ({ p, pos: i + 1 })).filter(({ p }) => !q || p.full_name.toLowerCase().includes(q) || p.roll_number.toLowerCase().includes(q));
    if (!rows.length) return '<p class="admin-empty">No one matches that search.</p>';
    return `<div class="table-wrap"><table class="ee-table"><thead><tr><th>#</th><th>Player</th><th>Points</th><th>Wheel</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${rows.map(({ p, pos }) => `
      <tr class="${pos <= TOP_N ? 'top' : ''}">
        <td>${pos}</td>
        <td><b>${esc(p.full_name)}</b><br><small>${esc(p.roll_number)}</small></td>
        <td><span class="ee-step"><button type="button" class="mc-icon-btn" data-ee-pts="-1" data-id="${esc(p.id)}" aria-label="Remove a point from ${esc(p.full_name)}" ${p.hunt_points <= 0 ? 'disabled' : ''}>−</button><b>${p.hunt_points}</b><button type="button" class="mc-icon-btn" data-ee-pts="1" data-id="${esc(p.id)}" aria-label="Add a point to ${esc(p.full_name)}" ${p.hunt_points >= MAX_POINTS ? 'disabled' : ''}>+</button></span></td>
        <td>${p.has_won ? '<span class="mc-badge green">Won</span>' : p.wheel_entrant ? `<span class="mc-badge blue">${p.wheel_number ? '#' + p.wheel_number : 'No number'}</span>` : '<span class="muted">—</span>'}</td>
        <td class="ee-row-actions"><button type="button" class="button-outline" data-ee-edit="${esc(p.id)}">Edit</button><button type="button" class="danger" data-ee-del="${esc(p.id)}">Delete</button></td>
      </tr>`).join('')}</tbody></table></div>`;
  }

  function prizesHtml() {
    return `
      <section class="admin-panel">
        <div class="mc-card-head"><h2>Add a prize</h2></div>
        <form id="ee-prize-form" class="admin-form" novalidate>
          <div class="two-fields">
            <label>Prize name<input name="title" required maxlength="120" placeholder="e.g. Google Cloud credits"></label>
            <label>Order on the wheel<input name="position" type="number" min="1" max="99" value="${S.prizes.length + 1}" required></label>
          </div>
          <div class="admin-actions"><button type="submit">Add prize</button></div>
        </form>
        <p class="muted small">Prizes are given out in this order, one per spin.</p>
      </section>
      <section class="admin-panel">
        <div class="mc-card-head"><h2>Prizes <small>(${S.prizes.length})</small></h2></div>
        ${S.prizes.length ? S.prizes.map((p) => `
          <div class="admin-list-row">
            <div><b>${esc(p.title)}</b><small>Position ${esc(String(p.position))} · ${p.status === 'won' ? `Won by #${esc(String(p.won_by_number ?? '—'))}` : 'Available'}</small></div>
            <div class="admin-actions">
              <button type="button" class="button-outline" data-ee-prize-edit="${esc(p.id)}" ${p.status === 'won' ? 'disabled' : ''}>Rename</button>
              <button type="button" class="danger" data-ee-prize-del="${esc(p.id)}" ${p.status === 'won' ? 'disabled title="Already won. Use Winner absent, redraw on the Console first."' : ''}>Delete</button>
            </div>
          </div>`).join('') : '<p class="admin-empty">No prizes yet.</p>'}
      </section>`;
  }

  function setupHtml() {
    const s = S.settings;
    return `
      <section class="admin-panel">
        <div class="mc-card-head"><h2>Rules and countdown</h2></div>
        <form id="ee-settings-form" class="admin-form" novalidate>
          <label>Rules (plain text, line breaks kept)
            <textarea name="rules_text" rows="8" maxlength="4000">${esc(s.rules_text || '')}</textarea></label>
          <div class="two-fields">
            <label>Countdown title<input name="countdown_title" maxlength="80" value="${esc(s.countdown_title || 'Hunt ends in')}"></label>
            <label>Countdown ends at (IST)<input name="countdown_ends_at" type="datetime-local" value="${esc(isoToIst(s.countdown_ends_at))}"></label>
          </div>
          <label class="admin-check"><input name="countdown_enabled" type="checkbox" ${s.countdown_enabled ? 'checked' : ''}> Show the countdown on the Easter Egg page</label>
          ${s.countdown_ends_at ? `<p class="muted small">Currently set to ${esc(when(s.countdown_ends_at))} IST.</p>` : ''}
          <div class="admin-actions"><button type="submit">Save rules and countdown</button></div>
        </form>
        <p class="muted small">The public page picks up changes within two minutes.</p>
      </section>`;
  }

  /* ---------- live wheel + countdown refresh ---------- */
  function refreshWheelCard() {
    const card = $('#ee-wheel-card');
    if (card) { card.innerHTML = wheelCardHtml(); bindWheel(); }
  }
  function startTicker() {
    clearInterval(ticker);
    ticker = setInterval(() => {
      if (!$('#ee-pane-console')) { clearInterval(ticker); return; }
      const el = $('.ee-cd'); if (el) el.textContent = countdownText().t;
    }, 30000);
  }
  function subscribe() {
    if (channel) { try { sb.removeChannel(channel); } catch (_) { /* ignore */ } channel = null; }
    try {
      channel = sb.channel('mc-easter-wheel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'easter_egg_wheel_state' }, async () => {
          if (!$('#ee-pane-console')) return;
          const r = await sb.from('easter_egg_wheel_state').select('*').eq('id', 1).maybeSingle();
          if (!r.error && r.data) { S.wheel = r.data; refreshWheelCard(); }
        }).subscribe();
    } catch (_) { /* realtime is optional */ }
  }

  /* ---------- actions ---------- */
  async function wheelCall(label, fn, okText) {
    const r = await fn();
    if (r.error) return flash(`${label}: ${rpcHint(r.error)}`, true);
    await audit(label.toLowerCase().replace(/\s+/g, '_'), 'easter_egg_wheel_state', 'prize wheel');
    await reload(typeof okText === 'function' ? okText(r) : okText);
  }

  function bindWheel() {
    $('#ee-wheel-start')?.addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      const now = new Date().toISOString();
      await wheelCall('Start spin', () => sb.from('easter_egg_wheel_state').update({
        status: 'rolling', started_at: now, winner_number: null, winner_prize_id: null, winner_prize_title: null, updated_at: now
      }).eq('id', 1).eq('status', 'idle'), 'Spin started. Press Stop when you are ready.');
    });
    $('#ee-wheel-stop')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const next = S.prizes.filter((p) => p.status === 'available').sort((a, b) => a.position - b.position)[0];
      if (!(await confirmDialog({ title: 'Stop the wheel and pick the winner?', body: `The server will pick a winning number now${next ? ` for "${next.title}"` : ''}. You can undo it afterwards with "Winner absent, redraw".`, confirm: 'Stop and pick' }))) return;
      btn.disabled = true;
      await wheelCall('Stop spin', () => sb.rpc('easter_egg_wheel_stop'), (r) => { const row = rpcRow(r); return row ? `Winner: #${row.winner_number} · ${row.prize_title}` : 'Winner picked.'; });
    });
    $('#ee-wheel-redraw')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const w = S.wheel;
      if (!(await confirmDialog({ title: `Release #${w.winner_number}?`, body: `Use this only if the winner is not in the room. They go back into the draw and "${w.winner_prize_title || 'the prize'}" becomes available again.`, confirm: 'Release winner', danger: true }))) return;
      btn.disabled = true;
      await wheelCall('Redraw', () => sb.rpc('easter_egg_wheel_redraw'), (r) => { const row = rpcRow(r); return row ? `Released #${row.released_number}. Start another spin.` : 'Winner released.'; });
    });
    $('#ee-wheel-reset')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      const rolling = S.wheel.status === 'rolling';
      if (!(await confirmDialog({ title: 'Reset the wheel?', body: rolling ? 'This cancels the spin in progress. No winner is picked.' : 'The projector goes back to its ready screen. Past winners stay removed from the draw.', confirm: 'Reset', danger: rolling }))) return;
      btn.disabled = true;
      await wheelCall('Reset wheel', () => sb.rpc('easter_egg_wheel_reset'), 'Wheel reset.');
    });
  }

  function bind() {
    $$('[data-ee-tab]').forEach((b) => b.addEventListener('click', () => {
      tab = b.dataset.eeTab;
      $$('[data-ee-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      TABS.forEach(([id]) => { const p = $(`#ee-pane-${id}`); if (p) p.hidden = id !== tab; });
    }));
    $('.ee-tabs')?.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const ids = TABS.map((t) => t[0]), i = ids.indexOf(tab), n = ids[(i + (e.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length];
      $(`#ee-tab-${n}`)?.click(); $(`#ee-tab-${n}`)?.focus();
    });
    bindWheel();

    bindAuto();
    bindPlayers();
  }

  function bindAuto() {
    $('#ee-auto-top')?.addEventListener('click', async () => {
      const top = rank(S.people).slice(0, TOP_N);
      const used = usedNumbers();
      const rows = top.filter((p) => !p.wheel_entrant || !p.wheel_number).map((p) => {
        const n = p.wheel_number || randomUnused(used); if (n) used.add(n);
        return { id: p.id, roll_number: p.roll_number, full_name: p.full_name, hunt_points: p.hunt_points, wheel_entrant: true, wheel_number: n, updated_at: new Date().toISOString() };
      });
      if (!rows.length) return flash(`The top ${TOP_N} are already on the wheel.`);
      if (rows.some((r) => !r.wheel_number)) return flash('All wheel numbers are in use.', true);
      if (!(await confirmDialog({ title: `Put ${rows.length} player${rows.length === 1 ? '' : 's'} on the wheel?`, body: `${rows.map((r) => r.full_name).join(', ')} will become wheel entrants with random numbers where they have none.`, confirm: 'Mark as entrants' }))) return;
      const r = await sb.from('easter_egg_participants').upsert(rows, { onConflict: 'id' });
      if (r.error) return flash(`Could not save: ${authErrorText(r.error)}`, true);
      await audit('update', 'easter_egg_participants', `top ${TOP_N} entrants`);
      reload(`${rows.length} player${rows.length === 1 ? '' : 's'} added to the wheel.`);
    });
  }

  function refreshConsole() {
    const pane = $('#ee-pane-console');
    if (pane) { pane.innerHTML = consoleHtml(stats()); bindWheel(); bindAuto(); }
  }

  function bindPlayers() {
    const f = $('#ee-person-form');
    if (f) {
      const entrant = f.querySelector('[name="wheel_entrant"]'), numIn = f.querySelector('[name="wheel_number"]');
      const clear = () => { f.reset(); f.person_id.value = ''; f.hunt_points.value = 0; };
      $('#ee-person-clear').addEventListener('click', clear);
      $('#ee-random-number').addEventListener('click', () => {
        const n = randomUnused(usedNumbers(f.person_id.value || null));
        if (n === null) return flash('All wheel numbers are in use.', true);
        numIn.value = n; entrant.checked = true;
      });
      f.addEventListener('submit', (ev) => {
        ev.preventDefault();
        withSaving(f, async () => {
          const roll = normRoll(f.roll_number.value), name = f.full_name.value.trim().replace(/\s+/g, ' ');
          const points = Number(f.hunt_points.value);
          if (!/^[A-Z0-9][A-Z0-9\-_/]{2,39}$/.test(roll)) return flash('Roll number: 3–40 letters, digits, - _ or /.', true);
          if (name.length < 2) return flash('Enter the full name.', true);
          if (!Number.isInteger(points) || points < 0 || points > MAX_POINTS) return flash(`Points must be a whole number from 0 to ${MAX_POINTS}.`, true);
          const editing = f.person_id.value || null;
          const existing = S.people.find((p) => p.roll_number === roll);
          if (!editing && existing && !(await confirmDialog({ title: 'Update the existing player?', body: `${roll} is already entered as ${existing.full_name}. Saving replaces their name and points.`, confirm: 'Update' }))) return;
          const isEntrant = entrant.checked;
          const self = editing || existing?.id || null;
          let n = isEntrant ? num(numIn.value) : null;
          if (isEntrant && n === null) n = existing?.wheel_number || randomUnused(usedNumbers(self));
          if (isEntrant && (n === null || !Number.isInteger(n) || n < WHEEL_MIN || n > WHEEL_MAX)) return flash(`Wheel numbers are whole numbers from ${WHEEL_MIN} to ${WHEEL_MAX}.`, true);
          if (n !== null && usedNumbers(self).has(n)) return flash(`Wheel number ${n} belongs to someone else.`, true);
          const row = { roll_number: roll, full_name: name, hunt_points: points, wheel_entrant: isEntrant, wheel_number: n, updated_at: new Date().toISOString() };
          const r = editing
            ? await sb.from('easter_egg_participants').update(row).eq('id', editing)
            : await sb.from('easter_egg_participants').upsert(row, { onConflict: 'roll_number' });
          if (r.error) return flash(/duplicate|unique/i.test(r.error.message || '') ? 'That roll number or wheel number is already in use.' : `Could not save: ${authErrorText(r.error)}`, true);
          await audit(editing ? 'update' : 'upsert', 'easter_egg_participants', name);
          await reload(`Saved ${name}.`);
        });
      });
    }
    $('#ee-search')?.addEventListener('input', MC.debounce((e) => { query = e.target.value; const box = $('#ee-people'); if (box) { box.innerHTML = peopleListHtml(); bindPeople(); } }, 150));
    $('#ee-export')?.addEventListener('click', () => {
      const csv = ['Position,Roll number,Name,Points,Wheel entrant,Wheel number,Won']
        .concat(rank(S.people).map((p, i) => [i + 1, p.roll_number, p.full_name, p.hunt_points, p.wheel_entrant ? 'yes' : 'no', p.wheel_number || '', p.has_won ? 'yes' : 'no'].map(csvCell).join(','))).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'easter-egg-hunt-players.csv';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('#ee-bulk-form')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      withSaving(form, async () => {
        const note = $('#ee-bulk-note'), seen = new Set(), rows = [], bad = [];
        form.bulk.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).forEach((line, i) => {
          const parts = line.split(/\t|,/).map((x) => x.trim());
          const roll = normRoll(parts[0]), name = (parts[1] || '').replace(/\s+/g, ' '), pts = parts[2] === undefined || parts[2] === '' ? 0 : Number(parts[2]);
          if (/^(ROLL|ROLLNUMBER)$/.test(roll) && i === 0) return; // header row
          if (!/^[A-Z0-9][A-Z0-9\-_/]{2,39}$/.test(roll) || name.length < 2 || !Number.isInteger(pts) || pts < 0 || pts > MAX_POINTS || seen.has(roll)) { bad.push(i + 1); return; }
          seen.add(roll); rows.push({ roll_number: roll, full_name: name, hunt_points: pts, updated_at: new Date().toISOString() });
        });
        if (bad.length) { note.textContent = `Fix line${bad.length === 1 ? '' : 's'} ${bad.slice(0, 10).join(', ')}${bad.length > 10 ? '…' : ''}. Nothing was imported.`; return flash('Some lines could not be read. Nothing was imported.', true); }
        if (!rows.length) { note.textContent = 'Nothing to import.'; return; }
        const clash = rows.filter((r) => S.people.some((p) => p.roll_number === r.roll_number)).length;
        if (!(await confirmDialog({ title: `Import ${rows.length} player${rows.length === 1 ? '' : 's'}?`, body: clash ? `${clash} already exist and will have their name and points replaced. Wheel entries are kept.` : 'They will be added to the leaderboard.', confirm: 'Import' }))) return;
        const r = await sb.from('easter_egg_participants').upsert(rows, { onConflict: 'roll_number' });
        if (r.error) return flash(`Could not import: ${authErrorText(r.error)}`, true);
        await audit('import', 'easter_egg_participants', `${rows.length} players`);
        await reload(`Imported ${rows.length} player${rows.length === 1 ? '' : 's'}.`);
      });
    });
    bindPeople();

    /* prizes */
    $('#ee-prize-form')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      withSaving(form, async () => {
        const title = form.title.value.trim(), position = Number(form.position.value);
        if (!title) return flash('Enter the prize name.', true);
        if (!Number.isInteger(position) || position < 1 || position > 99) return flash('Order must be 1–99.', true);
        const r = await sb.from('easter_egg_prizes').insert({ title, position });
        if (r.error) return flash(`Could not add prize: ${authErrorText(r.error)}`, true);
        await audit('create', 'easter_egg_prizes', title);
        await reload(`Prize added: ${title}`);
      });
    });
    $$('[data-ee-prize-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = S.prizes.find((x) => x.id === b.dataset.eePrizeDel); if (!p || p.status === 'won') return;
      if (!(await confirmDialog({ title: `Delete "${p.title}"?`, body: 'This cannot be undone.', confirm: 'Delete', danger: true }))) return;
      const r = await sb.from('easter_egg_prizes').delete().eq('id', p.id);
      if (r.error) return flash(authErrorText(r.error), true);
      await audit('delete', 'easter_egg_prizes', p.title); await reload('Prize deleted.');
    }));
    $$('[data-ee-prize-edit]').forEach((b) => b.addEventListener('click', async () => {
      const p = S.prizes.find((x) => x.id === b.dataset.eePrizeEdit); if (!p) return;
      const title = (window.prompt('Prize name', p.title) || '').trim();
      if (!title || title === p.title) return;
      const r = await sb.from('easter_egg_prizes').update({ title: title.slice(0, 120) }).eq('id', p.id);
      if (r.error) return flash(authErrorText(r.error), true);
      await audit('update', 'easter_egg_prizes', title); await reload('Prize renamed.');
    }));

    /* setup */
    $('#ee-settings-form')?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const form = ev.currentTarget;
      withSaving(form, async () => {
        const payload = {
          id: 1,
          rules_text: form.rules_text.value.trim(),
          countdown_title: form.countdown_title.value.trim() || 'Hunt ends in',
          countdown_ends_at: istToIso(form.countdown_ends_at.value),
          countdown_enabled: form.countdown_enabled.checked,
          updated_at: new Date().toISOString()
        };
        if (payload.countdown_enabled && !payload.countdown_ends_at) return flash('Set an end time before showing the countdown.', true);
        const r = await sb.from('easter_egg_settings').upsert(payload);
        if (r.error) return flash(`Could not save: ${authErrorText(r.error)}`, true);
        await audit('update', 'easter_egg_settings', 'rules and countdown');
        await reload('Rules and countdown saved. The Easter Egg page updates within two minutes.');
      });
    });
  }

  function bindPeople() {
    const f = $('#ee-person-form');
    $$('[data-ee-edit]').forEach((b) => b.addEventListener('click', () => {
      const p = S.people.find((x) => x.id === b.dataset.eeEdit); if (!p || !f) return;
      f.person_id.value = p.id; f.roll_number.value = p.roll_number; f.full_name.value = p.full_name;
      f.hunt_points.value = p.hunt_points; f.wheel_entrant.checked = !!p.wheel_entrant; f.wheel_number.value = p.wheel_number || '';
      f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.full_name.focus({ preventScroll: true });
    }));
    $$('[data-ee-del]').forEach((b) => b.addEventListener('click', async () => {
      const p = S.people.find((x) => x.id === b.dataset.eeDel); if (!p) return;
      if (!(await confirmDialog({ title: `Delete ${p.full_name}?`, body: p.has_won ? 'This player already won a prize. Deleting them does not change the prize record.' : 'They are removed from the leaderboard and the wheel. This cannot be undone.', confirm: 'Delete', danger: true }))) return;
      const r = await sb.from('easter_egg_participants').delete().eq('id', p.id);
      if (r.error) return flash(authErrorText(r.error), true);
      await audit('delete', 'easter_egg_participants', p.full_name); await reload(`Deleted ${p.full_name}.`);
    }));
    $$('[data-ee-pts]').forEach((b) => b.addEventListener('click', async () => {
      const p = S.people.find((x) => x.id === b.dataset.id); if (!p) return;
      const next = Math.min(MAX_POINTS, Math.max(0, p.hunt_points + Number(b.dataset.eePts)));
      if (next === p.hunt_points) return;
      $$('[data-ee-pts]').forEach((x) => { x.disabled = true; });
      const r = await sb.from('easter_egg_participants').update({ hunt_points: next, updated_at: new Date().toISOString() }).eq('id', p.id);
      if (r.error) { flash(authErrorText(r.error), true); } else { p.hunt_points = next; await audit('update', 'easter_egg_participants', `${p.full_name}: ${next} pts`); }
      const box = $('#ee-people'); if (box) { box.innerHTML = peopleListHtml(); bindPeople(); }
      refreshConsole();
    }));
  }

  MC.pages['easter-eggs'] = async () => {
    query = '';
    await load();
    paint();
    subscribe();
  };
})();
