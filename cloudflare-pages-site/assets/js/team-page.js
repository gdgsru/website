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
    eyebrow: 'GDG SRU / TEAM', title_top: 'Meet the', title_accent: 'team.', lead: 'The people behind the community.',
    cta_label: 'Meet everyone', map_label: 'THE TEAM', core_small: 'GDG SRU', core_big: 'One team.'
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

  const D_COLORS = {
    b: '#4285f4',
    g: '#34a853',
    y: '#f9ab00',
    r: '#ea4335'
  };
  const GOOGLE_COLORS = [D_COLORS.b, D_COLORS.g, D_COLORS.y, D_COLORS.r];

  function getPetalSvg(kind, size, i) {
    switch (kind) {
      case 'sparkle':
        return `<g transform="scale(${(size / 16).toFixed(3)})"><path class="bloom__petal" d="M0 -16C2.6 -2.6 2.6 -2.6 16 0 2.6 2.6 2.6 2.6 0 16 -2.6 2.6 -2.6 2.6 -16 0 -2.6 -2.6 -2.6 -2.6 0 -16Z" fill="${D_COLORS.b}"/></g>`;
      case 'chip':
        return `<g transform="scale(${(size / 11.6).toFixed(3)})"><g class="bloom__petal"><circle r="10" fill="#fff" stroke="${D_COLORS.g}" stroke-width="3.2"/><path d="M-11.6 0A11.6 11.6 0 0 0 11.6 0Z" fill="${D_COLORS.g}"/></g></g>`;
      case 'petal':
        return `<g transform="scale(${(size / 17).toFixed(3)})"><path class="bloom__petal" d="M0 -17C9 -8 9 6 0 14 -9 6 -9 -8 0 -17Z" fill="${D_COLORS.y}"/></g>`;
      case 'ray':
        return `<rect class="bloom__petal" x="${(-size * 0.25).toFixed(2)}" y="${(-size).toFixed(2)}" width="${(size * 0.5).toFixed(2)}" height="${(size * 2).toFixed(2)}" rx="${(size * 0.25).toFixed(2)}" fill="${D_COLORS.r}"/>`;
      case 'dots':
        const r = (i % 2) ? (size * 0.6).toFixed(2) : size.toFixed(2);
        const color = GOOGLE_COLORS[i % 4];
        return `<circle class="bloom__petal" r="${r}" fill="${color}"/>`;
    }
    return '';
  }

  function renderArtRing(r, kind, size) {
    const spacing = kind === 'dots' ? size * 4.2 : kind === 'ray' ? size * 1.6 : size * 3;
    const count = Math.max(6, Math.round((2 * Math.PI * r) / spacing));
    const petals = [];
    for (let i = 0; i < count; i++) {
      const deg = ((i / count) * 360).toFixed(2);
      petals.push(`<g transform="rotate(${deg}) translate(0 ${-r})">${getPetalSvg(kind, size, i)}</g>`);
    }
    return `<g class="bloom__art-ring" data-radius="${r}">${petals.join('')}</g>`;
  }

  function buildBloomConstellation(members) {
    const list = Array.isArray(members) ? members : [];
    const count = list.length || 18;

    // Distribute members across 2 concentric rings with proper leadership hierarchy:
    // Inner ring (6 core leads & advisors): Narayan Bora, Siddhartha Bhattacharyya, Uttam Chaurasia, Rahul, Gagan, Eshwari
    const INNER_TARGETS = [
      /narayan\s*bora/i,
      /siddhartha/i,
      /uttam/i,
      /\brahul\b/i,
      /\bgagan\b/i,
      /\beshwari\b/i
    ];

    const innerList = [];
    const outerList = [];
    const assigned = new Set();

    INNER_TARGETS.forEach((re) => {
      const idx = list.findIndex((m, i) => !assigned.has(i) && re.test(String(m?.name || '')));
      if (idx !== -1) {
        innerList.push(list[idx]);
        assigned.add(idx);
      }
    });

    // Fallback: if list doesn't match targets or has fewer, backfill inner up to 6 by role
    if (innerList.length < 6) {
      list.forEach((m, idx) => {
        if (!assigned.has(idx) && innerList.length < 6) {
          const role = String(m?.role || '').toLowerCase();
          const level = String(m?.level || '').toLowerCase();
          if (level === 'lead' || /lead|advisor|organizer/i.test(role)) {
            innerList.push(m);
            assigned.add(idx);
          }
        }
      });
    }

    // Outer ring gets all remaining members
    list.forEach((m, idx) => {
      if (!assigned.has(idx)) {
        outerList.push(m);
      }
    });

    const ring0_r = 50;
    const ring1_r = 82;
    const avatarD = 12.5; // diameter %

    // SVG art rings exactly as defined in CCD Kochi reference
    const artSvg = [
      `<circle r="${ring0_r}" class="bloom__guide"/>`,
      `<circle r="${ring1_r}" class="bloom__guide"/>`,
      `<circle r="26.5" class="bloom__guide"/>`,
      renderArtRing(36, 'sparkle', 4),
      renderArtRing(66, 'chip', 4.6),
      renderArtRing(91.5, 'ray', 2.3),
      renderArtRing(98.6, 'dots', 1)
    ];

    function renderRing(ringList, r, ringIdx) {
      const total = ringList.length;
      return ringList.map((raw, idx) => {
        const m = normalise(raw);
        const angle = (-90 + (ringIdx % 2 ? 180 / total : 0) + (idx / total) * 360) * Math.PI / 180;
        const cx = (50 + (r / 2) * Math.cos(angle)).toFixed(2);
        const cy = (50 + (r / 2) * Math.sin(angle)).toFixed(2);
        const color = GOOGLE_COLORS[(ringIdx * 6 + idx) % 4];
        const ini = initials(m.name);
        const photo = m.photo;

        return `<button type="button" class="bloom__face" style="left:${cx}%;top:${cy}%;--c:${color};" aria-label="${esc(m.name)}, ${esc(m.role)}. Go to their card" data-member-name="${esc(m.name)}" data-member-code="${esc(m.code || '')}">
          <span class="bloom__upright">
            <span class="bloom__pop">
              <span class="bloom__photo">
                ${photo ? `<img src="${esc(photo)}" alt="${esc(m.name)}" loading="eager" decoding="async" draggable="false">` : `<span class="crew-photo__initials">${esc(ini)}</span>`}
              </span>
            </span>
            <span class="bloom__tag" aria-hidden="true">${esc(m.name)}</span>
          </span>
        </button>`;
      }).join('');
    }

    const ringsHtml = [
      `<div class="bloom__ring" data-ring-idx="0">${renderRing(innerList, ring0_r, 0)}</div>`,
      `<div class="bloom__ring" data-ring-idx="1">${renderRing(outerList, ring1_r, 1)}</div>`
    ].join('');

    return `<div class="bloom" id="crew-bloom" style="--d:${avatarD}%;">
      <svg class="bloom__art" viewBox="-100 -100 200 200" aria-hidden="true">
        ${artSvg.join('')}
      </svg>
      <button class="bloom__hub" type="button" aria-label="${count} in the crew. Give the flower a spin">
        <span class="bloom__hub-in">
          <span class="bloom__count">${count}</span>
          <span class="bloom__labels" aria-hidden="true">
            <span class="bloom__label">in the crew</span>
            <span class="bloom__label bloom__label--spin">give it a spin</span>
          </span>
        </span>
      </button>
      ${ringsHtml}
    </div>`;
  }

  function heroHTML(page, members, departments) {
    const p = { ...PAGE_DEFAULTS, ...page };
    const list = Array.isArray(members) ? members : [];
    const count = list.length || 18;
    const edition = p.edition || '3rd';
    const community = p.community_count || '2,000+';

    return `<section class="crew-hero" aria-labelledby="crew-title">
      <div class="crew-hero__copy">
        <div class="section-eyebrow">
          <span class="pill crew__pill"><i class="crew__pill-dot" aria-hidden="true"></i> The team</span>
          <span class="eyebrow">${esc(p.eyebrow || "GDG SRU '26 ┬╖ GDG ON CAMPUS")}</span>
        </div>
        <h1 class="crew-hero__title" id="crew-title">
          <span class="crew-hero__mask">
            <span class="crew-hero__line">The <span class="crew-hero__word"><span class="crew-hero__trail" aria-hidden="true"></span><span class="crew-hero__text">crew</span><span class="crew-hero__head" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#fff" stroke="#34a853" stroke-width="2.8"/><path d="M2 12A10 10 0 0 0 22 12Z" fill="#34a853"/></svg></span></span></span>
          </span>
          <span class="crew-hero__mask">
            <span class="crew-hero__line">behind the day.</span>
          </span>
        </h1>
        <p class="crew-hero__lede">${esc(p.lead || "GDG on Campus SR University is powered by the student community. These are the people putting the 3rd edition together, and the crew grows as the community gets closer.")}</p>
        <dl class="crew-hero__stats">
          <div>
            <dt class="sr-only">Crew</dt>
            <dd><strong>${count}</strong><span>in the crew</span></dd>
          </div>
          <div>
            <dt class="sr-only">Edition</dt>
            <dd><strong class="stat-highlight stat-edition">${esc(edition)}</strong><span>edition</span></dd>
          </div>
          <div>
            <dt class="sr-only">Community</dt>
            <dd><strong class="stat-highlight stat-community">${esc(community)}</strong><span>verified in community</span></dd>
          </div>
        </dl>
        <div class="crew-hero__ctas">
          <a href="#leadership" class="btn crew-btn crew-btn-primary" data-team-jump="leadership"><span>Meet the crew</span> <span class="btn__arrow" aria-hidden="true">Γåô</span></a>
          <a href="/join/" class="btn o crew-btn crew-btn-secondary"><span>Join GDG SRU</span> <span class="btn__arrow" aria-hidden="true">Γåù</span></a>
        </div>
      </div>
      <div class="crew-hero__bloom">
        ${buildBloomConstellation(list)}
        <p class="crew-hero__hint" aria-hidden="true"><span>≡ƒæå</span> Pick a face to find their card</p>
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
    const groups = arrange(data.members, data.departments);
    const members = data.members || [];
    const departments = data.departments || [];
    if (!groups.length) {
      return `${DEFS}${heroHTML(data.page, members, departments)}<section class="tm-sec" data-team-section><div class="tm-head"><div class="tm-head-main"><h2>The team is being updated.</h2><p>Profiles will appear here as soon as they are published.</p></div></div></section>`;
    }
    return DEFS + heroHTML(data.page, members, departments) + groups.map((g) => sectionHTML(g.d, g.members)).join('');
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

  function bindRadarEvents(root) {
    const bloom = (root || document).querySelector('#crew-bloom');
    if (!bloom) return;

    const hubBtn = bloom.querySelector('.bloom__hub');
    const rings = Array.from(bloom.querySelectorAll('.bloom__ring'));
    const artRings = Array.from(bloom.querySelectorAll('.bloom__art-ring'));
    const faces = Array.from(bloom.querySelectorAll('.bloom__face'));

    const anims = [];

    // 1. Continuous smooth counter-rotation for avatar rings and uprights
    rings.forEach((ring, idx) => {
      const dir = (idx % 2) ? -360 : 360;
      const duration = (110 + idx * 40) * 1000;
      const anim = ring.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${dir}deg)` }
      ], {
        duration,
        iterations: Infinity,
        easing: 'linear'
      });
      anims.push(anim);

      // Counter-rotate the uprights so avatars remain right side up!
      const uprights = ring.querySelectorAll('.bloom__upright');
      uprights.forEach((u) => {
        const uAnim = u.animate([
          { transform: 'rotate(0deg)' },
          { transform: `rotate(${-dir}deg)` }
        ], {
          duration,
          iterations: Infinity,
          easing: 'linear'
        });
        anims.push(uAnim);
      });
    });

    // 2. Rotate art rings in SVG
    artRings.forEach((artRing, idx) => {
      const dir = (idx % 2) ? 360 : -360;
      const duration = (70 + idx * 25) * 1000;
      const anim = artRing.animate([
        { transform: 'rotate(0deg)' },
        { transform: `rotate(${dir}deg)` }
      ], {
        duration,
        iterations: Infinity,
        easing: 'linear'
      });
      anims.push(anim);
    });

    // 3. Pause when not visible on screen
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(([entry]) => {
        const visible = !!entry?.isIntersecting;
        anims.forEach((a) => {
          if (visible) {
            try { a.play(); } catch (_) {}
          } else {
            try { a.pause(); } catch (_) {}
          }
        });
      });
      observer.observe(bloom);
    }

    // 4. Smooth slow down on hover, resume on leave
    let currentRate = 1;
    let rateRaf = null;

    function setRate(target, duration = 0.6) {
      if (rateRaf) cancelAnimationFrame(rateRaf);
      const start = currentRate;
      const t0 = performance.now();
      function step(now) {
        const p = Math.min(1, (now - t0) / (duration * 1000));
        const ease = 1 - Math.pow(1 - p, 3);
        currentRate = start + (target - start) * ease;
        anims.forEach((a) => {
          try { a.playbackRate = currentRate; } catch (_) {}
        });
        if (p < 1) rateRaf = requestAnimationFrame(step);
      }
      rateRaf = requestAnimationFrame(step);
    }

    bloom.addEventListener('pointerenter', () => {
      if (!bloom.classList.contains('is-spinning')) setRate(0, 0.5);
    });
    bloom.addEventListener('pointerleave', () => {
      if (!bloom.classList.contains('is-spinning')) setRate(1, 0.9);
    });

    // 5. Hub click: Spin burst with sparks and pop waves
    if (hubBtn) {
      hubBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (bloom.classList.contains('is-spinning')) return;
        bloom.classList.add('is-spinning');

        // Accelerate spin rate up to 28 then slow down to 1
        setRate(28, 0.35);
        setTimeout(() => {
          setRate(1, 2.5);
          setTimeout(() => {
            bloom.classList.remove('is-spinning');
          }, 2600);
        }, 400);

        // Hub elastic pulse
        const hubIn = hubBtn.querySelector('.bloom__hub-in');
        if (hubIn) {
          hubIn.animate([
            { transform: 'scale(0.88)' },
            { transform: 'scale(1.08)' },
            { transform: 'scale(1)' }
          ], { duration: 800, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
        }

        // Staggered pop wave on faces
        const pops = bloom.querySelectorAll('.bloom__pop');
        pops.forEach((pop) => {
          const delay = Math.random() * 320;
          setTimeout(() => {
            pop.animate([
              { transform: 'scale(1)' },
              { transform: 'scale(1.28)' },
              { transform: 'scale(1)' }
            ], { duration: 420, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
          }, delay);
        });

        // 18 flying Google spark particles
        const rect = bloom.getBoundingClientRect();
        const radius = rect.width * 0.44;
        const sparkColors = ['#4285f4', '#34a853', '#f9ab00', '#ea4335'];
        for (let s = 0; s < 18; s++) {
          const spark = document.createElement('span');
          spark.className = 'bloom__spark';
          const c = sparkColors[s % 4];
          spark.innerHTML = `<svg viewBox="0 0 32 32"><path d="M16 0C18 10 22 14 32 16 22 18 18 22 16 32 14 22 10 18 0 16 10 14 14 10 16 0Z" fill="${c}"/></svg>`;
          bloom.appendChild(spark);

          const angle = (s / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
          const dist = radius * (0.6 + Math.random() * 0.45);
          const tx = Math.cos(angle) * dist;
          const ty = Math.sin(angle) * dist;
          const rot = (Math.random() - 0.5) * 720;

          const sparkAnim = spark.animate([
            { transform: 'translate(0, 0) scale(0.2) rotate(0deg)', opacity: 1 },
            { transform: `translate(${tx}px, ${ty}px) scale(${0.8 + Math.random() * 0.5}) rotate(${rot}deg)`, opacity: 0 }
          ], {
            duration: 900 + Math.random() * 400,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)'
          });
          sparkAnim.onfinish = () => spark.remove();
        }
      });
    }

    // 6. 3D Parallax tilt on mouse move
    const heroSection = bloom.closest('.crew-hero') || bloom;
    heroSection.addEventListener('pointermove', (e) => {
      if (window.innerWidth <= 900) return;
      const rect = bloom.getBoundingClientRect();
      const nx = (e.clientX - (rect.left + rect.width / 2)) / (window.innerWidth / 2);
      const ny = (e.clientY - (rect.top + rect.height / 2)) / (window.innerHeight / 2);
      const rotY = Math.max(-10, Math.min(10, nx * 14));
      const rotX = Math.max(-10, Math.min(10, -ny * 14));
      bloom.style.transform = `perspective(1100px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg)`;
    });
    heroSection.addEventListener('pointerleave', () => {
      bloom.style.transform = 'perspective(1100px) rotateX(0deg) rotateY(0deg)';
      bloom.style.transition = 'transform 0.6s ease-out';
      setTimeout(() => { bloom.style.transition = ''; }, 600);
    });

    // 7. Click on avatar: Scroll to their card in the grid below with focus pulse
    faces.forEach((face) => {
      face.addEventListener('click', (e) => {
        e.preventDefault();
        const name = face.dataset.memberName;
        const code = face.dataset.memberCode;

        const cards = Array.from(document.querySelectorAll('.tm-card'));
        let target = cards.find((c) => {
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
