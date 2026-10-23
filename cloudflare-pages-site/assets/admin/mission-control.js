/* Mission Control — private administration for GDG SRU.
 * This file is the shell: sign-in, navigation, routing, the command palette, drawers, dialogs and
 * the helpers every screen shares (exposed as window.MC). Screens load on demand:
 *   mc-overview.js  mc-content.js (events, blog, resources)  mc-team.js  mc-extra.js (leaderboard, settings)
 *   certificates-admin.js (attendance, certificates)
 * Access is enforced by Supabase Auth + the admin_users allowlist and row-level security, never by this UI.
 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  window.$ = $;
  window.$$ = $$;
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
  const slugify = (s) => String(s || '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90) || `item-${Date.now()}`;
  const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
  const textValue = (v) => typeof v === 'string' ? v : v == null ? '' : JSON.stringify(v);
  const msg = (text, good = false) => `<div class="msg ${good ? 'ok' : 'err'}" role="status">${esc(text)}</div>`;
  const formObject = (form) => { const out = {}; for (const [k, v] of new FormData(form)) out[k] = String(v).trim(); return out; };

  // Event times are entered and shown in IST whatever the browser's timezone is.
  const IST_MS = 330 * 60 * 1000;
  const istToIso = (v) => { const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - IST_MS).toISOString() : null; };
  const isoToIst = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() + IST_MS).toISOString().slice(0, 16); };
  const when = (v, tz = 'Asia/Kolkata') => { if (!v) return 'Date to be announced'; const d = new Date(v); if (Number.isNaN(d.getTime())) return 'Date to be announced'; try { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: tz }).format(d); } catch { return d.toLocaleString(); } };
  const ago = (v) => { const s = (Date.now() - new Date(v).getTime()) / 1000; if (!Number.isFinite(s)) return ''; if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; if (s < 604800) return `${Math.floor(s / 86400)} d ago`; return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };
  const until = (v) => { const ms = new Date(v).getTime() - Date.now(); if (!Number.isFinite(ms)) return ''; const d = Math.floor(Math.abs(ms) / 864e5), h = Math.floor(Math.abs(ms) % 864e5 / 36e5); if (ms >= 0) return d > 1 ? `in ${d} days` : d === 1 ? 'tomorrow' : h >= 1 ? `in ${h} h` : 'starting soon'; return d > 1 ? `${d} days ago` : d === 1 ? 'yesterday' : 'earlier today'; };

  const missingConfig = !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY || /YOUR-PROJECT|YOUR-ANON-KEY|placeholder/i.test(`${window.SUPABASE_URL || ''} ${window.SUPABASE_ANON_KEY || ''}`);
  let sb = null;
  try { if (!missingConfig && window.supabase?.createClient) sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }); } catch (e) { console.warn('Supabase configuration is invalid.', e); }

  const defaultSocials = (window.GDG_SITE_DEFAULTS || {}).socials || [];

  /* ---------- icons (24px grid, stroked) ---------- */
  const ICON = {
    home: 'M4 11.5 12 5l8 6.5M6 10v9h4v-5h4v5h4v-9',
    calendar: 'M5 6h14v13H5zM5 10h14M9 4v4M15 4v4',
    check: 'm5 12.5 4.5 4.5L19 7.5',
    award: 'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM9 13.2 8 20l4-2 4 2-1-6.8',
    idcard: 'M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm4 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm6 1h4m-4 4h4',
    key: 'M21 2l-2 2m-1.5 1.5L14 9l-1.5-1.5a6 6 0 1 0-2.5 8.5L2 22l6-2 1.5-1.5 2-2 1.5 1.5a6 6 0 0 0 8.5-2.5l3.5-3.5-2-2z',
    trophy: 'M8 5h8v5a4 4 0 0 1-8 0zM8 7H5v1.5A3 3 0 0 0 8 11.5M16 7h3v1.5a3 3 0 0 1-3 3M12 14v4M9 19h6',
    users: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM3 19c0-3 2.7-5 6-5s6 2 6 5M16 5.2a3.2 3.2 0 0 1 0 6M18 14.5c1.7.7 3 2.2 3 4.5',
    doc: 'M7 4h7l4 4v12H7zM14 4v4h4M10 12h5M10 15.5h5',
    library: 'M5 5h4v14H5zM10.5 5h4v14h-4zM16 6.5l3.8-1 2.4 12.8-3.8 1z',
    settings: 'M5 7h9M18 7h1M5 17h1M10 17h9M14 7a2 2 0 1 0 4 0 2 2 0 1 0-4 0zM6 17a2 2 0 1 0 4 0 2 2 0 1 0-4 0z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
    plus: 'M12 5v14M5 12h14',
    ext: 'M14 5h5v5M19 5l-8 8M18 14v5H5V6h5',
    menu: 'M4 7h16M4 12h16M4 17h16',
    x: 'M6 6l12 12M18 6 6 18',
    out: 'M10 5H5v14h5M14 8l4 4-4 4M18 12H9',
    image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15.5 9.5h.01',
    grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
    eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
    copy: 'M9 9h10v11H9zM5 15V4h10',
    trash: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13M10.5 11v5M13.5 11v5',
    edit: 'M5 19l1-4L16.5 4.5a2 2 0 0 1 3 3L9 18zM14.5 6.5l3 3',
    flip: 'M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5',
    alert: 'M12 4 3 19h18zM12 10v4.5M12 17h.01',
    spark: 'M12 4c.7 4.6 3.4 7.3 8 8-4.6.7-7.3 3.4-8 8-.7-4.6-3.4-7.3-8-8 4.6-.7 7.3-3.4 8-8z',
    chev: 'm9 6 6 6-6 6',
    upload: 'M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14',
    download: 'M12 5v11M7.5 11.5 12 16l4.5-4.5M5 19h14',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-15v5l3.5 2',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-4.5h.01M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-2.5 3v1',
    refresh: 'M20 4v5h-5M4 20v-5h5M20 9A9 9 0 0 0 5.7 5.7L4 9M4 15a9 9 0 0 0 14.3 3.3L20 15'
  };
  const icon = (n, cls = '') => `<svg class="mc-i ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON[n] || ICON.spark}"/></svg>`;

  /* ---------- toasts, confirm, drawer ---------- */
  let toastTimer = null;
  function toast(text, good = false) {
    let t = $('#mc-toast');
    if (!t) { t = document.createElement('div'); t.id = 'mc-toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); t.addEventListener('click', () => { t.hidden = true; }); }
    clearTimeout(toastTimer);
    t.className = 'mc-toast ' + (good ? 'ok' : 'err');
    t.innerHTML = `${icon(good ? 'check' : 'alert')}<span>${esc(String(text || ''))}</span>`;
    t.hidden = false;
    if (good) toastTimer = setTimeout(() => { t.hidden = true; }, 4200);
  }
  const clearToast = () => { const t = $('#mc-toast'); if (t) t.hidden = true; };

  function confirmDialog({ title = 'Are you sure?', body = '', confirm = 'Confirm', danger = false } = {}) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'mc-modal';
      wrap.innerHTML = `<div class="mc-modal-card" role="alertdialog" aria-modal="true" aria-labelledby="mc-cd-t" aria-describedby="mc-cd-b"><h2 id="mc-cd-t">${esc(title)}</h2><p id="mc-cd-b">${esc(body)}</p><div class="mc-modal-actions"><button type="button" class="button-outline" data-no>Cancel</button><button type="button" class="${danger ? 'danger solid' : ''}" data-yes>${esc(confirm)}</button></div></div>`;
      const prev = document.activeElement;
      const done = (v) => { wrap.remove(); document.removeEventListener('keydown', key, true); prev?.focus?.(); resolve(v); };
      const key = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
      wrap.addEventListener('click', (e) => { if (e.target === wrap || e.target.closest('[data-no]')) done(false); else if (e.target.closest('[data-yes]')) done(true); });
      document.addEventListener('keydown', key, true);
      document.body.appendChild(wrap);
      $('[data-no]', wrap).focus();
    });
  }

  const drawer = (() => {
    let el = null, prev = null, state = null;
    async function close(force = false) {
      if (!el) return true;
      if (!force && state?.dirty && !(await confirmDialog({ title: 'Discard your unsaved changes?', body: 'You have edits in this drawer that have not been saved. If you leave now, your draft will be lost.', confirm: 'Discard Changes', danger: true }))) return false;
      if (!el) return true;
      el.classList.remove('open');
      const gone = el; el = null; const cb = state?.onClose; state = null; cb?.();
      setTimeout(() => gone.remove(), 220);
      document.body.classList.remove('mc-lock');
      prev?.focus?.();
      return true;
    }
    function open({ title, subtitle = '', body, footer = '', wide = false, onClose } = {}) {
      if (el) { el.remove(); el = null; }
      prev = document.activeElement;
      el = document.createElement('div');
      el.className = 'mc-drawer-wrap';
      el.innerHTML = `<div class="mc-scrim" data-close></div><aside class="mc-drawer${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="mc-drawer-t"><header><div><h2 id="mc-drawer-t">${esc(title)}</h2>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div><button type="button" class="mc-icon-btn" data-close aria-label="Close panel">${icon('x')}</button></header><div class="mc-drawer-body">${body}</div>${footer ? `<footer>${footer}</footer>` : ''}</aside>`;
      state = { dirty: false, onClose };
      el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });
      el.addEventListener('input', () => { if (state) state.dirty = true; });
      el.addEventListener('change', () => { if (state) state.dirty = true; });
      document.body.appendChild(el); document.body.classList.add('mc-lock');
      const mine = el;
      requestAnimationFrame(() => { mine.classList.add('open'); (mine.querySelector('[autofocus],input:not([type=hidden]):not([type=file]),textarea,select') || mine.querySelector('button'))?.focus({ preventScroll: true }); });
      return {
        el,
        root: el.querySelector('.mc-drawer'),
        body: el.querySelector('.mc-drawer-body'),
        close,
        clean: () => { if (state) state.dirty = false; },
        markDirty: () => { if (state) state.dirty = true; },
        get isDirty() { return Boolean(state?.dirty); }
      };
    }
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el && !$('.mc-modal')) close(); });
    return { open, close, get isOpen() { return !!el; }, get isDirty() { return Boolean(state?.dirty); } };
  })();

  /* ---------- session ---------- */
  let adminUser = null, authWatched = false, idleArmed = false, idleTimer = null, manualSignOut = false;
  const IDLE_MS = 60 * 60 * 1000;
  const cache = new Map();
  const cached = async (key, fn, ttl = 45000) => { const hit = cache.get(key); if (hit && Date.now() - hit.t < ttl) return hit.v; const v = await fn(); cache.set(key, { t: Date.now(), v }); return v; };
  const dropCache = (prefix = '') => { for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k); };

  function authErrorText(error) {
    const text = String(error?.message || ''), all = text + ' ' + String(error?.details || '');
    const known = [
      [/events_one_pinned_next_session/, 'Another published event is already pinned as Next Session. Unpin it first.'],
      [/events_slug_key/, 'Another event already uses that slug. Choose a different one.'],
      [/events_check\b/, 'The end time must be after the start time.'],
      [/leaderboard_periods_check/, 'The end date must be on or after the start date.'],
      [/leaderboard_single_published_enabled/, 'Another leaderboard period is already published and scoring. Pause or hide it first.'],
      [/certificate_single_active_template/, 'Another certificate template is already active. Deactivate it first.'],
      [/team_members_member_code_key/, 'Another person already has that member ID. Pick a different one.'],
      [/team_members_photo_position_check/, 'Photo position must look like "50% 100%".'],
      [/team_departments_(name|slug)_key/, 'A department with that name or slug already exists.'],
      [/(_url_check|image_url|online_url|registration_url)/, 'A link must start with http:// or https://.'],
      [/attendance_records_event_id_fkey|community_points_period_id_fkey/, 'This item still has records attached (attendance or points). Remove those first.'],
      [/resources_event_id_fkey/, 'The linked event no longer exists.']
    ];
    if (error?.code === '23505' || error?.code === '23514' || error?.code === '23503' || /violates|duplicate key/i.test(text)) for (const [re, m] of known) if (re.test(all)) return m;
    if (error?.code === '23505') return 'An entry with the same unique value (for example the slug or name) already exists.';
    if (error?.code === '23514') return 'One of the values is not allowed. Check the dates, links and options and try again.';
    if (error?.code === '23503') return 'This item is linked to other records. Remove or change those first.';
    if (/jwt expired|invalid jwt|not authenticated/i.test(text)) return 'Your session has expired. Sign in again.';
    if (error?.code === '42501' || /row-level security|permission denied/i.test(text)) return 'You do not have permission to do that, or your session has expired. Sign in again if this is unexpected.';
    if (error?.code === '42703' || error?.code === 'PGRST204' || error?.code === '42P01' || error?.code === 'PGRST205' || /column .* does not exist|schema cache|relation .* does not exist/i.test(text)) {
      const m = /column "?([\w.]+)"? of relation "?(\w+)"?|column "?([\w.]+)"? does not exist|relation "?([\w.]+)"? does not exist|Could not find the '(\w+)' column of '(\w+)'|Could not find the table '([\w.]+)'/i.exec(text || '');
      const what = m ? ((m[1] && m[2]) ? m[2] + '.' + m[1] : (m[3] || m[4] || ((m[5] && m[6]) ? m[6] + '.' + m[5] : m[7]) || '')) : '';
      return 'The database is out of date' + (what ? ' (missing ' + what + ')' : '') + '. Run the newest files in supabase/migrations, then reload.';
    }
    return text || 'The request could not be completed. Please try again.';
  }
  async function audit(action, table, record) { try { await sb.from('audit_logs').insert({ actor_id: adminUser?.id || null, action, table_name: table, record_id: String(record || '') }); } catch { /* RLS is the authority; this log is supplementary. */ } }
  async function upsertSetting(key, value) { return await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString(), updated_by: adminUser.id }, { onConflict: 'key' }); }

  /* ---------- Storage buckets auto-provisioning & resilient uploads ---------- */
  const BUCKET_DEFS = {
    'site-assets': { public: true, fileSizeLimit: 12582912, mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] },
    'resource-files': { public: true, fileSizeLimit: 52428800, mimeTypes: ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'video/mp4', 'video/webm', 'application/zip'] },
    'certificate-logos': { public: false, fileSizeLimit: 5242880, mimeTypes: ['image/png', 'image/jpeg'] }
  };

  async function ensureStorageBucket(bucketId) {
    if (!sb) return false;
    const def = BUCKET_DEFS[bucketId] || { public: true };
    try {
      const { data: bucket, error: getErr } = await sb.storage.getBucket(bucketId);
      if (!getErr && bucket) return true;
      const opts = { public: def.public };
      if (def.fileSizeLimit) opts.fileSizeLimit = def.fileSizeLimit;
      if (def.mimeTypes) opts.allowedMimeTypes = def.mimeTypes;
      const { error: createErr } = await sb.storage.createBucket(bucketId, opts);
      if (!createErr || /already exists/i.test(createErr.message || '')) return true;
      console.warn(`Could not auto-provision bucket "${bucketId}":`, createErr);
      return false;
    } catch (err) {
      console.warn(`Exception provisioning bucket "${bucketId}":`, err);
      return false;
    }
  }

  async function ensureAllBuckets() {
    if (!sb || !adminUser) return;
    try {
      await Promise.allSettled(Object.keys(BUCKET_DEFS).map((id) => ensureStorageBucket(id)));
    } catch (e) {
      console.warn('ensureAllBuckets encountered an error:', e);
    }
  }

  async function uploadStorage(bucketId, path, fileOrBlob, options = {}) {
    if (!sb) throw new Error('Supabase client is not configured.');
    const isPublic = options.isPublic ?? (bucketId !== 'certificate-logos');
    const contentType = options.contentType || fileOrBlob.type || (bucketId === 'site-assets' ? 'image/webp' : 'application/octet-stream');
    const upsert = options.upsert !== false;
    const cacheControl = options.cacheControl || '3600';

    let res = await sb.storage.from(bucketId).upload(path, fileOrBlob, {
      upsert,
      cacheControl,
      contentType
    });

    if (res.error) {
      const isMissing = res.error.statusCode === 404 ||
        res.error.statusCode === '404' ||
        /not found|bucket_not_found/i.test(res.error.message || res.error.error || '');
      if (isMissing) {
        const provisioned = await ensureStorageBucket(bucketId);
        if (provisioned) {
          res = await sb.storage.from(bucketId).upload(path, fileOrBlob, {
            upsert,
            cacheControl,
            contentType
          });
        }
      }
    }

    if (res.error) throw res.error;

    let publicUrl = '';
    if (isPublic) {
      const { data } = sb.storage.from(bucketId).getPublicUrl(res.data.path);
      publicUrl = data?.publicUrl || '';
    }

    return {
      data: res.data,
      path: res.data.path,
      publicUrl
    };
  }

  /* ---------- Lightweight, secure Markdown renderer for previews ---------- */
  function renderMarkdown(md) {
    if (!md || !String(md).trim()) {
      return '<p class="mc-preview-empty"><em>Nothing to preview. Enter markdown formatting in the Write tab.</em></p>';
    }
    let out = esc(String(md));

    // Code blocks
    out = out.replace(/```([a-z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="${lang ? 'lang-' + lang : ''}">${code.trim()}</code></pre>`;
    });

    // Inline code
    out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');

    // Headings
    out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    out = out.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    out = out.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Blockquotes
    out = out.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Bold & italic
    out = out.replace(/\*\*\*([^\*\n]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    out = out.replace(/\*\*([^\*\n]+)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*([^\*\n]+)\*/g, '<em>$1</em>');
    out = out.replace(/___([^_\n]+)___/g, '<strong><em>$1</em></strong>');
    out = out.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    out = out.replace(/_([^_\n]+)_/g, '<em>$1</em>');

    // Safe links
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
      const u = safeUrl(url.trim());
      return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    });

    // Unordered lists
    out = out.replace(/(?:^[ \t]*[-*]\s+(.*(?:\n|$)))+/gim, (match) => {
      const items = match.trim().split('\n').map((ln) => {
        const item = ln.replace(/^[ \t]*[-*]\s+/, '').trim();
        return item ? `<li>${item}</li>` : '';
      }).filter(Boolean).join('');
      return `<ul>${items}</ul>`;
    });

    // Ordered lists
    out = out.replace(/(?:^[ \t]*\d+\.\s+(.*(?:\n|$)))+/gim, (match) => {
      const items = match.trim().split('\n').map((ln) => {
        const item = ln.replace(/^[ \t]*\d+\.\s+/, '').trim();
        return item ? `<li>${item}</li>` : '';
      }).filter(Boolean).join('');
      return `<ol>${items}</ol>`;
    });

    // Paragraphs
    const blocks = out.split(/\n{2,}/).map((blk) => {
      const trimmed = blk.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|pre|blockquote)/i.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).filter(Boolean);

    return blocks.join('\n');
  }
  async function withSaving(form, fn) {
    const btn = form.querySelector('button[type="submit"]') || (form.id ? $(`button[form="${form.id}"]`) : null);
    const label = btn ? btn.textContent : '';
    if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Saving…'; }
    try { await fn(); } catch (e) { console.error(e); toast(authErrorText(e) || 'Could not save. Please try again.'); }
    finally { if (btn?.isConnected) { btn.disabled = false; btn.textContent = label; } }
  }
  const loadScriptOnce = (src) => new Promise((resolve, reject) => { if ([...document.scripts].some((x) => x.src.endsWith(src))) return resolve(); const el = document.createElement('script'); el.src = src; el.onload = resolve; el.onerror = () => reject(new Error('Could not load ' + src)); document.head.appendChild(el); });

  function watchSession(main) {
    if (authWatched || !sb) return; authWatched = true;
    sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT' && adminUser && !manualSignOut) { adminUser = null; MC.user = null; renderLogin(main, 'Your session ended. Sign in again.'); } });
  }
  function armIdleLogout(main) {
    if (idleArmed) return; idleArmed = true;
    const bump = () => { clearTimeout(idleTimer); idleTimer = setTimeout(async () => { if (!adminUser) return; manualSignOut = true; await sb.auth.signOut(); manualSignOut = false; adminUser = null; MC.user = null; renderLogin(main, 'You were signed out after 60 minutes of inactivity.'); }, IDLE_MS); };
    ['pointerdown', 'keydown', 'scroll'].forEach((ev) => document.addEventListener(ev, bump, { passive: true })); bump();
  }

  /* ---------- sign-in screens ---------- */
  const gdgLogoSvg = '<svg class="mc-brand-logo" viewBox="185 345 710 390" fill="none" aria-hidden="true"><line x1="279" y1="540" x2="432" y2="430" stroke="#EA4335" stroke-width="128" stroke-linecap="round"/><line x1="279" y1="540" x2="432" y2="650" stroke="#4285F4" stroke-width="128" stroke-linecap="round"/><line x1="648" y1="650" x2="801" y2="540" stroke="#FBBC04" stroke-width="128" stroke-linecap="round"/><line x1="648" y1="430" x2="801" y2="540" stroke="#34A853" stroke-width="128" stroke-linecap="round"/></svg>';
  const loginFrame = (inner) => `<div class="mc-login"><div class="mc-login-card"><div class="mc-login-header">${gdgLogoSvg}<span class="mc-login-eyebrow">Google Developer Groups on Campus</span><h1>Mission Control</h1><p class="mc-login-subtitle">SR University Chapter Administrator Sign-in</p></div>${inner}<div class="mc-login-footer">Access restricted to verified GDG on Campus SR University organizers.</div></div></div>`;
  function renderLogin(main, errorText = '') {
    document.body.classList.remove('mc-app');
    main.innerHTML = loginFrame(`${errorText ? msg(errorText) : ''}<form id="admin-login" class="mc-stack"><label>Admin Email<input type="email" name="email" autocomplete="username" placeholder="organizer@sru.edu.in" required></label><label>Password<input type="password" name="password" autocomplete="current-password" placeholder="Enter password" required></label><button type="submit">Sign in to Mission Control</button><button type="button" class="button-outline" id="admin-reset-request">Forgot password?</button><div id="login-result" aria-live="polite"></div></form>`);
    $('#admin-login', main).addEventListener('submit', async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target));
      const r = await sb.auth.signInWithPassword({ email: normalizeEmail(v.email), password: v.password });
      if (r.error) { $('#login-result', main).innerHTML = msg('Sign-in failed. Check your details and try again.'); return; }
      const { data, error } = await sb.from('admin_users').select('user_id').eq('user_id', r.data.user.id).maybeSingle();
      if (error || !data) { await sb.auth.signOut(); $('#login-result', main).innerHTML = msg('This account is not authorised for Mission Control.'); return; }
      adminUser = r.data.user; MC.user = adminUser; startApp(main);
    });
    $('#admin-reset-request', main).addEventListener('click', async () => {
      const email = normalizeEmail($('#admin-login [name="email"]', main).value);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $('#login-result', main).innerHTML = msg('Enter your administrator email first.'); return; }
      const b = $('#admin-reset-request', main); b.disabled = true;
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}${location.pathname}?reset-password=1` });
      b.disabled = false;
      $('#login-result', main).innerHTML = error ? msg('Could not send a reset email right now. Please try again later.') : '<div class="msg ok" role="status">If an account exists for that address, a password-reset link will be sent. Check your inbox.</div>';
    });
  }
  function renderPasswordUpdate(main) {
    document.body.classList.remove('mc-app');
    main.innerHTML = loginFrame(`<h1>Set a new password</h1><p class="muted">Use at least 12 characters. This form works only inside a valid recovery session.</p><form id="admin-password-update" class="mc-stack"><label>New password<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><label>Confirm new password<input name="confirm" type="password" autocomplete="new-password" minlength="12" required></label><button type="submit">Update password</button><div id="password-result" aria-live="polite"></div></form>`);
    $('#admin-password-update', main).addEventListener('submit', async (e) => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(e.target)); const out = $('#password-result', main);
      if (String(v.password).length < 12) return void (out.innerHTML = msg('Use at least 12 characters.'));
      if (v.password !== v.confirm) return void (out.innerHTML = msg('The passwords do not match.'));
      const b = $('button[type="submit"]', e.target); b.disabled = true;
      const { error } = await sb.auth.updateUser({ password: v.password }); b.disabled = false;
      if (error) { out.innerHTML = msg('The password could not be updated. The reset link may have expired.'); return; }
      history.replaceState({}, '', location.pathname);
      adminUser = (await sb.auth.getUser()).data.user; MC.user = adminUser; await startApp(main); toast('Password updated.', true);
    });
  }

  /* ---------- shell ---------- */
  const NAV = [
    [null, [['overview', 'Overview', 'home']]],
    ['Run events', [['events', 'Events', 'calendar'], ['attendance', 'Attendance', 'check'], ['certificates', 'Certificates', 'award'], ['badges', 'Member Badges', 'idcard'], ['leaderboard', 'Leaderboard', 'trophy']]],
    ['Publish', [['team', 'Team', 'users'], ['blog', 'Blog', 'doc'], ['blog-series', 'Blog series', 'doc'], ['resources', 'Resource Hub', 'library']]],
    ['Site', [['settings', 'Settings', 'settings'], ['audit', 'Activity Log', 'clock']]]
  ];
  const TITLES = Object.fromEntries(NAV.flatMap(([, items]) => items.map(([id, label]) => [id, label])));
  const MODULE_FOR = { overview: 'mc-overview.js', events: 'mc-content.js', blog: 'mc-content.js', 'blog-series': 'mc-content.js', resources: 'mc-content.js', team: 'mc-team.js', badges: 'mc-extra.js', leaderboard: 'mc-extra.js', settings: 'mc-extra.js', audit: 'mc-extra.js' };

  function renderShell(main) {
    document.body.classList.add('mc-app');
    const email = adminUser?.email || '';
    const initial = (email.split('@')[0] || 'AD').slice(0, 2).toUpperCase();
    main.innerHTML = `<div class="mc-shell"><a class="mc-skip" href="#mc-main">Skip to content</a>
