/* GDG SRU · Member Directory & Top Profiles Showcase
   Zero-auth: reads static /data/profiles_index.json + live Supabase RPC layer
*/
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Preset notable achievements for pre-launch showcase (and fallback when offline)
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

  // Featured top profiles handles in priority order
  const TOP_HANDLES = ['narayan', 'alexk', 'ananya', 'vikram-n'];

  let allMembers = [];
  let activeFilter = 'All';
  let searchQuery = '';

  const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function getAvatarSrc(raw) {
    const m = /^avatar-(\d{2})$/.exec(String(raw || ''));
    return m ? `/assets/avatars/${m[0]}.svg` : '/assets/avatars/avatar-01.svg';
  }

  function getAchievement(m) {
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

  function renderTopBuilders(members) {
    const container = $('#top-builders-list');
    if (!container) return;

    // Pick top handles first, fallback to first 3
    let top = members.filter((m) => TOP_HANDLES.includes(m.u));
    if (top.length < 3) {
      top = members.slice(0, 3);
    }

    container.innerHTML = top.map((m) => {
      const ach = getAchievement(m);
      const avatarSrc = getAvatarSrc(m.a);
      return `
        <a href="/u/${encodeURIComponent(m.u)}" class="top-builder-card" aria-label="View ${esc(m.n)}'s digital pass">
          <div class="top-builder-top">
            <div class="top-builder-avatar-wrap">
              <img class="top-builder-avatar" src="${avatarSrc}" alt="${esc(m.n)}" loading="lazy" width="56" height="56">
              <span class="top-builder-check" aria-hidden="true">✓</span>
            </div>
            <div class="top-builder-meta">
              <h3 class="top-builder-name">${esc(m.n)}</h3>
              <p class="top-builder-handle">@${esc(m.u)}</p>
            </div>
            <span class="top-builder-level">Lvl ${ach.lvlNum} · ${esc(ach.level)}</span>
          </div>

          <div class="top-builder-achieve">
            <span class="top-builder-achieve-icon">${ach.icon}</span>
            <span>${esc(ach.text)}</span>
          </div>

          ${m.b ? `<p class="top-builder-bio">${esc(m.b)}</p>` : ''}

          <div class="top-builder-foot">
            <span class="top-builder-dept">${esc(m.d || 'SR University')}${m.c ? ` · '${String(m.c).slice(-2)}` : ''}</span>
            <span class="top-builder-btn">View Pass <i>→</i></span>
          </div>
        </a>
      `;
    }).join('');
  }

  function renderGrid(members) {
    const grid = $('#members-directory-grid');
    const countEl = $('#members-count-badge');
    if (!grid) return;

    const q = searchQuery.trim().toLowerCase();
    const filtered = members.filter((m) => {
      // Category filter
      if (activeFilter === 'Top XP' && !TOP_HANDLES.includes(m.u)) return false;
      if (activeFilter !== 'All' && activeFilter !== 'Top XP') {
        const dept = (m.d || '').toLowerCase();
        const target = activeFilter.toLowerCase();
        if (!dept.includes(target)) return false;
      }
      // Text search
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

    grid.innerHTML = filtered.map((m) => {
      const ach = getAchievement(m);
      const avatarSrc = getAvatarSrc(m.a);
      const skills = Array.isArray(m.s) ? m.s.slice(0, 3) : [];

      return `
        <a href="/u/${encodeURIComponent(m.u)}" class="member-card" aria-label="Member pass for ${esc(m.n)}">
          <div class="member-card-head">
            <img class="member-avatar" src="${avatarSrc}" alt="${esc(m.n)}" loading="lazy" width="44" height="44">
            <div style="min-width: 0; flex: 1;">
              <h4 class="member-name">${esc(m.n)}</h4>
              <p class="member-handle">@${esc(m.u)}</p>
            </div>
          </div>

          <p class="member-dept-badge">${esc(m.d || 'SR University')}${m.c ? ` · Cohort ${esc(m.c)}` : ''}</p>

          <div class="member-card-achieve">
            <span>${ach.icon}</span>
            <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${esc(ach.text)}</span>
          </div>

          ${skills.length ? `
            <div class="member-tags">
              ${skills.map((s) => `<span class="member-tag">${esc(s)}</span>`).join('')}
            </div>
          ` : ''}
        </a>
      `;
    }).join('');
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
      const res = await fetch(`/data/profiles_index.json?v=${Date.now()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      allMembers = json && Array.isArray(json.profiles) ? json.profiles : [];

      renderTopBuilders(allMembers);
      renderGrid(allMembers);

      // Async live enrich: check Supabase public leaderboard for live XP
      if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase) {
        try {
          const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
          const { data } = await client.from('public_main_leaderboard').select('*').limit(50);
          if (data && data.length) {
            data.forEach((row) => {
              const matched = allMembers.find((m) => m.n.toLowerCase() === row.student_name.toLowerCase());
              if (matched) {
                FALLBACK_ACHIEVEMENTS[matched.u] = {
                  icon: '💎',
                  text: `#${row.rank} · ${row.points} Community XP`,
                  level: row.points >= 1000 ? 'Vanguard' : row.points >= 500 ? 'Innovator' : row.points >= 200 ? 'Builder' : 'Explorer',
                  lvlNum: row.points >= 1000 ? 4 : row.points >= 500 ? 3 : row.points >= 200 ? 2 : 1
                };
              }
            });
            renderTopBuilders(allMembers);
            renderGrid(allMembers);
          }
        } catch (_) {
          // Live stats optional, static stays robust
        }
      }
    } catch (err) {
      console.warn('Could not load member directory:', err);
      const grid = $('#members-directory-grid');
      if (grid) {
        grid.innerHTML = '<p class="members-empty">Member directory is loading or updating. Please check back shortly.</p>';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindEvents();
    loadData();
  });
})();
