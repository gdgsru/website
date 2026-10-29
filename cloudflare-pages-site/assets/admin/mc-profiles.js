/* Mission Control → Member Profiles Studio
 * Full studio management for GDG SRU member profiles & passes:
 *   - In-place member profile editor for EVERY entry:
 *     Handle, Full Name, Roll Number, Department, Cohort, University,
 *     Status Badge, Active Indicator, Custom Photo, Curated 30-Avatar Picker,
 *     Theme Accent, Hero Short Bio, About Me Story, Technical Skills,
 *     Interests, GitHub, LinkedIn, Portfolio, Email, Coding Languages,
 *     Tools & Technologies, Hobbies, and Dynamic Workshops list.
 *   - Comprehensive Toggles for every action button & export:
 *     Toggle Download Card (PNG), Toggle Resume (PDF) + Custom Resume URL,
 *     Toggle Print / Laminate, Toggle Copy Link, Toggle Check-in QR.
 *   - Section Visibility Toggles:
 *     Toggle Profile Public Visibility (Hidden / Withdrawn),
 *     Toggle About Me, Workshops, Skills & Interests, Quick Links, More About Me.
 *   - Real-time interactive live preview.
 *   - Seamless persistence: Supabase site_settings (member_profile_overrides) + RPCs.
 *   - Deep-linking support: opens editor automatically via ?edit=:handle.
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
  let cachedOverrides = {};

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
    cachedOverrides = {};
    try {
      const { data: stRow } = await sb.from('site_settings').select('value').eq('key', 'member_profile_overrides').maybeSingle();
      if (stRow && stRow.value && typeof stRow.value === 'object') {
        cachedOverrides = stRow.value;
      }
    } catch (_) {}

    let ov = null;
    try {
      ov = await sb.rpc('admin_member_overview');
    } catch (e) {
      ov = { error: e };
    }

    if (ov && ov.error) {
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
        dept: String(p.d || 'CSE (AI & ML)'),
        cohort: String(p.c || '2024'),
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
        dept: d.dept || 'CSE (AI & ML)',
        cohort: d.cohort || '2024',
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

    // Merge site_settings overrides (takes top priority)
    Object.entries(cachedOverrides).forEach(([h, o]) => {
      if (!HANDLE_RE.test(h)) return;
      let r = map.get(h);
      if (!r) {
        r = {
          handle: h,
          name: o.name || h,
          dept: o.dept || o.department || 'CSE (AI & ML)',
          cohort: o.cohort || '2024',
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
      r._overridden = true;
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

      /* Studio Drawer Layout & Tab Bar */
      .mp-drawer-grid{display:grid;grid-template-columns:1fr 340px;gap:24px;align-items:start}
      @media(max-width:880px){.mp-drawer-grid{grid-template-columns:1fr}}
      .mp-drawer-col{display:flex;flex-direction:column;gap:16px}
      
      .mp-tabs-bar{
        display:flex;gap:6px;background:var(--ground);padding:6px;border-radius:var(--r-m);
        border:1px solid var(--line);margin-bottom:14px;overflow-x:auto;scrollbar-width:none;
      }
      .mp-tabs-bar::-webkit-scrollbar{display:none}
      .mp-tab-btn{
        display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border-radius:var(--r-s);
        border:none;background:none;color:var(--ink-2);font-size:12px;font-weight:600;cursor:pointer;
        white-space:nowrap;transition:all 0.15s ease;
      }
      .mp-tab-btn:hover{color:var(--ink);background:var(--surface)}
      .mp-tab-btn.is-active{background:var(--surface);color:var(--blue);box-shadow:0 1px 3px rgba(0,0,0,0.08);font-weight:700}
      .mp-tab-pane{display:none}
      .mp-tab-pane.is-active{display:flex;flex-direction:column;gap:14px}

      .mp-sec-box{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-m);padding:16px}
      .mp-sec-box h3{font-size:13.5px;font-weight:700;margin:0 0 12px;display:flex;align-items:center;justify-content:space-between}
      .mp-field-row{display:flex;flex-direction:column;gap:5px;margin-bottom:12px}
      .mp-field-row label{font-size:12px;font-weight:600;color:var(--ink-2);letter-spacing:0.01em}
      .mp-field-row label .req{color:var(--red);margin-left:2px}
      .mp-field-row input,.mp-field-row select,.mp-field-row textarea{
        min-height:34px;padding:6px 10px;border-radius:6px;border:1px solid var(--line);background:var(--surface);color:var(--ink);font-size:13px;
        transition:border-color 0.12s,box-shadow 0.12s;
      }
      .mp-field-row textarea{resize:vertical;min-height:65px;line-height:1.5}
      .mp-field-row input:focus,.mp-field-row select:focus,.mp-field-row textarea:focus{
        outline:none;border-color:var(--blue);box-shadow:0 0 0 2px rgba(26,115,232,0.15);
      }
      .mp-field-2col{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      @media(max-width:540px){.mp-field-2col{grid-template-columns:1fr}}

      /* Toggle Cards */
      .mp-toggle-card{
        display:flex;align-items:center;justify-content:space-between;gap:14px;padding:11px 14px;
        background:var(--ground);border:1px solid var(--line);border-radius:var(--r-m);margin-bottom:8px;
      }
      .mp-toggle-info{display:flex;flex-direction:column;gap:2px}
      .mp-toggle-title{font-size:13px;font-weight:600;color:var(--ink)}
      .mp-toggle-desc{font-size:11.5px;color:var(--ink-3);line-height:1.35}
      .mp-switch{position:relative;display:inline-block;width:40px;height:22px;flex-shrink:0}
      .mp-switch input{opacity:0;width:0;height:0}
      .mp-slider{
        position:absolute;cursor:pointer;inset:0;background-color:var(--line-2);transition:all .2s ease;
        border-radius:22px;
      }
      .mp-slider:before{
        position:absolute;content:"";height:16px;width:16px;left:3px;bottom:3px;background-color:#fff;
        transition:all .2s ease;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.25);
      }
      .mp-switch input:checked + .mp-slider{background-color:var(--blue)}
      .mp-switch input:checked + .mp-slider:before{transform:translateX(18px)}

      /* Dynamic Workshops Manager */
      .mp-ws-container{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
      .mp-ws-item{
        border:1px solid var(--line);border-radius:var(--r-s);background:var(--ground);padding:10px 12px;
        position:relative;
      }
      .mp-ws-top-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
      .mp-ws-top-row strong{font-size:12.5px;color:var(--ink)}
      .mp-ws-del-btn{
        background:none;border:none;color:var(--red);font-size:16px;font-weight:700;cursor:pointer;
        padding:2px 6px;border-radius:4px;line-height:1;
      }
      .mp-ws-del-btn:hover{background:rgba(234,67,53,0.1)}
      .mp-ws-grid{display:grid;grid-template-columns:1.5fr 1fr 1fr;gap:8px}
      @media(max-width:600px){.mp-ws-grid{grid-template-columns:1fr}}

      /* Visual Avatar Picker */
      .mp-avatar-grid{
        display:grid;grid-template-columns:repeat(6,1fr);gap:8px;max-height:160px;overflow-y:auto;
        padding:8px;border:1px solid var(--line);border-radius:var(--r-s);background:var(--ground);
      }
      .mp-av-btn{
        aspect-ratio:1;padding:3px;border-radius:50%;border:2px solid transparent;background:var(--surface);
        cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s ease;
      }
      .mp-av-btn:hover{transform:scale(1.12);border-color:var(--blue-soft)}
      .mp-av-btn.selected{border-color:var(--blue);box-shadow:0 0 0 3px rgba(26,115,232,0.3);background:var(--blue-soft)}
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

      /* Home Page Card Miniature Preview */
      .g16-mcard-mini{
        position:relative;width:100%;min-height:350px;border-radius:24px;overflow:hidden;padding:20px;
        display:flex;flex-direction:column;justify-content:space-between;box-sizing:border-box;
        font-family:var(--f-body,system-ui,sans-serif);
      }
      .g16-mcard-mini .g16-tl-logo{position:absolute;right:18px;top:18px;width:60px;height:60px;pointer-events:none;z-index:4}
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
  async function openEditor(handleOrNull) {
    const isNew = !handleOrNull;
    let base = null;
    if (!isNew) {
      try {
        const res = await fetch(`/data/profiles/${encodeURIComponent(handleOrNull)}.json?v=` + Date.now(), { cache: 'no-store' });
        if (res.ok) base = await res.json();
      } catch (_) {}
    }

    // Existing row or override
    const existingRow = rows.find((x) => x.handle === handleOrNull);
    const ov = (!isNew && cachedOverrides[handleOrNull]) ? cachedOverrides[handleOrNull] : {};

    const r = {
      handle: handleOrNull || '',
      name: ov.name || (base && base.name) || (existingRow && existingRow.name) || '',
      roll_display: ov.roll_display || ov.roll || (base && (base.roll_display || base.roll)) || '',
      dept: ov.dept || ov.department || (base && base.department) || (existingRow && existingRow.dept) || 'CSE (AI & ML)',
      cohort: ov.cohort || (base && base.cohort) || (existingRow && existingRow.cohort) || '2024',
      university: ov.university || (base && base.university) || 'SR University',
      status: ov.status || (base && base.status) || 'verified',
      active_status: ov.active_status || (base && base.active_status) || 'Active Member',
      theme: ov.theme || (base && base.theme) || (existingRow && existingRow.theme) || 'google-blue',
      avatar: ov.avatar || (base && base.avatar) || (existingRow && existingRow.avatar) || 'avatar-01',
      photo: ov.photo || (base && base.photo) || (handleOrNull === 'narayan' ? '/assets/images/narayan-portrait.png' : ''),
      bio: ov.bio !== undefined ? ov.bio : ((base && base.bio) || (existingRow && existingRow.bio) || ''),
      about_me: ov.about_me !== undefined ? ov.about_me : ((base && base.about_me) || (base && base.bio) || ''),
      skills: Array.isArray(ov.skills) ? ov.skills : (Array.isArray(base && base.skills) ? base.skills : (existingRow && existingRow.skills) || ['Web Dev', 'Python', 'React']),
      interests: Array.isArray(ov.interests) ? ov.interests : (Array.isArray(base && base.interests) ? base.interests : ['Open Source', 'Community', 'AI/ML', 'Product Building']),
      github: ov.github !== undefined ? ov.github : ((base && base.github) || ''),
      linkedin: ov.linkedin !== undefined ? ov.linkedin : ((base && base.linkedin) || ''),
      portfolio: ov.portfolio !== undefined ? ov.portfolio : ((base && base.portfolio) || ''),
      email: ov.email !== undefined ? ov.email : ((base && base.email) || `${handleOrNull || 'user'}@sru.edu.in`),
      coding_languages: ov.coding_languages !== undefined ? ov.coding_languages : ((base && base.coding_languages) || 'Python, JavaScript, C++'),
      tools: ov.tools !== undefined ? ov.tools : ((base && base.tools) || 'VS Code, Git, Firebase, React'),
      hobbies: ov.hobbies !== undefined ? ov.hobbies : ((base && base.hobbies) || 'Gaming, Photography, Music'),
      workshops: Array.isArray(ov.workshops) ? ov.workshops : (Array.isArray(base && base.workshops) ? base.workshops : []),
      // Toggles
      hidden: ov.hidden !== undefined ? !!ov.hidden : (existingRow ? !!existingRow.hidden : false),
      allow_download_card: ov.allow_download_card !== undefined ? !!ov.allow_download_card : true,
      allow_download_resume: ov.allow_download_resume !== undefined ? !!ov.allow_download_resume : true,
      resume_url: ov.resume_url || (base && base.resume_url) || '',
      allow_print: ov.allow_print !== undefined ? !!ov.allow_print : true,
      allow_copy_link: ov.allow_copy_link !== undefined ? !!ov.allow_copy_link : true,
      allow_checkin_qr: ov.allow_checkin_qr !== undefined ? !!ov.allow_checkin_qr : true,
      show_about_me: ov.show_about_me !== undefined ? !!ov.show_about_me : true,
      show_workshops: ov.show_workshops !== undefined ? !!ov.show_workshops : true,
      show_skills_interests: ov.show_skills_interests !== undefined ? !!ov.show_skills_interests : true,
      show_quick_links: ov.show_quick_links !== undefined ? !!ov.show_quick_links : true,
      show_more_about: ov.show_more_about !== undefined ? !!ov.show_more_about : true,
      // Misc
      achievement_icon: ov.achievement_icon || (existingRow && existingRow.achievement_icon) || '✓',
      achievement_text: ov.achievement_text || (existingRow && existingRow.achievement_text) || 'Verified Member · GDG SRU',
      points: existingRow ? existingRow.points : 0,
      activities: existingRow ? existingRow.activities : 0
    };

    // Reactive state for the live preview
    const previewState = {
      handle: r.handle || 'alexk',
      name: r.name || 'Alex Kumar',
      dept: r.dept || 'CSE (AI & ML)',
      cohort: r.cohort || '2024',
      avatar: r.avatar || 'avatar-01',
      photo: r.photo || '',
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
      const avatarSrc = previewState.photo || getAvatarSrc(previewState.avatar);
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

    const drawerTitle = isNew ? 'Add Member Profile' : `Edit Profile: @${r.handle}`;
    const drawerSub = isNew ? 'Create a new member profile studio entry' : `${r.name || r.handle} · ${r.dept || 'SR University'}`;

    let workshopsList = [...(r.workshops || [])];

    function renderWorkshopsHtml() {
      if (!workshopsList.length) {
        return '<p class="muted small" style="margin:6px 0">No workshops added yet. Click "+ Add Workshop" below.</p>';
      }
      return workshopsList.map((ws, i) => `
        <div class="mp-ws-item" data-idx="${i}">
          <div class="mp-ws-top-row">
            <strong>#${i + 1} Workshop</strong>
            <button type="button" class="mp-ws-del-btn" data-del-ws="${i}" title="Remove workshop">&times;</button>
          </div>
          <div class="mp-field-row" style="margin-bottom:6px">
            <label>Workshop Title</label>
            <input type="text" class="ws-input-title" value="${esc(ws.title || '')}" placeholder="e.g. Building Web Apps with Firebase">
          </div>
          <div class="mp-ws-grid">
            <div class="mp-field-row" style="margin-bottom:0">
              <label>Date Display</label>
              <input type="text" class="ws-input-date-disp" value="${esc(ws.date_display || ws.date || '')}" placeholder="e.g. Oct 12, 2025">
            </div>
            <div class="mp-field-row" style="margin-bottom:0">
              <label>Icon</label>
              <select class="ws-input-icon">
                <option value="firebase" ${(ws.icon || '').includes('firebase') ? 'selected' : ''}>Firebase</option>
                <option value="python" ${(ws.icon || '').includes('python') ? 'selected' : ''}>Python / AI</option>
                <option value="github" ${(ws.icon || '').includes('github') ? 'selected' : ''}>GitHub / Git</option>
                <option value="calendar" ${!ws.icon || ws.icon === 'calendar' ? 'selected' : ''}>Default Calendar</option>
              </select>
            </div>
            <div class="mp-field-row" style="margin-bottom:0">
              <label>Credential Code</label>
              <input type="text" class="ws-input-cred" value="${esc(ws.cred || '')}" placeholder="GDG-SRU-FB-2025-01">
            </div>
          </div>
        </div>
      `).join('');
    }

    const d = drawer.open({
      title: drawerTitle,
      subtitle: drawerSub,
      wide: true,
      body: `
        <div class="mp-drawer-grid">
          <!-- Left Column: Profile Editor Studio -->
          <div class="mp-drawer-col">
            <nav class="mp-tabs-bar" id="ed-tabs-bar" role="tablist">
              <button type="button" class="mp-tab-btn is-active" data-tab="tab-identity">👤 Identity &amp; Photo</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-toggles">🔘 Action Toggles</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-bios">📝 Bios &amp; Story</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-skills">🏷️ Skills &amp; Interests</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-links">🔗 Quick Links</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-tech">💻 Languages &amp; Tools</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-workshops">🎓 Workshops</button>
              <button type="button" class="mp-tab-btn" data-tab="tab-sections">👁️ Page Visibility</button>
            </nav>

            <form id="mp-editor-form">
              <!-- TAB 1: Identity & Photo -->
              <div class="mp-tab-pane is-active" id="tab-identity">
                <div class="mp-sec-box">
                  <h3><span>Basic Identity</span></h3>
                  <div class="mp-field-2col">
                    <div class="mp-field-row">
                      <label for="ed-handle">Handle (Username)<span class="req">*</span></label>
                      <input type="text" id="ed-handle" name="handle" value="${esc(r.handle)}" placeholder="e.g. narayan" pattern="[a-z0-9_-]{2,32}" required ${!isNew ? 'readonly style="opacity:0.8;background:var(--sunk)"' : ''}>
                      <small class="mp-hint">${isNew ? 'Unique handle (2-32 chars, a-z, 0-9, _, -).' : 'Handle cannot be changed once created.'}</small>
                    </div>
                    <div class="mp-field-row">
                      <label for="ed-name">Full Name<span class="req">*</span></label>
                      <input type="text" id="ed-name" name="name" value="${esc(r.name)}" placeholder="e.g. Narayan Bora" required>
                    </div>
                  </div>

                  <div class="mp-field-2col">
                    <div class="mp-field-row">
                      <label for="ed-roll">Roll Number / Student ID</label>
                      <input type="text" id="ed-roll" name="roll_display" value="${esc(r.roll_display)}" placeholder="e.g. 2403••••01">
                    </div>
                    <div class="mp-field-row">
                      <label for="ed-uni">University</label>
                      <input type="text" id="ed-uni" name="university" value="${esc(r.university)}" placeholder="SR University">
                    </div>
                  </div>

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

                  <div class="mp-field-2col">
                    <div class="mp-field-row">
                      <label for="ed-status">Verification Badge</label>
                      <select id="ed-status" name="status">
                        <option value="verified" ${r.status === 'verified' ? 'selected' : ''}>Verified Member</option>
                        <option value="core" ${r.status === 'core' ? 'selected' : ''}>Core Team</option>
                        <option value="lead" ${r.status === 'lead' ? 'selected' : ''}>Chapter Lead</option>
                        <option value="member" ${r.status === 'member' ? 'selected' : ''}>Active Member</option>
                      </select>
                    </div>
                    <div class="mp-field-row">
                      <label for="ed-active-status">Active Indicator Text</label>
                      <input type="text" id="ed-active-status" name="active_status" value="${esc(r.active_status || 'Active Member')}" placeholder="Active Member">
                    </div>
                  </div>
                </div>

                <div class="mp-sec-box">
                  <h3><span>Photo &amp; Avatar</span></h3>
                  <div class="mp-field-row">
                    <label for="ed-photo">Custom Portrait Photo URL</label>
                    <input type="text" id="ed-photo" name="photo" value="${esc(r.photo || '')}" placeholder="e.g. /assets/images/narayan-portrait.png or https://...">
                    <small class="mp-hint">Enter a direct photo URL or select from the 30 curated avatars below.</small>
                  </div>

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
                </div>
              </div>

              <!-- TAB 2: Action Buttons & Export Controls (Toggles) -->
              <div class="mp-tab-pane" id="tab-toggles">
                <div class="mp-sec-box">
                  <h3><span>Action Buttons &amp; Export Controls</span></h3>
                  <p class="muted small" style="margin:0 0 14px">Toggle button visibility on the profile hero bar and specify custom download destinations.</p>

                  <!-- 1. Download Card (PNG) -->
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Download Card (PNG) Button</span>
                      <span class="mp-toggle-desc">Allows visitors to download the 1080&times;1350 member card as PNG</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="allow_download_card" ${r.allow_download_card ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <!-- 2. Resume (PDF) -->
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Resume (PDF) Button</span>
                      <span class="mp-toggle-desc">Enables downloading ATS-formatted PDF resume</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="allow_download_resume" ${r.allow_download_resume ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <div class="mp-field-row" style="margin:4px 0 16px 8px;padding-left:10px;border-left:2px solid var(--blue-soft)">
                    <label for="ed-resume-url">Custom Hosted Resume URL (Optional)</label>
                    <input type="url" id="ed-resume-url" name="resume_url" value="${esc(r.resume_url || '')}" placeholder="https://drive.google.com/... or https://narayanbora.dev/resume.pdf">
                    <small class="mp-hint">If set, clicking "Resume (PDF)" opens this link directly. Leave blank to use the built-in ATS resume generator.</small>
                  </div>

                  <!-- 3. Print / Laminate -->
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Print / Laminate Button</span>
                      <span class="mp-toggle-desc">Enables browser print dialog styled for physical card lamination</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="allow_print" ${r.allow_print ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <!-- 4. Copy Link -->
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Copy Link Button</span>
                      <span class="mp-toggle-desc">Allows one-click copying of member pass URL with toast alert</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="allow_copy_link" ${r.allow_copy_link ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <!-- 5. Check-in QR -->
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Check-in QR Button</span>
                      <span class="mp-toggle-desc">Displays the dynamic event check-in QR scanner modal</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="allow_checkin_qr" ${r.allow_checkin_qr ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>
                </div>
              </div>

              <!-- TAB 3: Bios & Narrative -->
              <div class="mp-tab-pane" id="tab-bios">
                <div class="mp-sec-box">
                  <h3><span>Hero Short Bio</span> <span id="ed-bio-count" style="font-size:11px;color:var(--ink-3)">${(r.bio || '').length}/240</span></h3>
                  <div class="mp-field-row">
                    <label for="ed-bio">Bio Summary (Shown in Hero &amp; Home Pass)</label>
                    <textarea id="ed-bio" name="bio" rows="3" maxlength="240" placeholder="Organizer and web developer. Passionate about building community-first products...">${esc(r.bio || '')}</textarea>
                  </div>
                </div>

                <div class="mp-sec-box">
                  <h3><span>About Me (Full Story)</span></h3>
                  <div class="mp-field-row">
                    <label for="ed-about-me">Full Biography (Shown in About Me Card)</label>
                    <textarea id="ed-about-me" name="about_me" rows="5" placeholder="I'm a third-year CSE student at SR University...">${esc(r.about_me || '')}</textarea>
                  </div>
                </div>

                <div class="mp-sec-box">
                  <h3><span>Milestone / Achievement Tag</span></h3>
                  <div class="mp-field-2col">
                    <div class="mp-field-row" style="max-width:110px">
                      <label for="ed-achieve-icon">Icon</label>
                      <select id="ed-achieve-icon" name="achievement_icon">
                        ${ICONS.map((ic) => `<option value="${ic}" ${(r.achievement_icon || '✓') === ic ? 'selected' : ''}>${ic}</option>`).join('')}
                      </select>
                    </div>
                    <div class="mp-field-row">
                      <label for="ed-achieve-text">Tagline / Role</label>
                      <input type="text" id="ed-achieve-text" name="achievement_text" value="${esc(r.achievement_text || '')}" placeholder="e.g. Chapter Organizer &amp; Web Architect">
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 4: Skills & Interests -->
              <div class="mp-tab-pane" id="tab-skills">
                <div class="mp-sec-box">
                  <h3><span>Technical Skills</span></h3>
                  <div class="mp-field-row">
                    <label for="ed-skills">Skills (Comma-separated)</label>
                    <input type="text" id="ed-skills" name="skills" value="${esc((r.skills || []).join(', '))}" placeholder="Web Dev, Python, React, Community, JavaScript, UI/UX">
                    <small class="mp-hint">Top skills appear in the hero bar; all appear in the Skills &amp; Interests card.</small>
                  </div>
                </div>

                <div class="mp-sec-box">
                  <h3><span>Areas of Interest</span></h3>
                  <div class="mp-field-row">
                    <label for="ed-interests">Interests (Comma-separated)</label>
                    <input type="text" id="ed-interests" name="interests" value="${esc((r.interests || []).join(', '))}" placeholder="Open Source, Community, AI/ML, Product Building">
                    <small class="mp-hint">Rendered as colorful pill badges on the profile.</small>
                  </div>
                </div>
              </div>

              <!-- TAB 5: Quick Links & Social -->
              <div class="mp-tab-pane" id="tab-links">
                <div class="mp-sec-box">
                  <h3><span>2&times;2 Quick Links Card</span></h3>
                  <div class="mp-field-2col">
                    <div class="mp-field-row">
                      <label for="ed-github">GitHub Username / URL</label>
                      <input type="text" id="ed-github" name="github" value="${esc(r.github || '')}" placeholder="narayanbora">
                    </div>
                    <div class="mp-field-row">
                      <label for="ed-linkedin">LinkedIn URL</label>
                      <input type="url" id="ed-linkedin" name="linkedin" value="${esc(r.linkedin || '')}" placeholder="https://linkedin.com/in/...">
                    </div>
                  </div>
                  <div class="mp-field-2col">
                    <div class="mp-field-row">
                      <label for="ed-portfolio">Portfolio / Website URL</label>
                      <input type="url" id="ed-portfolio" name="portfolio" value="${esc(r.portfolio || '')}" placeholder="https://narayanbora.dev">
                    </div>
                    <div class="mp-field-row">
                      <label for="ed-email">SRU Email Address</label>
                      <input type="email" id="ed-email" name="email" value="${esc(r.email || '')}" placeholder="narayan.b@sru.edu.in">
                    </div>
                  </div>
                </div>
              </div>

              <!-- TAB 6: Languages & Tools (More About Me) -->
              <div class="mp-tab-pane" id="tab-tech">
                <div class="mp-sec-box">
                  <h3><span>More About Me Details</span></h3>
                  <div class="mp-field-row">
                    <label for="ed-coding-languages">Coding Languages</label>
                    <input type="text" id="ed-coding-languages" name="coding_languages" value="${esc(r.coding_languages || '')}" placeholder="Python, JavaScript, C++">
                  </div>
                  <div class="mp-field-row">
                    <label for="ed-tools">Tools &amp; Technologies</label>
                    <input type="text" id="ed-tools" name="tools" value="${esc(r.tools || '')}" placeholder="VS Code, Git, Firebase, React">
                  </div>
                  <div class="mp-field-row">
                    <label for="ed-hobbies">Hobbies &amp; Interests</label>
                    <input type="text" id="ed-hobbies" name="hobbies" value="${esc(r.hobbies || '')}" placeholder="Gaming, Photography, Music">
                  </div>
                </div>
              </div>

              <!-- TAB 7: Workshops Attended -->
              <div class="mp-tab-pane" id="tab-workshops">
                <div class="mp-sec-box">
                  <h3>
                    <span>Workshops Attended</span>
                    <button type="button" class="button-outline" id="ed-add-ws-btn" style="font-size:12px;padding:3px 9px;">+ Add Workshop</button>
                  </h3>
                  <div class="mp-ws-container" id="ed-workshops-box">
                    ${renderWorkshopsHtml()}
                  </div>
                </div>
              </div>

              <!-- TAB 8: Page Visibility & Section Toggles -->
              <div class="mp-tab-pane" id="tab-sections">
                <div class="mp-sec-box">
                  <h3><span>Profile Visibility</span></h3>
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Hide Entire Profile / Pass</span>
                      <span class="mp-toggle-desc">When enabled, visiting /u/${esc(r.handle || 'username')} shows “This profile isn’t available”.</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="hidden" ${r.hidden ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>
                </div>

                <div class="mp-sec-box">
                  <h3><span>Section Display Toggles</span></h3>
                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">About Me Card</span>
                      <span class="mp-toggle-desc">Display About Me biographical card and metadata strip</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="show_about_me" ${r.show_about_me ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Workshops Attended Card</span>
                      <span class="mp-toggle-desc">Display workshops listing and certificate links</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="show_workshops" ${r.show_workshops ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Skills &amp; Interests Card</span>
                      <span class="mp-toggle-desc">Display skill and interest pill clusters</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="show_skills_interests" ${r.show_skills_interests ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">Quick Links Card</span>
                      <span class="mp-toggle-desc">Display 2&times;2 GitHub, LinkedIn, Portfolio, Email cards</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="show_quick_links" ${r.show_quick_links ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>

                  <div class="mp-toggle-card">
                    <div class="mp-toggle-info">
                      <span class="mp-toggle-title">More About Me Card</span>
                      <span class="mp-toggle-desc">Display expandable coding languages, tools, hobbies accordion</span>
                    </div>
                    <label class="mp-switch">
                      <input type="checkbox" name="show_more_about" ${r.show_more_about ? 'checked' : ''}>
                      <span class="mp-slider"></span>
                    </label>
                  </div>
                </div>
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

          <!-- Right Column: Interactive Live Card Preview -->
          <div class="mp-preview-host">
            <span style="font-size:12px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:0.04em;">
              Live Card Preview
            </span>
            <div id="mp-live-preview-box" class="mp-admin-card-stage">
              ${renderCardHtml()}
            </div>
            <p style="font-size:11.5px;color:var(--ink-3);text-align:center;margin:4px 0 0;max-width:280px;line-height:1.4;">
              Updates in real-time. Changes are immediately reflected on public profiles.
            </p>
            ${!isNew ? `
              <div style="display:flex;flex-direction:column;gap:6px;width:100%;max-width:280px;margin-top:8px;">
                <a href="/u/${encodeURIComponent(r.handle)}" target="_blank" rel="noopener" class="button-outline" style="font-size:12px;justify-content:center;display:flex;align-items:center;gap:6px;">
                  Open Public Profile Dashboard ↗
                </a>
                <button type="button" class="button-outline" id="ed-copy-link" style="font-size:12px;justify-content:center;">
                  Copy Profile Link
                </button>
              </div>
            ` : ''}

            <!-- Award Points Section (Existing members only) -->
            ${!isNew ? `
              <div class="mp-sec-box" style="width:100%;max-width:280px;margin-top:12px;">
                <h3 style="font-size:12.5px;"><span>+ Award Community XP</span> <small style="color:var(--ink-3);font-size:11px">${r.points} XP</small></h3>
                <form id="mp-award-form">
                  <div class="mp-field-row">
                    <label for="mp-award-rule" style="font-size:11px">Activity Rule</label>
                    <select id="mp-award-rule" required style="font-size:12px;min-height:30px;">
                      ${pointRules.map((ru) => `<option value="${esc(ru.activity_type)}">${esc(ru.label)} (+${ru.points} pts)</option>`).join('') || '<option value="workshop_attendance">Workshop (+5 pts)</option>'}
                    </select>
                  </div>
                  <div class="mp-field-row">
                    <label for="mp-award-ref" style="font-size:11px">Reference ID</label>
                    <input type="text" id="mp-award-ref" placeholder="cloud-jam-26" required style="font-size:12px;min-height:30px;">
                  </div>
                  <button type="submit" class="mc-btn-save" style="width:100%;justify-content:center;margin-top:4px;height:32px;font-size:12px;">
                    Award Points
                  </button>
                </form>
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

    // Tabs switching
    $$('#ed-tabs-bar .mp-tab-btn', bodyEl).forEach((btn) => {
      btn.onclick = () => {
        $$('#ed-tabs-bar .mp-tab-btn', bodyEl).forEach((b) => b.classList.remove('is-active'));
        $$('.mp-tab-pane', bodyEl).forEach((p) => p.classList.remove('is-active'));
        btn.classList.add('is-active');
        const target = $('#' + btn.dataset.tab, bodyEl);
        if (target) target.classList.add('is-active');
      };
    });

    // Live form inputs
    form.addEventListener('input', (e) => {
      if (form.elements.handle) previewState.handle = form.elements.handle.value.trim().toLowerCase();
      if (form.elements.name) previewState.name = form.elements.name.value.trim();
      if (form.elements.dept) previewState.dept = form.elements.dept.value;
      if (form.elements.cohort) previewState.cohort = form.elements.cohort.value;
      if (form.elements.photo) previewState.photo = form.elements.photo.value.trim();
      if (form.elements.bio) {
        previewState.bio = form.elements.bio.value;
        const countEl = $('#ed-bio-count', bodyEl);
        if (countEl) countEl.textContent = `${form.elements.bio.value.length}/240`;
      }
      if (form.elements.skills) {
        previewState.skills = form.elements.skills.value.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (form.elements.achievement_text) previewState.achievement_text = form.elements.achievement_text.value.trim();
      if (form.elements.achievement_icon) previewState.achievement_icon = form.elements.achievement_icon.value;

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

    // Theme selector
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

    // Avatar selector
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

    // Workshops Add button
    const addWsBtn = $('#ed-add-ws-btn', bodyEl);
    if (addWsBtn) {
      addWsBtn.onclick = () => {
        workshopsList.push({
          title: 'New Workshop',
          date_display: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          date: new Date().toISOString().slice(0, 10),
          location: 'SR University',
          icon: 'calendar',
          cred: ''
        });
        const box = $('#ed-workshops-box', bodyEl);
        if (box) box.innerHTML = renderWorkshopsHtml();
      };
    }

    // Workshops Remove button (delegated)
    $('#ed-workshops-box', bodyEl)?.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del-ws]');
      if (delBtn) {
        const idx = Number(delBtn.dataset.delWs);
        if (!isNaN(idx)) {
          workshopsList.splice(idx, 1);
          const box = $('#ed-workshops-box', bodyEl);
          if (box) box.innerHTML = renderWorkshopsHtml();
        }
      }
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

      // Read current workshop items from DOM inputs
      const currentWorkshops = [];
      $$('#ed-workshops-box .mp-ws-item', bodyEl).forEach((item) => {
        const title = $('.ws-input-title', item)?.value.trim();
        const dateDisp = $('.ws-input-date-disp', item)?.value.trim();
        const iconVal = $('.ws-input-icon', item)?.value;
        const cred = $('.ws-input-cred', item)?.value.trim();
        if (title) {
          currentWorkshops.push({
            title,
            date_display: dateDisp || '',
            date: dateDisp || '',
            location: 'SR University',
            icon: iconVal || 'calendar',
            cred: cred || ''
          });
        }
      });

      const payload = {
        handle,
        name,
        roll_display: form.elements.roll_display?.value.trim() || '',
        roll: form.elements.roll_display?.value.trim() || '',
        dept: form.elements.dept.value,
        department: form.elements.dept.value,
        cohort: form.elements.cohort.value,
        university: form.elements.university?.value.trim() || 'SR University',
        status: form.elements.status?.value || 'verified',
        active_status: form.elements.active_status?.value.trim() || 'Active Member',
        theme: form.elements.theme.value || 'google-blue',
        avatar: form.elements.avatar.value || 'avatar-01',
        photo: form.elements.photo?.value.trim() || '',
        bio: form.elements.bio.value.trim(),
        about_me: form.elements.about_me?.value.trim() || form.elements.bio.value.trim(),
        skills: form.elements.skills.value.split(',').map((s) => s.trim()).filter(Boolean),
        interests: form.elements.interests?.value.split(',').map((s) => s.trim()).filter(Boolean) || [],
        github: form.elements.github?.value.trim() || '',
        linkedin: form.elements.linkedin?.value.trim() || '',
        portfolio: form.elements.portfolio?.value.trim() || '',
        email: form.elements.email?.value.trim() || '',
        coding_languages: form.elements.coding_languages?.value.trim() || '',
        tools: form.elements.tools?.value.trim() || '',
        hobbies: form.elements.hobbies?.value.trim() || '',
        workshops: currentWorkshops,
        achievement_icon: form.elements.achievement_icon.value || '✓',
        achievement_text: form.elements.achievement_text.value.trim() || `${form.elements.dept.value} · Verified Member`,
        // Toggles
        hidden: !!form.elements.hidden.checked,
        allow_download_card: !!form.elements.allow_download_card.checked,
        allow_download_resume: !!form.elements.allow_download_resume.checked,
        resume_url: form.elements.resume_url?.value.trim() || '',
        allow_print: !!form.elements.allow_print.checked,
        allow_copy_link: !!form.elements.allow_copy_link.checked,
        allow_checkin_qr: !!form.elements.allow_checkin_qr.checked,
        show_about_me: !!form.elements.show_about_me.checked,
        show_workshops: !!form.elements.show_workshops.checked,
        show_skills_interests: !!form.elements.show_skills_interests.checked,
        show_quick_links: !!form.elements.show_quick_links.checked,
        show_more_about: !!form.elements.show_more_about.checked
      };

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

      try {
        // 1. Save to Supabase site_settings under member_profile_overrides
        let cur = {};
        try {
          const { data: stRow } = await sb.from('site_settings').select('value').eq('key', 'member_profile_overrides').maybeSingle();
          if (stRow && stRow.value && typeof stRow.value === 'object') {
            cur = stRow.value;
          }
        } catch (_) {}
        cur[handle] = payload;
        await sb.from('site_settings').upsert({ key: 'member_profile_overrides', value: cur });
        cachedOverrides[handle] = payload;

        // 2. Try Supabase RPC
        try {
          await sb.rpc('admin_update_member_profile', {
            p_handle: handle,
            p_name: payload.name,
            p_dept: payload.dept,
            p_cohort: payload.cohort,
            p_avatar: payload.avatar,
            p_theme: payload.theme,
            p_bio: payload.bio,
            p_skills: payload.skills,
            p_achievement_text: payload.achievement_text,
            p_achievement_icon: payload.achievement_icon,
            p_hidden: payload.hidden
          });
        } catch (rpcErr) {
          console.warn('[Admin] admin_update_member_profile RPC skipped or unavailable:', rpcErr);
        }

        // 3. Update hidden status in member_passes if RPC exists
        try {
          await sb.rpc('admin_set_member_hidden', { p_handle: handle, p_hidden: payload.hidden });
        } catch (_) {}

        await audit(isNew ? 'create' : 'update', 'member_profiles', `@${handle} (${name})`);
        toast(`Profile and toggles saved for @${handle}!`, true);
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
          body: 'This removes their profile studio overrides and stops live stats.',
          confirm: 'Remove Profile',
          danger: true
        }))) return;

        try {
          try {
            const { data: stRow } = await sb.from('site_settings').select('value').eq('key', 'member_profile_overrides').maybeSingle();
            if (stRow && stRow.value && typeof stRow.value === 'object' && stRow.value[r.handle]) {
              delete stRow.value[r.handle];
              await sb.from('site_settings').upsert({ key: 'member_profile_overrides', value: stRow.value });
              delete cachedOverrides[r.handle];
            }
          } catch (_) {}

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
      const note = '';

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
      <p class="admin-lead" style="margin:0 0 14px">Public member passes at <code>/u/handle</code>. Click any member to edit every entry, manage action button toggles, and preview changes in real time.</p>
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

    // Deep-linking: auto-open member editor if ?edit=handle or hash contains edit
    try {
      const hashStr = location.hash || '';
      const qIdx = hashStr.indexOf('?');
      const params = new URLSearchParams(qIdx !== -1 ? hashStr.slice(qIdx) : location.search);
      const editHandle = params.get('edit');
      if (editHandle) {
        setTimeout(() => openEditor(editHandle), 120);
      }
    } catch (_) {}
  };
})();