<aside class="mc-rail" id="mc-rail">
  <div class="mc-rail-accent"></div>
  <a class="mc-brand" href="#/overview" aria-label="Mission Control home">
    <div class="mc-brand-row">
      ${gdgLogoSvg}
      <div>
        <b>Mission Control</b>
        <small class="mc-brand-sub">GDG on Campus · SRU</small>
      </div>
    </div>
  </a>
  <nav aria-label="Sections" class="mc-rail-nav">
    ${NAV.map(([g, items]) => `
      <div class="mc-navgroup">
        ${g ? `<p class="mc-navgroup-title">${esc(g)}</p>` : ''}
        ${items.map(([id, label, ic]) => `
          <a href="#/${id}" data-nav="${id}" class="mc-nav-link">
            ${icon(ic, 'mc-nav-i')}
            <span class="mc-nav-text">${esc(label)}</span>
          </a>
        `).join('')}
      </div>
    `).join('')}
  </nav>
  <div class="mc-rail-foot">
    <a href="/" target="_blank" rel="noopener" class="mc-rail-ext" title="Open public chapter website in new tab">${icon('ext')}<span>View Public Site</span></a>
    <div class="mc-admin-profile">
      <div class="mc-admin-avatar" title="${esc(email)}">${esc(initial)}</div>
      <div class="mc-admin-info">
        <b class="mc-admin-role">Organizer</b>
        <small class="mc-admin-email" title="${esc(email)}">${esc(email || 'organizer@sru.edu.in')}</small>
      </div>
      <button type="button" id="mc-signout" class="mc-signout-btn" title="Sign out of Mission Control" aria-label="Sign out">${icon('out')}</button>
    </div>
  </div>
