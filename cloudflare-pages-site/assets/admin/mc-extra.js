/* Mission Control → Leaderboard and Settings. The logic is carried over unchanged from the previous admin;
 * only the shell around it (navigation, toasts, dialogs, styling) is new. */
(() => {
  'use strict';
  const MC = window.MC;
  const sb = MC.sb;
  const { $, $$, esc, safeUrl, slugify, normalizeEmail, textValue, when, formObject, setWorkspace, adminMessage, authErrorText, audit, upsertSetting, defaultSocials } = MC;
  const bindDeleteButtons = () => MC.bindDeleteButtons(document);
  async function adminLeaderboard() {
    const [periods, rules, boards, recentPoints, standings] = await Promise.all([
      sb.from('leaderboard_periods').select('*').order('starts_on', { ascending: false }),
      sb.from('point_rules').select('*').order('sort_order'),
      sb.from('sponsored_leaderboards').select('*').order('sort_order'),
      sb.from('community_points').select('id,student_name,activity_type,points,source_ref,note,created_at,period_id').order('created_at', { ascending: false }).limit(30),
      sb.from('public_main_leaderboard').select('*').order('rank').limit(300)
    ]);
    if (periods.error || rules.error || boards.error) throw periods.error || rules.error || boards.error;
    const pointsList = (recentPoints && !recentPoints.error && recentPoints.data) || [];
    const standingsList = (standings && !standings.error && standings.data) || [];
    const knownStudents = Array.from(new Set([
      ...standingsList.map(s => s.student_name),
      ...pointsList.map(p => p.student_name)
    ])).filter(Boolean).sort();

    setWorkspace('Leaderboard', `<p class="admin-lead">Main points are awarded through fixed activity rules. Sponsored-programme boards are separate and use manually entered totals.</p>
    <section class="admin-panel">
      <h2>Main community period</h2>
      <form id="period-form" class="admin-form">
        <label>Title<input name="title" required placeholder="Semester 1 · 2026–27"></label>
        <label>Period type<select name="period_type"><option value="semester">Semester</option><option value="academic_year">Academic year</option></select></label>
        <div class="two-fields">
          <label>Starts<input name="starts_on" type="date" required></label>
          <label>Ends<input name="ends_on" type="date" required></label>
        </div>
        <div class="checkbox-row">
          <label class="inline-check"><input type="checkbox" name="published" checked> Publish to website immediately</label>
        </div>
        <button type="submit">Create period</button>
      </form>
      <div>
        ${(periods.data || []).map(p => `<div class="admin-list-row">
          <div>
            <b>${esc(p.title)}</b>
            <small>${esc(p.starts_on)} → ${esc(p.ends_on)} · ${p.published ? '<span style="color:var(--g,#188038);font-weight:600">● Published</span>' : '<span style="color:var(--ink-2)">○ Draft</span>'} · ${p.enabled ? '<span style="color:var(--b,#1a73e8);font-weight:600">Active scoring</span>' : '<span style="color:var(--ink-2)">Scoring paused</span>'}</small>
          </div>
          <div class="row-actions">
            <button type="button" data-toggle-period="${p.id}" data-id="${p.id}" data-enabled="${p.enabled}">${p.enabled ? 'Pause scoring' : 'Enable scoring'}</button>
            <button type="button" data-toggle-period-published="${p.id}" data-id="${p.id}" data-enabled="${p.enabled}" data-published="${p.published}">${p.published ? 'Hide from site' : 'Publish to site'}</button>
            <button type="button" data-delete="leaderboard_periods" data-id="${p.id}" data-label="${esc(p.title)}" class="danger">Delete</button>
          </div>
        </div>`).join('') || '<p class="muted">Create a period before awarding points.</p>'}
      </div>
    </section>

    <section class="admin-panel">
      <h2>Live community standings (${standingsList.length} builders ranked)</h2>
      <p class="muted">Updated automatically as points are awarded below. Top 10 appear on the 3D race lanes; all participants appear on the All-in-One Chapter Honor Roll.</p>
      ${standingsList.length ? `
        <div style="margin-bottom:12px">
          <input id="admin-roster-q" placeholder="Filter ranked students by name..." style="max-width:320px;padding:8px 12px;font-size:13px;border-radius:8px;border:1px solid var(--line-subtle)">
        </div>
        <div class="admin-list" id="admin-roster-rows" style="max-height:320px;overflow-y:auto">
          ${standingsList.map(s => {
            const lg = s.points >= 150 ? 'Diamond' : s.points >= 75 ? 'Gold' : s.points >= 30 ? 'Silver' : 'Bronze';
            return `<div class="admin-list-row admin-standings-row" data-name="${esc(s.student_name.toLowerCase())}">
              <div>
                <b>#${s.rank} · ${esc(s.student_name)}</b>
                <small>${lg} · ${s.points} total points</small>
              </div>
              <div class="row-actions">
                <button type="button" data-prefill-student="${esc(s.student_name)}">+ Add Points</button>
              </div>
            </div>`;
          }).join('')}
        </div>
      ` : '<p class="muted">No students ranked yet for this season. When inaugural events take place, record activities below.</p>'}
    </section>

    <section class="admin-panel">
      <h2>Record an eligible activity</h2>
      <form id="activity-form" class="admin-form">
        <label>Period
          <select name="period_id" required>
            <option value="">Choose period</option>
            ${(periods.data || []).map(p => `<option value="${p.id}" ${p.enabled && p.published ? 'selected' : ''}>${esc(p.title)}${p.enabled ? ' (Active)' : ''}</option>`).join('')}
          </select>
        </label>
        <label>Student name
          <input name="student_name" required placeholder="e.g. Rahul Sharma" list="student-roster-names">
          <datalist id="student-roster-names">
            ${knownStudents.map(n => `<option value="${esc(n)}">`).join('')}
          </datalist>
        </label>
        <label>Student email (private; hashed in the points table)<input name="student_email" type="email" required placeholder="rahul@sru.edu.in"></label>
        <label>Activity
          <select name="activity_type" required>
            ${(rules.data || []).filter(r => r.enabled).map(r => `<option value="${esc(r.activity_type)}">${esc(r.label)} · ${r.points} points</option>`).join('')}
          </select>
        </label>
        <label>Event / work reference<input name="source_ref" required placeholder="event ID, project reference, sprint session"></label>
        <label>Admin note (private)<textarea name="note" rows="2" placeholder="Optional internal note"></textarea></label>
        <button type="submit">Record points</button>
      </form>
    </section>

    <section class="admin-panel">
      <h2>Recent points awarded (${pointsList.length})</h2>
      ${pointsList.length ? `<div class="admin-list">
        ${pointsList.map(pt => `<div class="admin-list-row">
          <div>
            <b>${esc(pt.student_name)}</b> · <span style="color:var(--g,#188038);font-weight:700">+${pt.points} pts</span>
            <small>${esc(pt.activity_type)} · ref: ${esc(pt.source_ref)} · ${new Date(pt.created_at).toLocaleDateString()}${pt.note ? ` · ${esc(pt.note)}` : ''}</small>
          </div>
          <div class="row-actions">
            <button type="button" class="danger" data-delete="community_points" data-id="${pt.id}" data-label="${esc(pt.student_name)} (+${pt.points})">Delete</button>
          </div>
        </div>`).join('')}
      </div>` : '<p class="muted">No points recorded yet for any period. When events take place, record student activities above.</p>'}
    </section>

    <section class="admin-panel">
      <h2>Point rules</h2>
      <div class="admin-list">${(rules.data || []).map(r => `<div class="admin-list-row"><div><b>${esc(r.label)}</b><small>${r.points} points · maximum ${r.max_per_period} per period · ${r.enabled ? 'Enabled' : 'Disabled'}</small></div><button type="button" data-edit-rule="${r.id}">Edit rule</button></div>`).join('')}</div>
      <p class="muted small">Rules are predefined; admins cannot type a custom points amount when recording each student activity.</p>
    </section>

    <section class="admin-panel">
      <h2>Sponsored-programme leaderboards</h2>
      <form class="admin-form" id="sponsored-form">
        <input type="hidden" name="id">
        <label>Leaderboard title<input name="title" required placeholder="Cloud Study Jam"></label>
        <label>Programme name<input name="program_name" required placeholder="Google Cloud Study Jam"></label>
        <label>Period / cohort<input name="period_label" placeholder="2026 cohort"></label>
        <div class="checkbox-row"><label><input type="checkbox" name="enabled"> Enabled</label><label><input type="checkbox" name="published"> Published</label></div>
        <button type="submit">Save leaderboard</button>
      </form>
      ${(boards.data || []).map(b => `<div class="admin-list-row"><div><b>${esc(b.title)}</b><small>${esc(b.program_name)} · ${b.enabled ? 'Enabled' : 'Disabled'} · ${b.published ? 'Published' : 'Unpublished'}</small></div><div class="row-actions"><button type="button" data-edit-sponsored="${b.id}">Manage</button><button type="button" class="danger" data-delete="sponsored_leaderboards" data-id="${b.id}" data-label="${esc(b.title)}">Delete</button></div></div>`).join('')}
      <div id="sponsored-entries"></div>
    </section>`);

    $('#period-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = formObject(e.target);
      const shouldPublish = !!e.target.elements.published?.checked;
      f.enabled = true;
      f.published = shouldPublish;
      if (shouldPublish) {
        await sb.from('leaderboard_periods').update({ enabled: false }).eq('enabled', true).eq('published', true);
      }
      const r = await sb.from('leaderboard_periods').insert(f);
      if (r.error) return adminMessage(authErrorText(r.error));
      await audit('create', 'leaderboard_periods', f.title);
      await adminLeaderboard();
      adminMessage('Leaderboard period created.', true);
    });

    $('#activity-form').addEventListener('submit', async e => {
      e.preventDefault();
      const f = Object.fromEntries(new FormData(e.target));
      const { data, error } = await sb.rpc('record_community_activity', {
        p_period_id: f.period_id,
        p_student_name: f.student_name,
        p_student_email: normalizeEmail(f.student_email),
        p_activity_type: f.activity_type,
        p_source_ref: f.source_ref,
        p_note: f.note || ''
      });
      if (error) return adminMessage(authErrorText(error));
      await audit('record_activity', 'community_points', data);
      adminMessage('Points recorded using the predefined rule.', true);
      e.target.reset();
      await adminLeaderboard();
    });

    $$('[data-prefill-student]').forEach(b => {
      b.onclick = () => {
        const nameInput = $('#activity-form [name="student_name"]');
        if (nameInput) {
          nameInput.value = b.dataset.prefillStudent;
          nameInput.focus();
          $('#activity-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    });

    const adminQ = $('#admin-roster-q');
    if (adminQ) {
      adminQ.oninput = () => {
        const q = adminQ.value.trim().toLowerCase();
        $$('.admin-standings-row').forEach(row => {
          row.style.display = (!q || row.dataset.name.includes(q)) ? '' : 'none';
        });
      };
    }

    $$('[data-toggle-period]').forEach(b => b.onclick = async () => {
      const id = b.dataset.togglePeriod || b.dataset.id;
      const enable = b.dataset.enabled !== 'true';
      if (enable) {
        const peer = await sb.from('leaderboard_periods').update({ enabled: false }).eq('enabled', true).neq('id', id);
        if (peer.error) return adminMessage(authErrorText(peer.error));
      }
      const r = await sb.from('leaderboard_periods').update({ enabled: enable }).eq('id', id);
      if (r.error) return adminMessage(authErrorText(r.error));
      await audit(enable ? 'enable_scoring' : 'pause_scoring', 'leaderboard_periods', id);
      await adminLeaderboard();
    });

    $$('[data-toggle-period-published]').forEach(b => b.onclick = async () => {
      const id = b.dataset.togglePeriodPublished || b.dataset.id;
      const publish = b.dataset.published !== 'true';
      if (publish && b.dataset.enabled === 'true') {
        const peer = await sb.from('leaderboard_periods').update({ enabled: false }).eq('enabled', true).neq('id', id);
        if (peer.error) return adminMessage(authErrorText(peer.error));
      }
      const r = await sb.from('leaderboard_periods').update({ published: publish }).eq('id', id);
      if (r.error) return adminMessage(authErrorText(r.error));
      await audit(publish ? 'publish_period' : 'hide_period', 'leaderboard_periods', id);
      await adminLeaderboard();
    });

    $$('[data-edit-rule]').forEach(b => b.onclick = async () => {
      const r = (rules.data || []).find(x => x.id === b.dataset.editRule);
      const points = prompt(`Points for ${r.label} (positive whole number):`, String(r.points));
      if (points === null) return;
      const max = prompt('Maximum credits per student per period:', String(r.max_per_period));
      if (max === null) return;
      const enabled = confirm('Keep this activity rule enabled? Press Cancel to disable it.');
      const p = Number(points), m = Number(max);
      if (!Number.isInteger(p) || p < 1 || p > 10000 || !Number.isInteger(m) || m < 1) return adminMessage('Invalid points or maximum.');
      const result = await sb.from('point_rules').update({ points: p, max_per_period: m, enabled }).eq('id', r.id);
      if (result.error) return adminMessage(authErrorText(result.error));
      await adminLeaderboard();
    });

    const sf = $('#sponsored-form');
    sf.addEventListener('submit', async e => {
      e.preventDefault();
      const f = formObject(sf);
      const id = f.id;
      delete f.id;
      f.enabled = sf.elements.enabled.checked;
      f.published = sf.elements.published.checked;
      const r = id ? await sb.from('sponsored_leaderboards').update(f).eq('id', id) : await sb.from('sponsored_leaderboards').insert(f).select('id').single();
      if (r.error) return adminMessage(authErrorText(r.error));
      await adminLeaderboard();
      adminMessage('Sponsored leaderboard saved.', true);
    });

    $$('[data-edit-sponsored]').forEach(b => b.onclick = async () => {
      const board = (boards.data || []).find(x => x.id === b.dataset.editSponsored);
      if (!board) return;
      sf.elements.id.value = board.id;
      ['title', 'program_name', 'period_label'].forEach(k => sf.elements[k].value = board[k] || '');
      sf.elements.enabled.checked = board.enabled;
      sf.elements.published.checked = board.published;
      const ent = await sb.from('sponsored_leaderboard_entries').select('*').eq('leaderboard_id', board.id).order('points', { ascending: false });
      const host = $('#sponsored-entries');
      host.innerHTML = `<h3>${esc(board.title)} · participants</h3><form class="admin-form" id="sponsored-entry-form"><input type="hidden" name="leaderboard_id" value="${board.id}"><label>Student name<input name="student_name" required></label><label>Total points<input name="points" type="number" min="0" required></label><button type="submit">Add / update participant</button></form>${(ent.data || []).map(x => `<div class="admin-list-row"><div><b>${esc(x.student_name)}</b><small>${x.points} points</small></div><div class="row-actions"><button type="button" data-edit-entry="${x.id}">Edit</button><button type="button" class="danger" data-delete="sponsored_leaderboard_entries" data-id="${x.id}" data-label="${esc(x.student_name)}">Delete</button></div></div>`).join('')}`;
      const ef = $('#sponsored-entry-form');
      ef.addEventListener('submit', async ev => {
        ev.preventDefault();
        const d = formObject(ef);
        const found = (ent.data || []).find(x => x.student_name.toLowerCase() === d.student_name.toLowerCase());
        const r = found ? await sb.from('sponsored_leaderboard_entries').update({ points: Number(d.points) }).eq('id', found.id) : await sb.from('sponsored_leaderboard_entries').insert({ leaderboard_id: d.leaderboard_id, student_name: d.student_name, points: Number(d.points) });
        if (r.error) return adminMessage(authErrorText(r.error));
        await audit(found ? 'update' : 'create', 'sponsored_leaderboard_entries', d.student_name);
        await adminLeaderboard();
      });
      $$('[data-edit-entry]').forEach(x => x.onclick = () => {
        const row = (ent.data || []).find(z => z.id === x.dataset.editEntry);
        if (row) {
          ef.elements.student_name.value = row.student_name;
          ef.elements.points.value = row.points;
        }
      });
      bindDeleteButtons();
    });
    bindDeleteButtons();
  }
  async function adminSettings() {
    const settings=await sb.from('site_settings').select('*').order('key');
    if(settings.error)throw settings.error;
    const values=Object.fromEntries((settings.data||[]).map(x=>[x.key,x.value]));
    const eventCats=(window.GDG_SITE_DEFAULTS||{}).normalizeCategories(Array.isArray(values.event_categories)&&values.event_categories.length?values.event_categories:(window.GDG_SITE_DEFAULTS||{}).eventCategories);
    const trackLines=(Array.isArray(values.home_tracks)&&values.home_tracks.length?values.home_tracks:((window.GDG_SITE_DEFAULTS||{}).homeTracks||[])).map(t=>[t.label,t.description,t.color].join(' | ')).join('\n');
    const currentSocials=Array.isArray(values.social_links)?values.social_links:defaultSocials;
    const merged=defaultSocials.map(d=>({...d,...(currentSocials.find(x=>x.key===d.key)||{})}));
    currentSocials.filter(x=>!defaultSocials.some(d=>d.key===x.key)).forEach(x=>merged.push(x));
    const email=textValue(values.contact_email||(window.GDG_SITE_DEFAULTS||{}).contactEmail||'').replace(/^"|"$/g,'');
    const secondaryEmail=textValue(values.secondary_contact_email||(window.GDG_SITE_DEFAULTS||{}).secondaryContactEmail||'').replace(/^"|"$/g,'');
    const intro=textValue(values.community_intro||'').replace(/^"|"$/g,'');
    const homeCopy=textValue(values.homepage_copy||'').replace(/^"|"$/g,'');
    const logo=textValue(values.brand_logo_url||'').replace(/^"|"$/g,'');
    let ph = {};
    try { if (values.events_placeholder) ph = typeof values.events_placeholder === 'string' ? JSON.parse(values.events_placeholder) : values.events_placeholder; } catch {}
    let ann = { enabled: false, badge: 'UPCOMING', text: '', button_label: 'RSVP ↗', button_url: '', announcement_id: 1 };
    try {
      if (values.announcement_bar) {
        const parsed = typeof values.announcement_bar === 'string' ? JSON.parse(values.announcement_bar) : values.announcement_bar;
        ann = Object.assign(ann, parsed);
      }
    } catch {}
    setWorkspace('Settings',`<p class="admin-lead">Content and links only. Design tokens, layout, typography, and animations are protected from Settings changes.</p>
      <section class="admin-panel"><h2>Announcement Bar</h2><p class="muted">Global notification bar displayed above the header on every page. Saving edits auto-increments the announcement version so dismissed visitors see the update.</p>
        <div style="margin:16px 0;padding:14px;border:1px dashed var(--ln);border-radius:12px;background:var(--cd)">
          <small class="muted" style="display:block;margin-bottom:8px;font-weight:600">Live Preview:</small>
          <div id="ann-preview-bar" style="background:linear-gradient(180deg,rgba(8,12,24,0.22) 0%,rgba(8,12,24,0.55) 100%),linear-gradient(90deg,#1A73E8 0%,#6366F1 26%,#EA4335 60%,#FBBC04 84%,#34A853 100%);color:#fff;padding:9px 16px;border-radius:10px;display:flex;align-items:center;justify-content:center;gap:12px;font-size:13px;flex-wrap:wrap;box-shadow:0 4px 16px rgba(26,115,232,0.25)">
            <span id="ann-prev-badge" style="background:rgba(0,0,0,0.42);color:#fff;border:1px solid rgba(255,255,255,0.32);padding:3px 10px;border-radius:99px;font-weight:800;font-size:10.5px;letter-spacing:0.08em;text-transform:uppercase;display:inline-flex;align-items:center;gap:6px"><span style="width:6px;height:6px;border-radius:50%;background:#34A853"></span>${esc(ann.badge || 'UPCOMING')}</span>
            <span id="ann-prev-text" style="font-weight:500">${esc(ann.text || 'Your announcement will appear here.')}</span>
            <span id="ann-prev-btn" style="background:#fff;color:#0f172a;padding:4.5px 14px;border-radius:99px;font-weight:700;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,0.2)">${esc(ann.button_label || 'Action ↗')}</span>
          </div>
        </div>
        <form id="announcement-form" class="admin-form">
          <label class="check full"><input type="checkbox" name="enabled" ${ann.enabled ? 'checked' : ''}> <b>Enable Announcement Bar on website</b></label>
          <label>Badge text<input name="badge" value="${esc(ann.badge || 'UPCOMING')}" placeholder="UPCOMING, REGISTRATIONS OPEN, LIVE" required></label>
          <label class="full">Announcement message (plain text only)<textarea name="text" rows="2" placeholder="e.g. Grand Chapter Launch registrations are live on Google Community Platform." required>${esc(ann.text || '')}</textarea></label>
          <label>Button label<input name="button_label" value="${esc(ann.button_label || '')}" placeholder="e.g. RSVP on Chapter Page ↗"></label>
          <label>Button URL (must start with https://)<input name="button_url" type="url" value="${esc(ann.button_url || '')}" placeholder="https://gdg.community.dev/..."></label>
          <input type="hidden" name="announcement_id" value="${ann.announcement_id || 1}">
          <button type="submit">Save Announcement Bar</button>
        </form>
      </section>
      <section class="admin-panel"><h2>Events page placeholder</h2><p class="muted">Shown on the public Events page when no flagship event is scheduled. Leave a field empty to hide it.</p>
        <form id="placeholder-form" class="admin-form">
          <label>Heading<input name="heading" value="${esc(ph.heading || '')}" placeholder="e.g. Coming soon"></label>
          <label class="full">Summary<textarea name="summary" rows="2" placeholder="e.g. The next session details will be announced here once confirmed.">${esc(ph.summary || '')}</textarea></label>
          <label>Side panel title<input name="side_title" value="${esc(ph.side_title || '')}" placeholder="e.g. Official RSVP Portal."></label>
          <label class="full">Side panel text<textarea name="side_body" rows="2">${esc(ph.side_body || '')}</textarea></label>
          <label>Button label<input name="button_label" value="${esc(ph.button_label || '')}" placeholder="e.g. View on Chapter Page"></label>
          <label>Button URL (must start with https://)<input name="button_url" type="url" value="${esc(ph.button_url || '')}" placeholder="https://gdg.community.dev/..."></label>
          <button type="submit">Save Placeholder</button>
        </form>
      </section>
      <section class="admin-panel"><h2>Brand logo</h2><p class="muted">Optional logo override. Upload PNG, JPEG, or WebP up to 5 MB. When no override is set, the original Google-colour mark stays in place.</p>${logo&&safeUrl(logo)?`<p><img src="${esc(safeUrl(logo))}" alt="Current GDG SRU logo" style="max-width:180px;max-height:100px;object-fit:contain"></p>`:''}<form id="logo-form" class="admin-form"><label>Logo file<input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required></label><button type="submit">Upload logo</button></form>${logo?'<button type="button" class="button-outline" id="clear-logo">Remove logo override</button>':''}</section>
      <section class="admin-panel"><h2>Official contact</h2><form id="contact-form" class="admin-form"><label>Primary contact email<input name="email" type="email" value="${esc(email)}" required></label><label>Additional contact email<input name="secondary_email" type="email" value="${esc(secondaryEmail)}" required></label><button type="submit">Save contact emails</button></form><p class="muted">The primary address is used for privacy enquiries. Both addresses appear in the community contact section.</p></section>
      <section class="admin-panel"><h2>Social links</h2><p class="muted">Manage the six standard destinations and any additional platforms. Empty URLs are not displayed publicly.</p><form id="social-form" class="admin-form">${merged.map((s,i)=>`<div class="social-edit-row" data-social-row="${i}"><input type="hidden" name="key_${i}" value="${esc(s.key||slugify(s.label))}"><label>Platform<input name="label_${i}" value="${esc(s.label||'')}" required></label><label>URL<input name="url_${i}" type="url" value="${esc(s.url||'')}" placeholder="https://…"></label><label>Icon / short mark<input name="icon_${i}" value="${esc(s.icon||'')}" maxlength="40" placeholder="e.g. in, ✦, brand icon"></label><label>Description<input name="description_${i}" value="${esc(s.description||'')}" maxlength="180"></label><label class="inline-check"><input type="checkbox" name="enabled_${i}" ${s.enabled!==false?'checked':''}> Visible on site</label><label>Display order<input name="order_${i}" type="number" value="${Number(s.sort_order)||i+1}"></label><button type="button" class="button-outline remove-social" data-remove-social="${i}">Remove platform</button></div>`).join('')}<button type="button" class="button-outline" id="add-social">Add platform</button><button type="submit">Save social links</button></form></section>
      <section class="admin-panel"><h2>Event categories</h2><p class="muted">Turn on only the categories used by events you have run. New categories start turned off. An event that already uses a turned-off category keeps it.</p><form id="categories-form" class="admin-form">${eventCats.map((c)=>`<label class="check"><input type="checkbox" name="on" value="${esc(c.name)}"${c.active?' checked':''}> ${esc(c.name)}</label>`).join('')}<label>Add new categories (one per line, added turned off)<textarea name="new" rows="3" placeholder="Robotics"></textarea></label><button type="submit">Save categories</button></form></section>
      <section class="admin-panel"><h2>Home track cards</h2><p class="muted">One card per line: <b>Label | Description | color</b>. Color is b (blue), r (red), y (yellow) or g (green); leave it out to alternate colors. Up to 8 cards.</p><form id="tracks-form" class="admin-form"><label>Track cards<textarea name="tracks" rows="6">${esc(trackLines)}</textarea></label><button type="submit">Save track cards</button></form></section>
      <section class="admin-panel"><h2>Homepage text</h2><form id="home-copy-form" class="admin-form"><label>Hero introduction<textarea name="home_copy" rows="3">${esc(homeCopy)}</textarea></label><button type="submit">Save homepage text</button></form><p class="muted small">Changes only replace text in existing content slots. They do not change layout, typography, colours, or animations.</p></section><section class="admin-panel"><h2>Community introduction</h2><form id="intro-form" class="admin-form"><label>About the chapter text<textarea name="intro" rows="3">${esc(intro)}</textarea></label><button type="submit">Save introduction</button></form></section><section class="admin-panel"><h2>Backup & Export</h2><p class="muted">Download a complete snapshot of all published chapter data (events, team members, departments, blog posts, resources, and site settings) in a single portable JSON file.</p><button type="button" class="button" id="export-backup-btn">Export Chapter Data (.json)</button><span id="backup-status" style="margin-left:12px;font-size:13px;" class="muted"></span></section>`);
    let socialCount=merged.length;
    $('#add-social').onclick=()=>{
      const i=socialCount++;
      const node=document.createElement('div');node.className='social-edit-row';node.dataset.socialRow=String(i);
      node.innerHTML=`<input type="hidden" name="key_${i}" value="custom-${i}"><label>Platform<input name="label_${i}" required></label><label>URL<input name="url_${i}" type="url" placeholder="https://…"></label><label>Icon / short mark<input name="icon_${i}" maxlength="40" placeholder="e.g. in, ✦, brand icon"></label><label>Description<input name="description_${i}" maxlength="180"></label><label class="inline-check"><input type="checkbox" name="enabled_${i}" checked> Visible on site</label><label>Display order<input name="order_${i}" type="number" value="${i+1}"></label><button type="button" class="button-outline remove-social" data-remove-social="${i}">Remove platform</button>`;
      $('#social-form').insertBefore(node,$('#add-social'));
    };
    $('#social-form').addEventListener('click',e=>{
      const remove=e.target.closest('[data-remove-social]');if(!remove)return;
      if(!confirm('Remove this platform from the website?'))return;
      remove.closest('[data-social-row]').remove();
    });
    // Announcement bar live preview & save
    const phForm = $('#placeholder-form');
    if (phForm) phForm.onsubmit = async (e) => {
      e.preventDefault();
      const fd = formObject(e.target);
      const url = String(fd.button_url || '').trim();
      if (url && !/^https:\/\//.test(url)) return adminMessage('Button URL must begin with https://');
      const record = {
        heading: String(fd.heading || '').trim(),
        summary: String(fd.summary || '').trim(),
        side_title: String(fd.side_title || '').trim(),
        side_body: String(fd.side_body || '').trim(),
        button_label: String(fd.button_label || '').trim(),
        button_url: url
      };
      const r = await upsertSetting('events_placeholder', record);
      if (r.error) return adminMessage(authErrorText(r.error));
      await audit('update', 'site_settings', 'events_placeholder');
      adminMessage('Events page placeholder saved.', true);
      await adminSettings();
    };

    const annForm = $('#announcement-form');
    if (annForm) {
      const updateAnnPreview = () => {
        const badgeEl = $('#ann-prev-badge');
        const textEl = $('#ann-prev-text');
        const btnEl = $('#ann-prev-btn');
        if (badgeEl) badgeEl.textContent = annForm.elements.badge?.value || 'UPCOMING';
        if (textEl) textEl.textContent = annForm.elements.text?.value || 'Your announcement will appear here.';
        if (btnEl) {
          const l = annForm.elements.button_label?.value;
          btnEl.textContent = l || 'Action ↗';
          btnEl.style.display = l ? '' : 'none';
        }
      };
      annForm.addEventListener('input', updateAnnPreview);

      annForm.onsubmit = async (e) => {
        e.preventDefault();
        const fd = formObject(e.target);
        const btnUrl = String(fd.button_url || '').trim();
        if (btnUrl && !btnUrl.startsWith('https://')) {
          return adminMessage('Button URL must begin with https://');
        }
        const currentId = Number(fd.announcement_id) || 1;
        const newRecord = {
          enabled: !!e.target.elements.enabled.checked,
          badge: String(fd.badge || 'UPCOMING').trim(),
          text: String(fd.text || '').trim(),
          button_label: String(fd.button_label || '').trim(),
          button_url: btnUrl,
          announcement_id: currentId + 1 // version bump invalidates old dismissals
        };
        const r = await upsertSetting('announcement_bar', newRecord);
        if (r.error) return adminMessage(authErrorText(r.error));
        await audit('update', 'site_settings', 'announcement_bar');
        adminMessage('Announcement Bar saved & version updated.', true);
        await adminSettings();
      };
    }

    $('#tracks-form').onsubmit=async e=>{e.preventDefault();const lines=String(formObject(e.target).tracks||'').split('\n').map(x=>x.trim()).filter(Boolean);const list=lines.map((ln,i)=>{const parts=ln.split('|').map(x=>(x||'').trim());const color=['b','r','y','g'].includes(parts[2])?parts[2]:['b','r','y','g'][i%4];return {label:parts[0]||'',description:parts[1]||'',color};}).filter(t=>t.label);if(!list.length)return adminMessage('Add at least one track card.');if(list.length>8)return adminMessage('Keep the home page to 8 track cards or fewer.');const r=await upsertSetting('home_tracks',list);if(r.error)return adminMessage(authErrorText(r.error));await audit('update','site_settings','home_tracks');adminMessage('Track cards saved.',true);};
    $('#categories-form').onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target);const on=fd.getAll('on');const fresh=String(fd.get('new')||'').split('\n').map(x=>x.trim()).filter(Boolean);const list=(window.GDG_SITE_DEFAULTS||{}).normalizeCategories([...eventCats.map(c=>({name:c.name,active:on.includes(c.name)})),...fresh.map(name=>({name,active:false}))]);if(!list.length)return adminMessage('Add at least one category.');const r=await upsertSetting('event_categories',list);if(r.error)return adminMessage(authErrorText(r.error));await audit('update','site_settings','event_categories');adminMessage('Categories saved.',true);};
    $('#contact-form').onsubmit=async e=>{e.preventDefault();const fields=formObject(e.target);const primary=String(fields.email||'').trim();const secondary=String(fields.secondary_email||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primary)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(secondary))return adminMessage('Enter valid addresses for both contact email fields.');const a=await upsertSetting('contact_email',primary);if(a.error)return adminMessage(authErrorText(a.error));const b=await upsertSetting('secondary_contact_email',secondary);if(b.error)return adminMessage(authErrorText(b.error));await audit('update','site_settings','contact_email, secondary_contact_email');adminMessage('Contact emails saved.',true);};
    $('#home-copy-form').onsubmit=async e=>{e.preventDefault();const r=await upsertSetting('homepage_copy',formObject(e.target).home_copy);if(r.error)return adminMessage(authErrorText(r.error));await audit('update','site_settings','homepage_copy');adminMessage('Homepage text saved. Reload the public site to view the update.',true);};
    $('#intro-form').onsubmit=async e=>{e.preventDefault();const r=await upsertSetting('community_intro',formObject(e.target).intro);if(r.error)return adminMessage(authErrorText(r.error));await audit('update','site_settings','community_intro');adminMessage('Introduction saved. Reload the public site to view the update.',true);};
    $('#social-form').onsubmit=async e=>{
      e.preventDefault();const f=Object.fromEntries(new FormData(e.target));const values=[];
      for(let i=0;i<socialCount;i++){
        const key=f[`key_${i}`];if(!key)continue;
        const label=String(f[`label_${i}`]||'').trim(),url=String(f[`url_${i}`]||'').trim();if(!label)continue;
        if(url&&!safeUrl(url))return adminMessage(`The URL for ${label} must begin with http:// or https://.`);
        values.push({key,label,url,icon:String(f[`icon_${i}`]||'').trim(),description:String(f[`description_${i}`]||'').trim(),enabled:Object.hasOwn(f,`enabled_${i}`),sort_order:Number(f[`order_${i}`]||i+1)});
      }
      const r=await upsertSetting('social_links',values);if(r.error)return adminMessage(authErrorText(r.error));await audit('update','site_settings','social_links');adminMessage('Social links saved.',true);await adminSettings();
    };
    $('#logo-form').onsubmit=async e=>{
      e.preventDefault();const rawFile=e.target.elements.logo.files?.[0];if(!rawFile)return;
      if(!['image/png','image/jpeg','image/webp'].includes(rawFile.type))return adminMessage('Choose a PNG, JPEG, or WebP image.');
      if(rawFile.size>15*1024*1024)return adminMessage('The logo must be 15 MB or smaller.');
      const file=(MC.optimizeImageForWeb ? await MC.optimizeImageForWeb(rawFile, { maxWidth: 800, maxHeight: 400, quality: 0.9 }) : rawFile);
      const ext=file.name.split('.').pop().toLowerCase() || 'webp', path=`brand/logo.${ext}`;
      try {
        const upload=await MC.uploadStorage('site-assets',path,file,{isPublic:true,contentType:file.type});
        const saved=await upsertSetting('brand_logo_url',upload.publicUrl);if(saved.error)return adminMessage(authErrorText(saved.error));
        await audit('update','site_settings','brand_logo_url');adminMessage('Logo updated.',true);await adminSettings();
      } catch (err) {
        adminMessage(authErrorText(err));
      }
    };
    $('#clear-logo')?.addEventListener('click',async()=>{
      if(!confirm('Remove the custom logo and restore the original Google-colour mark?'))return;
      const r=await sb.from('site_settings').delete().eq('key','brand_logo_url');if(r.error)return adminMessage(authErrorText(r.error));
      await audit('delete','site_settings','brand_logo_url');await adminSettings();adminMessage('Logo override removed.',true);
    });
    const backupBtn = $('#export-backup-btn');
    if (backupBtn) {
      backupBtn.onclick = async () => {
        const status = $('#backup-status');
        backupBtn.disabled = true;
        if (status) status.textContent = 'Exporting data...';
        try {
          const [evs, team, depts, blogs, res, periods, sets] = await Promise.all([
            sb.from('events').select('*').order('created_at', { ascending: false }),
            sb.from('team_members').select('*').order('sort_order'),
            sb.from('team_departments').select('*').order('sort_order'),
            sb.from('blogs').select('*').order('created_at', { ascending: false }),
            sb.from('resources').select('*').order('created_at', { ascending: false }),
            sb.from('leaderboard_periods').select('*'),
            sb.from('site_settings').select('*')
          ]);
          const backup = {
            version: 1,
            exported_at: new Date().toISOString(),
            chapter: 'GDG on Campus SR University',
            data: {
              events: evs.data || [],
              team_members: team.data || [],
              team_departments: depts.data || [],
              blogs: blogs.data || [],
              resources: res.data || [],
              leaderboard_periods: periods.data || [],
              site_settings: sets.data || []
            }
          };
          const totalItems = Object.values(backup.data).reduce((acc, arr) => acc + arr.length, 0);
          const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          const dateStr = new Date().toISOString().slice(0, 10);
          a.href = url;
          a.download = `gdg-sru-backup-${dateStr}.json`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          if (status) status.textContent = `✓ Exported ${totalItems} items successfully.`;
          adminMessage(`Backup exported (${totalItems} items).`, true);
        } catch (err) {
          if (status) status.textContent = 'Export failed.';
          adminMessage('Export failed: ' + (err.message || String(err)));
        } finally {
          backupBtn.disabled = false;
        }
      };
    }
  }
  async function adminBadges() {
    let stored = [];
    try {
      const settings = await sb.from('site_settings').select('value').eq('key', 'member_badge_passcodes').maybeSingle();
      if (settings?.data?.value && Array.isArray(settings.data.value)) {
        stored = settings.data.value;
      }
    } catch (_) { console.warn('[Admin] Action failed:', _); }
    if (!stored.length) {
      try {
        const local = JSON.parse(localStorage.getItem('gdg-custom-passcodes') || '[]');
        if (Array.isArray(local)) stored = local;
      } catch (_) { console.warn('[Admin] Action failed:', _); }
    }

    // Default codes removed from public static JS for security. Passcodes are loaded dynamically from Supabase database.
    const defaultCodes = [];

    const allCodes = [...defaultCodes, ...stored];
    const origin = window.location.origin;

    setWorkspace('Member Badges', `
      <div class="mc-card-head" style="margin-bottom:18px">
        <div>
          <p class="admin-lead" style="margin:0 0 4px">Manage verification passcodes for the public Season 2026 Member Badge generator.</p>
          <small class="muted">Active passcodes allow enrolled chapter members to unlock and export their verified pass at <code>/member-badge/</code>.</small>
        </div>
        <a href="/member-badge/" target="_blank" rel="noopener" class="button button-outline" style="flex:none">Open Public Generator ↗</a>
      </div>

      <div class="mc-grid-2">
        <div class="mc-col">
          <section class="admin-panel">
            <h2>Active Chapter Passcodes (${allCodes.length})</h2>
            <div class="admin-list" id="mc-badges-list">
              ${allCodes.map((item) => {
                const shareUrl = `${origin}/member-badge/?code=${encodeURIComponent(item.code)}`;
                return `
                  <div class="admin-list-row mc-passcode-row">
                    <div style="min-width:0;flex:1">
                      <div style="display:flex;align-items:center;gap:8px">
                        <strong style="font-family:var(--code);font-size:14px;letter-spacing:0.5px">${esc(item.code)}</strong>
                        <span class="mc-count" style="background:var(--green-soft);color:#0d652d;border-color:transparent;font-size:11px;padding:2px 6px">Active</span>
                        ${item.core ? '<span class="mc-count" style="font-size:11px;padding:2px 6px">Core</span>' : ''}
                      </div>
                      <small class="muted" style="display:block;margin-top:2px">${esc(item.label || 'Season Passcode')}</small>
                    </div>
                    <div class="row-actions mc-passcode-actions">
                      <button type="button" class="button-outline" data-copy-link="${esc(shareUrl)}" style="font-size:12.5px">Copy Link</button>
                      <button type="button" class="button-outline" data-copy-code="${esc(item.code)}" style="font-size:12.5px">Copy Code</button>
                      ${!item.core ? `<button type="button" class="danger" data-delete-code="${esc(item.code)}" style="font-size:12.5px">Revoke</button>` : ''}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </section>
        </div>

        <div class="mc-col">
          <section class="admin-panel">
            <h2>Issue New Chapter Passcode</h2>
            <p class="muted small" style="margin-bottom:14px">Create a new passcode for announcements, specific event cohorts, or student groups.</p>
            <form id="mc-add-passcode-form" class="admin-form">
              <label>Passcode
                <input name="passcode" required placeholder="e.g. GDGSRU-SPR26" maxlength="32" style="font-family:var(--code);text-transform:uppercase">
              </label>
              <label>Label / Purpose
                <input name="label" placeholder="e.g. Spring 2026 Cohort" maxlength="64">
              </label>
              <div style="display:flex;gap:8px;margin-top:6px">
                <button type="submit">Save Passcode</button>
                <button type="button" class="button-outline" id="mc-gen-passcode">Generate Code</button>
              </div>
            </form>
          </section>

          <section class="admin-panel">
            <h2>Direct Share Link Info</h2>
            <p class="muted small" style="line-height:1.6">
              When sharing the Member Badge generator in WhatsApp, Telegram, or Discord, use the direct link (<code>?code=PASSCODE</code>).
              It will automatically unlock the pass generator for students without asking them to type anything manually.
            </p>
          </section>
        </div>
      </div>
    `);

    const ws = $('#admin-workspace');
    if (!ws) return;

    ws.querySelectorAll('[data-copy-link]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copyLink);
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = orig, 1800);
        } catch (_) { console.warn('[Admin] Action failed:', _); }
      };
    });

    ws.querySelectorAll('[data-copy-code]').forEach(btn => {
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(btn.dataset.copyCode);
          const orig = btn.textContent;
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = orig, 1800);
        } catch (_) { console.warn('[Admin] Action failed:', _); }
      };
    });

    const genBtn = $('#mc-gen-passcode', ws);
    if (genBtn) {
      genBtn.onclick = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let randomStr = '';
        for (let i = 0; i < 5; i++) randomStr += chars[Math.floor(Math.random() * chars.length)];
        const input = ws.querySelector('[name="passcode"]');
        if (input) input.value = `GDGSRU-${randomStr}`;
      };
    }

    const form = $('#mc-add-passcode-form', ws);
    if (form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const code = String(fd.get('passcode') || '').trim().toUpperCase();
        const label = String(fd.get('label') || '').trim() || 'Custom Passcode';
        if (!code || code.length < 4) return adminMessage('Enter a valid passcode (at least 4 characters).');

        const clean = code.replace(/[\s-_]/g, '');
        if (allCodes.some(c => c.code.replace(/[\s-_]/g, '') === clean)) {
          return adminMessage('This passcode (or equivalent) already exists.');
        }

        const newEntry = { code, label, active: true, core: false, created_at: new Date().toISOString() };
        const updated = [...stored, newEntry];

        localStorage.setItem('gdg-custom-passcodes', JSON.stringify(updated));
        const res = await upsertSetting('member_badge_passcodes', updated);
        if (res?.error) {
          console.warn('Could not sync to cloud settings:', res.error);
        }
        await audit('create', 'site_settings', `passcode:${code}`);
        adminMessage(`Passcode ${code} created successfully.`, true);
        await adminBadges();
      };
    }

    ws.querySelectorAll('[data-delete-code]').forEach(btn => {
      btn.onclick = async () => {
        const codeToDelete = btn.dataset.deleteCode;
        if (!confirm(`Revoke passcode "${codeToDelete}"?`)) return;
        const updated = stored.filter(s => s.code !== codeToDelete);
        localStorage.setItem('gdg-custom-passcodes', JSON.stringify(updated));
        await upsertSetting('member_badge_passcodes', updated);
        await audit('delete', 'site_settings', `passcode:${codeToDelete}`);
        adminMessage(`Passcode ${codeToDelete} revoked.`, true);
        await adminBadges();
      };
    });
  }

  MC.pages.badges = () => adminBadges();
  MC.pages.leaderboard = () => adminLeaderboard();
  const SETTINGS_SECTIONS = [
    ['announcements', 'Announcement Bar', ['Announcement Bar']],
    ['home', 'Home page', ['Home track cards', 'Homepage text', 'Community introduction']],
    ['contact', 'Contact & links', ['Official contact', 'Social links']],
    ['brand', 'Brand', ['Brand logo']],
    ['categories', 'Event categories', ['Event categories']],
    ['backup', 'Backup & Export', ['Backup & Export']]
  ];
  function settingsView(sub) {
    const cur = SETTINGS_SECTIONS.find((x) => x[0] === sub) || SETTINGS_SECTIONS[0];
    const known = SETTINGS_SECTIONS.flatMap((x) => x[2]);
    const ws = $('#admin-workspace'); if (!ws) return;
    ws.querySelectorAll('.admin-panel').forEach((panel) => {
      const h = (panel.querySelector('h2') || {}).textContent;
      const name = (h || '').trim();
      panel.hidden = known.includes(name) ? !cur[2].includes(name) : cur[0] !== 'home';
    });
    const old = ws.querySelector('.mc-subtabs'); if (old) old.remove();
    const bar = document.createElement('nav'); bar.className = 'mc-subtabs'; bar.setAttribute('aria-label', 'Settings sections');
    bar.innerHTML = SETTINGS_SECTIONS.map(([id, label]) => '<a href="#/settings/' + id + '"' + (id === cur[0] ? ' aria-current="page"' : '') + '>' + label + '</a>').join('');
    ws.prepend(bar);
  }
  /* ---------- Activity & Audit Log Viewer ---------- */
  async function adminAuditLog() {
    MC.setWorkspace('Activity Log', '<div class="mc-loading" role="status"><span>Loading audit records…</span></div>');
    let auditRecords = [], certRecords = [];
    try {
      const [logsRes, certLogsRes] = await Promise.all([
        sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        sb.from('cert_audit_log').select('*').order('created_at', { ascending: false }).limit(50)
      ]);
      if (logsRes.data) auditRecords = logsRes.data;
      if (certLogsRes.data) certRecords = certLogsRes.data;
    } catch (e) {
      console.warn('Audit logs fetch warning:', e);
    }

    const auditList = auditRecords.map((x) => ({
      id: x.id,
      actor: x.actor_id || 'Organizer',
      action: x.action || 'update',
      target: x.table_name || 'system',
      detail: x.record_id || '',
      time: x.created_at
    }));

    const certList = certRecords.map((x) => ({
      id: x.id,
      actor: x.actor_id || 'System / Admin',
      action: x.action || 'certificate_claim',
      target: 'certificates',
      detail: typeof x.details === 'object' ? JSON.stringify(x.details) : (x.details || ''),
      time: x.created_at
    }));

    const allLogs = [...auditList, ...certList].sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

    let filter = 'all';
    let q = '';

    const actionBadge = (act) => {
      const a = String(act || '').toLowerCase();
      if (['create', 'insert', 'sync_team'].includes(a)) return '<span class="mc-badge-pill green">CREATE</span>';
      if (['update', 'edit', 'reorder', 'enable_scoring'].includes(a)) return '<span class="mc-badge-pill blue">UPDATE</span>';
      if (['delete', 'remove', 'pause_scoring'].includes(a)) return '<span class="mc-badge-pill red">DELETE</span>';
      if (['claim', 'certificate_claim', 'issue_cert'].includes(a)) return '<span class="mc-badge-pill yellow">CERTIFICATE</span>';
      return `<span class="mc-badge-pill">${esc(a.toUpperCase())}</span>`;
    };

    const timeAgo = (dateStr) => {
      if (!dateStr) return '';
      const diffMs = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diffMs / 60000);
      if (mins < 1) return 'Just now';
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      const days = Math.floor(hrs / 24);
      if (days < 7) return `${days}d ago`;
      return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const drawAudit = () => {
      const filtered = allLogs.filter((l) => {
        if (filter !== 'all') {
          if (filter === 'create' && !['create', 'insert', 'sync_team'].includes(l.action)) return false;
          if (filter === 'update' && !['update', 'edit', 'reorder', 'enable_scoring'].includes(l.action)) return false;
          if (filter === 'delete' && !['delete', 'remove', 'pause_scoring'].includes(l.action)) return false;
        }
        if (q && !`${l.action} ${l.target} ${l.detail} ${l.actor}`.toLowerCase().includes(q)) return false;
        return true;
      });

      const createCount = allLogs.filter((l) => ['create', 'insert', 'sync_team'].includes(l.action)).length;
      const updateCount = allLogs.filter((l) => ['update', 'edit', 'reorder', 'enable_scoring'].includes(l.action)).length;
      const deleteCount = allLogs.filter((l) => ['delete', 'remove', 'pause_scoring'].includes(l.action)).length;

      MC.setWorkspace('Activity Log', `
        <p class="mc-lead">Comprehensive audit trail of chapter administrative events, content publications, and credential issuances.</p>
        
        <div class="mc-summary-bar">
          <div class="mc-sum-item">
            <span class="mc-sum-val">${allLogs.length}</span>
            <span class="mc-sum-label">Total Logs</span>
          </div>
          <div class="mc-sum-item ok">
            <span class="mc-sum-dot green"></span>
            <span class="mc-sum-val">${createCount}</span>
            <span class="mc-sum-label">Creations</span>
          </div>
          <div class="mc-sum-item">
            <span class="mc-sum-dot blue"></span>
            <span class="mc-sum-val">${updateCount}</span>
            <span class="mc-sum-label">Updates</span>
          </div>
          <div class="mc-sum-item warn">
            <span class="mc-sum-dot red"></span>
            <span class="mc-sum-val">${deleteCount}</span>
            <span class="mc-sum-label">Deletions</span>
          </div>
        </div>

        <div class="mc-toolbar">
          <div class="mc-find">
            ${MC.icon ? MC.icon('search') : ''}
            <input type="search" id="audit-q" placeholder="Filter by action, table, or record..." value="${esc(q)}">
            <button type="button" class="mc-find-clear" id="audit-q-clear" ${q ? '' : 'hidden'}>×</button>
          </div>
          <div class="mc-chips" role="group">
            ${[['all', 'All Activity'], ['create', 'Creations'], ['update', 'Updates'], ['delete', 'Deletions']].map(([k, l]) => `
              <button type="button" class="mc-chip-btn ${k === filter ? 'active' : ''}" data-audit-filter="${k}" aria-pressed="${k === filter}">${l}</button>
            `).join('')}
          </div>
          <button type="button" class="button-outline" id="audit-refresh" style="font-size:12px;margin-left:auto">${MC.icon ? MC.icon('refresh') : ''} Refresh</button>
        </div>

        <div class="mc-card" style="padding:0;overflow:hidden">
          ${filtered.length ? `
            <div class="mc-audit-table-wrap">
              <table class="mc-audit-table">
                <thead>
                  <tr>
                    <th style="width:130px">Action</th>
                    <th style="width:160px">Table / Target</th>
                    <th>Record / Identifier</th>
                    <th style="width:130px;text-align:right">Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map((l) => `
                    <tr>
                      <td>${actionBadge(l.action)}</td>
                      <td><code class="mc-table-code">${esc(l.target)}</code></td>
                      <td class="mc-audit-detail"><span title="${esc(l.detail)}">${esc(l.detail || '—')}</span></td>
                      <td style="text-align:right;white-space:nowrap;color:var(--ink-2);font-size:12px">
                        <span title="${esc(l.time ? new Date(l.time).toLocaleString('en-IN') : '')}">${esc(timeAgo(l.time))}</span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="padding:36px;text-align:center;color:var(--ink-2)">
              <b>No audit records match your search.</b>
              <p style="font-size:12.5px;margin:4px 0 0">Administrative actions will automatically appear here as changes are made.</p>
            </div>
          `}
        </div>
      `);

      const qInp = $('#audit-q');
      const qClr = $('#audit-q-clear');
      if (qInp) {
        qInp.oninput = (MC.debounce || ((fn) => fn))(() => {
          q = qInp.value.trim().toLowerCase();
          if (qClr) qClr.hidden = !q;
          drawAudit();
        }, 80);
      }
      if (qClr) {
        qClr.onclick = () => {
          q = '';
          drawAudit();
        };
      }
      $$('[data-audit-filter]').forEach((b) => {
        b.onclick = () => {
          filter = b.dataset.auditFilter;
          drawAudit();
        };
      });
      $('#audit-refresh')?.addEventListener('click', () => adminAuditLog());
    };

    drawAudit();
  }

  MC.pages.settings = async (route) => { await adminSettings(); settingsView(route && route.sub); };
  MC.pages.audit = () => adminAuditLog();
})();
