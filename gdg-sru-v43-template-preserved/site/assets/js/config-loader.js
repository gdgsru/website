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
    set(2, 'Category', e.category || 'Community');
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
    // Filter to future pinned events at the query, so a stale/past pinned event cannot hide
    // the next upcoming session. Read the public view; its RLS only exposes published events.
    client.from('public_event_list')
      .select('id,title,summary,start_at,end_at,timezone,venue,online_url,registration_url,pinned_next_session')
      .eq('pinned_next_session', true)
      .gt('start_at', new Date().toISOString())
      .order('start_at', { ascending: true })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (requestId !== nextSessionRequest) return;
        if (error) { console.warn('[GDG SRU] Could not load Next Session from public_event_list:', error.message); neutral(); return; }
        if (!data || !data.start_at || new Date(data.start_at).getTime() <= Date.now()) { neutral(); return; }
        const startMs = new Date(data.start_at).getTime();
        const timezone = data.timezone || 'Asia/Kolkata';
        const dateText = (() => { try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(startMs)); } catch { return new Date(startMs).toLocaleString(); } })();
        setText(titleEl, `${data.title} · ${dateText}`);
        // The second tile is labelled “Updates”. Prefer the actual venue/session state,
        // then useful event copy, rather than always leaving the generic chapter-page text.
        const summary = String(data.summary || '').trim();
        const hasDistinctSummary = summary && summary.toLocaleLowerCase() !== String(data.title || '').trim().toLocaleLowerCase();
        const updateText = data.venue || (data.online_url ? 'Online session' : data.registration_url ? 'Registration available' : hasDistinctSummary ? summary : 'Details to be announced');
        setText(updateEl, updateText);
        if (countdownCell.hidden) countdownCell.hidden = false;
        const tick = () => {
          if (requestId !== nextSessionRequest) return;
          const diff = Math.max(0, startMs - Date.now());
          if (diff <= 0) {
            if (window.__gdgNextSessionTimer) clearInterval(window.__gdgNextSessionTimer);
            window.__gdgNextSessionTimer = null;
            neutral();
            return;
          }
          const days = Math.floor(diff / 86400000), hours = Math.floor(diff / 3600000) % 24, minutes = Math.floor(diff / 60000) % 60, seconds = Math.floor(diff / 1000) % 60;
          setText(countdown, days ? `${days}d ${String(hours).padStart(2,'0')}h ${String(minutes).padStart(2,'0')}m` : `${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`);
        };
        tick(); window.__gdgNextSessionTimer = setInterval(() => { if (!document.hidden) tick(); }, 1000);
      })
      .catch(error => { console.warn('[GDG SRU] Next Session request failed.', error); neutral(); });
  }
  function renderLeaderboard(client) {
    if (!client) return;
    Promise.all([
      client.from('public_main_leaderboard').select('period_id,period_title,student_name,points,rank').order('rank').limit(1000),
      client.from('leaderboard_periods').select('id,title,period_type,starts_on,ends_on').eq('enabled', true).eq('published', true).order('starts_on', {ascending: false}),
      client.from('public_sponsored_leaderboards').select('leaderboard_id,title,program_name,period_label,student_name,points,rank,leaderboard_sort_order').order('leaderboard_sort_order').order('rank')
    ]).then(([mainResult, periodResult, sponsoredResult]) => {
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
  function updateHome(client) {
    rewriteNavigation();
    if ((isMultiPage() ? currentRouteKey() === 'leaderboard' : location.hash === '#leaderboard')) { renderLeaderboard(client); return; }
    if (isHomeRoute()) {
      updateNextSession(client);
    }
  }
  function installHomepageRefresh(client) {
    if (window.__GDG_HOME_REFRESH_INSTALLED__) return;
    window.__GDG_HOME_REFRESH_INSTALLED__ = true;
    const refreshNextSession = () => {
      if (!document.hidden && isHomeRoute()) updateNextSession(client);
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
  async function decorateEvents(client, root) {
    const routeSlug = window.__GDG_EVENT_SLUG || '';
    const renderEventDetail = (event) => {
      const intro = $('.page-intro', root);
      const eyebrow = intro && $('.eyebrow', intro);
      const heading = intro && $('h1', intro);
      const lead = intro && [...intro.querySelectorAll('p')].find(p => !p.classList.contains('eyebrow'));
      const detail = document.createElement('section'); detail.className = 'card pp runtime-event-detail';
      detail.style.cssText = 'max-width:900px;margin:20px 0 54px';
      if (!event) {
        if (eyebrow) eyebrow.textContent = 'EVENT DETAILS';
        if (heading) heading.textContent = window.__GDG_INVALID_EVENT_ROUTE ? 'Event Not Found' : 'Upcoming Session';
        if (lead) lead.textContent = window.__GDG_INVALID_EVENT_ROUTE ? 'This event link could not be found or has moved.' : 'Registration and session schedule details will be announced shortly.';
        detail.innerHTML = `<p class="cap">GDG SRU · EVENTS</p><h2>Explore Chapter Activities</h2><p>Visit the full chapter calendar to discover tech bootcamps, speaker sessions, and workshops at SR University.</p><a class="btn" href="/events/">Browse All Events ↗</a>`;
      } else {
        const category = esc(event.category || 'Community event');
        const date = whenText(event.start_at, event.timezone || 'Asia/Kolkata');
        const past = event.end_at ? new Date(event.end_at).getTime() < Date.now() : event.start_at ? new Date(event.start_at).getTime() < Date.now() : false;
        if (eyebrow) eyebrow.textContent = `${event.category || 'COMMUNITY EVENT'} · EVENT DETAILS`;
        if (heading) heading.textContent = event.title;
        if (lead) lead.textContent = `${date}${event.venue ? ` · ${event.venue}` : event.online_url ? ' · Online' : ''}`;
        const image = safeUrl(event.image_url);
        detail.innerHTML = `${image ? `<img src="${esc(image)}" alt="" loading="lazy" style="display:block;width:100%;max-height:380px;object-fit:cover;border-radius:18px;margin:0 0 22px">` : ''}<p class="cap">${category}${past ? ' · PAST EVENT' : ' · EVENT'}</p>${event.description ? `<div class="prose">${esc(event.description).replace(/\n/g,'<br>')}</div>` : `<p>${esc(event.summary || 'Event details will be announced soon.')}</p>`}${event.venue ? `<p><b>Venue:</b> ${esc(event.venue)}</p>` : ''}${event.online_url ? `<p><b>Online session:</b> <a class="text-link" href="${esc(safeUrl(event.online_url))}" target="_blank" rel="noopener noreferrer">Open session link ↗</a></p>` : ''}${event.registration_url && !past ? `<p><a class="btn" href="${esc(safeUrl(event.registration_url))}" target="_blank" rel="noopener noreferrer">Register externally ↗</a></p>` : `<p class="muted">${past ? 'This event has ended. Registration is no longer available.' : 'Registration details will be announced soon.'}</p>`}<a class="btn o" href="/events/">← All events</a>`;
      }
      [...root.children].forEach(child => { if (child !== intro && child !== detail) { child.hidden = true; child.style.setProperty('display', 'none', 'important'); } });
      if (!detail.isConnected) root.appendChild(detail);
    };
    if (!client) { if (routeSlug || window.__GDG_INVALID_EVENT_ROUTE) renderEventDetail(null); return; }
    const view = await client.from('public_event_list').select('id,title,slug,category,summary,description,image_url,start_at,end_at,timezone,venue,online_url,registration_url,featured,pinned_next_session').order('start_at',{ascending:true});
    if (view.error) { if (routeSlug) renderEventDetail(null); return; }
    const rows = view.data || [];
    if (window.__GDG_INVALID_EVENT_ROUTE) { renderEventDetail(null); return; }
    if (routeSlug) { renderEventDetail(rows.find(e => e.slug === routeSlug) || null); return; }
    const pinned = rows.find(e => e.pinned_next_session && e.start_at && new Date(e.start_at) > new Date());
    window.__GDG_PINNED_EVENT = pinned || null;
    if (pinned) {
      const main = $('.event-feature-main', root);
      if (main) {
        const h = $('h2', main), p = $('p', main), meta = $('.event-feature-meta', main);
        if (h) h.textContent = pinned.title;
        if (p) p.textContent = `${whenText(pinned.start_at,pinned.timezone||'Asia/Kolkata')}${pinned.venue?` · ${pinned.venue}`:pinned.online_url?' · Online':''}. ${pinned.summary||'Join the community for this session.'}`;
        if (meta) meta.textContent = `PINNED NEXT SESSION / ${String(pinned.category||'EVENT').toUpperCase()}`;
        const actions = $('.event-feature-actions', main);
        if (window.__gdgFillFeature) window.__gdgFillFeature();
        if (actions) actions.innerHTML = `${pinned.registration_url?`<a class="btn" href="${esc(safeUrl(pinned.registration_url))}" target="_blank" rel="noopener noreferrer">Register externally ↗</a>`:''}<a class="btn o" href="/event.html?slug=${encodeURIComponent(pinned.slug)}">Event details ↗</a>`;
      }
    }
    const formats = $('.event-formats', root);
    if (!formats) return;
    const section = document.createElement('section'); section.className = 'editorial-collections runtime-events';
    section.innerHTML = `<div class="editorial-collections-head"><div><span class="cap">CHAPTER CALENDAR</span><h2>Upcoming & past events.</h2></div><p>Browse published events and open a dedicated page for dates, venue details, and registration links.</p></div><div class="filter-bar" style="margin:18px 0"><div class="segmented" role="group" aria-label="Event time"><button type="button" data-runtime-time="upcoming" aria-pressed="true">Upcoming</button><button type="button" data-runtime-time="past" aria-pressed="false">Past</button></div><label>Category <select data-runtime-category><option value="all">All events</option>${[...new Set(['Cloud','AI/ML','Web & Mobile','Open Source',...rows.map(e => e.category).filter(Boolean)])].map(c => `<option>${esc(c)}</option>`).join('')}</select></label></div><div class="editorial-grid g16-row g16-tickets" data-runtime-events></div>`;
    formats.parentNode.insertBefore(section, formats);
    const out = $('[data-runtime-events]', section);
    const render = () => {
      const time = $('[data-runtime-time="past"]', section).getAttribute('aria-pressed') === 'true' ? 'past' : 'upcoming';
      const cat = $('[data-runtime-category]', section).value; const now = Date.now();
      const filtered = rows.filter(e => {
        const past = e.end_at ? new Date(e.end_at).getTime() < now : e.start_at ? new Date(e.start_at).getTime() < now : false;
        return (time === 'past' ? past : !past) && (cat === 'all' || e.category === cat);
      });
      out.innerHTML = filtered.length ? filtered.map(e => eventCard(Object.assign({}, e, { no: rows.indexOf(e) + 1 }), rows.indexOf(e))).join('') : `<div class="event-vault-empty"><b>No ${time} events in this category yet.</b><p>Check back for updates from GDG SRU.</p></div>`;
    };
    $$('[data-runtime-time]', section).forEach(b => b.addEventListener('click', () => { $$('[data-runtime-time]', section).forEach(x => x.setAttribute('aria-pressed',String(x===b))); render(); }));
    $('[data-runtime-category]',section).addEventListener('change',render); render();
  }
  async function renderBlogSeries(client) {
    const box = $('#blog-series');
    if (!box || !window.GDG16) return;
    const section = box.closest('section');
    const hide = () => { if (section) section.style.display = 'none'; };
    if (!client) { hide(); return; }
    try {
      const r = await client.from('blog_series').select('title,description,color,slug').eq('status', 'published').order('sort_order');
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
    const view = await client.from('public_blog_list').select('title,author,description,image_url,category,external_url,featured,sort_order,created_at').order('featured',{ascending:false}).order('sort_order').order('created_at',{ascending:false});
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
    try { view=await client.from('public_resource_list').select('*').order('featured',{ascending:false}).order('sort_order').order('created_at',{ascending:false}); }
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
    host.outerHTML=`<section class="resource-hub-runtime"><div class="resource-hub-tabs" role="tablist"><button type="button" role="tab" aria-selected="true" data-resource-tab="external">Free Resources <span>${external.length}</span></button><button type="button" role="tab" aria-selected="false" data-resource-tab="gdg">GDG SRU Library <span>${gdg.length}</span></button></div><section class="resource-section-runtime" data-resource-panel="external"><div class="resource-section-head"><h3>Free Resources</h3><p>Tools, courses, creative resources, career help, and more.</p></div><div class="resource-runtime-grid g16-row g16-perks">${makeCards(external,'external')}</div></section><section class="resource-section-runtime" data-resource-panel="gdg" hidden><div class="resource-section-head"><h3>GDG SRU Library</h3><p>Presentations, videos, notes, and materials shared from our events.</p></div><div class="resource-runtime-grid g16-row g16-perks">${makeCards(gdg,'gdg')}</div></section></section>`;
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
    card.innerHTML=`<h2>Information we handle</h2><p>Depending on the event, GDG SRU may process the name, email address, and other details supplied through the event registration platform. The source registration platform has its own privacy practices.</p><h3>Certificates and retention</h3><p>To check eligibility, the certificate page compares the name a visitor enters with the attendance list uploaded by an authorised organiser. Certificate artwork is generated on demand in the visitor’s browser. The site does not store a separate certificate file or a per-recipient certificate row. Attendance records (name, roll number, and email where given) are kept for one year after the event ends and then deleted automatically.</p><p>To discourage automated name guessing, the certificate endpoint also stores a short-lived counter keyed by a one-way hash of the network address. It does not store the name entered in that counter. Old counters are periodically pruned. This is separate from the attendance roster.</p><h3>Leaderboard privacy</h3><p>Public leaderboards display only the fields intended for public ranking. Email addresses and private attendance details should not be displayed.</p><h3>Cookies and analytics</h3><p>The website may use essential browser storage required for functionality. Any analytics or additional tracking must be described here before it is enabled.</p><h3>External services</h3><p>Event registration platforms, social networks, article hosts, and resource providers have their own privacy practices. Please review the relevant provider’s policy when using an external service.</p><h3>Your questions</h3><p>For privacy questions or applicable correction or deletion requests, contact <a href="mailto:${esc(contact)}">${esc(contact)}</a>.</p><p class="muted small">Attendance records are retained for one year following the conclusion of each event and purged automatically in accordance with chapter data retention schedules.</p>`;
  }
  const loadCertEngine = () => window.GDGCert ? Promise.resolve() : new Promise((resolve, reject) => {
    const s = document.createElement('script'); s.src = '/assets/js/cert-engine.js'; s.onload = resolve; s.onerror = () => reject(new Error('Certificate tools are unavailable right now. Please try again later.')); document.head.appendChild(s);
  });
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

    if (!certEvents.length) {
      try {
        const { data: pEvents } = await client
          .from('events')
          .select('id, title, start_at')
          .in('status', ['published', 'archived'])
          .order('start_at', { ascending: false });
        if (Array.isArray(pEvents) && pEvents.length) certEvents = pEvents;
      } catch (_) { console.warn('[App] Operation notice:', _); }
    }

    const activateDemoMode = () => {
      select.disabled = false; nameInput.disabled = false; idInput.disabled = false; submit.disabled = false;
      if (!select.querySelector('option[value="demo-cloud-jam"]')) {
        const opt = document.createElement('option'); opt.value = 'demo-cloud-jam'; opt.textContent = 'Google Cloud Jam 2026 (Interactive Demo)'; select.appendChild(opt);
      }
      select.value = 'demo-cloud-jam';
      if (!nameInput.value) nameInput.value = 'Asha Rao';
      if (!idInput.value) idInput.value = '26BCE1001';
      result.innerHTML = '<div class="note" style="margin-top:16px;text-align:center"><p style="margin:0"><b>Interactive Demo Mode Active:</b> Type your name (or keep sample) and click <b>Create my certificate →</b> to test the full certificate renderer, PDF/PNG download, and LinkedIn sharing!</p></div>';
    };

    const isDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if(!certEvents.length){
      select.disabled=true;nameInput.disabled=true;idInput.disabled=true;submit.disabled=true;
      result.innerHTML=`<div class="event-vault-empty" role="status" style="margin-top:20px;text-align:center;padding:32px 20px"><div style="font-size:36px;margin-bottom:8px">📜</div><b style="font-size:18px;display:block;margin-bottom:6px">Certificates will open after event rosters are published</b><p style="max-width:540px;margin:0 auto 16px;color:var(--mut);font-size:14px;line-height:1.6">Event certificates are issued on-demand from confirmed attendance rosters. Once organizers publish attendance for workshops, you will be able to claim your certificate here.</p><div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn sm" href="/events/">Browse upcoming events →</a><a class="btn o sm" href="/verify/">Verify a credential →</a>${isDev ? '<button type="button" class="btn o sm" id="gdg-try-demo-cert">Local Dev Test</button>' : ''}</div></div>`;
      if (isDev) $('#gdg-try-demo-cert', result)?.addEventListener('click', activateDemoMode);
    } else {
      select.disabled=false;nameInput.disabled=false;idInput.disabled=false;submit.disabled=false;
      select.innerHTML = '<option value="">Choose an event</option>' + certEvents.map(e=>`<option value="${esc(e.id)}">${esc(e.title)}</option>`).join('');
    }
    if (isDev && new URL(location.href).searchParams.has('demo')) {
      activateDemoMode();
      if (new URL(location.href).searchParams.get('demo') === 'auto') {
        requestAnimationFrame(() => submit.click());
      }
    }
    form.addEventListener('submit',async e=>{
      e.preventDefault(); e.stopPropagation();
      const eventId=select.value, name=nameInput.value.trim().replace(/\s+/g,' '), rawId=idInput.value.trim();
      const identifier = rawId || name;
      if(!eventId||name.length<3){result.innerHTML='<p role="alert">Choose an event and enter your full name.</p>';return;}
      submit.disabled=true; const label=submit.textContent; submit.textContent='Checking…'; result.innerHTML='';
      try{
        let claim = null;
        if (eventId === 'demo-cloud-jam') {
          let templateHtml = '';
          try {
            const tRes = await fetch('/assets/data/certificate-default-template.html');
            templateHtml = await tRes.text();
          } catch (tErr) {
            result.innerHTML = '<p role="alert">Could not load default certificate template.</p>';
            return;
          }
          claim = {
            found: true,
            certificate: {
              template_html: templateHtml,
              recipient_name: name || 'Asha Rao',
              credential_id: 'GDGSRU-DEMO2026',
              event_title: 'Google Cloud Jam 2026',
              event_start: '2026-10-24T10:00:00Z',
              fields: {
                event_name: 'Google Cloud Jam 2026',
                dev_tag: '#GoogleDeveloper',
                node_pill: 'NODE_ACTIVE // 2026',
                partner_sticker: '#SRU_ACM // CO-HOST',
                dossier_tag: 'BUILD_WITH_AI',
                track: 'Cloud & GenAI',
                skills: 'Vertex AI, Gemini 2.5, Cloud Run, Python',
                syllabus: 'Completed intensive hands-on development labs exploring Google Cloud infrastructure, Vertex AI foundational model deployments, and Gemini API multi-agent workflows.',
                signatories: [
                  { name: 'Faculty Advisor', role: 'Faculty Advisor, GDG SRU', scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 },
                  { name: 'Lead Organizer', role: 'Organizer & Chapter Lead', scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 }
                ]
              }
            }
          };
        } else {
          // Protected Edge Function call with IP rate-limiting & attendance verification
          try {
            const { data: cData, error: fnErr } = await client.functions.invoke('claim-certificate', {
              body: { event_id: eventId, name, identifier }
            });
            if (fnErr) {
              console.warn('[GDG Cert] Claim error:', fnErr);
              if (fnErr?.status === 429) {
                result.innerHTML = '<div class="event-vault-empty" role="status"><b>Too many verification attempts</b><p style="margin:6px 0;font-size:14px">To protect attendee records, this network has exceeded the temporary check limit. Please wait a few minutes before trying again.</p></div>';
                return;
              }
              result.innerHTML = '<div class="event-vault-empty" role="status"><b>Verification temporarily unavailable</b><p style="margin:6px 0;font-size:14px">Please try again in a few moments or contact chapter organizers.</p></div>';
              return;
            }
            claim = cData;
          } catch (invokeErr) {
            console.warn('[GDG Cert] Invoke error:', invokeErr);
            result.innerHTML = '<p role="alert">We could not check right now. Please try again in a moment.</p>';
            return;
          }
        }
        if(!claim?.found||!claim?.certificate){
          const mail=typeof currentContactEmail==='string'&&currentContactEmail?` or write to <a href="mailto:${esc(currentContactEmail)}">${esc(currentContactEmail)}</a>`:'';
          result.innerHTML=`<div class="event-vault-empty" role="status"><b>We couldn't find that name in the attendance roster for this event.</b><p>Check the spelling and the event, using the name, roll number or email you registered with${mail}. If multiple attendees have the same name, ask the organisers to correct the attendance list.</p></div>`;return;
        }
        const data=claim.certificate;
        if (!data.template_html || !data.template_html.trim()) {
          try {
            const tRes = await fetch('/assets/data/certificate-default-template.html');
            if (tRes.ok) data.template_html = await tRes.text();
          } catch (tErr) {
            console.warn('Could not load master certificate template:', tErr);
          }
        }
        data.fields = Object.assign({
          event_name: data.event_title || 'GDG SRU Event',
          cert_tag: 'OFFICIAL CREDENTIAL',
          cert_title: 'Certificate of Participation',
          dev_tag: '#GoogleDeveloper',
          node_pill: 'NODE_ACTIVE // 2026',
          partner_sticker: '#SRU_ACM // CO-HOST',
          dossier_tag: 'BUILD_WITH_AI',
          track: 'AI & Cloud',
          skills: 'Vertex AI, Gemini 2.5, Cloud Run, Python',
          syllabus_status: 'STATUS: COMPLETED',
        }, data.fields || {});
        if (!data.fields.signatories || !data.fields.signatories.length) {
          data.fields.signatories = [
            { name: 'Dr. K. Srinivas', role: 'Faculty Advisor, GDG SRU', scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 },
            { name: 'Siddharth Rao', role: 'Organizer & Chapter Lead', scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 }
          ];
        }
        await loadCertEngine();
        const built=window.GDGCert.buildDocument(data);
        const verifyUrl = `${location.origin}/verify/?code=${encodeURIComponent(data.credential_id)}`;
        const issueDate = new Date(data.event_start || Date.now());
        const linkedInCertUrl = `https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent((data.event_title || 'GDG') + ' Certificate')}&organizationName=${encodeURIComponent('Google Developer Groups')}&issueYear=${issueDate.getFullYear()}&issueMonth=${issueDate.getMonth() + 1}&certUrl=${encodeURIComponent(verifyUrl)}&certId=${encodeURIComponent(data.credential_id)}`;
        const postCaption = `🎓 Excited to share that I have earned my Certificate of Participation for "${data.event_title}" from Google Developer Group on Campus SR University!\n\n📜 Credential ID: ${data.credential_id}\n🔗 Verify Credential: ${verifyUrl}\n\nGrateful to the Google Developer Group on Campus SR University team and mentors for the incredible learning experience!\n\n#GoogleDeveloperGroups #GDGSRU #SRUniversity #StudentDevelopers #ContinuousLearning #TechCommunity`;

        result.innerHTML=`<div class="card pp" style="margin-top:20px;border-top:4px solid var(--b)"><div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:12px"><span class="tag t3">✓ VERIFIED CREDENTIAL</span><span class="cap" style="font-size:12px">Credential ID: <b>${esc(data.credential_id)}</b></span></div><h3 style="margin:0 0 6px">Your certificate is ready</h3><p style="margin:0 0 16px;color:var(--mut)">Awarded to <b>${esc(data.recipient_name)}</b> · <b>${esc(data.event_title)}</b></p><div id="gdg-cert-preview" aria-label="Certificate preview"></div><div class="gdg-cert-actions" style="margin-top:18px;display:flex;flex-wrap:wrap;gap:10px;align-items:center"><button class="btn" type="button" id="gdg-cert-pdf">Download PDF</button><button class="btn o" type="button" id="gdg-cert-png">Download image (.PNG)</button><button class="btn o" type="button" id="gdg-cert-linkedin" style="background:#0a66c2;border-color:#0a66c2;color:#fff">Share to LinkedIn</button><a class="btn o" id="gdg-cert-linkedin-add" target="_blank" rel="noopener" href="${linkedInCertUrl}">+ Add to LinkedIn Profile</a></div><div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--ln);display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:13px;color:var(--mut)"><span>Verification link: <a href="/verify/?code=${encodeURIComponent(data.credential_id)}" target="_blank">gdgsru.com/verify/?code=${esc(data.credential_id)}</a></span><button type="button" class="btn o sm" id="gdg-cert-copy-btn" style="padding:4px 10px;font-size:12px">Copy link</button><a href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Earned my certificate for ' + data.event_title + ' from @gdgsru! 🎓')}&url=${encodeURIComponent(verifyUrl)}" target="_blank" rel="noopener" style="color:inherit">Share on 𝕏</a><a href="https://api.whatsapp.com/send?text=${encodeURIComponent('Earned my certificate for ' + data.event_title + ' from GDG SRU! Verify: ' + verifyUrl)}" target="_blank" rel="noopener" style="color:inherit">WhatsApp</a></div><div id="gdg-share-assistant" style="display:none;margin-top:16px;background:var(--cd);border:1.5px solid var(--b);border-radius:12px;padding:16px;box-shadow:var(--sh)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><b style="color:var(--b);font-size:15px">🎉 Ready for LinkedIn!</b><button type="button" id="gdg-share-close" style="background:none;border:none;cursor:pointer;color:var(--mut);font-size:16px" aria-label="Close">✕</button></div><p style="font-size:13px;margin:0 0 10px;line-height:1.5"><b>1.</b> Your certificate banner has been downloaded to your device <i>(and copied to clipboard)</i>.<br><b>2.</b> Your brag post caption has been copied to your clipboard.<br><b>3.</b> In the LinkedIn tab, simply paste (<b>Ctrl+V</b>) your caption and attach your downloaded banner!</p><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn o sm" id="gdg-copy-caption-again">📋 Copy caption again</button><button type="button" class="btn o sm" id="gdg-redownload-banner">🖼️ Download banner again</button><a class="btn sm" href="${linkedInCertUrl}" target="_blank" rel="noopener">💼 Add to LinkedIn Profile</a></div></div><p id="gdg-cert-note" class="muted small" role="status" style="margin-top:10px"></p></div>`;

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
            <div><b>Status:</b> <span style="color:${row.status==='verified'?'var(--g)':'var(--r)'};font-weight:700">${row.status==='verified'?'Active & authentic':'Revoked by chapter administration'}</span></div>
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
      if (code === 'GDGSRU-DEMO2026' || (code && code.startsWith('GDGSRU-DEMO'))) {
        renderVerifiedRow({ recipient_name: 'Asha Rao', event_title: 'Google Cloud Jam 2026', status: 'verified' }, code);
        return;
      }
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
    const app = $('#app');
    if (app) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return; scheduled = true;
        requestAnimationFrame(() => { scheduled = false; decorateCurrentPage(client); });
      }).observe(app, { childList: true });
    }
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
          const { data, error } = await client.from('public_site_settings').select('key,value');
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
        updateMainMenuSocials(contactEmail);
        rewriteNavigation();
        updateHome(client);
        decorateCurrentPage(client, contactEmail);
        const app = $('#app');
        if (app) {
          let lastHash = location.hash;
          new MutationObserver(() => {
            if (location.hash !== lastHash) lastHash = location.hash;
            setTimeout(() => { rewriteSettingsLinks(socials, contactEmail); renderJoinSocialCards(socials); applySecondaryContactEmail(secondaryContactEmail); applyHomepageText(settings); applyBrandLogo(settings); rewriteNavigation(); if (isMultiPage() ? currentRouteKey() === 'leaderboard' : location.hash === '#leaderboard') renderLeaderboard(client); decorateCurrentPage(client, contactEmail); }, 0);
          }).observe(app, { childList: true });
        }
        setUpObservers(client);
        installHomepageRefresh(client);
      };
      apply();
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