</aside>
<div class="mc-scrim mc-rail-scrim" id="mc-rail-scrim"></div>
<div class="mc-main">
  <header class="mc-top">
    <button type="button" class="mc-icon-btn mc-menu" id="mc-menu" aria-label="Open navigation" aria-controls="mc-rail">${icon('menu')}</button>
    <div class="mc-crumb">
      <span class="mc-crumb-kicker">GDG on Campus SR University</span>
      <h1 id="admin-page-title">Overview</h1>
    </div>
    <div class="mc-top-center">
      <button type="button" class="mc-status-pill mc-status-btn" id="mc-status-pill" title="Click to view System Health & Diagnostics"><span class="mc-live-dot"></span><span>Online</span></button>
    </div>
    <div class="mc-top-actions" id="mc-page-actions"></div>
    <a href="/" target="_blank" rel="noopener" class="mc-top-link" title="Open public website">${icon('ext')}<span>Site ↗</span></a>
    <button type="button" class="mc-search" id="mc-search" aria-label="Search and jump to anything">${icon('search')}<span>Quick search</span><kbd>Ctrl K</kbd></button>
    <button type="button" class="mc-icon-btn mc-help-btn" id="mc-help-btn" title="Keyboard Shortcuts (?)" aria-label="Keyboard Shortcuts">${icon('help')}</button>
  </header>
  <main id="mc-main" class="mc-content" tabindex="-1">
    <div id="admin-result" aria-live="polite"></div>
    <div id="admin-workspace"></div>
  </main>
