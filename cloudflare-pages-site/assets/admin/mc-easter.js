/* Mission Control → Easter Egg Hunt.
 * Rules, countdown, prizes, and participants (with manually entered points) are
 * all edited here. Nothing is computed by the server: the team enters what it needs. */
(() => {
  'use strict';
  const MC = window.MC;
  const sb = MC.sb;
  const { $, $$, esc, setWorkspace, audit } = MC;
  const bindDeleteButtons = () => MC.bindDeleteButtons(document);

  const WHEEL_MIN = 1;
  const WHEEL_MAX = 999;

  /* Convert between a stored UTC timestamp and a datetime-local input (local time). */
  function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d - offset).toISOString().slice(0, 16);
  }
  function fromLocalInput(value) {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  function setStatus(text, isError = false) {
    const el = $('#ee-status');
    if (!el) return;
    el.textContent = text;
    el.dataset.state = isError ? 'error' : 'ok';
  }

  function randomUnusedNumber(used) {
    const pool = [];
    for (let n = WHEEL_MIN; n <= WHEEL_MAX; n++) if (!used.has(n)) pool.push(n);
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  async function adminEasterEggs(flash = '') {
    const [settings, prizes, people, wheel] = await Promise.all([
      sb.from('easter_egg_settings').select('*').eq('id', 1).maybeSingle(),
      sb.from('easter_egg_prizes').select('*').order('position'),
      sb.from('easter_egg_participants').select('*')
        .order('hunt_points', { ascending: false })
        .order('full_name'),
      sb.from('easter_egg_wheel_state').select('*').eq('id', 1).maybeSingle()
    ]);
    if (settings.error || prizes.error || people.error || wheel.error) {
      throw settings.error || prizes.error || people.error || wheel.error;
    }
    const w = wheel.data || { status: 'idle' };

    const s = settings.data || { rules_text: '', countdown_title: 'Hunt ends in', countdown_ends_at: null, countdown_enabled: false };
    const prizeList = prizes.data || [];
    const peopleList = people.data || [];
    const usedNumbers = new Set(peopleList.filter(p => p.wheel_number).map(p => p.wheel_number));
    const prizesAvailable = prizeList.filter(p => p.status === 'available').length;
    const entrantsInDraw = peopleList.filter(p => p.wheel_entrant && p.wheel_number && !p.has_won).length;
    const wheelStatusText = w.status === 'rolling'
      ? 'Spinning now'
      : w.status === 'stopped'
        ? `Last winner: #${esc(String(w.winner_number))} · ${esc(w.winner_prize_title || '')}`
        : 'Idle';

    setWorkspace('Easter Egg Hunt', `
      <p class="admin-lead">Rules and countdown appear on the public Easter Egg page. Points, prizes, and wheel entries are entered by the team.</p>
      <p id="ee-status" class="admin-status" data-state="ok" role="status" aria-live="polite">${esc(flash)}</p>

      <section class="admin-panel">
        <h2>Rules and countdown</h2>
        <form id="ee-settings-form" class="admin-form">
          <label>Rules (plain text, line breaks kept)
            <textarea name="rules_text" rows="8" maxlength="4000">${esc(s.rules_text || '')}</textarea>
          </label>
          <label>Countdown title
            <input name="countdown_title" maxlength="80" value="${esc(s.countdown_title || 'Hunt ends in')}">
          </label>
          <label>Countdown ends at (your local time)
            <input name="countdown_ends_at" type="datetime-local" value="${esc(toLocalInput(s.countdown_ends_at))}">
          </label>
          <label class="admin-check">
            <input name="countdown_enabled" type="checkbox" ${s.countdown_enabled ? 'checked' : ''}>
            Show the countdown on the Easter Egg page
          </label>
          <button type="submit">Save rules and countdown</button>
        </form>
      </section>

      <section class="admin-panel">
        <h2>Prize wheel</h2>
        <p class="admin-lead">Press Start, then Stop when the room is ready. The winning number is picked by the server when you press Stop. Each winner is removed from the draw.</p>
        <p class="admin-lead"><b>Status:</b> ${wheelStatusText}<br><b>Prizes available:</b> ${prizesAvailable} · <b>Numbers in the draw:</b> ${entrantsInDraw}</p>
        <div class="admin-actions">
          <button type="button" id="ee-wheel-start" ${w.status === 'rolling' || !prizesAvailable || !entrantsInDraw ? 'disabled' : ''}>Start spin</button>
          <button type="button" id="ee-wheel-stop" class="danger" ${w.status === 'rolling' ? '' : 'disabled'}>Stop and pick winner</button>
        </div>
      </section>

      <section class="admin-panel">
        <h2>Prizes <small>(${prizeList.length} entered, normally 3)</small></h2>
        <form id="ee-prize-form" class="admin-form">
          <label>Prize name<input name="title" required maxlength="120" placeholder="e.g. Google Cloud credits"></label>
          <label>Order on the wheel<input name="position" type="number" min="1" max="99" value="${prizeList.length + 1}" required></label>
          <button type="submit">Add prize</button>
        </form>
        <div class="admin-list">
          ${prizeList.length ? prizeList.map(p => `
            <div class="admin-list-row">
              <div><b>${esc(p.title)}</b>
                <small>Position ${esc(String(p.position))} · ${p.status === 'won' ? `Won by #${esc(String(p.won_by_number ?? '—'))}` : 'Available'}</small>
              </div>
              <button type="button" data-delete="easter_egg_prizes" data-id="${esc(p.id)}" data-label="${esc(p.title)}" class="danger">Delete</button>
            </div>`).join('') : '<p class="admin-empty">No prizes yet.</p>'}
        </div>
      </section>

      <section class="admin-panel">
        <h2>Participants and points <small>(${peopleList.length} entered)</small></h2>
        <p class="admin-lead">Enter each guest's hunt points by hand. Ties are settled in person by coin toss. Tick "Wheel entrant" for the top 10, and give each entrant a wheel number. Saving a roll number that already exists updates that person.</p>
        <form id="ee-person-form" class="admin-form">
          <input type="hidden" name="person_id">
          <label>Roll number<input name="roll_number" required maxlength="40"></label>
          <label>Full name<input name="full_name" required maxlength="120"></label>
          <label>Hunt points<input name="hunt_points" type="number" min="0" max="30" value="0" required></label>
          <label class="admin-check"><input name="wheel_entrant" type="checkbox"> Wheel entrant (top 10)</label>
          <label>Wheel number (1–999)
            <span class="admin-inline">
              <input name="wheel_number" type="number" min="${WHEEL_MIN}" max="${WHEEL_MAX}">
              <button type="button" id="ee-random-number">Random unused</button>
            </span>
          </label>
          <button type="submit">Save participant</button>
          <button type="button" id="ee-person-clear" class="ghost">Clear form</button>
        </form>
        <div class="admin-list">
          ${peopleList.length ? peopleList.map((p, i) => `
            <div class="admin-list-row">
              <div><b>${esc(p.full_name)}</b>
                <small>${esc(p.roll_number)} · ${esc(String(p.hunt_points))} pts · Hunt position ${i + 1}${p.wheel_entrant ? ` · Wheel ${p.wheel_number ? '#' + esc(String(p.wheel_number)) : 'no number yet'}` : ''}</small>
              </div>
              <div class="admin-actions">
                <button type="button" data-ee-edit="${esc(p.id)}">Edit</button>
                <button type="button" data-delete="easter_egg_participants" data-id="${esc(p.id)}" data-label="${esc(p.full_name)}" class="danger">Delete</button>
              </div>
            </div>`).join('') : '<p class="admin-empty">No participants yet.</p>'}
        </div>
      </section>
    `);

    /* Rules and countdown */
    $('#ee-settings-form')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.currentTarget;
      const payload = {
        id: 1,
        rules_text: f.rules_text.value.trim(),
        countdown_title: f.countdown_title.value.trim() || 'Hunt ends in',
        countdown_ends_at: fromLocalInput(f.countdown_ends_at.value),
        countdown_enabled: f.countdown_enabled.checked,
        updated_at: new Date().toISOString()
      };
      if (payload.countdown_enabled && !payload.countdown_ends_at) {
        setStatus('Set an end time before showing the countdown.', true);
        return;
      }
      const r = await sb.from('easter_egg_settings').upsert(payload);
      if (r.error) return setStatus(`Could not save: ${r.error.message}`, true);
      await audit('update', 'easter_egg_settings', 'rules and countdown');
      setStatus('Rules and countdown saved. The Easter Egg page updates within two minutes.');
    });

    /* Prizes */
    $('#ee-prize-form')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.currentTarget;
      const row = {
        title: f.querySelector('[name="title"]').value.trim(),
        position: Number(f.position.value) || 1
      };
      const r = await sb.from('easter_egg_prizes').insert(row);
      if (r.error) return setStatus(`Could not add prize: ${r.error.message}`, true);
      await audit('create', 'easter_egg_prizes', row.title);
      adminEasterEggs(`Prize added: ${row.title}`);
    });

    /* Participants */
    const personForm = $('#ee-person-form');
    const numberInput = personForm?.querySelector('[name="wheel_number"]');
    const entrantBox = personForm?.querySelector('[name="wheel_entrant"]');

    function fillPerson(p) {
      personForm.person_id.value = p.id;
      personForm.roll_number.value = p.roll_number;
      personForm.full_name.value = p.full_name;
      personForm.hunt_points.value = p.hunt_points;
      entrantBox.checked = !!p.wheel_entrant;
      numberInput.value = p.wheel_number || '';
      personForm.roll_number.focus();
    }

    function clearPerson() {
      personForm.reset();
      personForm.person_id.value = '';
      personForm.hunt_points.value = 0;
    }

    document.querySelectorAll('[data-ee-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = peopleList.find(x => x.id === btn.dataset.eeEdit);
        if (p) fillPerson(p);
      });
    });

    $('#ee-person-clear')?.addEventListener('click', clearPerson);

    $('#ee-random-number')?.addEventListener('click', () => {
      const current = Number(numberInput.value) || null;
      const used = new Set(usedNumbers);
      if (current) used.delete(current);
      const n = randomUnusedNumber(used);
      if (n === null) return setStatus('All wheel numbers are in use.', true);
      numberInput.value = n;
    });

    personForm?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const f = ev.currentTarget;
      const isEntrant = entrantBox.checked;
      let wheelNumber = isEntrant && numberInput.value ? Number(numberInput.value) : null;

      if (isEntrant && wheelNumber === null) {
        const used = new Set(usedNumbers);
        wheelNumber = randomUnusedNumber(used);
        if (wheelNumber === null) return setStatus('All wheel numbers are in use.', true);
      }
      if (wheelNumber !== null && (wheelNumber < WHEEL_MIN || wheelNumber > WHEEL_MAX)) {
        return setStatus(`Wheel numbers must be between ${WHEEL_MIN} and ${WHEEL_MAX}.`, true);
      }

      const row = {
        roll_number: f.roll_number.value.trim(),
        full_name: f.full_name.value.trim(),
        hunt_points: Math.max(0, Number(f.hunt_points.value) || 0),
        wheel_entrant: isEntrant,
        wheel_number: wheelNumber,
        updated_at: new Date().toISOString()
      };

      const r = f.person_id.value
        ? await sb.from('easter_egg_participants').update(row).eq('id', f.person_id.value)
        : await sb.from('easter_egg_participants').upsert(row, { onConflict: 'roll_number' });
      if (r.error) {
        const dup = /duplicate|unique/i.test(r.error.message || '');
        return setStatus(dup ? 'That wheel number or roll number is already in use.' : `Could not save: ${r.error.message}`, true);
      }
      await audit(f.person_id.value ? 'update' : 'upsert', 'easter_egg_participants', row.full_name);
      adminEasterEggs(`Saved ${row.full_name}.`);
    });

    $('#ee-wheel-start')?.addEventListener('click', async () => {
      const now = new Date().toISOString();
      const r = await sb.from('easter_egg_wheel_state').update({
        status: 'rolling', started_at: now, winner_number: null,
        winner_prize_id: null, winner_prize_title: null, updated_at: now
      }).eq('id', 1);
      if (r.error) return setStatus(`Could not start: ${r.error.message}`, true);
      await audit('start', 'easter_egg_wheel_state', 'prize wheel');
      adminEasterEggs('Spin started. Press Stop when you are ready.');
    });

    $('#ee-wheel-stop')?.addEventListener('click', async () => {
      const r = await sb.rpc('easter_egg_wheel_stop');
      if (r.error) return setStatus(`Could not stop: ${r.error.message}`, true);
      const row = Array.isArray(r.data) ? r.data[0] : r.data;
      await audit('stop', 'easter_egg_wheel_state', 'prize wheel');
      adminEasterEggs(row ? `Winner: #${row.winner_number} · ${row.prize_title}` : 'Winner picked.');
    });

    bindDeleteButtons();
  }

  MC.pages['easter-eggs'] = () => adminEasterEggs();
})();
