/* GDG SRU team page.
 * Every detail on this page comes from the database (team_members, team_departments and the
 * `team_page` site setting), all managed in Mission Control → Team. Nothing about a person or a
 * department is written into HTML or JavaScript.
 *
 * GDGTeam.cardHTML() is the one place card markup is defined. The public page and the live
 * preview inside Mission Control both call it, so the preview can never drift from the site.
 */
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (v) => {
    if (!v) return '';
    const str = String(v).trim();
    if (str.startsWith('/') || str.startsWith('data:image/')) return str;
    try {
      const u = new URL(str);
      return ['http:', 'https:'].includes(u.protocol) ? u.href : '';
    } catch {
      return '';
    }
  };
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const INKS = ['#4285f4', '#ea4335', '#fbbc04', '#34a853'];
  const ACCENTS = ['b', 'r', 'y', 'g'];
  const KINDS = [0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6, 7, 8, 8];
  const LEVELS = { lead: 'Lead', organizer: 'Organizer', member: 'Member', advisor: 'Advisor' };
  const SOCIALS = [
    ['linkedin', 'LinkedIn', 'in'], ['github', 'GitHub', '⌘'], ['instagram', 'Instagram', '◎'],
    ['discord', 'Discord', '◉'], ['googleDeveloper', 'Google Dev', 'G'], ['x', 'X', '𝕏'], ['website', 'Website', '↗']
  ];
  const PAGE_DEFAULTS = {
    eyebrow: "GDG SRU '26 · GDG ON CAMPUS",
    title_top: 'The crew',
    title_accent: 'behind the day.',
    lead: 'GDG on Campus SR University is powered by the student community. These are the people putting everything together, and the crew grows as the community gets closer.',
    cta_label: 'Meet the crew',
    map_label: 'THE CREW',
    core_small: 'GDG SRU',
    core_big: 'The crew.',
    edition: '1st',
    community_count: '1,800+'
  };
  const KICKER = { leadership: 'THE CORE TEAM', advisory: 'GUIDANCE & SUPPORT', department: 'DEPARTMENT' };

  const initials = (name) => {
    const p = String(name || '?').replace(/^(dr|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return ((p.length > 1 ? p[0][0] + p[p.length - 1][0] : (p[0] || '?')[0]) || '?').toUpperCase();
  };
  const hash = (v) => { let h = 2166136261; for (const ch of String(v || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };
  const rng = (seed) => () => { seed = (seed | 0) + 1831565813 | 0; let x = Math.imul(seed ^ seed >>> 15, 1 | seed); x = x + Math.imul(x ^ x >>> 7, 61 | x) ^ x; return ((x ^ x >>> 14) >>> 0) / 4294967296; };

  function riso(name, ink0) {
    const rand = rng(hash(name)), layers = [[], [], [], []];
    const cell = (kind, x, y, rot, scale, ink) => {
      const cx = x + 12.5, cy = y + 12.5, t = `transform="translate(${cx} ${cy}) rotate(${90 * rot}) scale(${scale}) translate(${-cx} ${-cy})"`;
      switch (kind) {
        case 0: return `<circle ${t} cx="${cx}" cy="${cy}" r="12.5"/>`;
        case 1: return `<path ${t} d="M${x} ${y}H${x + 25}A25 25 0 0 1 ${x} ${y + 25}Z"/>`;
        case 2: return `<path ${t} d="M${x} ${y + 25}A12.5 12.5 0 0 1 ${x + 25} ${y + 25}Z"/>`;
        case 3: return `<rect ${t} x="${x}" y="${y}" width="25" height="25"/>`;
        case 4: return `<path ${t} d="M${x} ${y + 25}H${x + 25}V${y}Z"/>`;
        case 5: return `<g ${t}>${[2.5, 10, 17.5].map((v) => `<rect x="${x}" y="${y + v}" width="25" height="5"/>`).join('')}</g>`;
        case 6: return `<rect ${t} x="${x}" y="${y}" width="25" height="25" fill="url(#tm-riso-ht${ink})"/>`;
        case 7: return `<circle ${t} cx="${cx}" cy="${cy}" r="10.5" fill="none" stroke="${INKS[ink]}" stroke-width="4"/>`;
        default: return '';
      }
    };
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const kind = KINDS[Math.floor(rand() * KINDS.length)];
      const ink = rand() < .5 ? ink0 : (ink0 + 1 + Math.floor(3 * rand())) % 4;
      layers[ink].push(cell(kind, c * 25, r * 25, Math.floor(4 * rand()), rand() < .22 ? 1.4 : 1, ink));
    }
    return `<svg class="tm-riso-composition" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${layers.map((g, i) => `<g class="tm-riso-ink tm-riso-i${i}" fill="${INKS[i]}" stroke="none">${g.join('')}</g>`).join('')}</svg>`;
  }

  // Halftone patterns the riso art references; the page needs them once.
  const DEFS = `<svg aria-hidden="true" width="0" height="0" style="position:absolute;overflow:hidden"><defs>${INKS.map((c, i) => `<pattern id="tm-riso-ht${i}" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.05" fill="${c}"/></pattern>`).join('')}</defs></svg>`;

  function normalise(m) {
    const role = String(m.role || '').trim() || 'Community Member';
    let level = String(m.level || '').toLowerCase();
    if (!LEVELS[level]) level = /lead organizer|\blead\b|head of/i.test(role) ? 'lead' : /organizer/i.test(role) ? 'organizer' : /advisor/i.test(role) ? 'advisor' : 'member';
    const accent = ACCENTS.includes(m.accent) ? m.accent : null;
    const pos = /^\d{1,3}% \d{1,3}%$/.test(m.photo_position || '') ? m.photo_position : '50% 100%';
    return {
      name: String(m.name || 'Team member').trim(), role, level, accent, pos,
      department: String(m.department || '').trim(), code: String(m.member_code || '').trim(),
      subtitle: String(m.card_subtitle || '').trim(), bio: String(m.bio || '').trim(),
      photo: safeUrl(m.photo_url || m.photo_path),
      socials: m.social_links && typeof m.social_links === 'object' && !Array.isArray(m.social_links) ? m.social_links : {}
    };
  }

  function links(socials, name) {
    const known = new Set(SOCIALS.map((s) => s[0]));
    const rows = SOCIALS.map(([k, label, glyph]) => [k, label, glyph, socials[k]])
      .concat(Object.entries(socials).filter(([k]) => !known.has(k)).map(([k, v]) => [k, k, '↗', v]));
    const html = rows.map(([, label, glyph, url]) => { const u = safeUrl(url); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(name)} on ${esc(label)}" title="${esc(label)}"><span class="tm-social-glyph" aria-hidden="true">${esc(glyph)}</span><span>${esc(label)}</span></a>` : ''; }).join('');
    return html ? `<nav class="tm-links" aria-label="${esc(name)} social links">${html}</nav>` : '';
  }

  /** One card. `opts.kind` is the department kind; `opts.index` seeds the fallback accent colour. */
  function cardHTML(raw, opts = {}) {
    const m = normalise(raw), index = opts.index || 0;
    const color = m.accent || ACCENTS[index % 4], ink = ACCENTS.indexOf(color);
    const code = m.code || `GDG SRU · ${String(index + 1).padStart(2, '0')}`;
    const ini = initials(m.name);
    const isFaculty = /faculty advisor/i.test(m.role), isStudentAdvisor = /student advisor/i.test(m.role);
    const special = opts.kind === 'leadership' && m.level === 'lead' ? ' tm-riso-featured is-wide is-lead-organizer' : isFaculty ? ' tm-faculty-advisor' : isStudentAdvisor ? ' tm-student-advisor' : '';
    const portrait = m.photo
      ? `<span class="tm-riso-portrait has-photo"><span class="tm-riso-ini tm-riso-photo-fallback" aria-hidden="true"><b>${esc(ini)}</b><b>${esc(ini)}</b></span><img class="tm-riso-photo-image" src="${esc(m.photo)}" alt="" loading="lazy" decoding="async" style="object-position:${esc(m.pos)}"></span>`
      : `<span class="tm-riso-portrait no-photo"><span class="tm-riso-ini" aria-hidden="true"><b>${esc(ini)}</b><b>${esc(ini)}</b></span></span>`;
    const idTail = code.replace(/^\d\d-/, '').replace(/^GDG SRU · /, '') || 'GDG';
    const social = links(m.socials, m.name);
    return `<article class="tm-card tm-riso-card${special}" data-c="${color}" data-level="${m.level}" data-role="${esc(m.role)}" data-department="${esc(m.department || 'Community')}" tabindex="0" aria-label="${esc(m.name + ', ' + m.role)}. Press Enter or Space to flip the card." aria-expanded="false">
<div class="tm-flip-shell"><div class="tm-face tm-face-front"><div class="tm-riso-front"><div class="tm-riso-paper"><div class="tm-riso-art">${riso(m.name, ink)}<i class="tm-riso-reg tm-riso-reg-a" aria-hidden="true"></i><i class="tm-riso-reg tm-riso-reg-b" aria-hidden="true"></i>${portrait}</div>
<div class="tm-riso-info"><span class="tm-riso-number">${esc(code)}</span><div class="tm-id"><h3 class="tm-riso-name">${m.name.split(/\s+/).map((p) => `<span>${esc(p)}</span>`).join('')}</h3><span class="tm-riso-flipmark" aria-hidden="true">↻</span></div>
<p class="tm-riso-role"><i aria-hidden="true"></i>${esc(m.role)}</p><div class="tm-chips"><span class="tm-chip tm-chip-main"><i aria-hidden="true"></i>${esc(m.department || 'Community')}</span><span class="tm-chip">${LEVELS[m.level]}</span></div>
<div class="tm-stats"><div><b>${esc(idTail)}</b><span>member id</span></div><div><b>SRU</b><span>chapter</span></div></div><span class="tm-riso-hint">Get in touch <i aria-hidden="true">↗</i></span></div><i class="tm-riso-bar" aria-hidden="true"><b></b><b></b><b></b><b></b></i></div></div></div>
<div class="tm-face tm-face-back" aria-hidden="true" inert><div class="tm-back-top"><span class="tm-back-index">${esc(code)}</span><span class="tm-back-mark" aria-hidden="true">✳</span></div><div class="tm-back-identity"><span class="tm-back-dept">${esc(m.department || 'Community')}</span><h3>${esc(m.name)}</h3><p class="tm-role">${esc(m.role)}</p>${m.subtitle ? `<p class="tm-sub">${esc(m.subtitle)}</p>` : ''}${m.bio ? `<p class="tm-bio">${esc(m.bio)}</p>` : ''}</div>${social ? `<div class="tm-back-social"><span class="tm-back-social-label">CONNECT</span>${social}</div>` : ''}<button class="tm-return" type="button" data-card-return aria-label="Return to ${esc(m.name)}'s profile">Back to profile <span aria-hidden="true">↗</span></button></div></div></article>`;
  }

  const sectionId = (d) => d.kind === 'leadership' ? 'leadership' : d.kind === 'advisory' ? 'advisory' : 'dept-' + (d.slug || slug(d.name));

  function sectionHTML(d, members) {
    const id = sectionId(d), n = members.length;
    return `<section class="tm-sec tm-sec-${id}" id="${id}" data-team-section><div class="tm-head"><div class="tm-head-main"><span class="tm-kicker">${KICKER[d.kind] || KICKER.department}</span><h2>${esc(d.heading || d.name)}</h2>${d.description ? `<p>${esc(d.description)}</p>` : ''}</div><span class="tm-count" data-total="${n}">${n} ${n === 1 ? 'person' : 'people'}</span></div><div class="tm-grid" data-count="${n}">${members.map((m, i) => cardHTML(m, { kind: d.kind, index: i })).join('')}</div><p class="tm-empty" hidden>No team members match your search.</p></section>`;
  }

  function renderAvatarNode(raw, x, y, idx) {
    const m = normalise(raw);
    const leftPct = ((x / 540) * 100).toFixed(2);
    const topPct = ((y / 540) * 100).toFixed(2);
    const ini = initials(m.name);
    const color = m.accent || ACCENTS[idx % 4];
    const portrait = m.photo
      ? `<img class="tm-riso-photo-image" src="${esc(m.photo)}" alt="${esc(m.name)}" loading="lazy" decoding="async" style="object-position:${esc(m.pos)}">`
      : `<span class="crew-avatar-fallback c-${color}" aria-hidden="true">${esc(ini)}</span>`;

    return `<button type="button" class="crew-avatar-node" data-name="${esc(m.name)}" data-role="${esc(m.role)}" data-dept="${esc(m.department || '')}" data-code="${esc(m.code || '')}" data-x="${x.toFixed(1)}" data-y="${y.toFixed(1)}" style="left:${leftPct}%;top:${topPct}%;" aria-label="View profile for ${esc(m.name)}, ${esc(m.role)}">${portrait}</button>`;
  }

  function buildRadarConstellation(members) {
    const list = Array.isArray(members) ? members : [];
    const count = list.length || 33;
    const cx = 270, cy = 270;

    // Generate outer decorative tick ring (radius 252)
    const ticksSvg = [];
    const totalTicks = 72;
    for (let i = 0; i < totalTicks; i++) {
      const angle = (i / totalTicks) * 2 * Math.PI;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      if (i % 4 === 0) {
        const dotX = cx + 252 * cos;
        const dotY = cy + 252 * sin;
        const color = INKS[(i / 4) % 4];
        ticksSvg.push(`<circle cx="${dotX.toFixed(1)}" cy="${dotY.toFixed(1)}" r="2.8" fill="${color}" class="radar-tick-dot"/>`);
      } else {
        const x1 = cx + 248 * cos;
        const y1 = cy + 248 * sin;
        const x2 = cx + 254 * cos;
        const y2 = cy + 254 * sin;
        ticksSvg.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-opacity="0.2" stroke-width="1.2" stroke-linecap="round"/>`);
      }
    }

    // Generate 12 radial faint spoke lines
    const spokesSvg = [];
    for (let s = 0; s < 12; s++) {
      const sAngle = (s / 12) * 2 * Math.PI;
      const cos = Math.cos(sAngle);
      const sin = Math.sin(sAngle);
      const x1 = cx + 76 * cos;
      const y1 = cy + 76 * sin;
      const x2 = cx + 234 * cos;
      const y2 = cy + 234 * sin;
      spokesSvg.push(`<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="currentColor" stroke-opacity="0.14" stroke-width="1" stroke-dasharray="2 4"/>`);
    }

    // Distribute members across 2 concentric rings
    let avatarNodesHtml = '';
    if (list.length > 0) {
      const n = list.length;
      const countInner = n <= 8 ? n : Math.max(5, Math.round(n * 0.38));
      const countOuter = n <= 8 ? 0 : n - countInner;

      const innerList = list.slice(0, countInner);
      const outerList = list.slice(countInner);

      // Inner ring placement (R = 132)
      innerList.forEach((m, idx) => {
        const angle = (idx / countInner) * 2 * Math.PI - Math.PI / 2;
        const x = cx + 132 * Math.cos(angle);
        const y = cy + 132 * Math.sin(angle);
        avatarNodesHtml += renderAvatarNode(m, x, y, idx);
      });

      // Outer ring placement (R = 196, staggered)
      outerList.forEach((m, idx) => {
        const offset = Math.PI / countOuter;
        const angle = (idx / countOuter) * 2 * Math.PI - Math.PI / 2 + offset;
        const x = cx + 196 * Math.cos(angle);
        const y = cy + 196 * Math.sin(angle);
        avatarNodesHtml += renderAvatarNode(m, x, y, countInner + idx);
      });
    }

    return `<div class="crew-constellation-wrap" aria-label="Interactive crew constellation radar">
      <div class="crew-radar" id="crew-radar">
        <svg class="crew-radar-svg" viewBox="0 0 540 540" aria-hidden="true">
          <circle cx="270" cy="270" r="234" class="radar-orbit orbit-boundary" />
          <circle cx="270" cy="270" r="196" class="radar-orbit orbit-outer" />
          <circle cx="270" cy="270" r="132" class="radar-orbit orbit-inner" />
          <circle cx="270" cy="270" r="74" class="radar-orbit orbit-hub" />
          <g class="radar-spokes">${spokesSvg.join('')}</g>
          <line id="radar-active-ray" class="radar-active-ray" x1="270" y1="270" x2="270" y2="270" />
          <g class="radar-ticks">${ticksSvg.join('')}</g>
        </svg>
        <div class="crew-radar-hub" aria-hidden="true">
          <span class="crew-hub-num">${count}</span>
          <span class="crew-hub-lbl">IN THE CREW</span>
        </div>
        <div class="crew-avatar-field">${avatarNodesHtml}</div>
        <div class="crew-tooltip" id="crew-tooltip" role="tooltip" aria-hidden="true">
          <b class="crew-tooltip-name"></b>
          <span class="crew-tooltip-role"></span>
        </div>
      </div>
      <div class="crew-picker-hint" aria-hidden="true">
        <span class="hint-icon">👆</span> Pick a face to find their card
      </div>
    </div>`;
  }

  function heroHTML(page, members, departments) {
    const p = { ...PAGE_DEFAULTS, ...page };
    const list = Array.isArray(members) ? members : [];
    const count = list.length || 33;
    const edition = p.edition || '1st';
    const community = p.community_count || '1,800+';

    return `<section class="hero crew-hero-section">
      <div class="crew-copy-col">
        <div class="crew-eyebrow">
          <span class="crew-pill"><i class="crew-dot" aria-hidden="true"></i> The team</span>
          <span class="crew-meta">${esc(p.eyebrow || "GDG SRU '26 · GDG ON CAMPUS")}</span>
        </div>
        <h1 class="crew-title">The crew<span class="crew-accent-dot" aria-hidden="true"></span><br>behind the day.</h1>
        <p class="lead crew-lead">${esc(p.lead || "GDG on Campus SR University is powered by the student community. These are the people putting everything together, and the crew grows as the community gets closer.")}</p>
        <div class="crew-stats-strip">
          <div class="crew-stat-cell">
            <b class="crew-stat-num">${count}</b>
            <span class="crew-stat-lbl">in the crew</span>
          </div>
          <div class="crew-stat-cell">
            <b class="crew-stat-num">${esc(edition)}</b>
            <span class="crew-stat-lbl">edition</span>
          </div>
          <div class="crew-stat-cell">
            <b class="crew-stat-num">${esc(community)}</b>
            <span class="crew-stat-lbl">in the community</span>
          </div>
        </div>
        <div class="crew-actions">
          <a href="#leadership" class="btn crew-btn-meet" data-team-jump="leadership">Meet the crew <span class="crew-btn-arr" aria-hidden="true">↓</span></a>
          <a href="/join/" class="btn o crew-btn-join">Join GDG SRU <span class="crew-btn-arr" aria-hidden="true">↗</span></a>
        </div>
      </div>
      <div class="crew-constellation-col">
        ${buildRadarConstellation(list)}
      </div>
    </section>`;
  }

  /** Turns raw rows into ordered sections. Departments follow their sort_order (the admin order);
   *  members follow sort_order within their department. Anyone whose department has no row still appears. */
  function arrange(members, departments) {
    const known = new Map();
    (departments || []).forEach((d) => known.set(d.name.toLowerCase(), { ...d, kind: d.kind || 'department' }));
    const buckets = new Map();
    (members || []).forEach((m) => {
      const name = String(m.department || '').trim() || 'Community';
      if (!known.has(name.toLowerCase())) known.set(name.toLowerCase(), { name, slug: slug(name), heading: name, description: '', blurb: '', kind: 'department', sort_order: 500 });
      const key = name.toLowerCase();
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(m);
    });
    const byOrder = (a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) || String(a.name).localeCompare(String(b.name));
    return [...known.entries()]
      .filter(([key]) => buckets.has(key))
      .map(([key, d]) => ({ d, members: buckets.get(key).slice().sort(byOrder) }))
      .sort((a, b) => byOrder(a.d, b.d));
  }

  function pageHTML(data) {
    const members = data.members || [];
    const departments = data.departments || [];
    const groups = arrange(members, departments);
    if (!groups.length) {
      return `${DEFS}${heroHTML(data.page, members, departments)}<section class="tm-sec" data-team-section><div class="tm-head"><div class="tm-head-main"><h2>The team is being updated.</h2><p>Profiles will appear here as soon as they are published.</p></div></div></section>`;
    }
    return DEFS + heroHTML(data.page, members, departments) + groups.map((g) => sectionHTML(g.d, g.members)).join('');
  }

  function bindRadarEvents(root) {
    const radar = (root || document).querySelector('#crew-radar');
    if (!radar || radar.dataset.bound) return;
    radar.dataset.bound = 'true';

    const ray = radar.querySelector('#radar-active-ray');
    const tooltip = radar.querySelector('#crew-tooltip');
    const nameEl = tooltip ? tooltip.querySelector('.crew-tooltip-name') : null;
    const roleEl = tooltip ? tooltip.querySelector('.crew-tooltip-role') : null;
    const buttons = radar.querySelectorAll('.crew-avatar-node');

    function activateNode(btn) {
      buttons.forEach(b => b.classList.toggle('is-active', b === btn));
      const x = btn.dataset.x;
      const y = btn.dataset.y;
      const name = btn.dataset.name;
      const role = btn.dataset.role;

      if (ray && x && y) {
        ray.setAttribute('x2', x);
        ray.setAttribute('y2', y);
        ray.classList.add('is-active');
      }

      if (tooltip && nameEl && roleEl) {
        nameEl.textContent = name;
        roleEl.textContent = role;
        const leftPct = parseFloat(btn.style.left);
        const topPct = parseFloat(btn.style.top);
        tooltip.style.left = `${leftPct}%`;
        const placeBelow = topPct < 32;
        tooltip.style.top = `calc(${topPct}% + ${placeBelow ? '26px' : '-44px'})`;
        tooltip.classList.add('is-visible');
      }
    }

    function deactivateAll() {
      buttons.forEach(b => b.classList.remove('is-active'));
      if (ray) ray.classList.remove('is-active');
      if (tooltip) tooltip.classList.remove('is-visible');
    }

    buttons.forEach((btn) => {
      btn.addEventListener('pointerenter', () => activateNode(btn));
      btn.addEventListener('focus', () => activateNode(btn));

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const name = btn.dataset.name;
        const code = btn.dataset.code;

        const cards = Array.from(document.querySelectorAll('.tm-card'));
        let target = cards.find(c => {
          const cName = c.querySelector('.tm-riso-name')?.textContent?.replace(/\s+/g, ' ').trim() || '';
          return (name && cName.toLowerCase().includes(name.toLowerCase())) ||
                 (code && c.querySelector('.tm-riso-number')?.textContent?.includes(code));
        });

        if (!target && cards.length) target = cards[0];

        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.classList.remove('tm-card-target-focus');
          void target.offsetWidth;
          target.classList.add('tm-card-target-focus');
          setTimeout(() => target.classList.remove('tm-card-target-focus'), 2500);
          target.focus({ preventScroll: true });
        }
      });
    });

    radar.addEventListener('pointerleave', deactivateAll);
    document.addEventListener('pointerdown', (e) => {
      if (!radar.contains(e.target)) deactivateAll();
    });
  }

  async function load(client) {
    if (client) {
      try {
        const [m, d, s] = await Promise.all([
          client.from('public_team_list').select('*').order('sort_order'),
          client.from('public_team_departments').select('*').order('sort_order'),
          client.from('public_site_settings').select('key,value').eq('key', 'team_page')
        ]);
        if (!m.error) {
          const page = s.data?.[0]?.value && typeof s.data[0].value === 'object' ? s.data[0].value : {};
          return { members: m.data || [], departments: d.error ? [] : d.data || [], page, source: 'database' };
        }
        console.warn('[GDG SRU] Team data could not be read from the database.', m.error);
      } catch (e) { console.warn('[GDG SRU] Team data request failed.', e); }
    }
    try {
      const seed = await (await fetch('/assets/data/team-seed.json', { cache: 'no-cache' })).json();
      return { members: (seed.members || []).map((x) => ({ ...x, photo_url: x.photo_path ? location.origin + x.photo_path : '' })), departments: seed.departments || [], page: {}, source: 'offline-seed' };
    } catch { return { members: [], departments: [], page: {}, source: 'none' }; }
  }

  let mounted = false;
  async function mount(client, root) {
    root = root || document.querySelector('[data-team-root]');
    if (!root || mounted) return;
    mounted = true;
    const data = await load(client);
    root.removeAttribute('aria-busy');
    root.innerHTML = pageHTML(data);
    root.dataset.teamSource = data.source;
    bindRadarEvents(root);
  }

  // Broken portrait → fall back to the initials art (no inline handlers, CSP-friendly).
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.classList.contains('tm-riso-photo-image')) return;
    const p = img.closest('.tm-riso-portrait');
    if (p) { p.classList.remove('has-photo'); p.classList.add('no-photo'); }
    img.remove();
  }, true);

  window.GDGTeam = { mount, cardHTML, pageHTML, arrange, normalise, DEFS, PAGE_DEFAULTS, SOCIALS, LEVELS };

  // If the live-data loader never runs (missing config), still show the team after a short wait.
  const fallback = () => setTimeout(() => { if (!mounted) mount(window.supabaseClient || null); }, 6000);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fallback, { once: true }); else fallback();
})();