</div></div>`;
    $('#mc-signout', main).addEventListener('click', async () => { manualSignOut = true; await sb.auth.signOut(); manualSignOut = false; adminUser = null; MC.user = null; renderLogin(main); });
    const rail = $('#mc-rail', main), openRail = (v) => { rail.classList.toggle('open', v); $('#mc-rail-scrim', main).classList.toggle('open', v); };
    $('#mc-menu', main).addEventListener('click', () => openRail(true));
    $('#mc-rail-scrim', main).addEventListener('click', () => openRail(false));
    rail.addEventListener('click', (e) => { if (e.target.closest('a[data-nav]')) openRail(false); });
    $('#mc-search', main).addEventListener('click', openPalette);
    $('#mc-status-pill', main)?.addEventListener('click', openHealthModal);
    $('#mc-help-btn', main)?.addEventListener('click', openShortcutsModal);
    armIdleLogout(main);
    const ws = $('#admin-workspace', main);
    ws.addEventListener('invalid', (e) => { const el = e.target; const lab = (el.closest('label')?.firstChild?.textContent || el.name || 'A field').trim(); toast(lab + ': ' + (el.validationMessage || 'please check this field.')); }, true);
  }

  /* ---------- router: #/section/sub?key=value ---------- */
  function parseRoute() {
    const raw = location.hash.replace(/^#\/?/, ''), [path, query = ''] = raw.split('?');
    const [tab = 'overview', ...rest] = path.split('/').filter(Boolean);
    return { tab: TITLES[tab] ? tab : 'overview', sub: rest.join('/'), params: Object.fromEntries(new URLSearchParams(query)) };
  }
  function go(tab, params = {}, sub = '') {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '')).toString();
    const h = `#/${tab}${sub ? '/' + sub : ''}${q ? '?' + q : ''}`;
    if (location.hash === h) render(); else location.hash = h;
  }
  /* Event tabs: keep Details / Attendance / Certificates together for the event being worked on. */
  function eventBar(route) {
    const main = $('#mc-main'); if (!main) return;
    let bar = $('#mc-eventbar');
    if (!bar) { bar = document.createElement('nav'); bar.id = 'mc-eventbar'; bar.className = 'mc-eventbar'; bar.setAttribute('aria-label', 'This event'); main.insertBefore(bar, $('#admin-result')); }
    const draw = () => {
      const sel = $('#wb-event-select') || $('#att-event') || $('#cfg-event'), id = (sel && sel.value) || route.params.event || '';
      const q = id ? '?event=' + encodeURIComponent(id) : '';
      const name = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim() : '';
      bar.innerHTML = '<a href="#/events">← Events</a>' + (name && id ? '<span class="mc-eventbar-name">' + esc(name) + '</span>' : '')
        + '<a href="#/events' + (id ? '/' + encodeURIComponent(id) : '') + '">Details</a>'
        + '<a href="#/attendance' + q + '"' + (route.tab === 'attendance' ? ' aria-current="page"' : '') + '>Attendance</a>'
        + '<a href="#/certificates' + q + '"' + (route.tab === 'certificates' ? ' aria-current="page"' : '') + '>Certificates</a>';
    };
    draw();
    const ws = $('#admin-workspace');
    if (ws._evbar) ws.removeEventListener('change', ws._evbar);
    ws._evbar = (e) => { if (e.target.id === 'wb-event-select' || e.target.id === 'att-event' || e.target.id === 'cfg-event') draw(); };
    ws.addEventListener('change', ws._evbar);
  }
  let renderToken = 0;
  function setWorkspace(title, html, actions = '') {
    const t = $('#admin-page-title'), w = $('#admin-workspace');
    if (t) t.textContent = title;
    if (w) w.innerHTML = html;
    const a = $('#mc-page-actions'); if (a) a.innerHTML = actions;
    const r = $('#admin-result'); if (r) r.innerHTML = '';
    document.title = `${title} · Mission Control`;
  }
  async function render() {
    if (!adminUser || !sb) return;
    const route = parseRoute(), token = ++renderToken;
    $$('.mc-rail a[data-nav]').forEach((a) => a.setAttribute('aria-current', a.dataset.nav === route.tab ? 'page' : 'false'));
    if (route.tab !== 'attendance' && route.tab !== 'certificates') { const b = $('#mc-eventbar'); if (b) b.remove(); }
    MC.rendering = true; drawer.close(true); MC.rendering = false;
    const label = TITLES[route.tab];
    setWorkspace(label, '<div class="mc-loading" role="status"><i></i><i></i><i></i><span>Loading</span></div>');
    try {
      const mod = MODULE_FOR[route.tab];
      if (mod) await loadScriptOnce('/assets/admin/' + mod);
      if (token !== renderToken) return;
      const page = MC.pages[route.tab];
      if (page) await page(route);
      else if (route.tab === 'attendance' || route.tab === 'certificates') {
        await loadScriptOnce('/assets/js/cert-engine.js'); await loadScriptOnce('/assets/admin/certificates-admin.js');
        const ctx = { sb, $, $$, setWorkspace, adminMessage: toast, authErrorText, audit, msg, adminUser, keepEvent: route.params.event || '', preselect: route.params.event || '' };
        if (route.tab === 'attendance') await window.GDGCertAdmin.renderAttendance(ctx); else await window.GDGCertAdmin.renderCertificates(ctx);
      }
      if (token === renderToken && (route.tab === 'attendance' || route.tab === 'certificates')) eventBar(route);
      if (token === renderToken) $('#mc-main')?.scrollTo?.(0, 0);
    } catch (error) {
      console.error(error);
      if (token !== renderToken) return;
      setWorkspace(label, msg(`Could not load ${label}. Check your connection and database setup, then try again.`));
      toast(authErrorText(error) === 'The request could not be completed. Please try again.' ? 'Could not load this section. Check your connection and database setup.' : authErrorText(error));
    }
  }

  /* ---------- command palette ---------- */
  let paletteEl = null;
  async function paletteIndex() {
    return cached('palette', async () => {
      const [ev, tm, bl, rs] = await Promise.all([
        sb.from('events').select('id,title,start_at').order('start_at', { ascending: false }).limit(150),
        sb.from('team_members').select('id,name,role').order('name').limit(300),
        sb.from('blog_entries').select('id,title').order('created_at', { ascending: false }).limit(150),
        sb.from('resources').select('id,title').order('title').limit(300)
      ]);
      const items = [];
      (ev.data || []).forEach((x) => items.push({ g: 'Events', label: x.title, hint: when(x.start_at), run: () => go('events', {}, x.id) }));
      (tm.data || []).forEach((x) => items.push({ g: 'People', label: x.name, hint: x.role, run: () => go('team', {}, x.id) }));
      (bl.data || []).forEach((x) => items.push({ g: 'Blog', label: x.title, hint: '', run: () => go('blog', {}, x.id) }));
      (rs.data || []).forEach((x) => items.push({ g: 'Resources', label: x.title, hint: '', run: () => go('resources', {}, x.id) }));
      return items;
    }, 60000);
  }
  /* ---------- system health & diagnostics modal ---------- */
  let healthModalEl = null;
  async function openHealthModal() {
    if (healthModalEl || !adminUser) return;
    healthModalEl = document.createElement('div');
    healthModalEl.id = 'mc-health-modal';
    healthModalEl.className = 'mc-modal';
    healthModalEl.innerHTML = `
      <div class="mc-dialog mc-health-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-diag-t">
        <header>
          <div>
            <h2 id="mc-diag-t">System Health & Storage Diagnostics</h2>
            <p class="muted small">Real-time status of database connection, active storage buckets, and auth session.</p>
          </div>
          <button type="button" class="mc-icon-btn" id="mc-diag-close" aria-label="Close">${icon('x')}</button>
        </header>
        <div class="mc-dialog-body" id="mc-diag-body">
          <div class="mc-loading" role="status"><span>Testing Supabase latency and storage buckets…</span></div>
        </div>
        <footer>
          <button type="button" class="button-outline" id="mc-diag-reprovision">${icon('refresh')}Re-verify Buckets</button>
          <span class="grow"></span>
          <button type="button" class="button" id="mc-diag-ok">Close</button>
        </footer>
      </div>
    `;
    document.body.appendChild(healthModalEl);
    const close = () => { healthModalEl?.remove(); healthModalEl = null; };
    $('#mc-diag-close', healthModalEl).onclick = close;
    $('#mc-diag-ok', healthModalEl).onclick = close;
    healthModalEl.onclick = (e) => { if (e.target === healthModalEl) close(); };

    async function runDiagnostics() {
      const body = $('#mc-diag-body', healthModalEl);
      if (!body) return;
      body.innerHTML = `<div class="mc-loading" role="status"><span>Testing Supabase latency and storage buckets…</span></div>`;
      
      const t0 = performance.now();
      let dbOk = false, dbErr = '', latency = 0;
      try {
        const { error } = await sb.from('site_settings').select('key').limit(1);
        latency = Math.round(performance.now() - t0);
        if (error) dbErr = error.message; else dbOk = true;
      } catch (err) {
        dbErr = err.message || String(err);
      }

      const bucketChecks = await Promise.all(Object.entries(BUCKET_DEFS).map(async ([bName, bDef]) => {
        try {
          const { data, error } = await sb.storage.getBucket(bName);
          return { name: bName, isPublic: bDef.public, sizeLimit: bDef.fileSizeLimit, ok: !error, error: error?.message };
        } catch (e) {
          return { name: bName, isPublic: bDef.public, sizeLimit: bDef.fileSizeLimit, ok: false, error: e.message };
        }
      }));

      body.innerHTML = `
        <div class="mc-diag-grid">
          <div class="mc-diag-item ${dbOk ? 'ok' : 'err'}">
            <div class="mc-diag-head">
              <b>Supabase Database Connection</b>
              <span class="mc-status-tag ${dbOk ? 'ok' : 'err'}">${dbOk ? 'Connected' : 'Error'}</span>
            </div>
            <p class="muted small">${dbOk ? `Roundtrip latency: <strong>${latency} ms</strong>` : `Error: ${esc(dbErr)}`}</p>
          </div>

          <div class="mc-diag-item">
            <div class="mc-diag-head">
              <b>Active Admin Session</b>
              <span class="mc-status-tag ok">Authenticated</span>
            </div>
            <p class="muted small">User: <strong>${esc(adminUser.email)}</strong> · Role: <strong>Chapter Organizer</strong></p>
          </div>
        </div>

        <h3 style="margin:16px 0 8px;font-size:14px;color:var(--ink)">Storage Buckets</h3>
        <div class="mc-diag-buckets">
          ${bucketChecks.map(b => `
            <div class="mc-bucket-row ${b.ok ? 'ok' : 'warn'}">
              <div class="mc-bucket-info">
                <strong>${esc(b.name)}</strong>
                <small class="muted">${b.isPublic ? 'Public bucket' : 'Private bucket'} · Max ${Math.round(b.sizeLimit / (1024 * 1024))} MB</small>
              </div>
              <span class="mc-status-tag ${b.ok ? 'ok' : 'err'}">${b.ok ? '✓ Ready' : 'Needs Provisioning'}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    runDiagnostics();

    $('#mc-diag-reprovision', healthModalEl).onclick = async () => {
      const btn = $('#mc-diag-reprovision', healthModalEl);
      btn.disabled = true; btn.textContent = 'Repairing…';
      try {
        await ensureAllBuckets();
        toast('All storage buckets verified & auto-provisioned.', true);
      } catch (e) {
        toast('Bucket auto-provisioning warning: ' + (e.message || String(e)));
      } finally {
        btn.disabled = false; btn.innerHTML = `${icon('refresh')}Re-verify Buckets`;
        runDiagnostics();
      }
    };
  }

  /* ---------- keyboard shortcuts help modal ---------- */
  let shortcutsModalEl = null;
  function openShortcutsModal() {
    if (shortcutsModalEl || !adminUser) return;
    shortcutsModalEl = document.createElement('div');
    shortcutsModalEl.id = 'mc-shortcuts-modal';
    shortcutsModalEl.className = 'mc-modal';
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const mod = isMac ? '⌘' : 'Ctrl';
    shortcutsModalEl.innerHTML = `
      <div class="mc-dialog mc-shortcuts-dialog" role="dialog" aria-modal="true" aria-labelledby="mc-sc-t">
        <header>
          <div>
            <h2 id="mc-sc-t">Keyboard Shortcuts</h2>
            <p class="muted small">Accelerate your workflow in Mission Control with simple keystrokes.</p>
          </div>
          <button type="button" class="mc-icon-btn" id="mc-sc-close" aria-label="Close">${icon('x')}</button>
        </header>
        <div class="mc-dialog-body">
          <div class="mc-shortcut-list">
            <div class="mc-sc-row">
              <span class="mc-sc-desc">Quick Search & Command Palette</span>
              <span class="mc-sc-keys"><kbd class="mc-key-hint">${mod}</kbd> + <kbd class="mc-key-hint">K</kbd></span>
            </div>
            <div class="mc-sc-row">
              <span class="mc-sc-desc">Quick-save current drawer (Events, Blog, Team, etc.)</span>
              <span class="mc-sc-keys"><kbd class="mc-key-hint">${mod}</kbd> + <kbd class="mc-key-hint">S</kbd></span>
            </div>
            <div class="mc-sc-row">
              <span class="mc-sc-desc">Close drawer, modal dialog, or command search</span>
              <span class="mc-sc-keys"><kbd class="mc-key-hint">Esc</kbd></span>
            </div>
            <div class="mc-sc-row">
              <span class="mc-sc-desc">Open this keyboard shortcuts cheat-sheet</span>
              <span class="mc-sc-keys"><kbd class="mc-key-hint">?</kbd></span>
            </div>
          </div>
        </div>
        <footer>
          <span class="grow"></span>
          <button type="button" class="button" id="mc-sc-ok">Got it</button>
        </footer>
      </div>
    `;
    document.body.appendChild(shortcutsModalEl);
    const close = () => { shortcutsModalEl?.remove(); shortcutsModalEl = null; };
    $('#mc-sc-close', shortcutsModalEl).onclick = close;
    $('#mc-sc-ok', shortcutsModalEl).onclick = close;
    shortcutsModalEl.onclick = (e) => { if (e.target === shortcutsModalEl) close(); };
  }

  async function openPalette() {
    if (paletteEl || !adminUser) return;
    const prev = document.activeElement;
    const base = [
      ...Object.entries(TITLES).map(([id, label]) => ({ g: 'Go to', label, hint: '', run: () => go(id) })),
      { g: 'Create', label: 'New event', hint: 'Events', run: () => go('events', {}, 'new') },
      { g: 'Create', label: 'Add a team member', hint: 'Team', run: () => go('team', {}, 'new') },
      { g: 'Create', label: 'New blog post', hint: 'Blog', run: () => go('blog', {}, 'new') },
      { g: 'Create', label: 'New resource', hint: 'Resource Hub', run: () => go('resources', {}, 'new') },
      { g: 'Team', label: 'Edit team page text and departments', hint: 'Team', run: () => go('team', { view: 'page' }) }
    ];
    let all = base, active = 0, shown = base;
    paletteEl = document.createElement('div');
    paletteEl.id = 'mc-palette'; paletteEl.className = 'mc-modal top';
    paletteEl.innerHTML = `<div class="mc-pal" role="dialog" aria-modal="true" aria-label="Search and jump"><div class="mc-pal-in">${icon('search')}<input type="text" placeholder="Search events, people, posts, or type a page name" aria-label="Search" autocomplete="off" spellcheck="false"></div><ul id="mc-pal-list" role="listbox"></ul><p class="mc-pal-foot">Up and down to move, Enter to open, Esc to close</p></div>`;
    document.body.appendChild(paletteEl);
    const input = $('input', paletteEl), list = $('ul', paletteEl);
    const close = () => { paletteEl?.remove(); paletteEl = null; prev?.focus?.(); };
    const draw = () => {
      const terms = input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      shown = (terms.length ? all.filter((x) => terms.every((t) => `${x.label} ${x.hint} ${x.g}`.toLowerCase().includes(t))) : base).slice(0, 40);
      active = Math.min(active, Math.max(0, shown.length - 1));
      list.innerHTML = shown.map((x, i) => `<li role="option" data-i="${i}" aria-selected="${i === active}"><span class="g">${esc(x.g)}</span><b>${esc(x.label)}</b><small>${esc(x.hint || '')}</small></li>`).join('') || '<li class="empty">Nothing matches. Try a person, event or page name.</li>';
      list.querySelector('[aria-selected=true]')?.scrollIntoView({ block: 'nearest' });
    };
    const choose = (i) => { const it = shown[i]; if (!it) return; close(); it.run(); };
    input.addEventListener('input', () => { active = 0; draw(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); draw(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });
    list.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) choose(+li.dataset.i); });
    paletteEl.addEventListener('mousedown', (e) => { if (e.target === paletteEl) close(); });
    draw(); input.focus();
    try { const extra = await paletteIndex(); all = base.concat(extra); if (paletteEl) draw(); } catch (e) { console.warn('Palette index unavailable', e); }
  }
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && adminUser) { e.preventDefault(); if (paletteEl) { paletteEl.remove(); paletteEl = null; } else openPalette(); }
    else if (e.key === '?' && adminUser && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable) {
      e.preventDefault();
      openShortcutsModal();
    }
  });

  /* ---------- event pipeline (shared by Overview and Events) ---------- */
  async function eventFacts(events) {
    const ids = events.filter((e) => e.status === 'published' || e.status === 'archived').slice(0, 40).map((e) => e.id);
    const [certs, counts] = await Promise.all([
      sb.from('event_certificates').select('event_id,claims_enabled'),
      Promise.all(ids.map((id) => sb.from('attendance_records').select('id', { count: 'exact', head: true }).eq('event_id', id).eq('attendance_status', 'attended')))
    ]);
    const facts = {};
    events.forEach((e) => { facts[e.id] = { attended: 0, cert: false }; });
    (certs.data || []).forEach((c) => { if (facts[c.event_id]) facts[c.event_id].cert = !!c.claims_enabled; });
    ids.forEach((id, i) => { facts[id].attended = counts[i].count || 0; });
    return facts;
  }
  function pipeline(ev, f = { attended: 0, cert: false }, interactive = true) {
    if (ev.status === 'cancelled') return '<p class="mc-pipe-note">Cancelled. Nothing further to do.</p>';
    const live = ev.status === 'published' || ev.status === 'archived';
    const steps = [
      ['draft', 'Drafted', true, 'events'],
      ['live', 'Published', live, 'events'],
      ['attendance', 'Attendance in', f.attended > 0, 'attendance'],
      ['cert', 'Certificates open', !!f.cert, 'certificates'],
      ['done', 'Archived', ev.status === 'archived', 'events']
    ];
    const next = steps.findIndex((s) => !s[2]);
    return `<ol class="mc-pipe" aria-label="Progress for ${esc(ev.title)}">${steps.map(([k, label, done, dest], i) => {
      const state = done ? 'done' : i === next ? 'next' : 'todo';
      const tip = k === 'attendance' && f.attended ? `${f.attended} attended` : label;
      const inner = `<span class="dot"></span><span class="lab">${esc(label)}</span>`;
      return `<li class="${state}">${interactive ? `<button type="button" data-pipe="${dest}" data-event="${esc(ev.id)}" title="${esc(tip)}">${inner}</button>` : inner}</li>`;
    }).join('')}</ol>`;
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-pipe]'); if (!b) return; const dest = b.dataset.pipe; if (dest === 'events') go('events', {}, b.dataset.event); else go(dest, { event: b.dataset.event }); });

  function bindDeleteButtons(root = document) {
    $$('[data-delete]', root).forEach((b) => {
      if (b.dataset.bound) return; b.dataset.bound = '1';
      b.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: `Delete ${b.dataset.label || 'this item'}?`, body: 'This cannot be undone.', confirm: 'Delete', danger: true }))) return;
        const table = b.dataset.delete, id = b.dataset.id;
        const r = await sb.from(table).delete().eq('id', id);
        if (r.error) return toast(authErrorText(r.error));
        await audit('delete', table, id); dropCache(); toast('Deleted.', true); render();
      });
    });
  }

  const MC = window.MC = {
    $, $$, esc, safeUrl, slugify, normalizeEmail, textValue, msg, formObject, istToIso, isoToIst, when, ago, until, icon,
    toast, adminMessage: toast, clearToast, confirmDialog, drawer, authErrorText, audit, upsertSetting, withSaving, loadScriptOnce,
    cached, dropCache, setWorkspace, go, render, route: parseRoute, eventFacts, pipeline, bindDeleteButtons, defaultSocials,
    ensureStorageBucket, ensureAllBuckets, uploadStorage, renderMarkdown, openHealthModal, openShortcutsModal,
    get sb() { return sb; }, user: null, pages: {}, ICON
  };
  MC.renderAdminTab = () => render();
  MC.refresh = () => render();

  async function startApp(main) {
    renderShell(main);
    ensureAllBuckets().catch((e) => console.warn('Bucket provisioning background task:', e));
    if (!location.hash || location.hash === '#') location.replace('#/overview');
    await render();
  }
  async function boot() {
    const main = $('main');
    if (!sb) { document.body.classList.remove('mc-app'); main.innerHTML = loginFrame(`<h1>Mission Control</h1>${msg('Website content connection is not configured. Add your Supabase URL and public key to site/config.js, then reload.')}`); return; }
    watchSession(main);
    const { data: { session } } = await sb.auth.getSession();
    const recovering = new URLSearchParams(location.search).get('reset-password') === '1';
    if (!session) return renderLogin(main, recovering ? 'The reset link is expired or invalid. Request a new one.' : '');
    const { data: row, error } = await sb.from('admin_users').select('user_id,email').eq('user_id', session.user.id).maybeSingle();
    if (error || !row) { await sb.auth.signOut(); return renderLogin(main, 'This account is not authorised for Mission Control.'); }
    adminUser = session.user; MC.user = adminUser;
    if (recovering) return renderPasswordUpdate(main);
    await startApp(main);
  }

  let lastConfirmedHash = location.hash || '#/overview';
  let revertingHash = false;
  window.addEventListener('hashchange', async () => {
    if (revertingHash) return;
    if (drawer.isOpen && drawer.isDirty) {
      const discard = await confirmDialog({
        title: 'Discard your unsaved changes?',
        body: 'You have edits in this drawer that have not been saved. If you leave now, your draft will be lost.',
        confirm: 'Discard Changes',
        danger: true
      });
      if (!discard) {
        revertingHash = true;
        location.hash = lastConfirmedHash;
        setTimeout(() => { revertingHash = false; }, 60);
        return;
      }
      await drawer.close(true);
    }
    lastConfirmedHash = location.hash;
    clearToast();
    render();
  });

  window.addEventListener('beforeunload', (e) => {
    if (drawer.isOpen && drawer.isDirty) {
      e.preventDefault();
      e.returnValue = 'You have unsaved changes in Mission Control.';
      return e.returnValue;
    }
  });
  document.addEventListener('DOMContentLoaded', boot);
})();
