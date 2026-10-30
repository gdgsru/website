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

  function heroHTML(page, nodes) {
    const p = { ...PAGE_DEFAULTS, ...page };
    const [ey1, ...ey2] = String(p.eyebrow).split(' / ');
    const core = String(p.core_big).trim().split(/\s+/), last = core.pop();
    const count = nodes.length;
    return `<section class="hero team-hero halic-inspired-hero team-portal-hero" data-team-design="team-portal"><div class="team-portal-copy"><span class="team-portal-eyebrow"><i></i> ${esc(ey1)}${ey2.length ? ` <span>/</span> ${esc(ey2.join(' / '))}` : ''}</span><h1>${esc(p.title_top)}<br><span>${esc(p.title_accent)}</span></h1><p class="lead">${esc(p.lead)}</p><div class="halic-hero-actions"><button type="button" class="btn" data-team-jump="leadership">${esc(p.cta_label)} <span aria-hidden="true">↘</span></button></div></div>
<div class="team-constellation" aria-label="An interactive map of the GDG SRU community"><div class="constellation-head"><span><i></i> ${esc(p.map_label)}</span></div>
<svg class="constellation-lines" viewBox="0 0 520 430" aria-hidden="true" preserveAspectRatio="none"><path d="M260 216 L110 92 L350 78 L425 190 L360 340 L142 350 L110 92 L425 190 L142 350 L350 78 L360 340 L260 216"/><path d="M110 92 L260 216 L425 190 M350 78 L260 216 L142 350"/></svg>
<div class="constellation-core" aria-label="${esc(p.core_small)} team"><small class="core-eyebrow">${esc(p.core_small)}</small><b>${core.length ? esc(core.join(' ')) + ' ' : ''}<em>${esc(last || '')}</em></b></div>
${nodes.map(({ d, n }, i) => `<button type="button" class="department-orbit-node department-node-${i + 1}" data-team-jump="${sectionId(d)}" aria-label="Explore ${esc(d.heading || d.name)} department"><span class="department-node-dot"></span><span class="department-node-copy"><b>${esc(d.name)}</b><small>${esc(d.blurb || `${n} ${n === 1 ? 'person' : 'people'}`)}</small></span><span class="department-node-arrow" aria-hidden="true">↗</span></button>`).join('')}
<div class="constellation-footer"><span>ONE TEAM · ${count} DEPARTMENT${count === 1 ? '' : 'S'}</span><span>SELECT A DEPARTMENT ↗</span></div></div></section>`;
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
    if (!groups.length) {
      return `${DEFS}${heroHTML(data.page, [])}<section class="tm-sec" data-team-section><div class="tm-head"><div class="tm-head-main"><h2>The team is being updated.</h2><p>Profiles will appear here as soon as they are published.</p></div></div></section>`;
    }
    const nodes = groups.filter((g) => g.d.kind === 'department').slice(0, 5).map((g) => ({ d: g.d, n: g.members.length }));
    return DEFS + heroHTML(data.page, nodes) + groups.map((g) => sectionHTML(g.d, g.members)).join('');
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
