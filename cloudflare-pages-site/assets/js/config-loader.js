/* Runtime integration for the preserved GDG SRU homepage.
   This file updates destinations and live data only; it does not rewrite the source HTML or CSS. */
(() => {
  'use strict';
  if (window.__GDG_CONFIG_LOADER_READY__) return;
  window.__GDG_CONFIG_LOADER_READY__ = true;
  const siteDefaults = () => window.GDG_SITE_DEFAULTS || {};
  const DEFAULTS = () => siteDefaults().socials || [];

  const isMultiPage = () => document.body.dataset.multipage === 'true' || window.GDG_MULTIPAGE === true;
  const currentRouteKey = () => isMultiPage() ? (window.GDG_CURRENT_ROUTE?.() || document.body.dataset.route || 'home') : ((location.hash.slice(1).split('/')[0] || 'home'));
  const PAGE_HASHES = {
    home: '#home', events: '#events', team: '#team', blogs: '#blogs', blog: '#blogs',
    join: '#join', contact: '#join', certificates: '#certificates', leaderboard: '#leaderboard',
    perks: '#perks', resources: '#perks', privacy: '#privacy', about: '#home', gallery: '#events'
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const safeUrl = value => { try { const u = new URL(String(value || '')); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const getSetting = (values, key) => {
    let value = values?.[key];
    if (typeof value === 'string' && value.startsWith('"') && value.endsWith('"')) { try { value = JSON.parse(value); } catch { /* keep source */ } }
    return value;
  };
  const _queryCache = new Map();
  function fetchCached(key, fetcher, ttlMs = 60000) {
    const hit = _queryCache.get(key);
    const now = Date.now();
    if (hit && (now - hit.time < ttlMs)) return hit.promise;
    const promise = Promise.resolve().then(fetcher).catch(err => {
      _queryCache.delete(key);
      throw err;
    });
    _queryCache.set(key, { time: now, promise });
    return promise;
  }
  function fetchBlogs(client) {
    return fetchCached('blogs', () =>
      client.from('public_blog_list')
        .select('title,author,description,image_url,category,external_url,featured,sort_order,created_at')
        .order('featured', { ascending: false })
        .order('sort_order')
        .order('created_at', { ascending: false })
    );
  }
  function fetchEvents(client) {
    return fetchCached('events', () =>
      client.from('public_event_list')
        .select('id,title,slug,category,summary,description,image_url,banner_url,start_at,end_at,timezone,event_tier,event_mode,accent_color,venue,join_link,online_url,speakers,speaker,rsvp_url,registration_url,syllabus_url,discord_channel_url,resource_url,calendar_enabled,certificates_ready,program_milestones,featured,pinned_next_session')
        .order('start_at', { ascending: true })
    );
  }
  function fetchBlogSeries(client) {
    return fetchCached('blog_series', () =>
      client.from('blog_series')
        .select('title,description,color,slug')
        .eq('status', 'published')
        .order('sort_order')
    );
  }
  function fetchResources(client) {
    return fetchCached('resources', () =>
      client.from('public_resource_list')
        .select('id,title,description,category,resource_type,kind,destination_url,image_url,access_type,eligibility,limitations,featured,sort_order')
        .order('featured', { ascending: false })
        .order('sort_order')
        .order('created_at', { ascending: false })
    );
  }
  function fetchLeaderboard(client) {
    return fetchCached('leaderboard', () =>
      Promise.all([
        client.from('public_main_leaderboard').select('period_id,period_title,student_name,points,rank').order('rank').limit(1000),
        client.from('leaderboard_periods').select('id,title,period_type,starts_on,ends_on').eq('enabled', true).eq('published', true).order('starts_on', {ascending: false}),
        client.from('public_sponsored_leaderboards').select('leaderboard_id,title,program_name,period_label,student_name,points,rank,leaderboard_sort_order').order('leaderboard_sort_order').order('rank')
      ])
    );
  }
  function syncPathToHash() {
    if (isMultiPage()) {
      const path = location.pathname.replace(/\/+$/, '') || '/';
      const url = new URL(location.href);
      const eventDetail = path.match(/^\/events\/([^/]+)$/);
      if (document.body.dataset.route === 'event-detail' || eventDetail) {
        const slug = url.searchParams.get('slug') || (eventDetail ? decodeURIComponent(eventDetail[1]) : '');
        if (slug) window.__GDG_EVENT_SLUG = slug;
      }
      const verify = path.match(/^\/verify\/([^/]+)$/);
      if (document.body.dataset.route === 'verify') window.__GDG_VERIFICATION_CODE = url.searchParams.get('code') || (verify ? decodeURIComponent(verify[1]) : '');
      return;
    }
    const path = location.pathname.replace(/\/+$/, '') || '/';
    const dispatchRoute = () => {
      const dispatch = () => setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 0);
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', dispatch, { once: true });
      else dispatch();
    };
    const eventDetail = path.match(/^\/events\/([^/]+)$/);
    if (eventDetail) {
      try { window.__GDG_EVENT_SLUG = decodeURIComponent(eventDetail[1]); }
      catch { window.__GDG_EVENT_SLUG = eventDetail[1]; }
      if (location.hash !== '#events') {
        history.replaceState(null, '', `${location.pathname}${location.search}#events`);
        dispatchRoute();
      }
      return;
    }
    if (path.startsWith('/events/')) {
      window.__GDG_INVALID_EVENT_ROUTE = true;
      if (location.hash !== '#404') {
        history.replaceState(null, '', `${location.pathname}${location.search}#404`);
        dispatchRoute();
      }
      return;
    }
    if (path === '/mission-control' || path.startsWith('/mission-control/')) return;
    let target = '';
    const verify = path.match(/^\/verify\/([^/]+)$/);
    if (verify) target = `#verify/${encodeURIComponent(decodeURIComponent(verify[1]))}`;
    else {
      const map = { '/': '#home', '/events': '#events', '/team': '#team', '/blog': '#blogs', '/join': '#join', '/contact': '#join', '/about': '#home', '/gallery': '#events', '/certificates': '#certificates', '/verify': '#verify', '/leaderboard': '#leaderboard', '/perks': '#perks', '/resources': '#perks', '/privacy': '#privacy' };
      target = map[path] || '';
    }
    if (target && location.hash !== target) {
      history.replaceState(null, '', `${location.pathname}${location.search}${target}`);
      dispatchRoute();
    }
  }
  function pageHashFor(raw, dataPage) {
    const full = String(dataPage || raw || '').replace(/^#/, '');
    const key = full.split('/')[0];
    if (isMultiPage()) return window.GDG_ROUTE_HREF?.(full) || window.GDG_ROUTE_HREF?.(key) || '';
    return PAGE_HASHES[key] || (key === 'verify' ? '#verify' : ['tracks', 'projects', 'roadmaps', 'first-pr', 'speak', 'alumni', 'gallery'].includes(key) ? '#events' : '');
  }
  function setRouteLink(anchor) {
    const dataPage = anchor.dataset.menuPage;
    const raw = anchor.getAttribute('href') || '';
    const hash = pageHashFor(raw, dataPage);
    if (hash) anchor.setAttribute('href', hash);
  }
  function rewriteNavigation() {
    // Retire the old public Lead Console link; Mission Control is opened by URL only.
    $$('a[href="/admin.html"], a[href="/admin"], a[href="/portal"], a[href="/portal.html"]').forEach(a => a.remove());
    // Leaderboard toggle: hide from public navigation if disabled in settings or defaults
    const lbEnabled = getSetting(currentSettings, 'leaderboard_enabled');
    const hideLeaderboard = lbEnabled === false || (lbEnabled === undefined && siteDefaults().leaderboardEnabled === false);
    if (hideLeaderboard) {
      $$('a[href="/leaderboard/"], a[href="/leaderboard"], [data-menu-page="leaderboard"]').forEach(a => a.remove());
    }
    const joinButton = $('header .rg');
    if (joinButton) joinButton.setAttribute('href', isMultiPage() ? '/join/' : '#join');
    // Retired destinations inside existing cards/CTAs must not open removed mini-sites.
    // Keep ordinary section anchors untouched; only known page-route links are rewritten.
    $$('a[href^="#"]').forEach(setRouteLink);
    if (!isMultiPage() && window.__GDG_EVENT_SLUG && /^\/events\/[^/]+$/.test(location.pathname)) {
      $$('a[href="#events"]').forEach(a => a.setAttribute('href', '/events'));
    }
    // In-page links intentionally remain hash links so the original SPA transitions keep working.
  }
  function siteLinkKey(href) {
    try {
      const u = new URL(href, location.origin), host = u.hostname.toLowerCase();
      if (host === 'discord.gg' || host.endsWith('.discord.com') || host === 'discord.com') return 'discord';
      if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
      if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
      if (host === 'github.com' || host.endsWith('.github.com')) return 'github';
      if (host === 'x.com' || host === 'twitter.com') return 'x';
      if (host === 'gdg.community.dev') return 'gdg';
    } catch { /* not an absolute link */ }
    return '';
  }
  function rewriteSettingsLinks(socials, email) {
    const byKey = new Map(socials.map(s => [s.key, s]));
    $$('a[href]').forEach(a => {
      const raw = a.getAttribute('href') || '';
      if (raw.startsWith('mailto:') && email) {
        const address = raw.slice(7).split('?')[0].trim().toLowerCase();
        if (['gdgoc@sru.edu.in', 'gdg@sru.edu.in'].includes(address) || a.dataset.gdgContactEmail === 'primary') {
          const suffix = raw.includes('?') ? raw.slice(raw.indexOf('?')) : '';
          a.dataset.gdgContactEmail = 'primary';
          a.setAttribute('href', `mailto:${email}${suffix}`);
        }
      }
      const key = a.dataset.gdgSocialKey || siteLinkKey(raw);
      if (!key) return;
      a.dataset.gdgSocialKey = key;
      const item = byKey.get(key);
      if (!item || item.enabled === false || !safeUrl(item.url)) { a.hidden = true; return; }
      a.hidden = false;
      a.setAttribute('href', safeUrl(item.url));
      if (key === 'discord' && a.id === 'hero-discord-btn') {
        const first = a.childNodes[0];
        if (first && first.nodeType === Node.TEXT_NODE) first.nodeValue = 'Join the Community ';
      }
    });
    if (email) {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
          return (node.nodeValue.includes('gdgoc@sru.edu.in') || node.nodeValue.includes('gdg@sru.edu.in')) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
        }
      });
      const nodes = []; let n; while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(node => { node.nodeValue = node.nodeValue.replaceAll('gdgoc@sru.edu.in', email).replaceAll('gdg@sru.edu.in', email); });
    }
  }
  function renderJoinSocialCards(socials) {
    const grid = $('.page-join > .card.pp > .grid');
    if (!grid) return;
    const active = socials.filter(item => item.enabled !== false && safeUrl(item.url))
      .sort((a, b) => (Number(a.sort_order) || 999) - (Number(b.sort_order) || 999));
    if (!active.length) {
      grid.innerHTML = '<p class="muted">Community links will appear here when configured.</p>';
      return;
    }
    const colors = ['b', 'r', 'y', 'g'];
    grid.classList.add('g16-row');
    grid.innerHTML = active.map((item, i) => {
      const url = safeUrl(item.url);
      const rawLbl = (item.label || '').toLowerCase();
      let icon = 'users';
      if (/discord/i.test(rawLbl)) icon = 'chat';
      else if (/github|code|repo/i.test(rawLbl)) icon = 'code';
      else if (/linkedin|network/i.test(rawLbl)) icon = 'users';
      else if (/instagram|photo/i.test(rawLbl)) icon = 'spark';
      else if (/twitter|x/i.test(rawLbl)) icon = 'spark';
      const isChapter = /google developer group|gdg/i.test(item.label || '');
      const nm = isChapter ? 'GDG on Campus' : (item.label || 'Community link');
      const actionLabel = /discord/i.test(nm) ? 'Join Discord' : /github/i.test(nm) ? 'View GitHub' : /linkedin/i.test(nm) ? 'Connect on LinkedIn' : isChapter ? 'Open Chapter Page' : `Visit ${nm}`;
      return GDG16.info({
        key: colors[i % colors.length],
        icon: icon,
        title: nm,
        text: item.description || `Connect with the chapter on ${nm}.`,
        actions: [{ label: actionLabel, href: url, ext: 1 }]
      });
    }).join('');
  }
  function applySecondaryContactEmail(value = currentSecondaryContactEmail) {
    const root = $('.join-contact-section, #contact-the-chapter');
    if (!root) return;
    const email = String(value || '').trim();
    const existing = $('#gdg-secondary-contact-email', root);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { existing?.remove(); return; }
    const primaryLink = $('a[href^="mailto:"]', root);
    const primary = primaryLink?.getAttribute('href')?.slice(7).split('?')[0].toLowerCase();
    if (primary === email.toLowerCase()) { existing?.remove(); return; }
    const row = existing || document.createElement('p');
    row.id = 'gdg-secondary-contact-email';
    row.style.cssText = 'margin:8px 0;color:var(--mut, #68778a)';
    row.innerHTML = `Additional email: <a href="mailto:${esc(email)}" style="text-decoration:underline">${esc(email)}</a>`;
    if (!existing) {
      if (primaryLink?.closest('p')) primaryLink.closest('p').insertAdjacentElement('afterend', row);
      else root.appendChild(row);
    }
  }
  function renderHomeTracks(settings) {
    const box = $('#home-tracks');
    if (!box || !window.GDG16) return;
    const saved = getSetting(settings, 'home_tracks');
    const list = (Array.isArray(saved) && saved.length ? saved : (siteDefaults().homeTracks || []))
      .filter(t => t && String(t.label || '').trim());
    box.innerHTML = window.GDG16.trackRow(list.map((t, i) => [
      ['b', 'r', 'y', 'g'].includes(t.color) ? t.color : ['b', 'r', 'y', 'g'][i % 4],
      esc(String(t.label).trim()), esc(String(t.description || '').trim())
    ]));
  }
  /* ── Global Announcement Bar Studio (Zero Layout Jump & Versioned Dismissal) ── */
  function ensureAnnouncementStyles() {
    if (document.getElementById('gdg-announcement-styles')) return;
    const style = document.createElement('style');
    style.id = 'gdg-announcement-styles';
    style.textContent = `
      :root { --announcement-h: 0px; }
      @keyframes gdgMeshFlow {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes gdgPulseBeacon {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.35; transform: scale(1.3); }
      }
      .gdg-announcement-bar {
        background: linear-gradient(180deg, rgba(8, 12, 24, 0.22) 0%, rgba(8, 12, 24, 0.55) 100%),
                    linear-gradient(90deg, #1A73E8 0%, #6366F1 26%, #EA4335 60%, #FBBC04 84%, #34A853 100%);
        background-size: 240% 240%;
        animation: gdgMeshFlow 16s ease infinite;
        color: #ffffff;
        border-bottom: 1px solid rgba(255, 255, 255, 0.22);
        box-shadow: 0 4px 20px -2px rgba(26, 115, 232, 0.28);
        font: 500 13px/1.4 var(--f-body, system-ui, -apple-system, sans-serif);
        padding: 8.5px 16px;
        position: relative;
        z-index: 100;
        box-sizing: border-box;
      }
      .gdg-announcement-bar[hidden] { display: none !important; }
      .gdg-announcement-wrap {
        max-width: 1220px;
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
        text-align: center;
      }
      .gdg-announcement-badge {
        display: inline-flex;
        align-items: center;
        gap: 6.5px;
        padding: 3px 10px;
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.42);
        border: 1px solid rgba(255, 255, 255, 0.32);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #ffffff;
        font: 800 10.5px/1 var(--f-mono, monospace);
        letter-spacing: .08em;
        text-transform: uppercase;
        flex-shrink: 0;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
      }
      .gdg-announcement-dot {
        width: 7px;
        height: 7px;
        border-radius: 999px;
        background: #34A853;
        box-shadow: 0 0 8px #34A853;
        animation: gdgPulseBeacon 2s infinite ease-in-out;
      }
      .gdg-announcement-text {
        font-weight: 600;
        color: #ffffff;
        letter-spacing: -0.01em;
        text-shadow: 0 1px 2px rgba(0,0,0,0.35);
      }
      .gdg-announcement-btn {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 4.5px 14px;
        border-radius: 999px;
        background: #ffffff;
        color: #0f172a !important;
        font: 700 12px/1 var(--f-body, system-ui);
        text-decoration: none;
        white-space: nowrap;
        box-shadow: 0 2px 10px rgba(0,0,0,0.22);
        transition: transform .18s cubic-bezier(0.16, 1, 0.3, 1), box-shadow .18s ease, background .15s;
      }
      .gdg-announcement-btn:hover {
        transform: translateY(-1px) scale(1.02);
        background: #f8fafc;
        box-shadow: 0 4px 16px rgba(0,0,0,0.35);
      }
      .gdg-announcement-close {
        background: rgba(255, 255, 255, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: #ffffff;
        width: 22px;
        height: 22px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        margin-left: 4px;
        border-radius: 999px;
        font-size: 14px;
        line-height: 1;
        transition: background .15s ease, transform .15s ease;
        padding: 0;
      }
      .gdg-announcement-close:hover {
        background: rgba(255, 255, 255, 0.35);
        transform: scale(1.1);
      }
      @media (max-width: 640px) {
        .gdg-announcement-bar { padding: 8px 12px; }
        .gdg-announcement-wrap { gap: 8px; }
        .gdg-announcement-text { font-size: 12px; }
        .gdg-announcement-btn { padding: 4px 11px; font-size: 11.5px; }
      }
    `;
    document.head.appendChild(style);
  }

  function getAnnouncementElement() {
    let el = document.getElementById('gdg-announcement-bar');
    if (!el) {
      ensureAnnouncementStyles();
      el = document.createElement('aside');
      el.id = 'gdg-announcement-bar';
      el.className = 'gdg-announcement-bar';
      el.setAttribute('role', 'region');
      el.setAttribute('aria-label', 'Announcement');
      el.hidden = true;
      const header = document.getElementById('hd') || document.querySelector('header');
      if (header && header.parentNode) header.parentNode.insertBefore(el, header);
      else document.body.prepend(el);
    }
    return el;
  }

  function renderAnnouncementBar(cfg) {
    if (!cfg || !cfg.enabled) {
      const el = document.getElementById('gdg-announcement-bar');
      if (el) el.hidden = true;
      return;
    }
    const currentDismissed = localStorage.getItem('gdg_announcement_dismissed_id');
    const aid = String(cfg.announcement_id || 1);
    if (currentDismissed === aid) {
      const el = document.getElementById('gdg-announcement-bar');
      if (el) el.hidden = true;
      return;
    }
    const bar = getAnnouncementElement();
    const badgeText = String(cfg.badge || 'ANNOUNCEMENT').trim();
    const msgText = String(cfg.text || '').trim();
    const btnLabel = String(cfg.button_label || '').trim();
    const rawBtnUrl = String(cfg.button_url || '').trim();
    // Fallback: if admin left button_url empty but provided a label, link to the chapter page
    const defaultChapterUrl = 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/';
    const btnUrl = (rawBtnUrl && rawBtnUrl.startsWith('https://')) ? rawBtnUrl : (btnLabel ? defaultChapterUrl : '');
    const showBtn = !!(btnLabel && btnUrl);

    bar.innerHTML = `
      <div class="gdg-announcement-wrap">
        ${badgeText ? `<span class="gdg-announcement-badge"><span class="gdg-announcement-dot" aria-hidden="true"></span>${esc(badgeText)}</span>` : ''}
        <span class="gdg-announcement-text">${esc(msgText)}</span>
        ${showBtn ? `<a class="gdg-announcement-btn" href="${esc(btnUrl)}" target="_blank" rel="noopener noreferrer">${esc(btnLabel)}</a>` : ''}
        <button type="button" class="gdg-announcement-close" aria-label="Dismiss announcement">✕</button>
      </div>
    `;
    bar.hidden = false;
    const closeBtn = bar.querySelector('.gdg-announcement-close');
    if (closeBtn) {
      closeBtn.onclick = () => {
        localStorage.setItem('gdg_announcement_dismissed_id', aid);
        bar.hidden = true;
      };
    }
  }

  // Pre-render announcement immediately from sessionStorage to eliminate layout jump
  try {
    const cached = sessionStorage.getItem('gdg_announcement_cache');
    if (cached) renderAnnouncementBar(JSON.parse(cached));
  } catch {}

  function applyAnnouncementBar(settings) {
    try {
      const raw = getSetting(settings, 'announcement_bar') || siteDefaults().announcementBar;
      if (!raw) return;
      const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
      sessionStorage.setItem('gdg_announcement_cache', JSON.stringify(cfg));
      renderAnnouncementBar(cfg);
    } catch (err) {
      console.warn('[GDG SRU] Announcement bar render skipped:', err);
    }
  }

  function applyHomepageText(settings) {
    renderHomeTracks(settings);
    const homeCopy = String(getSetting(settings, 'homepage_copy') || '').trim();
    const intro = String(getSetting(settings, 'community_intro') || '').trim();
    const heroTarget = $('.page-home .hero-reference-lead') || $('.page-home .home-hero .lead') || $('.page-home .home-hero-bottom .lead');
    const aboutTarget = $('.page-home .home-about-merged .editorial-collections-head > p');
    if (homeCopy && heroTarget) heroTarget.textContent = homeCopy;
    if (intro && aboutTarget) aboutTarget.textContent = intro;
  }
  function applyBrandLogo(settings) {
    const url = safeUrl(getSetting(settings, 'brand_logo_url'));
    if (!url) return;
    ['#lgs', '.brand-dots', '.menu-mark', '.v18-dots'].forEach(selector => {
      $$(selector).forEach(el => {
        if (el.querySelector('img[data-gdg-brand-logo]')) return;
        const img = document.createElement('img'); img.src = url; img.alt = 'GDG SRU'; img.dataset.gdgBrandLogo = '1';
        img.style.cssText = 'width:100%;height:100%;max-width:44px;max-height:44px;object-fit:contain;display:block';
        el.replaceChildren(img);
      });
    });
  }

  // The events page "next session" card is built by menu.js with placeholder values.
  // Fill them from the pinned event so admin edits show up on the card itself.
  window.__gdgFillFeature = function () {
    const f = document.querySelector('.event-feature'); const e = window.__GDG_PINNED_EVENT;
    if (!f || !e) return;
    const cells = f.querySelectorAll('.ef-fields > div');
    if (cells.length < 4) return;
    const tz = e.timezone || 'Asia/Kolkata';
    let when = '';
    try { when = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(new Date(e.start_at)); } catch { when = new Date(e.start_at).toLocaleString(); }
    const set = (i, label, value) => { const small = cells[i].querySelector('small'), b = cells[i].querySelector('b'); if (small && small.lastChild && small.lastChild.nodeType === 3) small.lastChild.nodeValue = label; if (b) b.textContent = value; };
    set(0, 'Date & time', when);
    set(1, 'Venue', e.venue || (e.online_url ? 'Online session' : 'To be announced'));
    set(2, 'Speaker', e.speaker || 'To be announced');
    set(3, 'Registration', e.registration_url ? 'Open — register below' : 'Details on event page');
    const side = f.querySelector('.event-feature-side');
    if (side) { const b = side.querySelector('b'), p = side.querySelector('p'); if (b) b.textContent = e.title; if (p) p.textContent = e.summary || 'Open the event page for full details.'; }
  };
  let nextSessionRequest = 0;
  function updateNextSession(client) {
    const titleEl = $('#next-event-label'), updateEl = $('#event-venue-label'), countdownCell = $('#countdown-cell'), countdown = $('#cd');
    if (!titleEl || !updateEl || !countdownCell || !countdown || !client) return;
    const requestId = ++nextSessionRequest;
    if (window.__gdgNextSessionTimer) clearInterval(window.__gdgNextSessionTimer);
    window.__gdgNextSessionTimer = null;
    const setText = (el, value) => { if (el.textContent !== value) el.textContent = value; };
    const neutral = () => {
      if (requestId !== nextSessionRequest) return;
      setText(titleEl, 'Coming soon');
      setText(updateEl, 'Official chapter page');
      if (!countdownCell.hidden) countdownCell.hidden = true;
      setText(countdown, '');
    };

    const nowIso = new Date().toISOString();
    // 1. First attempt: Pinned event
    client.from('public_event_list')
      .select('id,title,summary,start_at,end_at,timezone,venue,speaker,online_url,registration_url,pinned_next_session')
      .eq('pinned_next_session', true)
      .limit(1)
      .maybeSingle()
      .then(async ({ data, error }) => {
        let ev = data;
        const now = Date.now();
        // If pinned event does not exist or has already ended, look for nearest upcoming published event
        if (!ev || (ev.end_at && new Date(ev.end_at).getTime() < now) || (!ev.end_at && new Date(ev.start_at).getTime() < now)) {
          const up = await client.from('public_event_list')
            .select('id,title,summary,start_at,end_at,timezone,venue,speaker,online_url,registration_url,pinned_next_session')
            .gt('start_at', nowIso)
            .order('start_at', { ascending: true })
            .limit(1)
            .maybeSingle();
          ev = up.data;
        }

        if (requestId !== nextSessionRequest) return;
        if (!ev || !ev.start_at) { neutral(); return; }

        const startMs = new Date(ev.start_at).getTime();
        const endMs = ev.end_at ? new Date(ev.end_at).getTime() : startMs;

        // If the event is in the past and has ended, show neutral coming soon
        if (endMs < now) { neutral(); return; }

        const timezone = ev.timezone || 'Asia/Kolkata';
        const isLiveNow = startMs <= now && endMs >= now;
        const targetMs = isLiveNow ? endMs : startMs;

        const dateText = (() => {
          try {
            return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(startMs));
          } catch {
            return new Date(startMs).toLocaleString();
          }
        })();

        setText(titleEl, isLiveNow ? `${ev.title} · Live Now` : `${ev.title} · ${dateText}`);

        const summary = String(ev.summary || '').trim();
        const hasDistinctSummary = summary && summary.toLowerCase() !== String(ev.title || '').trim().toLowerCase();
        const updateText = ev.venue || (ev.online_url ? 'Online session' : ev.registration_url ? 'Registration available' : hasDistinctSummary ? summary : 'Details to be announced');
        setText(updateEl, updateText);

        const capEl = countdownCell.querySelector('.cap');
        if (capEl) capEl.textContent = isLiveNow ? 'Ends in' : 'Countdown';
        if (countdownCell.hidden) countdownCell.hidden = false;

        const tick = () => {
          if (requestId !== nextSessionRequest) return;
          const diff = Math.max(0, targetMs - Date.now());
          if (diff <= 0) {
            if (window.__gdgNextSessionTimer) clearInterval(window.__gdgNextSessionTimer);
            window.__gdgNextSessionTimer = null;
            updateNextSession(client);
            return;
          }
          const days = Math.floor(diff / 86400000);
          const hours = Math.floor(diff / 3600000) % 24;
          const minutes = Math.floor(diff / 60000) % 60;
          const seconds = Math.floor(diff / 1000) % 60;
          setText(countdown, days ? `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m` : `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`);
        };

        tick();
        window.__gdgNextSessionTimer = setInterval(() => { if (!document.hidden) tick(); }, 1000);
      })
      .catch((error) => {
        console.warn('[GDG SRU] Next Session request failed.', error);
        neutral();
      });
  }
  function renderLeaderboard(client) {
    if (!client) return;
    fetchLeaderboard(client).then(([mainResult, periodResult, sponsoredResult]) => {
      if (window.__GDG_SET_LEADERBOARD_DATA) {
        window.__GDG_SET_LEADERBOARD_DATA({
          main: mainResult.data || [],
          periods: periodResult.data || [],
          sponsored: sponsoredResult.data || []
        });
      }
    }).catch(error => {
      console.warn('[GDG SRU] Leaderboard query failed.', error);
    });
  }
  function isHomeRoute() { return isMultiPage() ? document.body.dataset.route === 'home' : (!location.hash || location.hash === '#home' || location.hash === '#about'); }
  async function updateHomeBlogs(client) {
    const homeGrid = $('.blog-home-grid');
    if (!homeGrid) return;
    const email = currentContactEmail || 'gdg@sru.edu.in';
    const renderEmpty = () => {
      homeGrid.classList.add('g16-row');
      homeGrid.innerHTML = `<div class="blog-latest-empty"><b>The first stories are on their way.</b><p>Have a build log, a tutorial or a lesson worth sharing? Pitch it to the team and it could be the first one featured here.</p><a class="btn" href="mailto:${esc(email)}?subject=GDG%20SRU%20blog%20idea">Pitch a story ↗</a></div>`;
    };
    if (!client) {
      renderEmpty();
      return;
    }
    try {
      const view = await fetchBlogs(client);
      if (view.error) { renderEmpty(); return; }
      const rows = (view.data || []).filter(b => safeUrl(b.external_url));
      if (rows.length) {
        homeGrid.classList.add('g16-row');
        homeGrid.innerHTML = rows.slice(0,3).map((b,i)=>window.GDG16 ? GDG16.blog({key:['b','g','y'][i%3],tag:b.category||'Community',title:b.title,text:b.description||'Read the article on its original site.',author:b.author||'GDG SRU',meta:'Read story ↗',href:safeUrl(b.external_url),image:safeUrl(b.image_url)||'',external:true},i) : '').join('');
      } else {
        renderEmpty();
      }
    } catch {
      renderEmpty();
    }
  }
  function updateHome(client) {
    rewriteNavigation();
    if ((isMultiPage() ? currentRouteKey() === 'leaderboard' : location.hash === '#leaderboard')) { renderLeaderboard(client); return; }
    if (isHomeRoute()) {
      updateNextSession(client);
      updateHomeBlogs(client);
    }
  }
  function installHomepageRefresh(client) {
    if (window.__GDG_HOME_REFRESH_INSTALLED__) return;
    window.__GDG_HOME_REFRESH_INSTALLED__ = true;
    const refreshNextSession = () => {
      if (!document.hidden && isHomeRoute()) {
        updateNextSession(client);
        updateHomeBlogs(client);
      }
    };
    // The homepage may already be open when an admin publishes an event in another tab.
    // Refresh on return to the tab and periodically, without re-rendering the whole homepage.
    window.addEventListener('focus', refreshNextSession);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshNextSession(); });
    window.__GDG_HOME_REFRESH_TIMER__ = window.setInterval(refreshNextSession, 60000);
  }
  const pageDecorated = new WeakSet();
  let currentContactEmail = '';
  let currentSecondaryContactEmail = '';
  let currentSettings = {};
  let currentClient = null;
  const colourFor = i => ['b','r','y','g'][i % 4];
  const whenText = (value, timezone='Asia/Kolkata') => {
    if (!value) return 'Date to be announced';
    try { return new Intl.DateTimeFormat('en-IN', { dateStyle:'medium', timeStyle:'short', timeZone:timezone }).format(new Date(value)); }
    catch { return new Date(value).toLocaleString(); }
  };
  function eventCard(e, i) {
    return window.GDG16 ? GDG16.ticket(e, i) : '';
  }

  function makeGoogleCalendarUrl(e) {
    if (!e || !e.start_at) return '';
    try {
      const start = new Date(e.start_at);
      const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 2 * 3600000);
      const formatUtc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const dates = `${formatUtc(start)}/${formatUtc(end)}`;
      const title = encodeURIComponent(e.title || 'GDG SRU Event');
      const details = encodeURIComponent((e.summary || e.description || '') + '\n\nOfficial RSVP: ' + (e.rsvp_url || e.registration_url || 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/'));
      const location = encodeURIComponent(e.venue || e.join_link || (e.event_mode === 'virtual' ? 'Online Session' : 'SR University, Warangal'));
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
    } catch { return ''; }
  }

  async function decorateEvents(client, root) {
    const routeSlug = window.__GDG_EVENT_SLUG || '';
    const renderEventDetail = (event) => {
      const intro = $('.page-intro', root);
      const eyebrow = intro && $('.eyebrow', intro);
      const heading = intro && $('h1', intro);
      const lead = intro && [...intro.querySelectorAll('p')].find(p => !p.classList.contains('eyebrow'));
      const detail = document.createElement('section'); detail.className = 'card pp runtime-event-detail';
      detail.style.cssText = 'max-width:960px;margin:20px 0 54px';
      if (!event) {
        if (eyebrow) eyebrow.textContent = 'EVENT DETAILS';
        if (heading) heading.textContent = window.__GDG_INVALID_EVENT_ROUTE ? 'Event Not Found' : 'Upcoming Session';
        if (lead) lead.textContent = window.__GDG_INVALID_EVENT_ROUTE ? 'This event link could not be found or has moved.' : 'Registration and session schedule details will be announced shortly.';
        detail.innerHTML = `<p class="cap">GDG SRU · EVENTS</p><h2>Explore Chapter Activities</h2><p>Visit the full chapter calendar to discover tech bootcamps, speaker sessions, and workshops at SR University.</p><a class="btn" href="/events/">Browse All Events ↗</a>`;
      } else {
        document.title = `${event.title} · GDG SRU`;
        const category = esc(event.category || 'Community event');
        const tz = event.timezone || 'Asia/Kolkata';
        const date = whenText(event.start_at, tz);
        const now = Date.now();
        const startTs = event.start_at ? new Date(event.start_at).getTime() : NaN;
        const endTs = event.end_at ? new Date(event.end_at).getTime() : startTs;
        const past = !isNaN(endTs) && endTs < now;
        const isLiveNow = !isNaN(startTs) && !isNaN(endTs) && startTs <= now && endTs >= now;

        const speakerName = event.speakers || event.speaker || '';
        const modeName = event.event_mode === 'virtual' ? 'Online Session' : (event.event_mode === 'hybrid' ? 'Hybrid Session' : 'In-Person (Campus)');
        const venueText = event.venue || (event.join_link || event.online_url ? 'Online' : modeName);
        const rsvpTarget = event.rsvp_url || event.registration_url || 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/';
        const isFallback = !event.rsvp_url && !event.registration_url;
        const calUrl = event.calendar_enabled !== false ? makeGoogleCalendarUrl(event) : '';
        const banner = safeUrl(event.banner_url || event.image_url);

        if (eyebrow) eyebrow.textContent = `${esc(String(event.category || 'COMMUNITY EVENT').toUpperCase())} · EVENT DETAILS`;
        if (heading) heading.textContent = event.title;
        if (lead) lead.textContent = `${date} · ${venueText}`;

        const tierLabel = event.event_tier === 'flagship' ? '★ Flagship Event' : (event.event_tier === 'program' ? '◷ Month-long Cohort' : 'Technical Session');
        const liveBadge = isLiveNow ? '<span class="status s-published" style="background:#ea4335;color:#fff;display:inline-flex;align-items:center;gap:6px"><span style="width:7px;height:7px;border-radius:50%;background:#fff;display:inline-block"></span> LIVE NOW</span>' : (past ? '<span class="status s-archived">Completed</span>' : '<span class="status s-published">Upcoming</span>');

        let actionsHtml = '';
        if (past) {
          if (event.certificates_ready) {
            actionsHtml += '<a class="btn" href="/certificates/" style="background:#34a853;color:#fff">Claim Certificate ↗</a>';
          }
          if (event.resource_url) {
            actionsHtml += `<a class="btn o" href="${esc(safeUrl(event.resource_url))}" target="_blank" rel="noopener noreferrer">Slides &amp; Code ↗</a>`;
          }
          actionsHtml += '<span class="muted" style="margin-left:8px;font-size:13px">This event has completed.</span>';
        } else {
          actionsHtml += `<a class="btn" href="${esc(rsvpTarget)}" target="_blank" rel="noopener noreferrer">${isLiveNow ? 'Join Live Session ↗' : (isFallback ? 'Chapter RSVP ↗' : 'RSVP on GDG Portal ↗')}</a>`;
          if (calUrl) actionsHtml += `<a class="btn o" href="${esc(calUrl)}" target="_blank" rel="noopener noreferrer">+ Add to Google Calendar</a>`;
          if (event.discord_channel_url) actionsHtml += `<a class="btn o" href="${esc(safeUrl(event.discord_channel_url))}" target="_blank" rel="noopener noreferrer">Discord Channel ↗</a>`;
          if (event.syllabus_url) actionsHtml += `<a class="btn o" href="${esc(safeUrl(event.syllabus_url))}" target="_blank" rel="noopener noreferrer">View Syllabus ↗</a>`;
        }

        let milestonesHtml = '';
        if (Array.isArray(event.program_milestones) && event.program_milestones.length) {
          milestonesHtml = `<div style="margin:24px 0;padding:18px;border:1px solid var(--ln);border-radius:14px;background:var(--cd)">
            <h4 style="margin:0 0 12px;font:700 13px/1 var(--f-mono,monospace);letter-spacing:.08em;text-transform:uppercase;color:var(--mut)">Weekly Program Milestones</h4>
            <ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:8px">
              ${event.program_milestones.map((m, idx) => `<li><b>Week ${m.week || idx + 1}:</b> <span>${esc(m.title || m)}</span></li>`).join('')}
            </ol>
          </div>`;
        }

        detail.innerHTML = `
          ${banner ? `<img src="${esc(banner)}" alt="${esc(event.title)}" loading="lazy" style="display:block;width:100%;max-height:420px;object-fit:cover;border-radius:18px;margin:0 0 24px">` : ''}
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
            <span class="cap" style="color:var(--b)">${esc(tierLabel)}</span>
            <span class="event-meta-divider">/</span>
            <span class="cap">${esc(modeName.toUpperCase())}</span>
            ${liveBadge}
          </div>
          <h2 style="font-size:clamp(28px,4vw,44px);margin:0 0 16px;letter-spacing:-.04em">${esc(event.title)}</h2>
          <div class="ef-fields" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;padding:16px 0;margin:16px 0 24px;border-top:1px solid var(--ln);border-bottom:1px solid var(--ln)">
            <div><small style="display:block;color:var(--mut);font-size:12px">Date &amp; time (IST)</small><b>${esc(date)}</b></div>
            <div><small style="display:block;color:var(--mut);font-size:12px">Venue / Mode</small><b>${esc(venueText)}</b></div>
            ${speakerName ? `<div><small style="display:block;color:var(--mut);font-size:12px">Speaker</small><b>${esc(speakerName)}</b></div>` : ''}
            <div><small style="display:block;color:var(--mut);font-size:12px">Platform</small><b>Official Google Community</b></div>
          </div>
          ${event.description ? `<div class="prose" style="font-size:16px;line-height:1.65;margin-bottom:24px">${esc(event.description).replace(/\n/g, '<br>')}</div>` : `<p style="font-size:16px;line-height:1.6;margin-bottom:24px">${esc(event.summary || 'Details for this session will be announced shortly.')}</p>`}
          ${milestonesHtml}
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:28px 0 16px">
            ${actionsHtml}
          </div>
          <div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--ln)">
            <a class="btn o" href="/events/">← Back to All Events</a>
          </div>
        `;
      }
      [...root.children].forEach(child => { if (child !== intro && child !== detail) { child.hidden = true; child.style.setProperty('display', 'none', 'important'); } });
      if (!detail.isConnected) root.appendChild(detail);
    };
    if (!client) { if (routeSlug || window.__GDG_INVALID_EVENT_ROUTE) renderEventDetail(null); return; }
    const view = await fetchEvents(client);
    if (view.error) { if (routeSlug) renderEventDetail(null); return; }
    const rows = view.data || [];
    if (window.__GDG_INVALID_EVENT_ROUTE) { renderEventDetail(null); return; }
    if (routeSlug) { renderEventDetail(rows.find(e => e.slug === routeSlug) || null); return; }

    function makeGoogleCalendarUrl(e) {
      if (!e.start_at) return '';
      try {
        const start = new Date(e.start_at);
        const end = e.end_at ? new Date(e.end_at) : new Date(start.getTime() + 2 * 3600000);
        const formatUtc = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
        const dates = `${formatUtc(start)}/${formatUtc(end)}`;
        const title = encodeURIComponent(e.title || 'GDG SRU Event');
        const details = encodeURIComponent((e.summary || e.description || '') + '\n\nOfficial RSVP: ' + (e.rsvp_url || e.registration_url || 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/'));
        const location = encodeURIComponent(e.venue || e.join_link || (e.event_mode === 'virtual' ? 'Online Session' : 'SR University, Warangal'));
        return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
      } catch { return ''; }
    }

    const now = Date.now();
    // ── Tier 1: Single Flagship Showcase Banner (Nearest Upcoming Flagship) ──
    const upcomingFlagships = rows.filter(e => e.event_tier === 'flagship' && (e.end_at ? new Date(e.end_at).getTime() >= now : e.start_at ? new Date(e.start_at).getTime() >= now : true));
    const flagship = upcomingFlagships.sort((a,b) => new Date(a.start_at||0) - new Date(b.start_at||0))[0] || rows.find(e => e.featured);

    const featureEl = $('.event-feature', root);
    if (flagship && featureEl) {
      const bannerImg = safeUrl(flagship.banner_url || flagship.image_url);
      const tz = flagship.timezone || 'Asia/Kolkata';
      const whenStr = flagship.start_at ? whenText(flagship.start_at, tz) : 'Date announced soon';
      const speakersText = String(flagship.speakers || flagship.speaker || '').trim();
      const modeText = flagship.event_mode === 'virtual' ? 'Online (Google Meet)' : flagship.event_mode === 'hybrid' ? 'Hybrid Session' : 'In-Person (Campus)';
      const venueText = flagship.venue || (flagship.join_link ? 'Online' : modeText);
      const rsvpTarget = flagship.rsvp_url || flagship.registration_url || 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/';
      const isFallback = !flagship.rsvp_url && !flagship.registration_url;
      const calUrl = flagship.calendar_enabled ? makeGoogleCalendarUrl(flagship) : '';
      const accent = ['blue','red','yellow','green'].includes(flagship.accent_color) ? flagship.accent_color : 'blue';
      const accentHex = { blue: '#4285f4', red: '#ea4335', yellow: '#fbbc04', green: '#34a853' }[accent];

      featureEl.className = `event-feature flagship-showcase-tier accent-${accent}`;
      featureEl.style.setProperty('--accent-col', accentHex);
      featureEl.innerHTML = `
        <div class="event-feature-main">
          <div class="event-feature-meta">
            <span class="event-live-dot" style="background:${accentHex}"></span>
            ${esc(String(flagship.category || 'FLAGSHIP EVENT').toUpperCase())} <span class="event-meta-divider">/</span> ${esc(modeText.toUpperCase())}
          </div>
          <h2>${esc(flagship.title)}</h2>
          <p>${esc(flagship.summary || flagship.description || 'Join Google Developer Group on Campus SR University for this flagship session.')}</p>
          <div class="ef-fields">
            <div><small><i style="background:#4285f4"></i>Date & time (IST)</small><b>${esc(whenStr)}</b></div>
            <div><small><i style="background:#ea4335"></i>Venue / Mode</small><b>${esc(venueText)}</b></div>
            <div><small><i style="background:#fbbc04"></i>Speaker</small><b>${esc(speakersText || 'To be announced')}</b></div>
            <div><small><i style="background:#34a853"></i>Platform</small><b>Official GDG Bevy Portal</b></div>
          </div>
          <div class="event-feature-actions">
            ${isFallback
              ? `<a class="btn" href="${esc(rsvpTarget)}" target="_blank" rel="noopener noreferrer">View Chapter Page ↗</a>`
              : `<a class="btn" href="${esc(rsvpTarget)}" target="_blank" rel="noopener noreferrer">RSVP on Official Portal ↗</a>`
            }
            ${calUrl ? `<a class="btn o" href="${esc(calUrl)}" target="_blank" rel="noopener noreferrer">+ Add to Google Calendar</a>` : ''}
          </div>
        </div>
        <div class="event-feature-side flagship-poster-side">
          ${bannerImg
            ? `<div class="flagship-poster-frame"><img src="${esc(bannerImg)}" alt="${esc(flagship.title)} poster" loading="lazy"></div>`
            : `<div class="flagship-poster-fallback"><span class="cap">FLAGSHIP SHOWCASE</span><b>${esc(flagship.title)}</b><p>Season 2026</p></div>`
          }
        </div>
      `;
    } else if (!flagship && featureEl) {
      // If no upcoming flagship event exists, gracefully hide the static placeholder
      featureEl.style.display = 'none';
    }

    // Pinned next session countdown timer for Home Page
    const pinned = rows.find(e => e.pinned_next_session && e.start_at && new Date(e.start_at) > new Date());
    window.__GDG_PINNED_EVENT = pinned || null;

    const formats = $('.event-formats', root);
    if (!formats) return;
    const section = document.createElement('section'); section.className = 'editorial-collections runtime-events';
    section.innerHTML = `
      <div class="editorial-collections-head">
        <div><span class="cap">CHAPTER CALENDAR</span><h2>Workshops, Talks & Programs.</h2></div>
        <p>Explore hands-on tech sessions, multi-week study jams, and bootcamps at SR University. All tickets and RSVPs are managed through Google's official community platform.</p>
      </div>
      <div class="filter-bar" style="margin:18px 0">
        <div class="segmented" role="group" aria-label="Event time">
          <button type="button" data-runtime-time="upcoming" aria-pressed="true">Upcoming</button>
          <button type="button" data-runtime-time="past" aria-pressed="false">Past Events</button>
        </div>
        <label>Category <select data-runtime-category><option value="all">All categories</option>${[...new Set(['Cloud','AI/ML','Web & Mobile','Open Source',...rows.map(e => e.category).filter(Boolean)])].map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div class="editorial-grid g16-row g16-tickets" data-runtime-events></div>
    `;
    formats.parentNode.insertBefore(section, formats);
    const out = $('[data-runtime-events]', section);

    const render = () => {
      const time = $('[data-runtime-time="past"]', section).getAttribute('aria-pressed') === 'true' ? 'past' : 'upcoming';
      const cat = $('[data-runtime-category]', section).value;
      const currentNow = Date.now();
      const filtered = rows.filter(e => {
        // Event counts as past when current time is later than end_at in IST
        const endTs = e.end_at ? new Date(e.end_at).getTime() : (e.start_at ? new Date(e.start_at).getTime() : 0);
        const isPast = endTs < currentNow;
        return (time === 'past' ? isPast : !isPast) && (cat === 'all' || e.category === cat);
      }).sort((a,b) => {
        const tA = new Date(a.start_at||0).getTime();
        const tB = new Date(b.start_at||0).getTime();
        return time === 'past' ? (tB - tA) : (tA - tB);
      });

      if (!filtered.length) {
        out.innerHTML = `<div class="event-vault-empty" style="grid-column:1/-1;width:100%;text-align:center;padding:48px 24px">
          <b style="font-size:20px;display:block;margin-bottom:8px">No ${time} events scheduled in this category.</b>
          <p class="muted" style="max-width:440px;margin:0 auto 20px">Check back for updates or join our community Discord to be the first to know about new sessions.</p>
          <a class="btn" href="https://discord.gg/htSJMNcdZs" target="_blank" rel="noopener noreferrer">Join Community Discord ↗</a>
        </div>`;
        return;
      }

      out.innerHTML = filtered.map((e, idx) => {
        if (e.event_tier === 'program' && window.GDG16?.program) {
          return window.GDG16.program(e, idx);
        }
        return window.GDG16 ? window.GDG16.ticket(Object.assign({}, e, { no: idx + 1 }), idx) : '';
      }).join('');
    };

    $$('[data-runtime-time]', section).forEach(b => b.addEventListener('click', () => {
      $$('[data-runtime-time]', section).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      render();
    }));
    $('[data-runtime-category]', section).addEventListener('change', render);
    render();
  }
  async function renderBlogSeries(client) {
    const box = $('#blog-series');
    if (!box || !window.GDG16) return;
    const section = box.closest('section');
    const hide = () => { if (section) section.style.display = 'none'; };
    if (!client) { hide(); return; }
    try {
      const r = await fetchBlogSeries(client);
      if (r.error || !(r.data || []).length) { hide(); return; }
      if (section) section.style.display = '';
      box.innerHTML = r.data.map((x, i) => window.GDG16.blog({
        key: ['b', 'g', 'y', 'r'].includes(x.color) ? x.color : 'b',
        tag: 'Series ' + String(i + 1).padStart(2, '0'),
        title: x.title, text: x.description || '',
        author: 'GDG SRU', meta: 'Open for stories ↗',
        href: 'mailto:gdg@sru.edu.in?subject=' + encodeURIComponent('GDG SRU blog idea: ' + x.title)
      }, i)).join('');
    } catch {
      hide();
    }
  }
  async function decorateBlogs(client, root) {
    renderBlogSeries(client);
    if (!client) return;
    const view = await fetchBlogs(client);
    if (view.error) return;
    const rows = (view.data || []).filter(b => safeUrl(b.external_url));
    const latest = $('[data-blog-latest]', root);
    if (latest && rows.length) {
      latest.classList.add('g16-row');
      latest.innerHTML = rows.map((b,i) => GDG16.blog({key:['b','g','y','r'][i%4],tag:b.featured?'Featured':(b.category||'Story'),title:b.title,text:b.description||'Open the original article to read the full story.',author:b.author||'GDG SRU',meta:'Read story \u2197',href:safeUrl(b.external_url),image:safeUrl(b.image_url)||'',external:true},i)).join('');
    }
    const homeGrid = $('.blog-home-grid');
    if (homeGrid && rows.length) { homeGrid.classList.add('g16-row'); homeGrid.innerHTML = rows.slice(0,3).map((b,i)=>GDG16.blog({key:['b','g','y'][i%3],tag:b.category||'Community',title:b.title,text:b.description||'Read the article on its original site.',author:b.author||'GDG SRU',meta:'Read story \u2197',href:safeUrl(b.external_url),image:safeUrl(b.image_url)||'',external:true},i)).join(''); }
  }
  // The team page is rendered by team-page.js straight from the database
  // (Mission Control → Team). Cards, departments and page copy are all editable there.
  function decorateTeam(client, root) {
    const host = $('[data-team-root]', root);
    if (host && window.GDGTeam) window.GDGTeam.mount(client, host);
  }
  function ensureResourceHubStyles() {
    if ($('#gdg-resource-hub-runtime-css')) return;
    const style=document.createElement('style');style.id='gdg-resource-hub-runtime-css';
    style.textContent=`.resource-hub-runtime{margin:36px 0 12px;color:var(--v8-ink,#202124)}.resource-hub-heading{margin:0 0 24px}.resource-hub-heading h2{margin:9px 0 10px;font-size:clamp(30px,4vw,46px);letter-spacing:-.06em}.resource-hub-heading p,.resource-section-head p{max-width:66ch;color:var(--v8-muted,#5f6368);line-height:1.65}.resource-hub-tabs{display:flex;gap:10px;flex-wrap:wrap;margin:18px 0 26px;border-bottom:1px solid var(--v8-line,#e3e6eb);padding-bottom:12px}.resource-hub-tabs button{display:inline-flex;gap:10px;align-items:center;padding:10px 15px;border:1px solid var(--v8-line,#e3e6eb);border-radius:10px;background:var(--v8-paper,#fff);color:var(--v8-ink,#202124);font:inherit;font-size:14px;font-weight:700;cursor:pointer}.resource-hub-tabs button[aria-selected=true]{background:var(--v8-ink,#202124);border-color:var(--v8-ink,#202124);color:#fff}.resource-hub-tabs button span{display:grid;place-items:center;min-width:22px;height:22px;padding:0 5px;border-radius:99px;background:#80808020;font-size:11px}.resource-section-head{margin-bottom:16px}.resource-section-head h3{font-size:clamp(23px,3vw,30px)}.resource-runtime-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px;align-items:stretch}.resource-runtime-card{min-width:0;min-height:320px;perspective:1000px}.resource-card-inner{position:relative;display:grid;grid-template:1fr/1fr;min-height:320px;height:100%;transform:rotateY(0);transform-style:preserve-3d;transition:transform .52s cubic-bezier(.2,.72,.2,1)}.resource-runtime-card.is-flipped .resource-card-inner{transform:rotateY(180deg)}.resource-card-face{grid-area:1/1;min-width:0;min-height:320px;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--v8-line,#e2e6eb);border-radius:20px;background:var(--v8-paper,#fff);box-shadow:0 8px 24px #2021240b;-webkit-backface-visibility:hidden;backface-visibility:hidden}.resource-card-front{display:grid;grid-template-columns:minmax(100px,.48fr) minmax(0,1fr)}.resource-card-face[hidden]{display:none}.resource-runtime-card .perk-card-art{min-width:0;min-height:100%;margin:0;border-radius:0;background:linear-gradient(150deg,#eef3fd,#f7f7f4);color:var(--v8-ink,#202124)}.resource-runtime-card .perk-card-art>span{display:grid;place-items:center;width:54px;height:54px;border-radius:15px;background:#fff;color:#4285f4;font-size:28px;overflow:hidden}.resource-runtime-card .perk-card-art img{width:100%;height:100%;object-fit:contain}.resource-runtime-card .perk-card-art small{line-height:1.5}.resource-runtime-card .perk-card-copy{padding:19px;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:8px}.resource-runtime-card .perk-card-copy h3{font-size:20px;line-height:1.2;overflow-wrap:anywhere}.resource-runtime-card .perk-card-copy p{font-size:14px;line-height:1.55;color:var(--v8-muted,#5f6368)}.resource-runtime-card .perk-kind{font:700 10px/1.5 DM Mono,monospace;text-transform:uppercase;letter-spacing:.07em;color:var(--v8-muted,#5f6368)}.resource-runtime-card .btn{margin:auto 0 0;border-radius:10px;padding:9px 14px;font-size:13px}.resource-card-back{transform:rotateY(180deg);padding:22px;gap:10px}.resource-card-back h3{font-size:22px;line-height:1.2;overflow-wrap:anywhere}.resource-card-back p{font-size:14px;line-height:1.55;color:var(--v8-muted,#5f6368)}.resource-card-back .btn{align-self:flex-start;margin-top:auto}.resource-back-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.resource-back-button{border:1px solid var(--v8-line,#e2e6eb);border-radius:10px;background:#fff;padding:7px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}.resource-runtime-card :focus-visible,.resource-hub-tabs button:focus-visible{outline:3px solid #4285f4;outline-offset:3px}@media(max-width:720px){.resource-runtime-grid{grid-template-columns:1fr}.resource-card-front{grid-template-columns:104px minmax(0,1fr)}.resource-card-face,.resource-card-inner,.resource-runtime-card{min-height:300px}.resource-runtime-card .perk-card-copy{padding:16px}}@media(prefers-reduced-motion:reduce){.resource-card-inner{transition:none!important;transform:none!important}.resource-runtime-card.is-flipped .resource-card-inner{transform:none!important}.resource-card-back{display:none}.resource-runtime-card.is-flipped .resource-card-front{display:none}.resource-runtime-card.is-flipped .resource-card-back{display:flex;transform:none}}`;
    document.head.append(style);
  }
  function accessLabel(type) { return ({free:'Free',free_tier:'Free tier',student_access:'Student access',restricted:'Access required'})[type]||'Resource'; }
  async function decorateResources(client, root) {
    ensureResourceHubStyles();
    const host=$('[data-fs]',root); if(!host)return;
    const showResourceStatus = (title, detail) => {
      host.outerHTML=`<section class="resource-hub-runtime"><div class="event-vault-empty"><b>${esc(title)}</b><p>${esc(detail)}</p></div></section>`;
    };
    if (!client) {
      showResourceStatus('Resources are coming soon.', 'Published resources will appear here.');
      return;
    }
    let view;
    try { view=await fetchResources(client); }
    catch (error) { console.warn('[GDG SRU] Resource Hub request failed.', error); showResourceStatus('Resources could not be loaded.', 'Please try again later.'); return; }
    if(view.error) { console.warn('[GDG SRU] Resource Hub query failed.', view.error); showResourceStatus('Resources could not be loaded.', 'Please try again later.'); return; }
    const rows=view.data||[];
    const external=rows.filter(r=>r.kind==='external'), gdg=rows.filter(r=>r.kind==='gdg');
    const makeCards=(items, section)=>items.length?items.map((r,i)=>{
      const image=safeUrl(r.image_url), url=safeUrl(r.destination_url), access=accessLabel(r.access_type);
      const steps=[`Access: ${access}.`];
      if(r.eligibility)steps.push(`Eligibility: ${r.eligibility}`);
      if(r.limitations)steps.push(`Limitations: ${r.limitations}`);
      steps.push(url?(section==='gdg'?'Open the material with the button above.':'Visit the resource with the button above.'):'The resource link will be added shortly.');
      return GDG16.perk({kind:r.category||r.resource_type||'Resource',title:r.title,text:r.description||'Explore this resource.',tags:[access,r.resource_type&&r.resource_type!==r.category?r.resource_type:''],chip:section==='external'?'Student resource':'GDG SRU library',live:access,url:url,cta:section==='gdg'?'Open material':'Visit resource',steps:steps,image:image||'',note:''},i);
    }).join(''):'<div class="event-vault-empty"><b>No published resources yet.</b><p>The chapter team will add resources here as they become available.</p></div>';
    host.outerHTML=`<section class="resource-hub-runtime"><div class="resource-hub-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-resource-tab="external">Free Resources <span>${external.length}</span></button><button type="button" role="tab" aria-selected="false" data-resource-tab="gdg">GDG SRU Library <span>${gdg.length}</span></button></div><section class="resource-section-runtime" data-resource-panel="external"><div class="resource-section-head"><h2 class="resource-section-title">Free Resources</h2><p>Tools, courses, creative resources, career help, and more.</p></div><div class="resource-runtime-grid g16-row g16-perks">${makeCards(external,'external')}</div></section><section class="resource-section-runtime" data-resource-panel="gdg" hidden><div class="resource-section-head"><h2 class="resource-section-title">GDG SRU Library</h2><p>Presentations, videos, notes, and materials shared from our events.</p></div><div class="resource-runtime-grid g16-row g16-perks">${makeCards(gdg,'gdg')}</div></section></section>`;
    const hub=$('.resource-hub-runtime',root);
    $$('[data-resource-tab]',hub).forEach(button=>button.addEventListener('click',()=>{
      const tab=button.dataset.resourceTab; $$('[data-resource-tab]',hub).forEach(b=>b.setAttribute('aria-selected',String(b===button)));
      $$('[data-resource-panel]',hub).forEach(panel=>panel.hidden=panel.dataset.resourcePanel!==tab);
    }));
    $$('[data-resource-flip]',hub).forEach(button=>button.addEventListener('click',()=>{
      const card=button.closest('.resource-runtime-card'), on=!card.classList.contains('is-flipped');card.classList.toggle('is-flipped',on);
      const front=$('.resource-card-front',card), back=$('.resource-card-back',card);front.inert=on;front.setAttribute('aria-hidden',String(on));back.inert=!on;back.setAttribute('aria-hidden',String(!on));
    }));
  }
  function decoratePrivacy(root, email) {
    const card=$('.card.pp',root); if(!card)return;
    const contact=String(email||siteDefaults().contactEmail||'');
    card.innerHTML=`<h2>Information we handle</h2><p>Depending on the event, GDG SRU may process the student name, university roll number, email address, and department supplied during registration and verified at event check-in. The source registration platforms maintain their own independent privacy notices.</p><h3>Certificates & on-demand issuing</h3><p>To check eligibility, the certificate portal compares the student name and identifier (roll number or email) entered against the confirmed attendance roster uploaded by authorized chapter leads. Certificate artwork is rendered on demand inside the attendee’s browser using client-side canvas and vector rendering. The website does not store pre-rendered certificate image files.</p><p>To prevent automated enumeration and rate-limit abuse, the certificate verification endpoint uses a salted one-way hash of the requester’s network address and event ID. Personal attendee names are never recorded in rate-limiting counters, and counters expire automatically within 15 minutes.</p><h3>Data retention & automatic purge</h3><p>Attendance records and certificate verification records are kept for one year after the event date and then deleted automatically by scheduled maintenance jobs.</p><h3>Leaderboard & community points</h3><p>Public leaderboards display only the student’s registered name, points, and community rank. Email addresses, phone numbers, and private academic details are never exposed publicly.</p><h3>Cookies & local storage</h3><p>This website uses essential browser storage (such as localStorage for dark/light theme preference) strictly necessary for site functionality. No third-party advertising cookies or trackers are used.</p><h3>Your questions</h3><p>For privacy questions or applicable correction or deletion requests, contact <a href="mailto:${esc(contact)}">${esc(contact)}</a>.</p>`;
  }
  const loadCertEngine = () => {
    if (!document.getElementById('gdg-cert-fonts')) {
      const link = document.createElement('link');
      link.id = 'gdg-cert-fonts';
      link.rel = 'stylesheet';
      // Self-hosted cert fonts — also loaded inside iframe by cert-engine via base64 data URIs
      link.href = '/assets/fonts/cert-fonts.css?v=20261025';
      document.head.appendChild(link);
    }
    return window.GDGCert ? Promise.resolve() : new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = '/assets/js/cert-engine.js?v=20261025-selfhost';
      s.onload = resolve;
      s.onerror = () => reject(new Error('Certificate tools are unavailable right now. Please try again later.'));
      document.head.appendChild(s);
    });
  };
  async function decorateCertificates(client, root) {
    const form=$('#cf',root), result=$('#res',root); if(!form||!result)return;

    // Certificates are created on demand from the uploaded attendance list; nothing is stored.
    form.innerHTML=`<h2>Get your certificate</h2><p>Choose the event you attended, then type your name. If the event registered your roll number or email, enter it as well. If you are on the attendance list, your certificate is created right here.</p><label for="gdg-cert-event"><b>Event</b></label><select id="gdg-cert-event" required><option value="">Choose an event</option></select><label for="gdg-cert-name"><b>Your name</b></label><input id="gdg-cert-name" type="text" autocomplete="name" required minlength="3" maxlength="120" placeholder="Full name as registered"><label for="gdg-cert-id"><b>Roll number or email</b> <span class="muted small" style="font-weight:normal">(optional for name-only sessions)</span></label><input id="gdg-cert-id" type="text" autocomplete="off" maxlength="80" placeholder="Roll number or email (optional if name only)"><button class="btn" type="submit">Create my certificate →</button><p class="muted small">Your certificate is generated in your browser and is not stored on our servers. Anyone can check a certificate ID on the <a href="/verify/">verification page</a>.</p>`;
    result.innerHTML='';
    if(!client){result.innerHTML='<p class="muted">Certificates will be available after the website is connected to its database.</p>';return;}
    const select=$('#gdg-cert-event',form), nameInput=$('#gdg-cert-name',form), idInput=$('#gdg-cert-id',form), submit=$('button[type=submit]',form);
    let certEvents = [];
    try {
      const { data: rEvents } = await client.rpc('list_certificate_events');
      if (Array.isArray(rEvents) && rEvents.length) certEvents = rEvents;
    } catch (_) { console.warn('[App] Operation notice:', _); }

    if(!certEvents.length){
      select.disabled=true;nameInput.disabled=true;idInput.disabled=true;submit.disabled=true;
      result.innerHTML=`<div class="event-vault-empty" role="status" style="margin-top:20px;text-align:center;padding:32px 20px"><div style="font-size:36px;margin-bottom:8px">📜</div><b style="font-size:18px;display:block;margin-bottom:6px">Certificates will open after event rosters are published</b><p style="max-width:540px;margin:0 auto 16px;color:var(--mut);font-size:14px;line-height:1.6">Event certificates are issued on-demand from confirmed attendance rosters. Once organizers publish attendance for workshops, you will be able to claim your certificate here.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn sm" href="/events/">Browse upcoming events →</a><a class="btn o sm" href="/verify/">Verify a credential →</a></div></div>`;
    } else {
      select.disabled=false;nameInput.disabled=false;idInput.disabled=false;submit.disabled=false;
      select.innerHTML = '<option value="">Choose an event</option>' + certEvents.map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault(); e.stopPropagation();
      const eventId=select.value, name=nameInput.value.trim().replace(/\s+/g,' '), rawId=idInput.value.trim();
      const identifier = rawId || name;
      if(!eventId||name.length<3){result.innerHTML='<p role="alert">Choose an event and enter your full name.</p>';return;}
      submit.disabled=true; const label=submit.textContent; submit.textContent='Checking…'; result.innerHTML='';
      try{
        let claim = null;
        try {
          const { data: cData, error: fnErr } = await client.functions.invoke('claim-certificate', {
            body: { event_id: eventId, name, identifier: rawId }
          });
          if (!fnErr && cData) {
            claim = cData;
          } else {
            console.warn('[GDG Cert] Edge function unavailable, attempting direct RPC fallback:', fnErr);
            const { data: rpcData, error: rpcErr } = await client.rpc('claim_certificate', {
              p_event_id: eventId,
              p_name: name,
              p_identifier: rawId || null
            });
            if (!rpcErr) {
              claim = rpcData ? { found: true, certificate: rpcData } : { found: false };
            } else {
              console.warn('[GDG Cert] RPC fallback error:', rpcErr);
              if (fnErr?.status === 429) {
                result.innerHTML = '<div class="event-vault-empty" role="status"><b>Too many verification attempts</b><p style="margin:6px 0;font-size:14px">To protect attendee records, this network has exceeded the temporary check limit. Please wait a few minutes before trying again.</p></div>';
                return;
              }
              result.innerHTML = '<div class="event-vault-empty" role="status"><b>Verification temporarily unavailable</b><p style="margin:6px 0;font-size:14px">Please try again in a few moments or contact chapter organizers.</p></div>';
              return;
            }
          }
        } catch (invokeErr) {
          console.warn('[GDG Cert] Invoke error, attempting direct RPC fallback:', invokeErr);
          try {
            const { data: rpcData, error: rpcErr } = await client.rpc('claim_certificate', {
              p_event_id: eventId,
              p_name: name,
              p_identifier: rawId || null
            });
            if (!rpcErr) {
              claim = rpcData ? { found: true, certificate: rpcData } : { found: false };
            } else {
              result.innerHTML = '<p role="alert">We could not check right now. Please try again in a moment.</p>';
              return;
            }
          } catch {
            result.innerHTML = '<p role="alert">We could not check right now. Please try again in a moment.</p>';
            return;
          }
        }
        if(!claim?.found||!claim?.certificate){
          const mail=typeof currentContactEmail==='string'&&currentContactEmail?` or write to <a href="mailto:${esc(currentContactEmail)}">${esc(currentContactEmail)}</a>`:'';
          result.innerHTML=`<div class="event-vault-empty" role="status"><b>We couldn't find that name in the attendance roster for this event.</b><p>Check the spelling and the event, using the name, roll number or email you registered with${mail}. If multiple attendees have the same name, ask the organisers to correct the attendance list.</p></div>`;return;
        }
        const data=claim.certificate;
        try {
          const tRes = await fetch('/assets/data/certificate-default-template.html');
          if (tRes.ok) data.template_html = await tRes.text();
        } catch (tErr) {
          console.warn('Could not load master certificate template:', tErr);
        }
        if (!data.template_html) {
          result.innerHTML = '<p role="alert">Could not load certificate template. Please try again later.</p>';
          return;
        }
        await loadCertEngine();
        const built=window.GDGCert.buildDocument(data);
        const verifyUrl = `${location.origin}/verify/?code=${encodeURIComponent(data.credential_id)}`;
        const issueDate = new Date(data.event_start || Date.now());
        const linkedInCertUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent((data.event_title || 'GDG') + ' Certificate')}&organizationName=${encodeURIComponent('Google Developer Groups')}&issueYear=${issueDate.getFullYear()}&issueMonth=${issueDate.getMonth() + 1}&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(data.credential_id)}`;
        const postCaption = `🎓 Excited to share that I have earned my Certificate of Participation for "${data.event_title}" from Google Developer Group on Campus SR University!\n\n📜 Credential ID: ${data.credential_id}\n🔗 Verify Credential: ${verifyUrl}\n\nGrateful to the Google Developer Group on Campus SR University team and mentors for the incredible learning experience!\n\n#GoogleDeveloperGroups #GDGSRU #SRUniversity #StudentDevelopers #ContinuousLearning #TechCommunity`;

        result.innerHTML=`<div class="card pp" style="margin-top:20px;border-top:4px solid var(--b)"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px"><span class="tag t3">✓ VERIFIED CREDENTIAL</span><span class="cap" style="font-size:12px">Credential ID: <b>${esc(data.credential_id)}</b></span></div><h3 style="margin:0 0 6px">Your certificate is ready</h3><p style="margin:0 0 16px;color:var(--mut)">Awarded to <b>${esc(data.recipient_name)}</b> · <b>${esc(data.event_title)}</b></p><div id="gdg-cert-preview" aria-label="Certificate preview"></div><div class="gdg-cert-actions" style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button class="btn" type="button" id="gdg-cert-pdf">Download PDF</button><button class="btn o" type="button" id="gdg-cert-png">Download image (.PNG)</button><button class="btn o" type="button" id="gdg-cert-linkedin" style="background:#0a66c2;border-color:#0a66c2;color:#fff">Share to LinkedIn</button><a class="btn o" id="gdg-cert-linkedin-add" target="_blank" rel="noopener" href="${linkedInCertUrl}">+ Add to LinkedIn Profile</a></div><div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--ln);display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:13px;color:var(--mut)"><span>Verification link: <a href="/verify/?code=${encodeURIComponent(data.credential_id)}" target="_blank">${esc(location.host)}/verify/?code=${esc(data.credential_id)}</a></span><button type="button" class="btn o sm" id="gdg-cert-copy-btn" style="padding:4px 10px;font-size:12px">Copy link</button><a href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Earned my certificate for ' + data.event_title + ' from @gdgsru! 🎓')}&url=${encodeURIComponent(verifyUrl)}" target="_blank" rel="noopener" style="color:inherit">Share on 𝕏</a><a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Earned my certificate for ' + data.event_title + ' from GDG SRU! Verify: ' + verifyUrl)}" target="_blank" rel="noopener" style="color:inherit">WhatsApp</a></div><div id="gdg-share-assistant" style="display:none;margin-top:16px;background:var(--cd);border:1.5px solid var(--b);border-radius:12px;padding:16px;box-shadow:var(--sh)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="color:var(--b);font-size:15px">🎉 Ready for LinkedIn!</b><button type="button" id="gdg-share-close" style="background:none;border:none;cursor:pointer;color:var(--mut);font-size:16px" aria-label="Close">✕</button></div><p style="font-size:13px;margin:0 0 10px;line-height:1.5"><b>1.</b> Your certificate banner has been downloaded to your device <i>(and copied to clipboard)</i>.<br><b>2.</b> Your brag post caption has been copied to your clipboard.<br><b>3.</b> In the LinkedIn tab, simply paste (<b>Ctrl+V</b>) your caption and attach your downloaded banner!</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn o sm" id="gdg-copy-caption-again">📋 Copy caption again</button><button type="button" class="btn o sm" id="gdg-redownload-banner">🖼️ Download banner again</button><a class="btn sm" href="${linkedInCertUrl}" target="_blank" rel="noopener">💼 Add to LinkedIn Profile</a></div></div><p id="gdg-cert-note" class="muted small" role="status" style="margin-top:10px"></p></div>`;

        const frame=await window.GDGCert.mount($('#gdg-cert-preview',result),built.html), file=data.credential_id, note=$('#gdg-cert-note',result);
        const fileTitle = `${data.event_title || 'GDG'}_${data.recipient_name || 'Certificate'}`;
        const run=async(btn,fn)=>{btn.disabled=true;note.textContent='Preparing your file…';try{await fn(frame,fileTitle);note.textContent='';}catch(err){note.textContent='The download could not be created. Please try again, or use a different browser.';}finally{btn.disabled=false;}};
        $('#gdg-cert-pdf',result).addEventListener('click',ev=>run(ev.currentTarget,window.GDGCert.downloadPdf));
        $('#gdg-cert-png',result).addEventListener('click',ev=>run(ev.currentTarget,window.GDGCert.downloadPng));

        // LinkedIn Share Button
        const linkedInBtn = $('#gdg-cert-linkedin', result);
        if (linkedInBtn) {
          linkedInBtn.addEventListener('click', async () => {
            linkedInBtn.disabled = true;
            note.textContent = 'Preparing certificate banner and opening LinkedIn…';
            try {
              try { await window.GDGCert.downloadPng(frame, fileTitle); } catch (e) { console.warn('PNG download failed:', e); }
              try { await window.GDGCert.copyPngToClipboard(frame); } catch (e) { console.warn('[App] Operation notice:', e); }
              try {
                if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(postCaption);
                }
              } catch (e) { console.warn('Clipboard copy failed:', e); }
              const feedUrl = 'https://www.linkedin.com/feed/?shareActive=true&text=' + encodeURIComponent(postCaption);
              try { window.open(feedUrl, '_blank', 'noopener,noreferrer'); } catch (e) { console.warn('[App] Operation notice:', e); }
              const assistant = $('#gdg-share-assistant', result);
              if (assistant) {
                assistant.style.display = 'block';
                assistant.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              }
              note.textContent = 'Certificate banner downloaded and post caption ready for LinkedIn!';
            } catch (err) {
              console.warn('[GDG Cert] LinkedIn sharing helper error:', err);
              note.textContent = 'Please use "Download image" button and share manually.';
            } finally {
              linkedInBtn.disabled = false;
            }
          });
        }

        // Copy Link Button
        $('#gdg-cert-copy-btn', result)?.addEventListener('click', async (ev) => {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(verifyUrl);
            const btn = ev.currentTarget;
            const orig = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = orig, 2000);
          }
        });

        // Assistant Buttons
        $('#gdg-share-close', result)?.addEventListener('click', () => {
          const a = $('#gdg-share-assistant', result);
          if (a) a.style.display = 'none';
        });
        $('#gdg-copy-caption-again', result)?.addEventListener('click', async (ev) => {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(postCaption);
            const btn = ev.currentTarget;
            const orig = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => btn.textContent = orig, 2000);
          }
        });
        $('#gdg-redownload-banner', result)?.addEventListener('click', () => {
          window.GDGCert.downloadPng(frame, fileTitle);
        });

      }catch(err){result.innerHTML='<p role="alert">Something went wrong while creating your certificate. Please try again.</p>';}
      finally{submit.disabled=false;submit.textContent=label;}
    });
  }
  async function decorateVerification(client, root) {
    const page = (root && root.matches && root.matches('.page-verify')) ? root : $('.page-verify',root); if(!page)return;
    const verifyPathMatch=location.pathname.match(/^\/verify\/([^/]+)\/?$/); const hashPart=(isMultiPage() ? (window.__GDG_VERIFICATION_CODE || new URL(location.href).searchParams.get('code') || (verifyPathMatch ? decodeURIComponent(verifyPathMatch[1]) : '')) : decodeURIComponent(location.hash.split('/').slice(1).join('/')||'')).trim();
    const id=hashPart ? hashPart.toUpperCase() : '';
    const intro=$('.page-intro',page);
    const main=`<section class="card pp" style="margin-top:24px;max-width:760px"><h2>Verify a GDG SRU certificate</h2><p>Enter the certificate ID printed on the document or open the verification link supplied with it.</p><form id="gdg-verify-form"><label for="gdg-verify-id"><b>Certificate ID</b></label><input id="gdg-verify-id" required autocomplete="off" autocapitalize="characters" placeholder="GDGSRU-ABC123…" value="${esc(id)}"><button class="btn" type="submit">Verify certificate →</button></form><div id="gdg-verify-result" aria-live="polite"></div></section>`;
    const old=$('#vcard-async-box',page); if(old) old.remove();
    const existing=$('.gdg-runtime-verification',page);if(existing)return;
    const wrap=document.createElement('div');wrap.className='gdg-runtime-verification';wrap.innerHTML=main;page.appendChild(wrap);
    const form=$('#gdg-verify-form',wrap), out=$('#gdg-verify-result',wrap);
    const renderVerifiedRow = (row, code) => {
      const verifyUrl = `${location.origin}/verify/?code=${encodeURIComponent(code)}`;
      const profileUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent((row.event_title || 'GDG') + ' Certificate')}&organizationName=${encodeURIComponent('Google Developer Groups')}&issueYear=${new Date().getFullYear()}&issueMonth=${new Date().getMonth() + 1}&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(code)}`;
      out.innerHTML=`
        <div class="card pp" style="margin-top:18px;border-left:5px solid ${row.status==='verified'?'var(--g)':'var(--r)'}">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px">
            <span class="tag ${row.status==='verified'?'t3':'t2'}">${row.status==='verified'?'✓ OFFICIALLY VERIFIED':'REVOKED CREDENTIAL'}</span>
            <span class="cap" style="font-size:12px">Credential ID: <b>${esc(code)}</b></span>
          </div>
          <h3 style="margin:0 0 6px">${row.status==='verified'?'Certificate verified successfully':'Certificate status: Revoked'}</h3>
          <p style="margin:0 0 16px;color:var(--mut)">Officially registered with <b>Google Developer Group on Campus · SR University</b>.</p>
          
          <div style="background:var(--cd);padding:14px 18px;border-radius:12px;border:1px solid var(--ln);margin-bottom:16px">
            <div style="margin-bottom:6px"><b>Recipient:</b> <span style="font-size:17px;font-weight:700;color:var(--b)">${esc(row.recipient_name)}</span></div>
            <div style="margin-bottom:6px"><b>Event:</b> <span>${esc(row.event_title)}</span></div>
            ${row.event_date ? `<div style="margin-bottom:6px"><b>Event Date:</b> <span>${esc(row.event_date)}</span></div>` : ''}
            <div><b>Status:</b> <span style="color:${row.status==='verified'?'var(--g)':'var(--r)'};font-weight:700">${row.status==='verified'?'Active & authentic':'Revoked by chapter administration'}</span></div>
            ${row.details_updated_at ? `<div style="margin-top:8px;font-size:12px;color:var(--mut)"><b>Details last updated:</b> <span>${new Date(row.details_updated_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>` : ''}
          </div>

          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <button type="button" class="btn o sm" id="gdg-copy-vlink">🔗 Copy verification link</button>
            ${row.status==='verified'?`<a class="btn o sm" target="_blank" rel="noopener" href="${profileUrl}">💼 Add to LinkedIn Profile</a>`:''}
            <a class="btn sm" href="/certificates/">Get your own certificate →</a>
          </div>
          <p id="gdg-vlink-note" class="muted small" role="status" style="margin-top:8px"></p>
        </div>`;
      $('#gdg-copy-vlink', out)?.addEventListener('click', async (ev) => {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(verifyUrl);
          const btn = ev.currentTarget;
          const orig = btn.textContent;
          btn.textContent = '✓ Copied!';
          setTimeout(() => btn.textContent = orig, 2000);
        }
      });
    };
    const run=async code=>{
      if(!client){out.innerHTML='<p role="alert">Certificate verification is unavailable right now. Please try again later.</p>';return;}
      out.innerHTML='<p class="muted">Checking the official registry…</p>';
      const {data,error}=await client.rpc('verify_certificate',{p_code:code});
      const row=Array.isArray(data)?data[0]:data;
      if(error||!row){
        out.innerHTML=`<div class="event-vault-empty" role="status" style="margin-top:16px"><b>Certificate not found.</b><p>We could not find an active certificate matching <code>${esc(code)}</code>. Double check the ID, or visit the <a href="/certificates/">Certificates page</a> to claim your credential.</p></div>`;
        return;
      }
      renderVerifiedRow(row, code);
    };
    form.addEventListener('submit',e=>{e.preventDefault();run($('#gdg-verify-id',form).value.trim().toUpperCase());});
    if(id) run(id);
  }
  function decorateCurrentPage(client, contactEmail=currentContactEmail) {
    const app=$('#app');if(!app)return;
    contactEmail = contactEmail || currentContactEmail;
    const root = $('.page-events',app); if(root&&!pageDecorated.has(root)){pageDecorated.add(root);decorateEvents(client,root);}
    const blogRoot=$('.page-blogs',app);if(blogRoot&&!pageDecorated.has(blogRoot)){pageDecorated.add(blogRoot);decorateBlogs(client,blogRoot);}
    const teamRoot=$('.page-team',app);if(teamRoot&&!pageDecorated.has(teamRoot)){pageDecorated.add(teamRoot);decorateTeam(client,teamRoot);}
    const resourceRoot=$('.page-perks',app);if(resourceRoot&&!pageDecorated.has(resourceRoot)){pageDecorated.add(resourceRoot);decorateResources(client,resourceRoot);}
    const privacyRoot=$('.page-privacy',app);if(privacyRoot&&!pageDecorated.has(privacyRoot)){pageDecorated.add(privacyRoot);decoratePrivacy(privacyRoot,contactEmail);}
    const certRoot=$('.page-certificates',app);if(certRoot&&!pageDecorated.has(certRoot)){pageDecorated.add(certRoot);decorateCertificates(client,certRoot);}
    const verifyRoot=$('.page-verify',app);if(verifyRoot&&!pageDecorated.has(verifyRoot)){pageDecorated.add(verifyRoot);decorateVerification(client,verifyRoot);}
  }
  function setUpObservers(client) {
    if (!isMultiPage()) window.addEventListener('hashchange', () => {
      if (/^\/events\/[^/]+$/.test(location.pathname) && location.hash !== '#events') { delete window.__GDG_EVENT_SLUG; delete window.__GDG_INVALID_EVENT_ROUTE; }
      rewriteNavigation(); setTimeout(() => { updateHome(client); decorateCurrentPage(client); }, 100);
    });
  }
  function updateMainMenuSocials(email) {
    const side = $('.menu-side');
    if (!side) return;
    if (email) {
      $$('a[href^="mailto:"]', side).forEach(a => a.href = `mailto:${email}`);
      $$('a', side).forEach(a => { if (a.textContent.includes('gdg@sru.edu.in')) a.textContent = email; });
    }
  }
  function startWithConfig() {
    // supabase-js and config.js load in parallel and never block rendering.
    const loadScript = (src) => new Promise((resolve) => {
      const el = document.createElement('script'); el.src = src; el.async = true;
      el.onload = () => resolve(true); el.onerror = () => resolve(false);
      document.head.appendChild(el);
    });
    const SUPABASE_JS = '/assets/js/vendor/supabase.js';
    const sdkReady = window.supabase?.createClient ? Promise.resolve(true) : loadScript(SUPABASE_JS);
    Promise.all([loadScript('/config.js'), sdkReady]).then(([configOk]) => {
      if (!configOk) { console.warn('[GDG SRU] Supabase configuration is missing. Add site/config.js before enabling live data.'); renderHomeTracks([]); return; }
      const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
      if (!url || !key || /YOUR-PROJECT|YOUR-ANON-KEY|placeholder/i.test(`${url} ${key}`) || !window.supabase?.createClient) {
        const fallbackEmail = siteDefaults().contactEmail || '';
        const applyFallback = () => {
          renderHomeTracks([]);
          rewriteNavigation(); rewriteSettingsLinks(DEFAULTS(), fallbackEmail); renderJoinSocialCards(DEFAULTS());
          applySecondaryContactEmail(siteDefaults().secondaryContactEmail || '');
          updateMainMenuSocials(fallbackEmail); decorateCurrentPage(null, fallbackEmail);
          updateHomeBlogs(null);
        };
        applyFallback();
        const appRoot=$('#app'); if(appRoot) new MutationObserver(applyFallback).observe(appRoot,{childList:true});
        if (!isMultiPage()) window.addEventListener('hashchange',()=>{ if (/^\/events\/[^/]+$/.test(location.pathname) && location.hash !== '#events') { delete window.__GDG_EVENT_SLUG; delete window.__GDG_INVALID_EVENT_ROUTE; } setTimeout(applyFallback,80); });
        return;
      }
      let client;
      try { client = window.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); window.supabaseClient = client; }
      catch (error) { console.warn('[GDG SRU] Supabase configuration could not be read.', error); renderHomeTracks([]); return; }
      const apply = async () => {
        let settings = {};
        try {
          const { data, error } = await fetchCached('site_settings', () => client.from('public_site_settings').select('key,value'));
          if (!error) settings = Object.fromEntries((data || []).map(r => [r.key, r.value]));
        } catch (error) { console.warn('[GDG SRU] Shared settings not available.', error); }
        const configuredSocials = Array.isArray(settings.social_links) ? settings.social_links : [];
        const socials = DEFAULTS().map(d => ({ ...d, ...(configuredSocials.find(s => s.key === d.key) || {}) }));
        configuredSocials.filter(s => !DEFAULTS().some(d => d.key === s.key)).forEach(s => socials.push(s));
        const contactEmail = String(getSetting(settings, 'contact_email') || siteDefaults().contactEmail || '');
        const secondaryContactEmail = String(getSetting(settings, 'secondary_contact_email') || siteDefaults().secondaryContactEmail || '');
        currentClient = client; currentSettings = settings; currentContactEmail = contactEmail; currentSecondaryContactEmail = secondaryContactEmail;
        rewriteSettingsLinks(socials, contactEmail);
        renderJoinSocialCards(socials);
        applySecondaryContactEmail(secondaryContactEmail);
        applyHomepageText(settings);
        applyBrandLogo(settings);
        applyAnnouncementBar(settings);
        updateMainMenuSocials(contactEmail);
        rewriteNavigation();
        updateHome(client);
        decorateCurrentPage(client, contactEmail);
        const app = $('#app');
        if (app) {
          let lastHash = location.hash;
          let appMutTimer = null;
          new MutationObserver(() => {
            if (location.hash !== lastHash) lastHash = location.hash;
            if (appMutTimer) clearTimeout(appMutTimer);
            appMutTimer = setTimeout(() => {
              appMutTimer = null;
              rewriteSettingsLinks(socials, contactEmail);
              renderJoinSocialCards(socials);
              applySecondaryContactEmail(secondaryContactEmail);
              applyHomepageText(settings);
              applyBrandLogo(settings);
              rewriteNavigation();
              if (isMultiPage() ? currentRouteKey() === 'leaderboard' : location.hash === '#leaderboard') renderLeaderboard(client);
              decorateCurrentPage(client, contactEmail);
            }, 60);
          }).observe(app, { childList: true });
        }
        setUpObservers(client);
        installHomepageRefresh(client);
      };
      apply();

      // Real-time synchronization when admin saves in Mission Control (across tabs)
      window.addEventListener('storage', (e) => {
        if (e.key === 'gdg_site_synced') {
          console.log('[GDG SRU] Real-time content sync triggered from Mission Control.');
          try { sessionStorage.removeItem('gdg_announcement_cache'); } catch (_) {}
          _queryCache.clear();
          apply();
        }
      });

      // Automatically revalidate content when user switches back to this tab
      let lastVisibleSync = Date.now();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Date.now() - lastVisibleSync > 25000) {
          lastVisibleSync = Date.now();
          _queryCache.delete('site_settings');
          _queryCache.delete('events');
          _queryCache.delete('blogs');
          apply();
        }
      });
    });
  }
  function normaliseUnsupportedHash() {
    if (isMultiPage()) return;
    const raw = location.hash.slice(1);
    if (!raw) return;
    const page = decodeURIComponent(raw).split('/')[0];
    const allowed = new Set(['home','events','team','blogs','blog','join','contact','certificates','verify','leaderboard','perks','resources','privacy','about','home-blogs','404']);
    if (!allowed.has(page)) { history.replaceState(null, '', '/events'); location.reload(); return; }
  }
  syncPathToHash();
  normaliseUnsupportedHash();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startWithConfig, { once: true });
  else startWithConfig();
})();
