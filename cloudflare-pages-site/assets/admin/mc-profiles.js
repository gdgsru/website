/* Mission Control → Member profiles.
 * Shows every member pass (static list published to /data/profiles_index.json) next to what the database knows
 * (live XP, workshops, hidden flag), and lets organizers:
 *   - hide / unhide a pass instantly (no rebuild; the public page shows "This pass isn't available")
 *   - remove a member's live-stats mapping
 *   - spot mismatches: published but not in the database, or in the database but not published
 * All writes go through admin-only RPCs that check public.is_admin() server-side (migration 20261028090000).
 * Profile text (name, links, bio) lives in the repo and is changed by editing the sheet and re-running build_profiles.py. */
(() => {
  'use strict';
  const MC = window.MC;
  const sb = MC.sb;
  const { $, $$, esc, icon, setWorkspace, audit, toast, confirmDialog, authErrorText } = MC;

  const HANDLE_RE = /^[a-z0-9_-]{2,32}$/;
  const LEVELS = [['Explorer', 0], ['Builder', 200], ['Innovator', 500], ['Vanguard', 1000]];
  const levelOf = (pts) => LEVELS.filter(([, min]) => pts >= min).pop()[0];
  const FILTERS = [['all', 'All'], ['attention', 'Needs attention'], ['hidden', 'Hidden']];
  const STATE = {
    live: { label: 'Live', cls: 'green', hint: '' },
    hidden: { label: 'Hidden', cls: 'red', hint: 'Public page shows “This pass isn’t available”.' },
    'no-db': { label: 'Not in database', cls: 'yellow', hint: 'Run the newest members_seed.sql in Supabase so live stats work.' },
    'no-json': { label: 'Not published', cls: 'blue', hint: 'In the database but no profile file: re-run build_profiles.py and push.' }
  };

  let rows = [];
  let meta = { generated: '', indexMissing: false };
  let query = '';
  let filter = 'all';

  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const stateOf = (r) => (r.hidden ? 'hidden' : !r.inDb ? 'no-db' : !r.published ? 'no-json' : 'live');
  const needsAttention = (r) => r.state === 'no-db' || r.state === 'no-json';
  const rpcHint = (e) => (/function .* does not exist|schema cache|Could not find the function/i.test(e?.message || '')
    ? 'Run migration 20261028090000_member_profiles_admin.sql in the Supabase SQL Editor, then reload this page.'
    : authErrorText(e));

  /* ---------- data ---------- */
  async function load() {
    const [idxRes, ov] = await Promise.all([
      fetch('/data/profiles_index.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      sb.rpc('admin_member_overview')
    ]);
    if (ov.error) throw ov.error;
    const published = idxRes && Array.isArray(idxRes.profiles) ? idxRes.profiles : [];
    meta = { generated: (idxRes && idxRes.generated) || '', indexMissing: !idxRes };

    const map = new Map();
    published.forEach((p) => {
      if (!p || !HANDLE_RE.test(String(p.u))) return;
      map.set(p.u, { handle: p.u, name: String(p.n || p.u), dept: String(p.d || ''), cohort: String(p.c || ''), published: true, inDb: false, hidden: false, points: 0, activities: 0, workshops: 0 });
    });
    (ov.data || []).forEach((d) => {
      const r = map.get(d.handle) || { handle: d.handle, name: '', dept: '', cohort: '', published: false };
      Object.assign(r, { inDb: true, hidden: !!d.hidden, points: Number(d.points) || 0, activities: Number(d.activities) || 0, workshops: Number(d.workshops) || 0 });
      map.set(d.handle, r);
    });
    rows = [...map.values()].sort((a, b) => (a.name || a.handle).localeCompare(b.name || b.handle, undefined, { sensitivity: 'base' }));
    rows.forEach((r) => { r.state = stateOf(r); });
  }

  /* ---------- view ---------- */
  function injectStyle() {
    if ($('#mp-style')) return;
    const st = document.createElement('style');
    st.id = 'mp-style';
    st.textContent = `
      .mp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 18px}
      .mp-stat{padding:14px 16px;border:1px solid var(--line);border-radius:var(--r-m);background:var(--surface)}
      .mp-stat b{display:block;font-size:26px;line-height:1.1;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
      .mp-stat span{font-size:12px;color:var(--ink-3)}
      .mp-stat.warn b{color:var(--yellow-ink)}
      .mp-tools{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-bottom:14px}
      .mp-tools input[type=search]{min-width:220px;flex:1;max-width:360px}
      .mp-table td,.mp-table th{vertical-align:middle}
      .mp-table small{color:var(--ink-3)}
      .mp-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
      .mp-hint{display:block;margin-top:4px;font-size:12px;color:var(--ink-3);max-width:34ch}
      .mp-steps{margin:8px 0 0;padding-left:20px;display:grid;gap:6px}
      .mp-note{margin-top:14px;padding:12px 14px;border:1px dashed var(--line-2);border-radius:var(--r-m);font-size:13px;color:var(--ink-2)}
    `;
    document.head.appendChild(st);
  }

  const counts = () => ({
    published: rows.filter((r) => r.published).length,
    live: rows.filter((r) => r.state === 'live').length,
    hidden: rows.filter((r) => r.state === 'hidden').length,
    attention: rows.filter(needsAttention).length
  });

  function summaryHtml() {
    const c = counts();
    return `<div class="mp-stats" id="mp-summary">
      <div class="mp-stat"><b>${c.published}</b><span>Published passes</span></div>
      <div class="mp-stat"><b>${c.live}</b><span>Live (stats connected)</span></div>
      <div class="mp-stat"><b>${c.hidden}</b><span>Hidden</span></div>
      <div class="mp-stat ${c.attention ? 'warn' : ''}"><b>${c.attention}</b><span>Need attention</span></div>
    </div>`;
  }

  function visibleRows() {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter === 'attention' && !needsAttention(r)) return false;
      if (filter === 'hidden' && r.state !== 'hidden') return false;
      return !q || `${r.name} ${r.handle} ${r.dept} ${r.cohort}`.toLowerCase().includes(q);
    });
  }

  function listHtml() {
    if (!rows.length) return '<p class="admin-empty">No member passes yet. Run <code>build_profiles.py</code>, push, then run the seed in Supabase.</p>';
    const list = visibleRows();
    if (!list.length) return '<p class="admin-empty">Nothing matches.</p>';
    return `<div class="table-wrap"><table class="mp-table"><thead><tr>
        <th>Member</th><th>Department</th><th>Level</th><th>Workshops</th><th>Status</th><th><span class="sr-only">Actions</span></th>
      </tr></thead><tbody>${list.map((r) => {
        const st = STATE[r.state];
        const name = r.published
          ? `<a href="/u/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener noreferrer"><b>${esc(r.name)}</b></a>`
          : `<b>${esc(r.name || '(no profile file)')}</b>`;
        const level = r.inDb ? `${esc(levelOf(r.points))}<br><small>${r.points.toLocaleString('en-IN')} XP</small>` : '<span class="muted">—</span>';
        const acts = r.inDb
          ? `<button type="button" class="button-outline" data-mp="${r.hidden ? 'unhide' : 'hide'}" data-handle="${esc(r.handle)}">${r.hidden ? 'Unhide' : 'Hide'}</button>
             <button type="button" class="danger" data-mp="remove" data-handle="${esc(r.handle)}">Remove</button>`
          : '';
        const copy = r.published ? `<button type="button" class="button-outline" data-mp="copy" data-handle="${esc(r.handle)}" aria-label="Copy link to ${esc(r.name)}’s pass">Copy link</button>` : '';
        return `<tr>
          <td>${name}<br><small>@${esc(r.handle)}</small></td>
          <td>${esc(r.dept || '—')}${r.cohort ? `<br><small>Cohort ${esc(r.cohort)}</small>` : ''}</td>
          <td>${level}</td>
          <td>${r.inDb ? r.workshops : '<span class="muted">—</span>'}</td>
          <td><span class="mc-badge-pill ${st.cls}">${st.label}</span>${st.hint ? `<small class="mp-hint">${esc(st.hint)}</small>` : ''}</td>
          <td><div class="mp-actions">${copy}${acts}</div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  function paint() {
    injectStyle();
    const actions = `<button type="button" class="button-outline" id="mp-refresh">${icon('clock')} Refresh</button>
      <button type="button" class="button-outline" id="mp-csv" ${rows.length ? '' : 'disabled'}>Download CSV</button>`;
    setWorkspace('Member profiles', `
      <p class="admin-lead" style="margin:0 0 14px">Public member passes at <code>/u/handle</code>. Hide a pass instantly, or check that the published list and the database agree.</p>
      ${meta.indexMissing ? '<p class="mp-note" style="margin:0 0 14px">Couldn’t load <code>/data/profiles_index.json</code>. Run <code>build_profiles.py</code> and push it. Only database rows are shown below.</p>' : ''}
      ${summaryHtml()}
      <section class="admin-panel">
        <div class="mp-tools">
          <input type="search" id="mp-search" placeholder="Search name, handle, department" aria-label="Search members" value="${esc(query)}" autocomplete="off">
          <div class="mc-chips" role="group" aria-label="Filter members">${FILTERS.map(([id, label]) => `<button type="button" class="button-outline" data-mp-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>
        </div>
        <div id="mp-list">${listHtml()}</div>
        ${meta.generated ? `<p class="muted small" style="margin:12px 0 0">Published list last built ${esc(new Date(meta.generated).toLocaleString('en-IN'))}.</p>` : ''}
      </section>
      <section class="admin-panel">
        <h2>Publishing a new batch</h2>
        <ol class="mp-steps">
          <li>In the sheet, set <code>Approved = TRUE</code> for members whose attendance you verified, then export the CSV.</li>
          <li>Run <code>python scripts/build_profiles.py verified_responses.csv</code> and fix any username collisions it prints.</li>
          <li>Paste <code>build/members_seed.sql</code> into the Supabase SQL Editor and run it. Hidden passes stay hidden.</li>
          <li>Commit and push <code>cloudflare-pages-site/data</code>. Cloudflare deploys in about a minute.</li>
        </ol>
        <p class="mp-note"><b>Hide vs delete.</b> Hiding blocks the pass page and removes its points and certificates from the public lookup straight away. The member’s profile file stays in the repo until you remove them from the sheet, rebuild and push, and they stay in search until then. To fix a handle or any profile text, edit the sheet and rebuild.</p>
      </section>`, actions);
    bind();
  }

  function repaintList() {
    const box = $('#mp-list'); if (box) box.innerHTML = listHtml();
    const sum = $('#mp-summary'); if (sum) sum.outerHTML = summaryHtml();
    $$('[data-mp-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mpFilter === filter)));
  }

  /* ---------- actions ---------- */
  async function reload(message) {
    try { await load(); } catch (e) { toast(rpcHint(e), false); return; }
    paint();
    if (message) toast(message, true);
  }

  async function act(kind, handle) {
    const r = rows.find((x) => x.handle === handle); if (!r) return;
    const who = r.name || '@' + handle;
    if (kind === 'copy') {
      const url = `${location.origin}/u/${handle}`;
      try { await navigator.clipboard.writeText(url); toast('Link copied', true); } catch { toast(url, true); }
      return;
    }
    if (kind === 'hide') {
      if (!(await confirmDialog({ title: `Hide ${who}’s pass?`, body: 'The public page will say the pass isn’t available, and their points and certificates stop being returned. You can unhide it at any time.', confirm: 'Hide pass', danger: true }))) return;
      const res = await sb.rpc('admin_set_member_hidden', { p_handle: handle, p_hidden: true });
      if (res.error) return toast(rpcHint(res.error), false);
      await audit('update', 'member_profiles', `hide @${handle}`);
      return reload(`${who}’s pass is hidden.`);
    }
    if (kind === 'unhide') {
      const res = await sb.rpc('admin_set_member_hidden', { p_handle: handle, p_hidden: false });
      if (res.error) return toast(rpcHint(res.error), false);
      await audit('update', 'member_profiles', `unhide @${handle}`);
      return reload(`${who}’s pass is visible again.`);
    }
    if (kind === 'remove') {
      if (!(await confirmDialog({ title: `Remove ${who} from the database?`, body: 'Their live stats stop working. Their static pass page stays online until you remove them from the sheet, rebuild and push (use Hide for an instant takedown).', confirm: 'Remove', danger: true }))) return;
      const res = await sb.rpc('admin_delete_member_profile', { p_handle: handle });
      if (res.error) return toast(rpcHint(res.error), false);
      await audit('delete', 'member_profiles', `@${handle}`);
      return reload(`Removed @${handle} from the database.`);
    }
  }

  function downloadCsv() {
    const head = ['handle', 'name', 'department', 'cohort', 'status', 'xp', 'level', 'workshops'];
    const lines = [head.join(',')].concat(rows.map((r) => [r.handle, r.name, r.dept, r.cohort, STATE[r.state].label, r.inDb ? r.points : '', r.inDb ? levelOf(r.points) : '', r.inDb ? r.workshops : ''].map(csvCell).join(',')));
    const blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'member-profiles.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function bind() {
    const list = $('#mp-list');
    if (list) list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mp]'); if (!b || b.disabled) return;
      b.disabled = true;
      Promise.resolve(act(b.dataset.mp, b.dataset.handle)).finally(() => { b.disabled = false; });
    });
    const s = $('#mp-search');
    if (s) s.addEventListener('input', () => { query = s.value; repaintList(); });
    $$('[data-mp-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.mpFilter; repaintList(); }));
    const rf = $('#mp-refresh'); if (rf) rf.addEventListener('click', () => reload('Refreshed.'));
    const csv = $('#mp-csv'); if (csv) csv.addEventListener('click', downloadCsv);
  }

  MC.pages['member-profiles'] = async () => {
    try {
      await load();
    } catch (e) {
      console.warn('[Admin] member profiles', e);
      setWorkspace('Member profiles', `<section class="admin-panel"><h2>Couldn’t load member profiles</h2><p class="admin-empty">${esc(rpcHint(e))}</p></section>`);
      return;
    }
    paint();
  };
})();
