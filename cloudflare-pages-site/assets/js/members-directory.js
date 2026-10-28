/* GDG SRU · Member Directory & Multi-Design Showcase
   Zero-auth: static profiles_index.json + optional Supabase live layer
   Supports:
     - Design 1: Official Digital Pass Badge (mini CR80 lanyard pass with Google skins)
     - Design 2: Developer Holo-Card (interactive 3D flippable collector card)
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

  let allMembers = [];
  let activeFilter = 'All';
  let searchQuery = '';
  let cardDesign = localStorage.getItem('gdg-member-card-design') || 'holo'; // 'pass' or 'holo'

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

  function renderBarcodeSvg(seedText) {
    let h = 2166136261;
    for (const ch of seedText) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h >>> 24; };
    let x = 0, rects = '';
    while (x < 130) {
      const w = 1 + (rnd() % 3), gap = 1 + (rnd() % 2);
      if (x + w > 130) break;
      rects += `<rect x="${x}" y="0" width="${w}" height="16"/>`;
      x += w + gap;
    }
    return `<svg viewBox="0 0 130 16" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${rects}</svg>`;
  }

  /* ---- Card Renderers ---- */

  // Design 1: Digital Pass Badge (mini CR80 vertical pass)
  function renderPassCard(m) {
    const ach = getAchievement(m);
    const avatarSrc = getAvatarSrc(m.a);
    const skin = m.t || 'google-blue';
    const roll = `2403•••${String(m.u).slice(-2)}`;

    return `
      <article class="mpass-card" data-skin="${esc(skin)}" onclick="location.href='/u/${encodeURIComponent(m.u)}'" role="link" tabindex="0" aria-label="Digital pass for ${esc(m.n)}">
        <div class="mpass-slot" aria-hidden="true"></div>
        <div class="mpass-head">
          <span class="mpass-org">GDG on Campus<br>SR University</span>
          <span class="mpass-kind">MEMBER</span>
        </div>

        <div class="mpass-avatar-wrap">
          <img class="mpass-avatar" src="${avatarSrc}" alt="${esc(m.n)}" loading="lazy" width="76" height="76">
          <span class="mpass-check" aria-hidden="true">✓</span>
        </div>

        <h4 class="mpass-name">${esc(m.n)}</h4>
        <p class="mpass-handle">@${esc(m.u)}</p>

        <dl class="mpass-fields">
          <div><dt>Roll no.</dt><dd>${esc(roll)}</dd></div>
          <div><dt>Cohort</dt><dd>${esc(m.c || '2024')}</dd></div>
        </dl>

        <div class="mpass-achieve-pill" title="${esc(ach.text)}">
          <span>${ach.icon}</span>
          <span>${esc(ach.text)}</span>
        </div>

        <div class="mpass-barcode" aria-hidden="true">
          ${renderBarcodeSvg(m.u)}
        </div>

        <div class="mpass-foot">
          <span class="mpass-foot-tag">Verified</span>
          <span class="mpass-foot-lvl">Lvl ${ach.lvlNum} · ${esc(ach.level)}</span>
        </div>
      </article>
    `;
  }

  // Design 2: Developer Holo-Card (Interactive Flippable Card)
  function renderHoloCard(m) {
    const ach = getAchievement(m);
    const avatarSrc = getAvatarSrc(m.a);
    const skills = Array.isArray(m.s) ? m.s.slice(0, 3) : [];
    const bioText = m.b || 'Passionate student developer exploring Google technologies and building solutions at SR University.';

    return `
      <div class="mholo-card" data-handle="${esc(m.u)}" tabindex="0" role="region" aria-label="Developer card for ${esc(m.n)}. Click to flip.">
        <div class="mholo-shell">
          <!-- Front Face -->
          <div class="mholo-face mholo-front">
            <div class="mholo-head">
              <span class="mholo-badge-id">GDG SRU // 2026</span>
              <span class="mholo-xp-badge">Lvl ${ach.lvlNum} · ${esc(ach.level)}</span>
            </div>

            <div class="mholo-center">
              <div class="mholo-av-aura">
                <img class="mholo-av-img" src="${avatarSrc}" alt="${esc(m.n)}" loading="lazy" width="68" height="68">
              </div>
              <h4 class="mholo-name">${esc(m.n)}</h4>
              <p class="mholo-handle">@${esc(m.u)}</p>
              <p class="mholo-dept">${esc(m.d || 'SR University')}${m.c ? ` · '${String(m.c).slice(-2)}` : ''}</p>
            </div>

            <div class="mholo-achieve" title="${esc(ach.text)}">
              <span>${ach.icon}</span>
              <span>${esc(ach.text)}</span>
            </div>

            ${skills.length ? `
              <div class="mholo-skills">
                ${skills.map((s) => `<span class="mholo-skill">${esc(s)}</span>`).join('')}
              </div>
            ` : ''}

            <p class="mholo-flip-hint"><span>↺</span> Click to flip</p>
          </div>

          <!-- Back Face -->
          <div class="mholo-face mholo-back">
            <div class="mholo-back-head">
              <span class="mholo-back-title">Developer Profile</span>
              <span style="font-size: 11px; opacity: 0.6;">@${esc(m.u)}</span>
            </div>

            <p class="mholo-back-bio">"${esc(bioText)}"</p>

            <div class="mholo-back-meta">
              <p>Department: <strong>${esc(m.d || 'SR University')}</strong></p>
              <p>Status: <strong style="color: #81c995;">Verified Member</strong></p>
              <p>Achievement: <strong>${esc(ach.text)}</strong></p>
            </div>

            <div class="mholo-back-actions">
              <a href="/u/${encodeURIComponent(m.u)}" class="mholo-back-btn" onclick="event.stopPropagation()">
                View 3D Pass <i>→</i>
              </a>
              <button type="button" class="mholo-back-flip">↺ Flip back</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderTopBuilders(members) {
    const container = $('#top-builders-list');
    if (!container) return;

    let top = members.filter((m) => TOP_HANDLES.includes(m.u));
    if (top.length < 3) top = members.slice(0, 3);

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

    // Render based on selected design
    grid.innerHTML = filtered.map((m) => (cardDesign === 'pass' ? renderPassCard(m) : renderHoloCard(m))).join('');

    // Attach card flip listeners for Holo-cards
    if (cardDesign === 'holo') {
      $$('.mholo-card', grid).forEach((card) => {
        card.addEventListener('click', (e) => {
          if (e.target.closest('a')) return;
          card.classList.toggle('is-flipped');
        });
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            if (e.target.closest('a')) return;
            e.preventDefault();
            card.classList.toggle('is-flipped');
          }
        });
      });
    }
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

    // Card Design Switcher Toggle
    $$('[data-card-design]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('[data-card-design]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        cardDesign = btn.dataset.cardDesign;
        try { localStorage.setItem('gdg-member-card-design', cardDesign); } catch (_) {}
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
        } catch (_) {}
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
