/* GDG SRU · Member Directory & Official Card Showcase
   Zero-auth: static profiles_index.json + optional Supabase live layer
   Uses the signature GDG SRU home page card design (.g16-mcard / .g16-tl)
   featuring dynamic Google color halos, radar orbit ripples, 3D tilt, and verified badges.
*/
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const FALLBACK_ACHIEVEMENTS = {
    'narayan': { icon: '🏆', text: 'Chapter Organizer & Web Architect · 500+ XP', level: 'Innovator', lvlNum: 3 },
    'alexk': { icon: '🚀', text: 'Flutter & Firebase Bootcamp · Certified', level: 'Builder', lvlNum: 2 },
    'ananya': { icon: '☁️', text: 'Google Cloud Study Jam \'26 · Cloud Hero', level: 'Builder', lvlNum: 2 },
    'vikram-n': { icon: '⚡', text: 'Competitive Programming Sprint · Top 3', level: 'Builder', lvlNum: 2 },
    'priya-m': { icon: '🔌', text: 'IoT & Hardware Systems Sprint · Verified', level: 'Explorer', lvlNum: 1 },
    'sana-r': { icon: '🤖', text: 'Android Study Jam · Milestone Completed', level: 'Explorer', lvlNum: 1 },
    'deepa-s': { icon: '📊', text: 'Data Science & Analytics · Top Project', level: 'Explorer', lvlNum: 1 },
    'kirant': { icon: '🧠', text: 'Machine Learning Sprint · Certified', level: 'Explorer', lvlNum: 1 },
    'meera-k': { icon: '🌟', text: 'Multi-modal AI Research · Contributor', level: 'Explorer', lvlNum: 1 },
    'rahulv': { icon: '📦', text: 'Full-Stack Web Sprint · Built & Deployed', level: 'Explorer', lvlNum: 1 }
  };

  const TOP_HANDLES = ['narayan', 'alexk', 'ananya', 'vikram-n'];
  const COLOR_ORDER = ['b', 'r', 'y', 'g'];
  const THEME_TO_COLOR = {
    'google-blue': 'b',
    'google-red': 'r',
    'google-yellow': 'y',
    'google-green': 'g',
    'terminal-dark': 'b'
  };

  let allMembers = [];
  let activeFilter = 'All';
  let searchQuery = '';

  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function getAvatarSrc(raw) {
    const m = /^avatar-(\d{2})$/.exec(String(raw || ''));
    return m ? `/assets/avatars/${m[0]}.svg` : '/assets/avatars/avatar-01.svg';
  }

  function getAchievement(m) {
    if (m._achieveText) {
      const pts = m._liveXP || 0;
      const lvl = pts >= 1000 ? 'Vanguard' : pts >= 500 ? 'Innovator' : pts >= 200 ? 'Builder' : 'Explorer';
      const lvlNum = pts >= 1000 ? 4 : pts >= 500 ? 3 : pts >= 200 ? 2 : 1;
      return {
        icon: m._achieveIcon || '✓',
        text: m._achieveText,
        level: lvl,
        lvlNum: lvlNum
      };
    }
    if (FALLBACK_ACHIEVEMENTS[m.u]) {
      return FALLBACK_ACHIEVEMENTS[m.u];
    }
    return {
      icon: '✓',
      text: `${m.d || 'SR University'} · Verified Pass`,
      level: 'Explorer',
      lvlNum: 1
    };
  }

  /* ---- Signature Home Page Card Design (.g16-mcard) ---- */
  function renderHomeCard(m, idx = 0) {
    const ach = getAchievement(m);
    const avatarSrc = getAvatarSrc(m.a);
    const colorKey = THEME_TO_COLOR[m.t] || COLOR_ORDER[idx % COLOR_ORDER.length];
    const skills = Array.isArray(m.s) ? m.s.slice(0, 3) : [];
    const bioText = m.b || 'Passionate student developer exploring Google technologies and building solutions at SR University.';

    return `
      <a href="/u/${encodeURIComponent(m.u)}" class="g16-mcard g16-tl-${colorKey}" aria-label="View ${esc(m.n)}'s digital pass">
        <div class="g16-tl-card">
          <!-- Avatar Lens with Verified Checkmark -->
          <div class="g16-tl-logo" aria-hidden="true">
            <span class="g16-tl-c g16-tl-c1"></span>
            <div class="g16-tl-c5">
              <img src="${avatarSrc}" alt="${esc(m.n)}" loading="lazy" width="66" height="66">
              <span class="g16-mcard-check" title="Verified Member">✓</span>
            </div>
          </div>

          <!-- Top Meta Bar -->
          <div class="g16-mcard-top">
            <span class="g16-tl-num">LVL ${ach.lvlNum} · ${esc(ach.level.toUpperCase())}</span>
            <span class="g16-mcard-dept">${esc(m.d || 'SR University')}${m.c ? ` · '${String(m.c).slice(-2)}` : ''}</span>
          </div>

          <!-- Content Area -->
          <div class="g16-mcard-content">
            <h3 class="g16-tl-title">${esc(m.n)}</h3>
            <span class="g16-mcard-handle">@${esc(m.u)}</span>

            <div class="g16-mcard-achieve" title="${esc(ach.text)}">
              <span class="g16-achieve-icon">${ach.icon}</span>
              <span class="g16-achieve-text">${esc(ach.text)}</span>
            </div>

            <p class="g16-tl-text">${esc(bioText)}</p>

            ${skills.length ? `
              <div class="g16-mcard-skills">
                ${skills.map((s) => `<span class="g16-mcard-skill">${esc(s)}</span>`).join('')}
              </div>
            ` : ''}
          </div>

          <!-- Bottom Action Bar -->
          <div class="g16-tl-bottom">
            <span class="g16-mcard-badge-tag">GDG SRU // PASS</span>
            <span class="g16-tl-more">View Pass <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
          </div>
        </div>
      </a>
    `;
  }

  function renderTopBuilders(members) {
    const container = $('#top-builders-list');
    if (!container) return;

    let top = members.filter((m) => TOP_HANDLES.includes(m.u));
    if (top.length < 4) top = members.slice(0, 4);

    container.innerHTML = top.map((m, idx) => renderHomeCard(m, idx)).join('');
  }

  function renderGrid(members) {
    const grid = $('#members-directory-grid');
    const countEl = $('#members-count-badge');
    if (!grid) return;

    const q = searchQuery.trim().toLowerCase();
    const filtered = members.filter((m) => {
      if (activeFilter === 'Top XP' && !TOP_HANDLES.includes(m.u)) return false;
      if (activeFilter !== 'All' && activeFilter !== 'Top XP') {
        const dept = (m.d || '').toLowerCase();
        const target = activeFilter.toLowerCase();
        if (!dept.includes(target)) return false;
      }
      if (!q) return true;
      const haystack = `${m.n} ${m.u} ${m.d || ''} ${(m.s || []).join(' ')} ${m.b || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    if (countEl) {
      countEl.textContent = `${filtered.length} of ${members.length} verified`;
    }

    if (!filtered.length) {
      grid.innerHTML = `
        <div class="members-empty" style="grid-column: 1 / -1;">
          <h3>No members found</h3>
          <p>We couldn't find anyone matching "<strong>${esc(q || activeFilter)}</strong>".</p>
          <button type="button" class="members-chip active" id="members-reset-search" style="margin-top: 14px;">Reset filters</button>
        </div>
      `;
      const btn = $('#members-reset-search');
      if (btn) {
        btn.onclick = () => {
          searchQuery = '';
          activeFilter = 'All';
          const input = $('#members-search-input');
          if (input) input.value = '';
          $$('.members-chip').forEach((c) => c.classList.toggle('active', c.dataset.filter === 'All'));
          renderGrid(allMembers);
        };
      }
      return;
    }

    // Render all members in the signature home card design
    grid.innerHTML = filtered.map((m, idx) => renderHomeCard(m, idx)).join('');
  }

  function bindEvents() {
    const input = $('#members-search-input');
    if (input) {
      input.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderGrid(allMembers);
      });
    }

    $$('.members-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        $$('.members-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        activeFilter = chip.dataset.filter || 'All';
        renderGrid(allMembers);
      });
    });
  }

  async function loadData() {
    try {
      const res = await fetch(`/data/profiles_index.json?v=${Date.now()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      allMembers = Array.isArray(data.profiles) ? data.profiles : (Array.isArray(data) ? data : []);

      // If Supabase live layer is available, fetch live points and profile overrides
      if (window.sbClient && typeof window.sbClient.from === 'function') {
        try {
          const { data: pts } = await window.sbClient
            .from('community_points')
            .select('user_email, points')
            .eq('verified', true);

          if (Array.isArray(pts) && pts.length) {
            const ptMap = new Map();
            pts.forEach((p) => {
              const handle = (p.user_email || '').split('@')[0].toLowerCase();
              ptMap.set(handle, (ptMap.get(handle) || 0) + (p.points || 0));
            });
            allMembers.forEach((m) => {
              if (ptMap.has(m.u)) m._liveXP = ptMap.get(m.u);
            });
          }
        } catch (e) {
          console.warn('[GDG SRU] Supabase live points sync skipped:', e);
        }

        try {
          const { data: stRow } = await window.sbClient
            .from('public_site_settings')
            .select('value')
            .eq('key', 'member_profile_overrides')
            .maybeSingle();

          if (stRow && stRow.value && typeof stRow.value === 'object') {
            const overrides = stRow.value;
            const memberMap = new Map();
            allMembers.forEach((m) => memberMap.set(m.u, m));

            Object.entries(overrides).forEach(([h, o]) => {
              let m = memberMap.get(h);
              if (!m) {
                if (!o.hidden) {
                  m = {
                    u: h,
                    n: o.name || h,
                    d: o.dept || o.department || '',
                    c: o.cohort || '',
                    a: o.avatar || 'avatar-01',
                    t: o.theme || 'google-blue',
                    s: Array.isArray(o.skills) ? o.skills : [],
                    b: o.bio || ''
                  };
                  if (o.achievement_text) m._achieveText = o.achievement_text;
                  if (o.achievement_icon) m._achieveIcon = o.achievement_icon;
                  allMembers.push(m);
                  memberMap.set(h, m);
                }
              } else {
                if (o.hidden) {
                  m._hidden = true;
                } else {
                  if (o.name) m.n = o.name;
                  if (o.dept || o.department) m.d = o.dept || o.department;
                  if (o.cohort) m.c = o.cohort;
                  if (o.avatar) m.a = o.avatar;
                  if (o.theme) m.t = o.theme;
                  if (Array.isArray(o.skills)) m.s = o.skills;
                  if (o.bio) m.b = o.bio;
                  if (o.achievement_text) m._achieveText = o.achievement_text;
                  if (o.achievement_icon) m._achieveIcon = o.achievement_icon;
                }
              }
            });

            allMembers = allMembers.filter((m) => !m._hidden);
          }
        } catch (stErr) {
          console.warn('[GDG SRU] Could not fetch member profile overrides:', stErr);
        }
      }

      renderTopBuilders(allMembers);
      renderGrid(allMembers);
    } catch (err) {
      console.warn('[GDG SRU] Could not load profiles_index.json:', err);
      // Mock fallbacks
      allMembers = [
        { u: 'narayan', n: 'Narayan Bora', d: 'CSE (AI & ML)', c: '2024', a: 'avatar-03', t: 'google-yellow', s: ['Next.js', 'Supabase', 'Python'], b: 'Chapter Organizer & Web Architect.' },
        { u: 'alexk', n: 'Alex Kumar', d: 'CSE (AI & ML)', c: '2024', a: 'avatar-09', t: 'google-blue', s: ['Flutter', 'Firebase', 'Dart'], b: 'Building things with Flutter and Firebase.' },
        { u: 'ananya', n: 'Ananya Patel', d: 'IT', c: '2024', a: 'avatar-14', t: 'google-red', s: ['Cloud', 'Kubernetes', 'Go'], b: 'Cloud computing and DevOps. Certified in Google Cloud.' },
        { u: 'vikram-n', n: 'Vikram Naidu', d: 'CSE', c: '2024', a: 'avatar-21', t: 'google-green', s: ['Algorithms', 'C++', 'Python'], b: 'Competitive programmer and algorithm nerd.' }
      ];
      renderTopBuilders(allMembers);
      renderGrid(allMembers);
    }
  }

  function init() {
    bindEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
