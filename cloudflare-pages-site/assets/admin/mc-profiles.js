/* Mission Control → Member Profiles Studio
 * Full studio management for GDG SRU member passes:
 *   - In-place member profile editor: Full Name, Handle, Department, Cohort,
 *     Theme Accent, Curated 30-Avatar Visual Picker, Achievement Milestone,
 *     Bio, Technical Skills, and Visibility Status.
 *   - Real-time live card preview (.g16-mcard signature home page card design
 *     with concentric radar orbit ripples and Google color glow).
 *   - Quick + Add Member for instant pre-batch onboarding.
 *   - Dual persistence: Supabase RPC (member_profiles table) + site_settings override fallback.
 *   - Quick award community XP directly from the studio drawer.
 *   - Instant hide / unhide toggle (no rebuild required).
 *   - Mismatch detection: published vs database status.
 */
(() => {
  'use strict';
  const MC = window.MC;
  const sb = MC.sb;
  const { $, $$, esc, icon, setWorkspace, audit, toast, confirmDialog, authErrorText, drawer } = MC;

  const HANDLE_RE = /^[a-z0-9_-]{2,32}$/;
  const LEVELS = [['Explorer', 0], ['Builder', 200], ['Innovator', 500], ['Vanguard', 1000]];
  const levelOf = (pts) => (LEVELS.filter(([, min]) => pts >= min).pop() || ['Explorer', 0])[0];
  const lvlNumOf = (pts) => (pts >= 1000 ? 4 : pts >= 500 ? 3 : pts >= 200 ? 2 : 1);
  const FILTERS = [['all', 'All'], ['attention', 'Needs attention'], ['hidden', 'Hidden']];
  const SKINS = [
    { id: 'google-blue', label: 'Google Blue', hex: '#4285f4', key: 'b' },
    { id: 'google-red', label: 'Google Red', hex: '#ea4335', key: 'r' },
    { id: 'google-yellow', label: 'Google Yellow', hex: '#fbbc04', key: 'y' },
    { id: 'google-green', label: 'Google Green', hex: '#34a853', key: 'g' },
    { id: 'terminal-dark', label: 'Terminal Dark', hex: '#202124', key: 'b' }
  ];
  const STATE = {
    live: { label: 'Live', cls: 'green', hint: '' },
    hidden: { label: 'Hidden', cls: 'red', hint: 'Public page shows “This pass isn’t available”.' },
    'no-db': { label: 'Not in database', cls: 'yellow', hint: 'Run the newest migration in Supabase so live stats work.' },
    'no-json': { label: 'Studio only', cls: 'blue', hint: 'Created via Mission Control studio; live on site via overrides.' }
  };

  const DEPARTMENTS = [
    'CSE (AI & ML)',
    'CSE',
    'IT',
    'ECE',
    'CSE (Data Science)',
    'EEE',
    'Mechanical',
    'Civil',
    'Other'
  ];

  const COHORTS = ['2023', '2024', '2025', '2026', '2027'];
  const ICONS = ['🚀', '🏆', '☁️', '⚡', '🤖', '✓', '💎', '🌟', '🧠', '📦', '📊'];

  let rows = [];
  let meta = { generated: '', indexMissing: false, dbWarning: '' };
  let query = '';
  let filter = 'all';
  let pointRules = [];

  const csvCell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const stateOf = (r) => (r.hidden ? 'hidden' : !r.inDb ? 'no-db' : !r.published ? 'no-json' : 'live');
  const needsAttention = (r) => r.state === 'no-db';
  const rpcHint = (e) => (/function .* does not exist|schema cache|Could not find the function/i.test(e?.message || '')
    ? 'Run migration 20261028210000_member_profiles_editor.sql in the Supabase SQL Editor, then reload this page.'
    : authErrorText(e));

  function getAvatarSrc(raw) {
    const m = /^avatar-(\d{2})$/.exec(String(raw || ''));
    return m ? `/assets/avatars/${m[0]}.svg` : '/assets/avatars/avatar-01.svg';
  }

  /* ---------- data ---------- */
  async function load() {
    let idxRes = null;
    try {
      const res = await fetch('/data/profiles_index.json?v=' + Date.now(), { cache: 'no-store' });
      if (res.ok) idxRes = await res.json();
    } catch (_) {}

    let rulesRes = null;
    try {
      rulesRes = await sb.from('point_rules').select('*').eq('enabled', true).order('sort_order');
    } catch (_) {
      rulesRes = { data: [] };
    }
    pointRules = (rulesRes && rulesRes.data) || [];

    // Fetch site_settings overrides
    let overrides = {};
    try {
      const { data: stRow } = await sb.from('site_settings').select('value').eq('key', 'member_profile_overrides').maybeSingle();
      if (stRow && stRow.value && typeof stRow.value === 'object') {
        overrides = stRow.value;
      }
    } catch (_) {}

    let ov = null;
    try {
      ov = await sb.rpc('admin_member_overview');
    } catch (e) {
      ov = { error: e };
    }

    if (ov && ov.error) {
      console.warn('[GDG SRU] admin_member_overview RPC failed:', ov.error);
      try {
        const direct = await sb.from('member_passes').select('*');
        if (direct && !direct.error && direct.data) {
          ov = {
            data: direct.data.map((p) => ({
              handle: p.handle,
              hidden: p.hidden,
              points: 0,
              activities: 0,
              workshops: 0
            }))
          };
        }
      } catch (_) {}
    }

    const published = idxRes && Array.isArray(idxRes.profiles) ? idxRes.profiles : [];
    meta = {
      generated: (idxRes && idxRes.generated) || '',
      indexMissing: !idxRes,
      dbWarning: (ov && ov.error) ? (ov.error.message || 'Database overview RPC not yet installed in Supabase.') : ''
    };

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
        achievement_text: '',
        achievement_icon: '✓',
        published: true,
        inDb: false,
        hidden: false,
        points: 0,
        activities: 0,
        workshops: 0
      });
    });

    // Merge database rows if returned
    ((ov && ov.data) || []).forEach((d) => {
      const r = map.get(d.handle) || {
        handle: d.handle,
        name: d.name || d.handle,
        dept: d.dept || '',
        cohort: d.cohort || '',
        avatar: d.avatar || 'avatar-01',
        theme: d.theme || 'google-blue',
        skills: Array.isArray(d.skills) ? d.skills : [],
        bio: d.bio || '',
        achievement_text: d.achieve_text || '',
        achievement_icon: d.achieve_icon || '✓',
        published: false
      };
      if (d.name) r.name = d.name;
      if (d.dept) r.dept = d.dept;
      if (d.cohort) r.cohort = d.cohort;
      if (d.avatar) r.avatar = d.avatar;
      if (d.theme) r.theme = d.theme;
      if (d.bio) r.bio = d.bio;
      if (Array.isArray(d.skills) && d.skills.length) r.skills = d.skills;
      if (d.achieve_text) r.achievement_text = d.achieve_text;
      if (d.achieve_icon) r.achievement_icon = d.achieve_icon;
      Object.assign(r, {
        inDb: true,
        hidden: !!d.hidden,
        points: Number(d.points) || 0,
        activities: Number(d.activities) || 0,
        workshops: Number(d.workshops) || 0
      });
      map.set(d.handle, r);
    });

    // Merge site_settings overrides (takes highest priority for admin edits)
    Object.entries(overrides).forEach(([h, o]) => {
      if (!HANDLE_RE.test(h)) return;
      let r = map.get(h);
      if (!r) {
        r = {
          handle: h,
          name: o.name || h,
          dept: o.dept || o.department || '',
          cohort: o.cohort || '',
          avatar: o.avatar || 'avatar-01',
          theme: o.theme || 'google-blue',
          skills: Array.isArray(o.skills) ? o.skills : [],
          bio: o.bio || '',
          achievement_text: o.achievement_text || '',
          achievement_icon: o.achievement_icon || '✓',
          published: false,
          inDb: false,
          hidden: !!o.hidden,
          points: 0,
          activities: 0,
          workshops: 0
        };
        map.set(h, r);
      } else {
        if (o.name !== undefined) r.name = o.name;
        if (o.dept !== undefined || o.department !== undefined) r.dept = o.dept || o.department;
        if (o.cohort !== undefined) r.cohort = o.cohort;
        if (o.avatar !== undefined) r.avatar = o.avatar;
        if (o.theme !== undefined) r.theme = o.theme;
        if (Array.isArray(o.skills)) r.skills = o.skills;
        if (o.bio !== undefined) r.bio = o.bio;
        if (o.achievement_text !== undefined) r.achievement_text = o.achievement_text;
        if (o.achievement_icon !== undefined) r.achievement_icon = o.achievement_icon;
        if (o.hidden !== undefined) r.hidden = !!o.hidden;
      }
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

      /* Studio Inspector Drawer Layout */
      .mp-drawer-grid{display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start}
      @media(max-width:820px){.mp-drawer-grid{grid-template-columns:1fr}}
      .mp-drawer-col{display:flex;flex-direction:column;gap:18px}
      .mp-sec-box{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:16px}
      .mp-sec-box h3{font-size:14px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;justify-content:space-between}
      .mp-field-row{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
      .mp-field-row label{font-size:12px;font-weight:600;color:var(--ink-2);letter-spacing:0.01em}
      .mp-field-row label .req{color:var(--red);margin-left:2px}
      .mp-field-row input,.mp-field-row select,.mp-field-row textarea{
        min-height:34px;padding:5px 10px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:13px;
        transition:border-color 0.12s,box-shadow 0.12s;
      }
      .mp-field-row textarea{resize:vertical;min-height:65px;line-height:1.5}
      .mp-field-row input:focus,.mp-field-row select:focus,.mp-field-row textarea:focus{
        outline:none;border-color:var(--blue);box-shadow:0 0 0 2px rgba(26,115,232,0.15);
      }
      .mp-field-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}

      /* Curated 30-Avatar Visual Picker */
      .mp-avatar-grid{
        display:grid;grid-template-columns:repeat(6,1fr);gap:8px;max-height:170px;overflow-y:auto;
        padding:8px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--ground);
      }
      .mp-av-btn{
        aspect-ratio:1;padding:3px;border-radius:50%;border:2px solid transparent;background:var(--surface);
        cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s ease;
      }
      .mp-av-btn:hover{transform:scale(1.12);border-color:var(--blue-soft)}
      .mp-av-btn.selected{
        border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,115,232,0.3);background:var(--blue-soft);
      }
      .mp-av-btn img{width:100%;height:100%;border-radius:50%;object-fit:cover;pointer-events:none}

      /* Theme accent pills */
      .mp-theme-picker{display:flex;gap:6px;flex-wrap:wrap}
      .mp-theme-pill{
        display:inline-flex;align-items:center;gap:6px;padding:5px 10px;border-radius:99px;border:1px solid var(--line);
        font-size:12px;font-weight:600;cursor:pointer;background:var(--surface);color:var(--ink-2);transition:all 0.12s ease;
      }
      .mp-theme-pill:hover{background:var(--sunk);color:var(--ink)}
      .mp-theme-pill.selected{border-color:var(--blue);background:var(--blue-soft);color:var(--blue);font-weight:700}
      .mp-theme-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}

      /* Live Card Stage */
      .mp-preview-host{display:flex;flex-direction:column;align-items:center;gap:10px;position:sticky;top:10px}
      .mp-admin-card-stage{width:100%;max-width:320px;perspective:1000px}

      /* Home Page Card Miniature Preview (.g16-mcard-mini) */
      .g16-mcard-mini{
        position:relative;width:100%;min-height:350px;border-radius:24px;overflow:hidden;padding:20px;
        display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;
        font-family:var(--f-body,system-ui,sans-serif);
      }
      .g16-mcard-mini .g16-tl-logo{
        position:absolute;right:18px;top:18px;width:60px;height:60px;pointer-events:none;z-index:4;
      }
      .g16-mcard-mini .g16-tl-c1{
        position:absolute;inset:-5px;border-radius:50%;border:1.5px dashed color-mix(in srgb, var(--a, #4285f4) 40%, transparent);
        animation:g16-spin 24s linear infinite;display:block;
      }
      .g16-mcard-mini .g16-tl-c2,.g16-mcard-mini .g16-tl-c3,.g16-mcard-mini .g16-tl-c4{display:none}
      .g16-mcard-mini .g16-tl-c5{
        position:absolute;inset:0;width:60px;height:60px;display:grid;place-content:center;border:2px solid #fff;border-radius:50%;
        overflow:hidden;pointer-events:auto;background:#fff;box-shadow:0 6px 20px -4px rgba(0,0,0,0.15);
      }
      .g16-mcard-mini .g16-tl-c5 img{width:100%;height:100%;object-fit:cover;border-radius:50%}
      .g16-mcard-mini .g16-mcard-check{
        position:absolute;right:-1px;bottom:-1px;width:18px;height:18px;background:#34a853;color:#fff;
        border:2px solid #fff;border-radius:50%;display:grid;place-items:center;font-size:10px;font-weight:900;
        box-shadow:0 2px 5px rgba(0,0,0,0.2);
      }
      @keyframes g16-spin{to{transform:rotate(360deg)}}
      .g16-mcard-mini .g16-mcard-top{
        display:flex;align-items:center;gap:6px;max-width:calc(100% - 76px);margin-bottom:12px;position:relative;z-index:3;flex-wrap:wrap;
      }
      .g16-mcard-mini .g16-tl-num{
        display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font:700 10.5px/1 var(--f-body,system-ui,sans-serif);
        letter-spacing:0.04em;text-transform:uppercase;
      }
      .g16-mcard-mini .g16-mcard-dept{font:600 11.5px/1 var(--f-body,system-ui,sans-serif);color:#5f6368}
      .g16-mcard-mini .g16-mcard-content{position:relative;z-index:3;flex:1;display:flex;flex-direction:column;margin-top:14px}
      .g16-mcard-mini .g16-tl-title{font-size:19px;font-weight:700;letter-spacing:-0.025em;line-height:1.25;margin:0 0 2px;color:#111b2e}
      .g16-mcard-mini .g16-mcard-handle{font:600 12.5px/1 var(--f-body,system-ui,sans-serif);margin-bottom:10px;display:block}
      .g16-mcard-mini .g16-mcard-achieve{
        display:flex;align-items:center;gap:6px;padding:6px 10px;border-radius:10px;font:600 11.5px/1.3 var(--f-body,system-ui,sans-serif);
        margin-bottom:10px;background:rgba(255,255,255,0.92);box-shadow:0 1px 4px rgba(0,0,0,0.04);color:#111;
      }
      .g16-mcard-mini .g16-tl-text{
        font:400 12.5px/1.45 var(--f-body,system-ui,sans-serif);color:#53647d;margin:0 0 12px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;
      }
      .g16-mcard-mini .g16-mcard-skills{display:flex;gap:5px;flex-wrap:wrap;margin-top:auto;margin-bottom:10px}
      .g16-mcard-mini .g16-mcard-skill{
        display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font:600 10.5px/1 var(--f-body,system-ui,sans-serif);
        background:#fff;border:1px solid #e2e8f0;color:#334155;
      }
      .g16-mcard-mini .g16-tl-bottom{
        display:flex;align-items:center;justify-content:space-between;padding-top:10px;position:relative;z-index:3;border-top:1px solid rgba(0,0,0,0.06);
      }
      .g16-mcard-mini .g16-mcard-badge-tag{font:700 10px/1 var(--f-body,system-ui,sans-serif);color:#64748b;letter-spacing:0.08em;text-transform:uppercase}
      .g16-mcard-mini .g16-tl-more{
        display:inline-flex;align-items:center;gap:4px;padding:5px 12px;border-radius:999px;font:700 11.5px/1 var(--f-body,system-ui,sans-serif);
        background:#fff;border:1px solid #e4e8ed;color:#111b2e;
      }
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
    if (!rows.length) return '<p class="admin-empty">No member passes yet. Click <b>+ Add Member</b> above or run <code>build_profiles.py</code>.</p>';
    const list = visibleRows();
    if (!list.length) return '<p class="admin-empty">Nothing matches.</p>';
    return `<div class="table-wrap"><table class="mp-table"><thead><tr>
        <th>Member</th><th>Department</th><th>Level</th><th>Workshops</th><th>Status</th><th><span class="sr-only">Actions</span></th>
      </tr></thead><tbody>${list.map((r) => {
        const st = STATE[r.state] || STATE.live;
        const name = `<b>${esc(r.name || r.handle)}</b>`;
        const level = r.inDb ? `${esc(levelOf(r.points))}<br><small>${r.points.toLocaleString('en-IN')} XP</small>` : '<span class="muted">—</span>';
        const editBtn = `<button type="button" class="button-outline" data-mp="edit" data-handle="${esc(r.handle)}" style="font-weight:700">Edit Profile ↗</button>`;
        const copy = r.published || r.state === 'live' || r.state === 'no-json'
          ? `<button type="button" class="button-outline" data-mp="copy" data-handle="${esc(r.handle)}" title="Copy link to pass">Copy</button>`
          : '';
        return `<tr data-row-handle="${esc(r.handle)}">
          <td style="cursor:pointer" data-mp="edit" data-handle="${esc(r.handle)}">${name}<br><small>@${esc(r.handle)}</small></td>
          <td>${esc(r.dept || '—')}${r.cohort ? `<br><small>Cohort ${esc(r.cohort)}</small>` : ''}</td>
          <td>${level}</td>
          <td>${r.inDb ? r.workshops : '<span class="muted">—</span>'}</td>
          <td><span class="mc-badge-pill ${st.cls}">${st.label}</span>${st.hint ? `<small class="mp-hint">${esc(st.hint)}</small>` : ''}</td>
          <td><div class="mp-actions">${editBtn}${copy}</div></td>
        </tr>`;
      }).join('')}</tbody></table></div>`;
  }

  /* ---------- Profile Editor Studio: In-Place Editing & Live Home Card Preview ---------- */
  function openEditor(handleOrNull) {
    const isNew = !handleOrNull;
    const r = isNew ? {
      handle: '',
      name: '',
      dept: 'CSE (AI & ML)',
      cohort: '2024',
      avatar: 'avatar-01',
      theme: 'google-blue',
      skills: ['Python', 'Cloud'],
      bio: 'Student developer exploring Google technologies and building solutions at SR University.',
      achievement_icon: '🚀',
      achievement_text: 'Verified Member · GDG SRU',
      points: 0,
      workshops: 0,
      hidden: false,
      published: false,
      inDb: false,
      state: 'no-json'
    } : (rows.find((x) => x.handle === handleOrNull) || {
      handle: handleOrNull,
      name: handleOrNull,
      dept: 'CSE',
      cohort: '2024',
      avatar: 'avatar-01',
      theme: 'google-blue',
      skills: [],
      bio: '',
      achievement_icon: '✓',
      achievement_text: 'Verified Member · GDG SRU',
      points: 0,
      workshops: 0,
      hidden: false,
      published: false,
      inDb: false,
      state: 'no-json'
    });

    // Reactive state for the live preview
    const previewState = {
      handle: r.handle || 'alexk',
      name: r.name || 'Alex Kumar',
      dept: r.dept || 'CSE (AI & ML)',
      cohort: r.cohort || '2024',
      avatar: r.avatar || 'avatar-01',
      theme: r.theme || 'google-blue',
      skills: [...(r.skills || [])],
      bio: r.bio || 'Student developer exploring Google technologies and building solutions at SR University.',
      achievement_icon: r.achievement_icon || '🚀',
      achievement_text: r.achievement_text || `${r.dept || 'SR University'} · Verified Member`,
      points: r.points || 0,
      workshops: r.workshops || 0,
      hidden: !!r.hidden
    };

    function renderCardHtml() {
      const skinObj = SKINS.find((s) => s.id === previewState.theme) || SKINS[0];
      const themeHex = skinObj.hex;
      const avatarSrc = getAvatarSrc(previewState.avatar);
      const lvl = levelOf(previewState.points);
      const lvlNum = lvlNumOf(previewState.points);
      const achText = previewState.achievement_text || `${previewState.dept || 'SR University'} · Verified Member`;
      const achIcon = previewState.achievement_icon || '✓';
      const cohortDisplay = previewState.cohort ? `'${String(previewState.cohort).slice(-2)}` : "'24";
      const skillsToRender = previewState.skills.slice(0, 3);

      return `
        <div class="g16-mcard-mini" style="background:radial-gradient(120% 75% at 85% 0,${themeHex}33,transparent 68%),linear-gradient(180deg,#fffefa,${themeHex}10);border:1.5px solid ${themeHex}40;box-shadow:0 26px 40px -24px ${themeHex};">
          <!-- Orbit Ripples & Avatar -->
          <div class="g16-tl-logo" aria-hidden="true">
            <span class="g16-tl-c g16-tl-c1" style="border-color:${themeHex}33;"></span>
            <span class="g16-tl-c g16-tl-c2" style="border-color:${themeHex}55;"></span>
            <span class="g16-tl-c g16-tl-c3" style="border-color:${themeHex}77;"></span>
            <span class="g16-tl-c g16-tl-c4" style="background:${themeHex}18;border-color:${themeHex}66;"></span>
            <div class="g16-tl-c g16-tl-c5" style="box-shadow:0 0 24px ${themeHex}88;">
              <img src="${avatarSrc}" alt="" loading="lazy">
              <span class="g16-mcard-check" title="Verified">✓</span>
            </div>
          </div>

          <!-- Top Meta Bar -->
          <div class="g16-mcard-top">
            <span class="g16-tl-num" style="background:${themeHex}18;color:${themeHex};border:1px solid ${themeHex}44;">
              LVL ${lvlNum} · ${esc(lvl.toUpperCase())}
            </span>
            <span class="g16-mcard-dept">${esc(previewState.dept || 'SR University')} · ${esc(cohortDisplay)}</span>
          </div>

          <!-- Content -->
          <div class="g16-mcard-content">
            <h4 class="g16-tl-title">${esc(previewState.name || previewState.handle || 'Member Name')}</h4>
            <span class="g16-mcard-handle" style="color:${themeHex};">@${esc(previewState.handle || 'handle')}</span>

            <div class="g16-mcard-achieve" style="border:1px solid ${themeHex}33;">
              <span style="font-size:14px;line-height:1;">${achIcon}</span>
              <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(achText)}</span>
            </div>

            <p class="g16-tl-text">
              "${esc(previewState.bio || 'Passionate student developer exploring Google technologies at SR University.')}"
            </p>

            ${skillsToRender.length ? `
              <div class="g16-mcard-skills">
                ${skillsToRender.map((s) => `<span class="g16-mcard-skill">${esc(s)}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Bottom Action Bar -->
          <div class="g16-tl-bottom" style="border-top-color:${themeHex}22;">
            <span class="g16-mcard-badge-tag">GDG SRU // PASS</span>
            <span class="g16-tl-more">
              View Pass ↗
            </span>
          </div>
        </div>
      `;
    }

    const drawerTitle = isNew ? 'Add Member Pass' : `Edit Profile: @${r.handle}`;
    const drawerSub = isNew ? 'Create a new member profile studio entry' : `${r.name || r.handle} · ${r.dept || 'SR University'}`;

    const d = drawer.open({
      title: drawerTitle,
      subtitle: drawerSub,
      wide: true,
      body: `
        <div class="mp-drawer-grid">
          <!-- Left Column: Profile Editor Studio -->
          <div class="mp-drawer-col">
            <div class="mp-sec-box">
              <h3>
                <span>${isNew ? 'New Member Information' : 'Profile Details'}</span>
                ${!isNew ? `<span class="mc-badge-pill ${(STATE[r.state] || STATE.live).cls}">${(STATE[r.state] || STATE.live).label}</span>` : ''}
              </h3>

              <form id="mp-editor-form">
                <!-- Handle & Name -->
                <div class="mp-field-2col">
                  <div class="mp-field-row">
                    <label for="ed-handle">Handle (Username)<span class="req">*</span></label>
                    <input type="text" id="ed-handle" name="handle" value="${esc(r.handle)}" placeholder="e.g. rohitk" pattern="[a-z0-9_-]{2,32}" required ${!isNew ? 'readonly style="opacity:0.8;background:var(--sunk)"' : ''}>
                    <small class="mp-hint">${isNew ? 'Unique handle (2-32 chars, a-z, 0-9, _, -).' : 'Handle cannot be changed once created.'}</small>
                  </div>
                  <div class="mp-field-row">
                    <label for="ed-name">Full Name<span class="req">*</span></label>
                    <input type="text" id="ed-name" name="name" value="${esc(r.name)}" placeholder="e.g. Rohit Kumar" required>
                  </div>
                </div>

                <!-- Department & Cohort -->
                <div class="mp-field-2col">
                  <div class="mp-field-row">
                    <label for="ed-dept">Department / Branch</label>
                    <select id="ed-dept" name="dept">
                      ${DEPARTMENTS.map((dept) => `<option value="${esc(dept)}" ${r.dept === dept ? 'selected' : ''}>${esc(dept)}</option>`).join('')}
                    </select>
                  </div>
                  <div class="mp-field-row">
                    <label for="ed-cohort">Cohort Year</label>
                    <select id="ed-cohort" name="cohort">
                      ${COHORTS.map((c) => `<option value="${esc(c)}" ${(r.cohort || '2024') === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
                    </select>
                  </div>
                </div>

                <!-- Theme Accent -->
                <div class="mp-field-row">
                  <label>Card Theme Accent</label>
                  <div class="mp-theme-picker" id="ed-theme-picker">
                    ${SKINS.map((s) => `
                      <button type="button" class="mp-theme-pill ${r.theme === s.id ? 'selected' : ''}" data-theme="${s.id}">
                        <span class="mp-theme-dot" style="background:${s.hex}"></span>
                        <span>${esc(s.label)}</span>
                      </button>
                    `).join('')}
                  </div>
                  <input type="hidden" id="ed-theme" name="theme" value="${esc(r.theme || 'google-blue')}">
                </div>

                <!-- Curated 30-Avatar Visual Picker -->
                <div class="mp-field-row">
                  <label>Curated Avatar (Select 1 of 30)</label>
                  <div class="mp-avatar-grid" id="ed-avatar-picker">
                    ${Array.from({ length: 30 }, (_, i) => {
                      const id = `avatar-${String(i + 1).padStart(2, '0')}`;
                      const isSel = (r.avatar || 'avatar-01') === id;
                      return `
                        <button type="button" class="mp-av-btn ${isSel ? 'selected' : ''}" data-avatar="${id}" title="${id}">
                          <img src="/assets/avatars/${id}.svg" alt="${id}" width="42" height="42">
                        </button>
                      `;
                    }).join('')}
                  </div>
                  <input type="hidden" id="ed-avatar" name="avatar" value="${esc(r.avatar || 'avatar-01')}">
                </div>

                <!-- Achievement / Milestone Banner -->
                <div class="mp-field-2col">
                  <div class="mp-field-row" style="max-width:110px">
                    <label for="ed-achieve-icon">Icon</label>
                    <select id="ed-achieve-icon" name="achievement_icon">
                      ${ICONS.map((ic) => `<option value="${ic}" ${(r.achievement_icon || '✓') === ic ? 'selected' : ''}>${ic}</option>`).join('')}
                    </select>
                  </div>
                  <div class="mp-field-row">
                    <label for="ed-achieve-text">Achievement / Role Tag</label>
                    <input type="text" id="ed-achieve-text" name="achievement_text" value="${esc(r.achievement_text || '')}" placeholder="e.g. Chapter Organizer & Web Architect">
                  </div>
                </div>

                <!-- Bio -->
                <div class="mp-field-row">
                  <div style="display:flex;justify-content:space-between;align-items:center;">
                    <label for="ed-bio">Bio (Max 240 chars)</label>
                    <span id="ed-bio-count" style="font-size:11px;color:var(--ink-3);">${(r.bio || '').length}/240</span>
                  </div>
                  <textarea id="ed-bio" name="bio" rows="2" maxlength="240" placeholder="Passionate student developer exploring Google technologies and building solutions at SR University.">${esc(r.bio || '')}</textarea>
                </div>

                <!-- Technical Skills -->
                <div class="mp-field-row">
                  <label for="ed-skills">Technical Skills (Comma-separated)</label>
                  <input type="text" id="ed-skills" name="skills" value="${esc((r.skills || []).join(', '))}" placeholder="e.g. Flutter, Firebase, Python, Docker">
                  <small class="mp-hint">Top 3 skills appear on the directory card; all appear on their digital pass.</small>
                </div>

                <!-- Visibility Toggle -->
                <div class="mp-field-row" style="margin-top:4px">
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:500;">
                    <input type="checkbox" id="ed-hidden" name="hidden" ${r.hidden ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--blue);">
                    <span>Hide this pass from public directory and searches</span>
                  </label>
                </div>

                <!-- Submit / Action Bar -->
                <div style="display:flex;gap:10px;margin-top:16px;align-items:center;flex-wrap:wrap;">
                  <button type="submit" class="mc-btn-save" style="flex:1;min-width:180px;height:38px;justify-content:center;">
                    ${icon('check')} Save Member Profile
                  </button>
                  ${!isNew ? `
                    <button type="button" class="mc-btn-delete" id="ed-del-btn" style="height:38px;">
                      ${icon('trash')} Remove
                    </button>
                  ` : ''}
                </div>
              </form>
            </div>

            <!-- Award Points Section (Existing members only) -->
            ${!isNew ? `
              <div class="mp-sec-box">
                <h3><span>+ Award Community XP</span> <small style="color:var(--ink-3);font-size:12px">${r.points} XP currently</small></h3>
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
            ` : ''}
          </div>

          <!-- Right Column: Interactive Live Home Card Preview -->
          <div class="mp-preview-host">
            <span style="font-size:12px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:0.04em;">
              Live Card Preview
            </span>
            <div id="mp-live-preview-box" class="mp-admin-card-stage">
              ${renderCardHtml()}
            </div>
            <p style="font-size:11.5px;color:var(--ink-3);text-align:center;margin:4px 0 0;max-width:280px;line-height:1.4;">
              Updates instantly as you type. Visitors see this card on the home page and member directory.
            </p>
            ${!isNew ? `
              <div style="display:flex;gap:8px;margin-top:8px;">
                <a href="/u/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener" class="button-outline" style="font-size:12px;">
                  Open Live Pass ↗
                </a>
                <button type="button" class="button-outline" id="ed-copy-link" style="font-size:12px;">
                  Copy Pass Link
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `
    });

    const bodyEl = d.el;
    const form = $('#mp-editor-form', bodyEl);
    const previewBox = $('#mp-live-preview-box', bodyEl);

    function updatePreview() {
      if (previewBox) previewBox.innerHTML = renderCardHtml();
    }

    // Live form bindings
    form.addEventListener('input', (e) => {
      const hIn = form.elements.handle;
      const nIn = form.elements.name;
      const dIn = form.elements.dept;
      const cIn = form.elements.cohort;
      const bIn = form.elements.bio;
      const sIn = form.elements.skills;
      const atIn = form.elements.achievement_text;
      const aiIn = form.elements.achievement_icon;

      if (hIn) previewState.handle = hIn.value.trim().toLowerCase();
      if (nIn) previewState.name = nIn.value.trim();
      if (dIn) previewState.dept = dIn.value;
      if (cIn) previewState.cohort = cIn.value;
      if (bIn) {
        previewState.bio = bIn.value;
        const countEl = $('#ed-bio-count', bodyEl);
        if (countEl) countEl.textContent = `${bIn.value.length}/240`;
      }
      if (sIn) {
        previewState.skills = sIn.value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (atIn) previewState.achievement_text = atIn.value.trim();
      if (aiIn) previewState.achievement_icon = aiIn.value;

      updatePreview();
    });

    form.addEventListener('change', (e) => {
      if (e.target.name === 'dept' || e.target.name === 'cohort' || e.target.name === 'achievement_icon') {
        previewState.dept = form.elements.dept.value;
        previewState.cohort = form.elements.cohort.value;
        previewState.achievement_icon = form.elements.achievement_icon.value;
        updatePreview();
      }
    });

    // Theme selector click
    $$('#ed-theme-picker .mp-theme-pill', bodyEl).forEach((pill) => {
      pill.onclick = () => {
        $$('#ed-theme-picker .mp-theme-pill', bodyEl).forEach((p) => p.classList.remove('selected'));
        pill.classList.add('selected');
        const themeId = pill.dataset.theme;
        $('#ed-theme', bodyEl).value = themeId;
        previewState.theme = themeId;
        updatePreview();
      };
    });

    // Avatar visual picker click
    $$('#ed-avatar-picker .mp-av-btn', bodyEl).forEach((btn) => {
      btn.onclick = () => {
        $$('#ed-avatar-picker .mp-av-btn', bodyEl).forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
        const avId = btn.dataset.avatar;
        $('#ed-avatar', bodyEl).value = avId;
        previewState.avatar = avId;
        updatePreview();
      };
    });

    // Form submit
    form.onsubmit = async (e) => {
      e.preventDefault();
      const handle = (isNew ? form.elements.handle.value : r.handle).trim().toLowerCase();
      if (!HANDLE_RE.test(handle)) {
        toast('Handle must be 2-32 characters: lowercase letters, numbers, hyphens or underscores.', false);
        return;
      }
      const name = form.elements.name.value.trim();
      if (!name) {
        toast('Full name is required.', false);
        return;
      }

      const dept = form.elements.dept.value;
      const cohort = form.elements.cohort.value;
      const theme = form.elements.theme.value || 'google-blue';
      const avatar = form.elements.avatar.value || 'avatar-01';
      const bio = form.elements.bio.value.trim();
      const achievement_icon = form.elements.achievement_icon.value || '✓';
      const achievement_text = form.elements.achievement_text.value.trim() || `${dept} · Verified Member`;
      const rawSkills = form.elements.skills.value;
      const skills = rawSkills.split(',').map((s) => s.trim()).filter(Boolean);
      const hidden = form.elements.hidden.checked;

      const payload = {
        handle,
        name,
        dept,
        cohort,
        theme,
        avatar,
        bio,
        skills,
        achievement_icon,
        achievement_text,
        hidden
      };

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

      try {
        // 1. Try Supabase RPC
        try {
          await sb.rpc('admin_update_member_profile', {
            p_handle: handle,
            p_name: name,
            p_dept: dept,
            p_cohort: cohort,
            p_avatar: avatar,
            p_theme: theme,
            p_bio: bio,
            p_skills: skills,
            p_achievement_text: achievement_text,
            p_achievement_icon: achievement_icon,
            p_hidden: hidden
          });
        } catch (rpcErr) {
          console.warn('[Admin] admin_update_member_profile RPC skipped or failed:', rpcErr);
        }

        // 2. Also save to site_settings.member_profile_overrides as resilient fallback
        try {
          let cur = {};
          const { data: stRow } = await sb.from('site_settings').select('value').eq('key', 'member_profile_overrides').maybeSingle();
          if (stRow && stRow.value && typeof stRow.value === 'object') {
            cur = stRow.value;
          }
          cur[handle] = payload;
          await sb.from('site_settings').upsert({ key: 'member_profile_overrides', value: cur });
        } catch (stErr) {
          console.warn('[Admin] site_settings override upsert skipped or failed:', stErr);
        }

        // 3. Update hidden status in member_passes if RPC exists
        try {
          await sb.rpc('admin_set_member_hidden', { p_handle: handle, p_hidden: hidden });
        } catch (_) {}

        await audit(isNew ? 'create' : 'update', 'member_profiles', `@${handle} (${name})`);
        toast(`Profile saved for @${handle}!`, true);
        d.close(true);
        await reload();
      } catch (err) {
        console.error('[Admin] Error saving member profile:', err);
        toast(authErrorText(err), false);
        if (btn) { btn.disabled = false; btn.innerHTML = `${icon('check')} Save Member Profile`; }
      }
    };

    // Remove Profile
    const delBtn = $('#ed-del-btn', bodyEl);
    if (delBtn) {
      delBtn.onclick = async () => {
        if (!(await confirmDialog({
          title: `Remove @${r.handle}’s profile?`,
          body: 'This removes their profile overrides and stops live stats.',
          confirm: 'Remove Profile',
          danger: true
        }))) return;

        try {
          // Remove from site_settings overrides
          try {
            const { data: stRow } = await sb.from('site_settings').select('value').eq('key', 'member_profile_overrides').maybeSingle();
            if (stRow && stRow.value && typeof stRow.value === 'object' && stRow.value[r.handle]) {
              delete stRow.value[r.handle];
              await sb.from('site_settings').upsert({ key: 'member_profile_overrides', value: stRow.value });
            }
          } catch (_) {}

          // Remove via RPC
          try {
            await sb.rpc('admin_delete_member_profile', { p_handle: r.handle });
          } catch (_) {}

          await audit('delete', 'member_profiles', `@${r.handle}`);
          toast(`Removed @${r.handle}.`, true);
          d.close(true);
          await reload();
        } catch (err) {
          toast(authErrorText(err), false);
        }
      };
    }

    // Copy Link button in preview pane
    $('#ed-copy-link', bodyEl)?.addEventListener('click', async () => {
      const url = `${location.origin}/u/${r.handle}`;
      try { await navigator.clipboard.writeText(url); toast('Link copied', true); } catch { toast(url, true); }
    });

    // Award Points Form Submit
    $('#mp-award-form', bodyEl)?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const ruleType = $('#mp-award-rule', bodyEl).value;
      const ref = $('#mp-award-ref', bodyEl).value.trim();
      const note = $('#mp-award-note', bodyEl).value.trim();

      const { data: period } = await sb.from('leaderboard_periods').select('id').eq('enabled', true).limit(1).maybeSingle();
      if (!period || !period.id) {
        toast('No active leaderboard period found. Enable a period first in Leaderboard tab.', false);
        return;
      }

      const email = `${r.handle}@sru.edu.in`;
      const res = await sb.rpc('record_community_activity', {
        p_period_id: period.id,
        p_student_name: r.name || r.handle,
        p_student_email: email,
        p_activity_type: ruleType,
        p_source_ref: ref,
        p_note: note || `Awarded via Member Profiles studio for @${r.handle}`
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

  // Alias for backwards compatibility
  const openInspector = openEditor;

  function paint() {
    injectStyle();
    const actions = `
      <button type="button" class="mc-btn-save" id="mp-add-member">${icon('plus')} Add Member</button>
      <button type="button" class="button-outline" id="mp-refresh">${icon('clock')} Refresh</button>
      <button type="button" class="button-outline" id="mp-csv" ${rows.length ? '' : 'disabled'}>Download CSV</button>
    `;
    setWorkspace('Member profiles', `
      <p class="admin-lead" style="margin:0 0 14px">Public member passes at <code>/u/handle</code>. Click any member to edit their profile and see live card updates.</p>
      ${meta.indexMissing ? '<p class="mp-note" style="margin:0 0 14px">Couldn’t load <code>/data/profiles_index.json</code>. Run <code>build_profiles.py</code> and push it.</p>' : ''}
      ${meta.dbWarning ? `<p class="mp-note" style="margin:0 0 14px;background:#fef7e0;color:#b06000;border:1px solid #fde293;">⚠️ ${esc(meta.dbWarning)} — Run <code>supabase/migrations/20261028210000_member_profiles_editor.sql</code> in the Supabase SQL editor to enable database-backed profiles.</p>` : ''}
      ${summaryHtml()}
      <section class="admin-panel">
        <div class="mp-tools">
          <input type="search" id="mp-search" placeholder="Search name, handle, department" aria-label="Search members" value="${esc(query)}" autocomplete="off">
          <div class="mc-chips" role="group" aria-label="Filter members">${FILTERS.map(([id, label]) => `<button type="button" class="button-outline" data-mp-filter="${id}" aria-pressed="${filter === id}">${label}</button>`).join('')}</div>
        </div>
        <div id="mp-list">${listHtml()}</div>
        ${meta.generated ? `<p class="muted small" style="margin:12px 0 0">Published list last built ${esc(new Date(meta.generated).toLocaleString('en-IN'))}. Click any row to edit profile.</p>` : ''}
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
    if (kind === 'edit' || kind === 'inspect') {
      openEditor(handle);
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
    const lines = [head.join(',')].concat(rows.map((r) => [r.handle, r.name, r.dept, r.cohort, (STATE[r.state] || STATE.live).label, r.inDb ? r.points : '', r.inDb ? levelOf(r.points) : '', r.inDb ? r.workshops : ''].map(csvCell).join(',')));
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
          openEditor(row.dataset.rowHandle);
        }
      });
    }
    const addBtn = $('#mp-add-member');
    if (addBtn) addBtn.addEventListener('click', () => openEditor(null));
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
