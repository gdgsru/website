/* Mission Control → Member Profiles Studio
 * Full studio management for GDG SRU member passes:
 *   - Live interactive card preview (supports both Digital Pass Badge & Developer Holo-Card designs)
 *   - Inspect individual member passes & live XP stats
 *   - Quick award community XP directly from the profile drawer
 *   - Instant hide / unhide toggle (no rebuild required)
 *   - Quick add member for immediate pre-batch onboarding
 *   - Mismatch detection: published vs database status
 */
(() => {
  'use strict';
  const MC = window.MC;
  const sb = MC.sb;
  const { $, $$, esc, icon, setWorkspace, audit, toast, confirmDialog, authErrorText, drawer } = MC;

  const HANDLE_RE = /^[a-z0-9_-]{2,32}$/;
  const LEVELS = [['Explorer', 0], ['Builder', 200], ['Innovator', 500], ['Vanguard', 1000]];
  const levelOf = (pts) => LEVELS.filter(([, min]) => pts >= min).pop()[0];
  const FILTERS = [['all', 'All'], ['attention', 'Needs attention'], ['hidden', 'Hidden']];
  const SKINS = ['google-blue', 'google-green', 'google-yellow', 'google-red', 'terminal-dark'];
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
  let pointRules = [];

  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const stateOf = (r) => (r.hidden ? 'hidden' : !r.inDb ? 'no-db' : !r.published ? 'no-json' : 'live');
  const needsAttention = (r) => r.state === 'no-db' || r.state === 'no-json';
  const rpcHint = (e) => (/function .* does not exist|schema cache|Could not find the function/i.test(e?.message || '')
    ? 'Run migration 20261028090000_member_profiles_admin.sql in the Supabase SQL Editor, then reload this page.'
    : authErrorText(e));

  function getAvatarSrc(raw) {
    const m = /^avatar-(\d{2})$/.exec(String(raw || ''));
    return m ? `/assets/avatars/${m[0]}.svg` : '/assets/avatars/avatar-01.svg';
  }

  /* ---------- data ---------- */
  async function load() {
    const [idxRes, ov, rulesRes] = await Promise.all([
      fetch('/data/profiles_index.json?v=' + Date.now(), { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      sb.rpc('admin_member_overview'),
      sb.from('point_rules').select('*').eq('enabled', true).order('sort_order').catch(() => ({ data: [] }))
    ]);
    if (ov.error) throw ov.error;
    pointRules = (rulesRes && rulesRes.data) || [];

    const published = idxRes && Array.isArray(idxRes.profiles) ? idxRes.profiles : [];
    meta = { generated: (idxRes && idxRes.generated) || '', indexMissing: !idxRes };

    const map = new Map();
    published.forEach((p) => {
      if (!p || !HANDLE_RE.test(String(p.u))) return;
      map.set(p.u, {
        handle: p.u,
        name: String(p.n || p.u),
        dept: String(p.d || ''),
        cohort: String(p.c || ''),
        avatar: p.a || 'avatar-01',
        theme: p.t || 'google-blue',
        skills: Array.isArray(p.s) ? p.s : [],
        bio: p.b || '',
        published: true,
        inDb: false,
        hidden: false,
        points: 0,
        activities: 0,
        workshops: 0
      });
    });

    (ov.data || []).forEach((d) => {
      const r = map.get(d.handle) || { handle: d.handle, name: '', dept: '', cohort: '', avatar: 'avatar-01', theme: 'google-blue', skills: [], bio: '', published: false };
      Object.assign(r, {
        inDb: true,
        hidden: !!d.hidden,
        points: Number(d.points) || 0,
        activities: Number(d.activities) || 0,
        workshops: Number(d.workshops) || 0
      });
      map.set(d.handle, r);
    });

    rows = [...map.values()].sort((a, b) => (a.name || a.handle).localeCompare(b.name || b.handle, undefined, { sensitivity: 'base' }));
    rows.forEach((r) => { r.state = stateOf(r); });
  }

  /* ---------- styles ---------- */
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
      .mp-table tr:hover td{background:rgba(66, 133, 244, 0.04)}
      .mp-table small{color:var(--ink-3)}
      .mp-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}
      .mp-hint{display:block;margin-top:4px;font-size:12px;color:var(--ink-3);max-width:34ch}
      .mp-steps{margin:8px 0 0;padding-left:20px;display:grid;gap:6px}
      .mp-note{margin-top:14px;padding:12px 14px;border:1px dashed var(--line-2);border-radius:var(--r-m);font-size:13px;color:var(--ink-2)}

      /* Studio Inspector Drawer */
      .mp-drawer-grid{display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start}
      @media(max-width:760px){.mp-drawer-grid{grid-template-columns:1fr}}
      .mp-drawer-col{display:flex;flex-direction:column;gap:18px}
      .mp-sec-box{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:16px}
      .mp-sec-box h3{font-size:14px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;justify-content:space-between}
      .mp-field-row{display:flex;flex-direction:column;gap:4px;margin-bottom:12px}
      .mp-field-row label{font-size:12px;font-weight:600;color:var(--ink-2)}
      .mp-field-row input,.mp-field-row select{height:34px;padding:0 10px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:13px}
      .mp-actions-bar{display:flex;gap:8px;flex-wrap:wrap}

      /* Drawer Card Preview */
      .mp-preview-host{display:flex;flex-direction:column;align-items:center;gap:12px;position:sticky;top:0}
      .mp-preview-controls{display:flex;gap:6px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:6px}
      .mp-pbtn{height:28px;padding:0 10px;border-radius:99px;font-size:11.5px;font-weight:700;border:1px solid var(--line);background:var(--surface);cursor:pointer;color:var(--ink-2)}
      .mp-pbtn.active{background:var(--blue);color:#fff;border-color:var(--blue)}

      /* Miniature Live Card inside Admin */
      .mp-admin-card-stage{width:100%;max-width:320px;perspective:1000px}
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
        const name = `<b>${esc(r.name || r.handle)}</b>`;
        const level = r.inDb ? `${esc(levelOf(r.points))}<br><small>${r.points.toLocaleString('en-IN')} XP</small>` : '<span class="muted">—</span>';
        const inspectBtn = `<button type="button" class="button-outline" data-mp="inspect" data-handle="${esc(r.handle)}" style="font-weight:700">Inspect &amp; Card ↗</button>`;
        const copy = r.published ? `<button type="button" class="button-outline" data-mp="copy" data-handle="${esc(r.handle)}" title="Copy link to pass">Copy</button>` : '';
        return `<tr data-row-handle="${esc(r.handle)}">
          <td style="cursor:pointer" data-mp="inspect" data-handle="${esc(r.handle)}">${name}<br><small>@${esc(r.handle)}</small></td>
          <td>${esc(r.dept || '—')}${r.cohort ? `<br><small>Cohort ${esc(r.cohort)}</small>` : ''}</td>
          <td>${level}</td>
          <td>${r.inDb ? r.workshops : '<span class="muted">—</span>'}</td>
          <td><span class="mc-badge-pill ${st.cls}">${st.label}</span>${st.hint ? `<small class="mp-hint">${esc(st.hint)}</small>` : ''}</td>
          <td><div class="mp-actions">${inspectBtn}${copy}</div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  /* ---------- Inspector Drawer: Live Card Preview + Admin Controls ---------- */
  function openInspector(handle) {
    const r = rows.find((x) => x.handle === handle);
    if (!r) return;

    let previewDesign = 'holo'; // 'pass' or 'holo'
    let previewSkin = r.theme || 'google-blue';
    let isFlipped = false;

    function renderPreviewCard() {
      const avatarSrc = getAvatarSrc(r.avatar);
      const lvl = levelOf(r.points);
      const lvlNum = r.points >= 1000 ? 4 : r.points >= 500 ? 3 : r.points >= 200 ? 2 : 1;
      const achieve = `${r.points > 0 ? `💎 ${r.points} Community XP` : '✓ Verified Member'}`;

      if (previewDesign === 'pass') {
        return `
          <div style="width:280px;border-radius:20px;padding:16px;background:linear-gradient(160deg,#4285f4,#1a4fb8);color:#fff;box-shadow:0 12px 30px rgba(0,0,0,0.35);position:relative;display:flex;flex-direction:column;min-height:360px;" data-skin="${esc(previewSkin)}">
            <div style="width:40px;height:7px;border-radius:99px;background:rgba(0,0,0,0.35);margin:0 auto 10px;"></div>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <span style="font-size:10px;font-weight:700;line-height:1.2;opacity:0.8;">GDG on Campus<br>SR University</span>
              <span style="font-size:9px;font-weight:700;padding:3px 7px;border-radius:99px;background:rgba(255,255,255,0.18);">MEMBER</span>
            </div>
            <div style="width:68px;height:68px;margin:0 auto 8px;border-radius:50%;overflow:hidden;border:2px solid #fff;background:#fff;">
              <img src="${avatarSrc}" alt="" style="width:100%;height:100%;object-fit:cover;">
            </div>
            <h4 style="text-align:center;font-size:17px;font-weight:800;margin:0 0 2px;">${esc(r.name || r.handle)}</h4>
            <p style="text-align:center;font-size:11px;opacity:0.75;margin:0 0 10px;">@${esc(r.handle)}</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px;padding:8px 0;border-top:1px dashed rgba(255,255,255,0.3);border-bottom:1px dashed rgba(255,255,255,0.3);margin-bottom:8px;">
              <div><span style="font-size:9px;text-transform:uppercase;opacity:0.75;display:block;">Cohort</span><b>${esc(r.cohort || '2024')}</b></div>
              <div><span style="font-size:9px;text-transform:uppercase;opacity:0.75;display:block;">Points</span><b>${r.points} XP</b></div>
            </div>
            <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;">
              <span style="font-size:9.5px;padding:3px 8px;border-radius:99px;background:rgba(255,255,255,0.18);">Verified</span>
              <span style="font-size:9.5px;padding:3px 8px;border-radius:99px;background:#fff;color:#111;font-weight:700;">Lvl ${lvlNum} · ${esc(lvl)}</span>
            </div>
          </div>
        `;
      }

      // Holo-card
      return `
        <div style="width:280px;height:360px;position:relative;perspective:1000px;cursor:pointer;" id="mp-drawer-card-flip">
          <div style="width:100%;height:100%;position:relative;transition:transform 0.6s;transform-style:preserve-3d;${isFlipped ? 'transform:rotateY(180deg)' : ''}">
            <!-- Front -->
            <div style="position:absolute;inset:0;backface-visibility:hidden;border-radius:22px;background:#fff;border:1.5px solid #e8eaed;padding:18px;display:flex;flex-direction:column;box-shadow:0 10px 30px rgba(0,0,0,0.1);">
              <div style="height:3px;background:linear-gradient(90deg,#4285f4,#ea4335,#fbbc04,#34a853);margin:-18px -18px 14px -18px;border-radius:22px 22px 0 0;"></div>
              <div style="display:flex;justify-content:space-between;align-items:center;font-size:10.5px;font-weight:700;color:#5f6368;margin-bottom:10px;">
                <span>GDG SRU // BUILDER</span>
                <span style="color:#4285f4;background:rgba(66,133,244,0.1);padding:3px 7px;border-radius:99px;">${r.points} XP</span>
              </div>
              <div style="width:64px;height:64px;margin:0 auto 8px;border-radius:50%;padding:2px;background:conic-gradient(#4285f4,#ea4335,#fbbc04,#34a853,#4285f4);">
                <img src="${avatarSrc}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;background:#fff;">
              </div>
              <h4 style="text-align:center;font-size:16.5px;font-weight:800;margin:0 0 2px;color:#111;">${esc(r.name || r.handle)}</h4>
              <p style="text-align:center;font-size:11.5px;color:#5f6368;margin:0 0 8px;">@${esc(r.handle)}</p>
              <div style="padding:6px 10px;border-radius:8px;background:#f8f9fc;border:1px solid #e8eaed;font-size:11.5px;font-weight:600;margin-bottom:8px;text-align:center;color:#111;">
                ${achieve}
              </div>
              <p style="text-align:center;font-size:10.5px;color:#5f6368;margin-top:auto;">↺ Click card to flip</p>
            </div>
            <!-- Back -->
            <div style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);border-radius:22px;background:#141518;color:#fff;border:1.5px solid #2b2d32;padding:18px;display:flex;flex-direction:column;justify-content:space-between;">
              <div>
                <span style="font-size:11px;font-weight:700;color:#8ab4f8;text-transform:uppercase;letter-spacing:0.1em;">Developer Pass</span>
                <p style="font-size:12.5px;line-height:1.45;color:rgba(255,255,255,0.75);margin:10px 0;">"${esc(r.bio || 'Verified GDG SRU student developer.')}"</p>
                <div style="font-size:11.5px;color:rgba(255,255,255,0.5);line-height:1.4;">
                  <p>Branch: <b style="color:#fff;">${esc(r.dept || 'SR University')}</b></p>
                  <p>Cohort: <b style="color:#fff;">${esc(r.cohort || '2024')}</b></p>
                  <p>Status: <b style="color:#81c995;">Verified</b></p>
                </div>
              </div>
              <p style="text-align:center;font-size:10.5px;color:rgba(255,255,255,0.5);">↺ Click to flip back</p>
            </div>
          </div>
        </div>
      `;
    }

    const d = drawer.open({
      title: r.name || `@${r.handle}`,
      subtitle: `Member Pass Studio · ${r.dept || 'SR University'}`,
      wide: true,
      body: `
        <div class="mp-drawer-grid">
          <!-- Left Column: Member Meta & Quick Actions -->
          <div class="mp-drawer-col">
            <div class="mp-sec-box">
              <h3><span>Identity &amp; Status</span> <span class="mc-badge-pill ${STATE[r.state].cls}">${STATE[r.state].label}</span></h3>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:13px;margin-bottom:14px;">
                <div><span style="color:var(--ink-3);display:block;font-size:11px;text-transform:uppercase;">Handle</span><b>@${esc(r.handle)}</b></div>
                <div><span style="color:var(--ink-3);display:block;font-size:11px;text-transform:uppercase;">Department</span><b>${esc(r.dept || '—')}</b></div>
                <div><span style="color:var(--ink-3);display:block;font-size:11px;text-transform:uppercase;">Community XP</span><b>${r.points} XP</b></div>
                <div><span style="color:var(--ink-3);display:block;font-size:11px;text-transform:uppercase;">Workshops Attended</span><b>${r.workshops}</b></div>
              </div>
              <div class="mp-actions-bar">
                <a href="/u/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener" class="mc-btn-save" style="font-size:12.5px;text-decoration:none;">
                  Open Live Pass ↗
                </a>
                <button type="button" class="button-outline" id="mp-drawer-toggle-hide" style="font-size:12.5px;">
                  ${r.hidden ? 'Unhide Pass' : 'Hide Pass'}
                </button>
                <button type="button" class="button-outline" id="mp-drawer-copy-link" style="font-size:12.5px;">
                  Copy Link
                </button>
              </div>
            </div>

            <!-- Award Points Section -->
            <div class="mp-sec-box">
              <h3><span>+ Award Community XP</span> <small style="color:var(--ink-3);font-size:12px">Syncs live to pass</small></h3>
              <form id="mp-award-form">
                <div class="mp-field-row">
                  <label for="mp-award-rule">Eligible Activity Rule</label>
                  <select id="mp-award-rule" required>
                    ${pointRules.map((ru) => `<option value="${esc(ru.activity_type)}">${esc(ru.label)} (+${ru.points} pts)</option>`).join('') || '<option value="workshop_attendance">Workshop Attendance (+5 pts)</option>'}
                  </select>
                </div>
                <div class="mp-field-row">
                  <label for="mp-award-ref">Event / Reference ID</label>
                  <input type="text" id="mp-award-ref" placeholder="e.g. cloud-study-jam-26" required>
                </div>
                <div class="mp-field-row">
                  <label for="mp-award-note">Admin Note (Private)</label>
                  <input type="text" id="mp-award-note" placeholder="Optional audit memo">
                </div>
                <button type="submit" class="mc-btn-save" style="width:100%;justify-content:center;margin-top:6px;">
                  Record &amp; Award Points
                </button>
              </form>
            </div>
          </div>

          <!-- Right Column: Interactive Card Preview -->
          <div class="mp-preview-host">
            <div class="mp-preview-controls">
              <button type="button" class="mp-pbtn ${previewDesign === 'holo' ? 'active' : ''}" data-pv-design="holo">🃏 Holo-Card</button>
              <button type="button" class="mp-pbtn ${previewDesign === 'pass' ? 'active' : ''}" data-pv-design="pass">🪪 Digital Pass</button>
            </div>
            <div id="mp-card-preview-container" class="mp-admin-card-stage">
              ${renderPreviewCard()}
            </div>
            <p style="font-size:11.5px;color:var(--ink-3);text-align:center;margin:4px 0 0;">
              Live member card preview. Visitors see this design on the site.
            </p>
          </div>
        </div>
      `
    });

    const bodyEl = d.el;

    // Toggle Card Design
    $$('[data-pv-design]', bodyEl).forEach((btn) => {
      btn.onclick = () => {
        $$('[data-pv-design]', bodyEl).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        previewDesign = btn.dataset.pvDesign;
        isFlipped = false;
        const host = $('#mp-card-preview-container', bodyEl);
        if (host) host.innerHTML = renderPreviewCard();
        attachFlip();
      };
    });

    function attachFlip() {
      const cardEl = $('#mp-drawer-card-flip', bodyEl);
      if (cardEl) {
        cardEl.onclick = () => {
          isFlipped = !isFlipped;
          const host = $('#mp-card-preview-container', bodyEl);
          if (host) host.innerHTML = renderPreviewCard();
          attachFlip();
        };
      }
    }
    attachFlip();

    // Toggle Hide
    $('#mp-drawer-toggle-hide', bodyEl)?.addEventListener('click', async () => {
      await act(r.hidden ? 'unhide' : 'hide', r.handle);
      d.close(true);
    });

    // Copy Link
    $('#mp-drawer-copy-link', bodyEl)?.addEventListener('click', async () => {
      await act('copy', r.handle);
    });

    // Award Points Form Submit
    $('#mp-award-form', bodyEl)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ruleType = $('#mp-award-rule', bodyEl).value;
      const ref = $('#mp-award-ref', bodyEl).value.trim();
      const note = $('#mp-award-note', bodyEl).value.trim();

      // Look for active period
      const { data: period } = await sb.from('leaderboard_periods').select('id').eq('enabled', true).limit(1).maybeSingle();
      if (!period || !period.id) {
        toast('No active leaderboard period found. Enable a period first in Leaderboard tab.', false);
        return;
      }

      // Query student email from attendance or seed
      const email = `${r.handle}@sru.edu.in`;
      const res = await sb.rpc('record_community_activity', {
        p_period_id: period.id,
        p_student_name: r.name || r.handle,
        p_student_email: email,
        p_activity_type: ruleType,
        p_source_ref: ref,
        p_note: note || `Awarded via Member Profiles admin for @${r.handle}`
      });

      if (res.error) {
        toast(authErrorText(res.error), false);
        return;
      }

      await audit('award_points', 'community_points', `@${r.handle} +${ruleType}`);
      toast(`Points awarded to @${r.handle}!`, true);
      d.close(true);
      await reload();
    });
  }

  function paint() {
    injectStyle();
    const actions = `
      <button type="button" class="button-outline" id="mp-refresh">${icon('clock')} Refresh</button>
      <button type="button" class="button-outline" id="mp-csv" ${rows.length ? '' : 'disabled'}>Download CSV</button>
    `;
    setWorkspace('Member profiles', `
      <p class="admin-lead" style="margin:0 0 14px">Public member passes at <code>/u/handle</code>. Inspect any member to preview their 3D pass, toggle visibility, or award XP.</p>
      ${meta.indexMissing ? '<p class="mp-note" style="margin:0 0 14px">Couldn’t load <code>/data/profiles_index.json</code>. Run <code>build_profiles.py</code> and push it.</p>' : ''}
      ${summaryHtml()}
      <section class="admin-panel">
        <div class="mp-tools">
          <input type="search" id="mp-search" placeholder="Search name, handle, department" aria-label="Search members" value="${esc(query)}" autocomplete="off">
          <div class="mc-chips" role="group" aria-label="Filter members">${FILTERS.map(([id, label]) => `<button type="button" class="button-outline" data-mp-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>
        </div>
        <div id="mp-list">${listHtml()}</div>
        ${meta.generated ? `<p class="muted small" style="margin:12px 0 0">Published list last built ${esc(new Date(meta.generated).toLocaleString('en-IN'))}. Click any row to inspect.</p>` : ''}
      </section>
      <section class="admin-panel">
        <h2>Publishing a new batch</h2>
        <ol class="mp-steps">
          <li>In the sheet, set <code>Approved = TRUE</code> for members whose attendance you verified, then export the CSV.</li>
          <li>Run <code>python scripts/build_profiles.py verified_responses.csv</code> and fix any username collisions it prints.</li>
          <li>Paste <code>build/members_seed.sql</code> into the Supabase SQL Editor and run it. Hidden passes stay hidden.</li>
          <li>Commit and push <code>cloudflare-pages-site/data</code>. Cloudflare deploys in about a minute.</li>
        </ol>
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
    if (kind === 'inspect') {
      openInspector(handle);
      return;
    }
    if (kind === 'copy') {
      const url = `${location.origin}/u/${handle}`;
      try { await navigator.clipboard.writeText(url); toast('Link copied', true); } catch { toast(url, true); }
      return;
    }
    if (kind === 'hide') {
      if (!(await confirmDialog({ title: `Hide ${who}’s pass?`, body: 'The public page will say the pass isn’t available, and their points and certificates stop being returned.', confirm: 'Hide pass', danger: true }))) return;
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
      if (!(await confirmDialog({ title: `Remove ${who} from the database?`, body: 'Their live stats stop working. Their static pass page stays online until you remove them from the sheet.', confirm: 'Remove', danger: true }))) return;
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
    if (list) {
      list.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mp]');
        if (b) {
          if (b.disabled) return;
          b.disabled = true;
          Promise.resolve(act(b.dataset.mp, b.dataset.handle)).finally(() => { b.disabled = false; });
          return;
        }
        const row = e.target.closest('tr[data-row-handle]');
        if (row && !e.target.closest('button') && !e.target.closest('a')) {
          openInspector(row.dataset.rowHandle);
        }
      });
    }
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
