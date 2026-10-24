/* GDG SRU certificate engine.
 * Renders a certificate on demand from (template HTML + event fields + recipient name).
 * Nothing is stored: the same inputs always produce the same certificate.
 * Shared by the public Certificates page and the Mission Control preview.
 *
 * Safety model: templates are untrusted text. Every render (1) substitutes escaped values,
 * (2) runs the result through an allowlist sanitizer (no scripts, handlers, forms, iframes,
 * unsafe URLs), (3) shows it in a sandboxed iframe with its own restrictive CSP.
 */
(() => {
  'use strict';

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- URLs ---------- */
  const okUrl = (u) => {
    const t = String(u || '').trim();
    if (!t) return false;
    if (t.startsWith('#')) return true;
    if (t.startsWith('blob:') || t.startsWith('data:image/')) return true;
    return /^https?:\/\/[^\s"'<>]+$/i.test(t);
  };
  const urlKey = (k) => /(^|_)(url|logo|img|image|photo|src)$/.test(k);

  /* ---------- Template language ({{key}}, {{#key}}..{{/key}}, {{^key}}..{{/key}}) ---------- */
  const truthy = (v) => Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : !!v;
  const lookup = (stack, key) => {
    for (let i = stack.length - 1; i >= 0; i--) {
      const o = stack[i];
      if (o && typeof o === 'object' && Object.prototype.hasOwnProperty.call(o, key)) return o[key];
    }
    return '';
  };
  const substituteVars = (text, stack) => text.replace(/\{\{\s*([\w]+)\s*\}\}/g, (_, key) => {
    const v = lookup(stack, key);
    if (Array.isArray(v) || (v && typeof v === 'object')) return '';
    const s = String(v ?? '');
    return urlKey(key) ? (okUrl(s) && !s.startsWith('#') ? esc(s.trim()) : '') : esc(s);
  });
  const findClose = (text, name) => {
    const re = new RegExp(`\\{\\{([#^/])\\s*${name}\\s*\\}\\}`, 'g');
    let depth = 1, m;
    while ((m = re.exec(text))) {
      if (m[1] === '/') { depth--; if (depth === 0) return { start: m.index, end: m.index + m[0].length }; } else depth++;
    }
    return null;
  };
  function renderTemplate(tpl, ctx) {
    const go = (text, stack) => {
      let out = '', rest = text;
      for (;;) {
        const m = /\{\{([#^])\s*(\w+)\s*\}\}/.exec(rest);
        if (!m) { out += substituteVars(rest, stack); return out; }
        out += substituteVars(rest.slice(0, m.index), stack);
        const after = rest.slice(m.index + m[0].length);
        const close = findClose(after, m[2]);
        if (!close) { out += substituteVars(rest.slice(m.index), stack); return out; }
        const inner = after.slice(0, close.start), val = lookup(stack, m[2]);
        if (m[1] === '^') { if (!truthy(val)) out += go(inner, stack); }
        else if (Array.isArray(val)) val.forEach((item) => { out += go(inner, stack.concat([item])); });
        else if (truthy(val)) out += go(inner, stack);
        rest = after.slice(close.end);
      }
    };
    return go(String(tpl || ''), [ctx]);
  }

  /* ---------- Sanitizer ---------- */
  const TAGS = new Set(('html head body title meta link style div span p h1 h2 h3 h4 h5 h6 b i u s strong em small sub sup br hr img a ul ol li ' +
    'table thead tbody tfoot tr td th caption section header footer main article aside figure figcaption blockquote code pre ' +
    'svg g path circle ellipse rect line polyline polygon text tspan defs lineargradient radialgradient stop clippath mask pattern symbol').split(' '));
  const ATTRS = new Set(('class id style title lang dir role alt width height src href colspan rowspan rel charset name content ' +
    'viewbox d fill stroke stroke-width stroke-linecap stroke-linejoin stroke-dasharray stroke-dashoffset stroke-opacity fill-opacity fill-rule clip-rule ' +
    'opacity cx cy r rx ry x y x1 y1 x2 y2 points transform offset stop-color stop-opacity gradientunits gradienttransform preserveaspectratio xmlns ' +
    'font-family font-size font-weight text-anchor letter-spacing dominant-baseline clip-path mask patternunits fx fy').split(' '));

  const cssSafe = (css) => String(css || '')
    .replace(/\\/g, '')                                        // no CSS escapes (blocks url()/expression obfuscation)
    .replace(/@import[^;{}]*;?/gi, '')
    .replace(/expression\s*\(/gi, 'blocked(')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/-moz-binding|behavior\s*:/gi, 'blocked')
    .replace(/url\(\s*(['"]?)([\s\S]*?)\1\s*\)/gi, (m, _q, u) => (okUrl(u) || /^https:\/\/fonts\.gstatic\.com\//i.test(u.trim())) ? m : 'none');

  function sanitize(html) {
    const removed = new Set();
    const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
    const nodes = [...doc.querySelectorAll('*')];
    for (const el of nodes) {
      if (!el.isConnected) continue;
      const tag = el.tagName.toLowerCase();
      let keep = TAGS.has(tag);
      if (keep && tag === 'meta') keep = el.hasAttribute('charset') || (el.getAttribute('name') || '').toLowerCase() === 'viewport';
      if (keep && tag === 'link') keep = (el.getAttribute('rel') || '').toLowerCase() === 'stylesheet' && /^https:\/\/fonts\.googleapis\.com\//i.test(el.getAttribute('href') || '');
      if (!keep) { removed.add(`<${tag}>`); el.remove(); continue; }
      for (const attr of [...el.attributes]) {
        const n = attr.name.toLowerCase();
        let ok = ATTRS.has(n) || n.startsWith('data-') || n.startsWith('aria-');
        if (n.startsWith('on')) ok = false;
        if (ok && (n === 'src' || n === 'href')) {
          const v = attr.value.trim();
          if (tag === 'a' && n === 'href') ok = /^(https?:|mailto:|#)/i.test(v);
          else if (tag === 'link') ok = true;
          else ok = okUrl(v);
        }
        if (ok && n === 'style') el.setAttribute('style', cssSafe(attr.value));
        else if (ok && /url\s*\(/i.test(attr.value) && n !== 'style') el.setAttribute(attr.name, cssSafe(attr.value));
        if (!ok) { removed.add(`${n} attribute`); el.removeAttribute(attr.name); }
      }
      if (tag === 'a') { el.setAttribute('rel', 'noopener noreferrer'); el.setAttribute('target', '_blank'); }
      if (tag === 'style') el.textContent = cssSafe(el.textContent);
    }
    return { html: '<!doctype html>\n' + doc.documentElement.outerHTML, removed: [...removed] };
  }

  const FRAME_CSP = "default-src 'none'; img-src 'self' data: blob:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com data:";
  const withFrameCsp = (html) => html.replace(/<head>/i, `<head><meta http-equiv="Content-Security-Policy" content="${FRAME_CSP}">`);

  /* ---------- Fields ---------- */
  const currentYear = String(new Date().getFullYear());
  const DEFAULT_FIELDS = {
    org_title: 'Google Developer Groups', org_subtitle: 'On Campus SR University', logo_url: '',
    cert_tag: 'OFFICIAL CREDENTIAL', cert_title: 'Certificate of Participation', statement: 'This document certifies that',
    achievement_text: 'has successfully attended and contributed to', hosted_by_text: 'hosted by', on_text: 'on',
    event_name: '', event_subtitle: '', event_venue: '', event_category: '', duration: '', tags: '', issuer_name: 'GDG on Campus SR University', chapter: '', host_chapter: '', date: '', date_short: '',
    custom_field_defs: [],
    dev_tag: '',
    node_pill: '',
    partner_sticker: '',
    dossier_tag: '',
    track: '',
    skills: '',
    syllabus: '',
    curriculum_text: '',
    curriculum_status: 'STATUS: COMPLETED',
    curriculum_bullets: [],
    watermark_text: '', watermark_year: currentYear,
    cohosts: [],
    sponsors: [],
    signatories: [],
  };
  // Shown in Mission Control as the editable fields (in this order).
  const FIELD_DEFS = [
    ['track', 'Track Name (e.g. AI & Cloud, Web Development)'],
    ['skills', 'Skills & Competencies (comma separated)'],
    ['curriculum_text', 'Topic / Curriculum Overview (optional)', 'textarea'],
    ['dev_tag', 'Tech Badge Tag'],
    ['node_pill', 'Active Node Pill'],
    ['partner_sticker', 'Partner Pill Sticker (optional)'],
    ['dossier_tag', 'Dossier Tag Sticker'],
    ['event_name', 'Event Name Override (blank = event title)'],
    ['cert_title', 'Certificate Title (default: Certificate of Participation)'],
    ['cert_tag', 'Top Badge Tag (default: OFFICIAL CREDENTIAL)'],
    ['host_chapter', 'Chapter Name'],
    ['date', 'Date Text (blank = event date)'],
  ];
  const PLACEHOLDERS = ['recipient_name', 'credential_id', 'event_name', 'event_subtitle', 'event_venue', 'event_category', 'duration', 'tags', 'issuer_name', 'chapter', 'host_chapter', 'date', 'date_short', 'logo_url', 'gdg_custom_logo', 'track', 'skills', 'dev_tag', 'node_pill', 'partner_sticker', 'dossier_tag', 'custom_field_defs'].concat(FIELD_DEFS.map((f) => f[0])).filter((v, i, a) => a.indexOf(v) === i);

  const fmtDate = (d, opts) => { try { return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', ...opts }).format(d); } catch { return ''; } };
  const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

  function buildContext(p) {
    const f = { ...DEFAULT_FIELDS, ...(p.fields || {}) };
    const d = p.event_start ? new Date(p.event_start) : null, valid = d && !Number.isNaN(d.getTime());
    const long = f.date || (valid ? fmtDate(d, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
    const short = f.date_short || (valid ? fmtDate(d, { day: 'numeric', month: 'short', year: 'numeric' }) : '');
    const rawSkills = Array.isArray(f.skills)
      ? f.skills.map((x) => (typeof x === 'object' && x !== null ? (x.tag || x.name || x.label || '') : String(x))).filter(Boolean).join(', ')
      : String(f.skills || '');
    const skills = rawSkills.split(',').map((s) => s.trim()).filter(Boolean).map((s) => ({
      tag: s.startsWith('#') ? s : '#' + s.replace(/\s+/g, '')
    }));
    const rawCurriculum = String(f.curriculum_text || f.syllabus || '');
    const curriculumLines = rawCurriculum.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    const curriculumBullets = (Array.isArray(f.curriculum_bullets) && f.curriculum_bullets.length)
      ? f.curriculum_bullets
      : (f.curriculum_bullets === true ? curriculumLines.map((text) => ({ text })) : []);
    const cohosts = Array.isArray(f.cohosts) ? f.cohosts : [];
    const sponsors = Array.isArray(f.sponsors) ? f.sponsors : [];
    const partners = (Array.isArray(f.partners) && f.partners.length) ? f.partners : [...cohosts, ...sponsors];

    const logoH = Number(f.gdg_logo_size) || 60;
    const logoX = Number(f.gdg_logo_x) || 0;
    const logoY = Number(f.gdg_logo_y) || 0;
    const maxW = Math.max(320, Math.round(logoH * 5));
    const gdgLogoStyle = f.gdg_logo_style || `height:${logoH}px;max-height:${logoH}px;max-width:${maxW}px;object-fit:contain;display:block;transform:translate(${logoX}px,${logoY}px);`;

    return {
      ...f,
      recipient_name: p.recipient_name || '', name: p.recipient_name || '', credential_id: p.credential_id || '',
      event_name: f.event_name || p.event_title || '',
      host_chapter: f.chapter_name || f.host_chapter || f.chapter || 'GDG on Campus SR University',
      chapter: f.chapter_name || f.host_chapter || f.chapter || 'GDG on Campus SR University',
      chapter_name: f.chapter_name || f.host_chapter || f.chapter || 'GDG on Campus SR University',
      gdg_custom_logo: f.gdg_custom_logo || '',
      gdg_logo_style: gdgLogoStyle,
      hide_chapter_text: !!f.hide_chapter_text,
      date: long,
      date_short: short,
      watermark_year: f.watermark_year || (valid ? String(d.getFullYear()) : currentYear),
      skills,
      raw_skills: rawSkills,
      curriculum_text: rawCurriculum,
      syllabus: rawCurriculum,
      curriculum_status: f.curriculum_status || 'STATUS: COMPLETED',
      curriculum_bullets: curriculumBullets,
      cohosts,
      sponsors,
      partners,
      signatories: Array.isArray(f.signatories) ? f.signatories : [],
    };
  }

  /** payload: {template_html, recipient_name, credential_id, event_title, event_start, fields}. */
  function buildDocument(payload) {
    const rendered = renderTemplate(payload.template_html, buildContext(payload));
    const clean = sanitize(rendered);
    return { html: withFrameCsp(clean.html), removed: clean.removed };
  }

  /* ---------- Browser side: preview + export ---------- */
  function fitName(doc) {
    const el = doc.querySelector('[data-fit-name]'); if (!el || !el.parentElement) return;
    const max = el.parentElement.clientWidth, MAX = 52, MIN1 = 42, MIN2 = 34;
    el.style.transition = 'none';
    const set = (s) => { el.style.fontSize = s + 'px'; };
    el.style.whiteSpace = 'nowrap';
    let size = MAX; set(size);
    const border = el.offsetWidth - el.clientWidth;
    while (el.scrollWidth + border > max && size > MIN1) { size--; set(size); }
    if (el.scrollWidth + border <= max) return;
    el.style.whiteSpace = 'normal'; size = 46; set(size);
    const tooTall = () => (el.clientHeight - 18) > size * 1.1 * 2 + 4 || el.scrollWidth > el.clientWidth + 1;
    while (tooTall() && size > MIN2) { size--; set(size); }
  }

  /** Mounts the certificate into `container` (scaled to fit its width). Returns the iframe. */
  async function mount(container, html) {
    container.textContent = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:100%;overflow:hidden;background:#fff;border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,.18);aspect-ratio:1123/794;';

    const frame = document.createElement('iframe');
    frame.setAttribute('sandbox', 'allow-same-origin');
    frame.setAttribute('title', 'Certificate preview');
    frame.setAttribute('scrolling', 'no');
    frame.style.cssText = 'width:1123px!important;min-width:1123px!important;max-width:1123px!important;height:794px!important;min-height:794px!important;max-height:794px!important;border:0;display:block;background:#fff;transform-origin:0 0;position:absolute;left:0;top:0;';
    wrap.appendChild(frame);
    container.appendChild(wrap);

    const rescale = () => {
      const w = wrap.clientWidth || container.clientWidth || 360;
      const s = Math.min(1, w / 1123) || 1;
      frame.style.transform = `scale(${s})`;
      wrap.style.height = Math.round(794 * s) + 'px';
    };
    rescale();
    if (window.ResizeObserver) new ResizeObserver(rescale).observe(wrap);
    else addEventListener('resize', rescale);

    await new Promise((res) => { frame.onload = res; frame.srcdoc = html; });
    const doc = frame.contentDocument;
    try { await Promise.race([doc.fonts.ready, new Promise((r) => setTimeout(r, 4000))]); } catch { /* fonts are best effort */ }
    fitName(doc);

    // On mobile screens and desktop, create an image overlay from canvas so mobile browsers never reflow or clip the iframe!
    try {
      const canvas = await toCanvas(frame);
      const img = document.createElement('img');
      img.src = canvas.toDataURL('image/png');
      img.alt = 'Certificate preview';
      img.style.cssText = 'width:100%;height:auto;display:block;border-radius:8px;position:relative;z-index:2;pointer-events:auto;';
      wrap.style.height = 'auto';
      wrap.style.aspectRatio = 'auto';
      frame.style.opacity = '0';
      frame.style.pointerEvents = 'none';
      frame.style.zIndex = '1';
      wrap.appendChild(img);
    } catch (e) {
      console.warn('Canvas preview notice:', e);
      rescale();
    }

    return frame;
  }

  // PDF libraries: self-hosted copy in /assets/vendor if present, otherwise the pinned cdnjs build with SRI.
  const LIBS = {
    html2canvas: [
      { src: '/assets/vendor/html2canvas.min.js' },
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', integrity: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H' }
    ],
    jspdf: [
      { src: '/assets/vendor/jspdf.umd.min.js' },
      { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js', integrity: 'sha384-JcnsjUPPylna1s1fvi1u12X5qjY5OL56iySh75FdtrwhO/SWXgMjoVqcKyIIWOLk' }
    ],
  };
  const loaded = {};
  const tryScript = (entry) => new Promise((res, rej) => {
    const s = document.createElement('script');
    const src = typeof entry === 'string' ? entry : entry.src;
    s.src = src;
    if (entry && entry.integrity) {
      s.integrity = entry.integrity;
      s.crossOrigin = 'anonymous';
    }
    s.onload = res;
    s.onerror = () => { s.remove(); rej(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
  const loadScript = (name) => loaded[name] || (loaded[name] = (async () => { let err; for (const src of LIBS[name]) { try { return await tryScript(src); } catch (e) { err = e; } } loaded[name] = null; throw err; })());
  const safeName = (s) => String(s || 'Certificate').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 80) || 'Certificate';

  async function toCanvas(frame) {
    try {
      if (frame.contentDocument?.fonts?.ready) {
        await Promise.race([frame.contentDocument.fonts.ready, new Promise((r) => setTimeout(r, 2000))]);
      }
    } catch (_) {}
    await loadScript('html2canvas');
    const doc = frame.contentDocument, el = doc.getElementById('certificate') || doc.body.firstElementChild;
    return window.html2canvas(el, { scale: 2, width: 1123, height: 794, backgroundColor: '#F8F9FA', useCORS: true, logging: false, windowWidth: 1123, windowHeight: 794 });
  }
  async function downloadPdf(frame, name) {
    const canvas = await toCanvas(frame); await loadScript('jspdf');
    const pdf = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
    pdf.save(safeName(name) + '.pdf');
  }
  async function downloadPng(frame, name) {
    const canvas = await toCanvas(frame);
    const a = document.createElement('a'); a.href = canvas.toDataURL('image/png'); a.download = safeName(name) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
  }
  async function getPngBlob(frame) {
    const canvas = await toCanvas(frame);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  }
  async function copyPngToClipboard(frame) {
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') return false;
    try {
      const blob = await getPngBlob(frame);
      if (!blob) return false;
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch (e) {
      console.warn('[GDG Cert] Could not copy PNG to clipboard:', e);
      return false;
    }
  }

  window.GDGCert = { esc, renderTemplate, sanitize, buildContext, buildDocument, mount, fitName, downloadPdf, downloadPng, toCanvas, getPngBlob, copyPngToClipboard, DEFAULT_FIELDS, FIELD_DEFS, PLACEHOLDERS, safeName };
})();
