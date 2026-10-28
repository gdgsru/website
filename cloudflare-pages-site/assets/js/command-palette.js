/* GDG SRU · Developer Command Palette (Ctrl + K / Cmd + K)
   A keyboard-first spotlight command center for GDG on Campus SR University.
*/
(() => {
  'use strict';

  const COMMANDS = [
    // Navigation
    { id: 'nav-home', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>', title: 'Home', desc: 'Welcome to GDG on Campus SR University', url: '/', keywords: 'home main campus warangal sru' },
    { id: 'nav-events', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>', title: 'Events & Workshops', desc: 'Hackathons, speaker sessions, and tech bootcamps', url: '/events/', keywords: 'events sessions workshops hackathons calendar meetups' },
    { id: 'nav-team', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>', title: 'Core Team', desc: 'Meet the organizers, domain leads, and mentors', url: '/team/', keywords: 'team members organizers leads advisors people who' },
    { id: 'nav-blog', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', title: 'Tech Blogs', desc: 'Engineering articles, architectures, and student tutorials', url: '/blog/', keywords: 'blogs posts articles engineering writeups code tutorials' },
    { id: 'nav-join', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>', title: 'Join Community', desc: 'Become an official member of the GDG SRU chapter', url: '/join/', keywords: 'join register signup member apply onboarding discord' },
    { id: 'nav-certs', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>', title: 'Claim Certificate', desc: 'Download event credentials with verification hash', url: '/certificates/', keywords: 'certificates claim attend credentials badge award' },
    { id: 'nav-verify', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>', title: 'Verify Certificate', desc: 'Validate certificate cryptographic authenticity', url: '/verify/', keywords: 'verify validate check credential qr hash authenticity' },
    { id: 'nav-leaderboard', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>', title: 'Leaderboard', desc: 'Student contributor rankings and community points', url: '/leaderboard/', keywords: 'leaderboard points rank score contributors badges' },
    { id: 'nav-resources', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', title: 'Resource Hub', desc: 'Roadmaps, developer kits, and learning materials', url: '/resources/', keywords: 'resources roadmaps perks guides cheat sheets github' },
    { id: 'nav-privacy', category: 'Navigation', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>', title: 'Privacy Policy', desc: 'Data retention, analytics, and community terms', url: '/privacy/', keywords: 'privacy policy terms legal data gdpr' },

    // Developer Actions & Easter Eggs
    { id: 'act-pass', category: 'Community', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>', title: 'Claim GDG Member Pass', desc: 'Create your official digital member pass (Season 2026)', action: () => { if (window.openMemberPassStudio) window.openMemberPassStudio(); }, keywords: 'member pass card badge id digital pass avatar photo sru 2026' },
    { id: 'act-confetti', category: 'Developer Tools', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>', title: 'Fire Confetti Cannon', desc: 'Explode Google-colored geometric confetti across the screen', action: () => { if (window.gdg && window.gdg.confetti) window.gdg.confetti(); }, keywords: 'confetti party celebrate animation colors' },
    { id: 'act-matrix', category: 'Developer Tools', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>', title: 'Toggle Matrix Theme', desc: 'Turn the website into phosphorescent green cyberpunk mode', action: () => { if (window.gdg && window.gdg.matrix) window.gdg.matrix(); }, keywords: 'matrix hacker green terminal cyberpunk theme dark' },
    { id: 'act-discord', category: 'Community', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', title: 'Open Discord Server', desc: 'Connect with 1,000+ SR University student developers', url: 'https://discord.gg/htSJMNcdZs', external: true, keywords: 'discord chat community channels server voice' },
    { id: 'act-github', category: 'Community', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>', title: 'GitHub Organization', desc: 'Explore open-source projects and campus repositories', url: 'https://github.com/gdgsru', external: true, keywords: 'github code repos repositories git open source' },
    { id: 'act-official', category: 'Community', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>', title: 'Official GDG Chapter Page', desc: 'Google Developer Groups official community platform', url: 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/', external: true, keywords: 'google developer official chapter rsvp bevvy platform' },
    { id: 'act-mc', category: 'Administration', icon: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>', title: 'Mission Control Portal', desc: 'Admin console for core leads (Protected)', url: '/mission-control.html', keywords: 'mission control admin portal login auth backend manage' }
  ];

  let modalEl = null;
  let inputEl = null;
  let listEl = null;
  let filtered = [...COMMANDS];

  // ---- Member directory search (static /data/profiles_index.json, no database round-trips) ----
  const MEMBER_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
  let memberIndex = null;
  let memberIndexPromise = null;
  const escHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function loadMemberIndex() {
    if (!memberIndexPromise) {
      memberIndexPromise = fetch('/data/profiles_index.json', { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          memberIndex = j && Array.isArray(j.profiles) ? j.profiles : [];
          return memberIndex;
        })
        .catch(() => { memberIndex = []; return memberIndex; });
    }
    return memberIndexPromise;
  }

  function memberMatches(q) {
    if (!memberIndex || q.length < 2) return [];
    const out = [];
    for (const m of memberIndex) {
      if (!m || typeof m.u !== 'string' || !/^[a-z0-9_-]{2,32}$/.test(m.u)) continue;
      const hay = `${m.n || ''} ${m.u} ${m.d || ''} ${m.c || ''}`.toLowerCase();
      if (!hay.includes(q)) continue;
      out.push({
        id: 'member-' + m.u,
        category: 'Members',
        icon: MEMBER_ICON,
        title: escHtml(m.n || m.u), // titles are inserted with innerHTML below, so escape names
        desc: escHtml('@' + m.u + (m.d ? ' · ' + m.d : '')),
        keywords: '',
        url: '/u/' + encodeURIComponent(m.u),
      });
      if (out.length >= 6) break;
    }
    return out;
  }
  let selectedIndex = 0;
  let isOpen = false;
  let lastActiveElement = null; // was assigned but never declared: threw a ReferenceError in strict mode, so Ctrl+K never opened

  function ensureStyles() {
    if (document.getElementById('gdg-cp-styles')) return;
    const style = document.createElement('style');
    style.id = 'gdg-cp-styles';
    style.textContent = `
      #gdg-cp-backdrop {
        position: fixed; inset: 0; z-index: 2147483646;
        background: rgba(8, 9, 12, 0.76);
        backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
        display: flex; align-items: flex-start; justify-content: center;
        padding: clamp(40px, 12vh, 100px) 16px 24px;
        opacity: 0; pointer-events: none;
        transition: opacity 0.22s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #gdg-cp-backdrop.is-open { opacity: 1; pointer-events: auto; }
      #gdg-cp-dialog {
        width: 100%; max-width: 620px;
        background: rgba(22, 23, 27, 0.94);
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 18px;
        box-shadow: 0 28px 70px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06), inset 0 1px 2px rgba(255, 255, 255, 0.2);
        overflow: hidden;
        display: flex; flex-direction: column;
        transform: translateY(-14px) scale(0.98);
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        font-family: Google Sans, system-ui, -apple-system, sans-serif;
      }
      #gdg-cp-backdrop.is-open #gdg-cp-dialog {
        transform: translateY(0) scale(1);
      }
      .gdg-cp-header {
        display: flex; align-items: center; gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .gdg-cp-search-icon {
        width: 20px; height: 20px; color: #4285F4; flex-shrink: 0;
      }
      .gdg-cp-input {
        flex: 1; background: transparent; border: none; outline: none;
        font: 500 16px Google Sans, system-ui, sans-serif;
        color: #fff; caret-color: #4285F4;
      }
      .gdg-cp-input::placeholder { color: rgba(255, 255, 255, 0.42); }
      .gdg-cp-kbd {
        font: 600 11px monospace;
        padding: 3px 7px; border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.16);
        color: rgba(255, 255, 255, 0.7);
      }
      .gdg-cp-list {
        max-height: 380px; overflow-y: auto; padding: 10px 8px;
        overscroll-behavior: contain;
      }
      .gdg-cp-list::-webkit-scrollbar { width: 6px; }
      .gdg-cp-list::-webkit-scrollbar-track { background: transparent; }
      .gdg-cp-list::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.16); border-radius: 99px; }
      .gdg-cp-category {
        font: 700 11px Google Sans, sans-serif;
        letter-spacing: 0.08em; text-transform: uppercase;
        color: rgba(255, 255, 255, 0.4);
        padding: 10px 14px 4px;
      }
      .gdg-cp-item {
        display: flex; align-items: center; gap: 14px;
        padding: 10px 14px; border-radius: 10px;
        cursor: pointer; user-select: none;
        transition: background 0.12s ease, transform 0.12s ease;
        color: rgba(255, 255, 255, 0.9);
      }
      .gdg-cp-item:hover, .gdg-cp-item.is-active {
        background: rgba(66, 133, 244, 0.18);
        border: 1px solid rgba(66, 133, 244, 0.35);
      }
      .gdg-cp-item-icon {
        font-size: 19px; width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255, 255, 255, 0.06);
        border-radius: 8px; flex-shrink: 0;
      }
      .gdg-cp-item-body { flex: 1; min-width: 0; }
      .gdg-cp-item-title {
        font: 600 14px Google Sans, sans-serif; color: #fff;
        display: flex; align-items: center; gap: 6px;
      }
      .gdg-cp-item-desc {
        font: 400 12px system-ui, sans-serif;
        color: rgba(255, 255, 255, 0.55);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        margin-top: 1px;
      }
      .gdg-cp-item-ext { font-size: 11px; opacity: 0.6; }
      .gdg-cp-footer {
        padding: 10px 18px;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex; align-items: center; justify-content: space-between;
        font: 500 12px Google Sans, system-ui, sans-serif;
        color: rgba(255, 255, 255, 0.45);
        background: rgba(14, 15, 18, 0.5);
      }
      .gdg-cp-hints { display: flex; align-items: center; gap: 14px; }
      .gdg-cp-hints span { display: inline-flex; align-items: center; gap: 4px; }
      .gdg-cp-brand {
        display: inline-flex; align-items: center; gap: 6px;
        font-size: 11px; color: rgba(255, 255, 255, 0.65);
      }
      .gdg-cp-dots { display: inline-flex; gap: 3px; }
      .gdg-cp-dots i { width: 5px; height: 5px; border-radius: 50%; }
      .gdg-cp-dots i:nth-child(1) { background: #4285F4; }
      .gdg-cp-dots i:nth-child(2) { background: #EA4335; }
      .gdg-cp-dots i:nth-child(3) { background: #FBBC04; }
      .gdg-cp-dots i:nth-child(4) { background: #34A853; }
      .gdg-cp-empty {
        padding: 36px 20px; text-align: center;
        font: 400 14px system-ui, sans-serif; color: rgba(255, 255, 255, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  function createPalette() {
    ensureStyles();
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.id = 'gdg-cp-backdrop';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'Command Palette');

    modalEl.innerHTML = `
      <div id="gdg-cp-dialog">
        <div class="gdg-cp-header">
          <svg class="gdg-cp-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input type="text" class="gdg-cp-input" placeholder="Type a page, command, or action... (Esc to close)" spellcheck="false" autocomplete="off" />
          <kbd class="gdg-cp-kbd">Esc</kbd>
        </div>
        <div class="gdg-cp-list" role="listbox"></div>
        <div class="gdg-cp-footer">
          <div class="gdg-cp-hints">
            <span><kbd class="gdg-cp-kbd">↑</kbd><kbd class="gdg-cp-kbd">↓</kbd> navigate</span>
            <span><kbd class="gdg-cp-kbd">↵</kbd> select</span>
          </div>
          <div class="gdg-cp-brand">
            <span class="gdg-cp-dots"><i></i><i></i><i></i><i></i></span>
            <span>GDG on Campus · SR University</span>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modalEl);
    inputEl = modalEl.querySelector('.gdg-cp-input');
    listEl = modalEl.querySelector('.gdg-cp-list');

    // Backdrop click to close
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) closePalette();
    });

    // Search input listener
    inputEl.addEventListener('input', () => {
      const q = inputEl.value.trim().toLowerCase();
      if (!q) {
        filtered = [...COMMANDS];
      } else {
        filtered = COMMANDS.filter((cmd) => {
          const hay = `${cmd.title} ${cmd.desc} ${cmd.keywords} ${cmd.category}`.toLowerCase();
          return hay.includes(q);
        }).concat(memberMatches(q));
      }
      selectedIndex = 0;
      renderList();
    });

    // Keyboard navigation inside input
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (filtered.length) {
          selectedIndex = (selectedIndex + 1) % filtered.length;
          updateActive();
          scrollIntoView();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (filtered.length) {
          selectedIndex = (selectedIndex - 1 + filtered.length) % filtered.length;
          updateActive();
          scrollIntoView();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) execute(filtered[selectedIndex]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closePalette();
      }
    });
  }

  function renderList() {
    if (!listEl) return;
    if (!filtered.length) {
      listEl.innerHTML = `<div class="gdg-cp-empty">No commands match your search. Press <kbd class="gdg-cp-kbd">Esc</kbd> to return.</div>`;
      return;
    }

    let lastCat = null;
    let html = '';
    filtered.forEach((cmd, idx) => {
      if (cmd.category !== lastCat) {
        lastCat = cmd.category;
        html += `<div class="gdg-cp-category">${cmd.category}</div>`;
      }
      const isActive = idx === selectedIndex;
      html += `
        <div class="gdg-cp-item ${isActive ? 'is-active' : ''}" id="gdg-cp-opt-${idx}" data-idx="${idx}" role="option" aria-selected="${isActive}">
          <div class="gdg-cp-item-icon">${cmd.icon}</div>
          <div class="gdg-cp-item-body">
            <div class="gdg-cp-item-title">
              <span>${cmd.title}</span>
              ${cmd.external ? '<span class="gdg-cp-item-ext">↗</span>' : ''}
            </div>
            <div class="gdg-cp-item-desc">${cmd.desc}</div>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;

    // Attach click events
    listEl.querySelectorAll('.gdg-cp-item').forEach((el) => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.getAttribute('data-idx'), 10);
        if (filtered[idx]) execute(filtered[idx]);
      });
      el.addEventListener('mouseenter', () => {
        selectedIndex = parseInt(el.getAttribute('data-idx'), 10);
        updateActive();
      });
    });
  }

  function updateActive() {
    if (!listEl) return;
    const items = listEl.querySelectorAll('.gdg-cp-item');
    items.forEach((item, idx) => {
      const active = idx === selectedIndex;
      item.classList.toggle('is-active', active);
      item.setAttribute('aria-selected', active);
    });
    if (inputEl) {
      if (filtered.length && filtered[selectedIndex]) {
        inputEl.setAttribute('aria-activedescendant', `gdg-cp-opt-${selectedIndex}`);
      } else {
        inputEl.removeAttribute('aria-activedescendant');
      }
    }
  }

  function scrollIntoView() {
    if (!listEl) return;
    const active = listEl.querySelector('.gdg-cp-item.is-active');
    if (active) {
      active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function execute(cmd) {
    closePalette();
    if (cmd.action) {
      cmd.action();
    } else if (cmd.url) {
      if (cmd.external) {
        window.open(cmd.url, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(cmd.url);
      }
    }
  }

  function openPalette() {
    lastActiveElement = document.activeElement;
    createPalette();
    isOpen = true;
    modalEl.classList.add('is-open');
    inputEl.value = '';
    filtered = [...COMMANDS];
    selectedIndex = 0;
    renderList();
    updateActive();
    requestAnimationFrame(() => inputEl.focus());
    // Warm the member index; if the person already started typing, re-run the search once it lands.
    loadMemberIndex().then(() => {
      if (isOpen && inputEl && inputEl.value.trim()) inputEl.dispatchEvent(new Event('input'));
    });
  }

  function closePalette() {
    if (!modalEl || !isOpen) return;
    isOpen = false;
    modalEl.classList.remove('is-open');
    if (inputEl) inputEl.blur();
    if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
      try { lastActiveElement.focus(); } catch (_) {}
    }
  }

  // Global Keyboard Listener
  window.addEventListener('keydown', (e) => {
    // Ctrl + K or Cmd + K
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isOpen) closePalette();
      else openPalette();
      return;
    }

    // Slash "/" shortcut when not typing in form controls
    if (e.key === '/' && !isOpen) {
      const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (!['input', 'textarea', 'select'].includes(tag) && !document.activeElement.isContentEditable) {
        e.preventDefault();
        openPalette();
      }
    }
  });

  // Expose global method
  window.gdgCommandPalette = {
    open: openPalette,
    close: closePalette
  };
})();
