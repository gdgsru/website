/* Mission Control → Events, Blog, Resource Hub.
 * One pattern for all three: a searchable list, and a side drawer for creating or editing.
 * The URL carries the open item (#/events/<id>, #/events/new) so any record can be linked to. */
(() => {
  'use strict';
  const MC = window.MC;
  const { $, $$, esc, safeUrl, slugify, when, until, icon, go, toast, audit, authErrorText, withSaving, formObject, istToIso, isoToIst, confirmDialog, drawer } = MC;
  const sb = () => MC.sb;

    let eventCategories = [];
  async function loadEventCategories() {
    const defaults = window.GDG_SITE_DEFAULTS || {};
    const r = await sb().from('site_settings').select('value').eq('key', 'event_categories').maybeSingle();
    const saved = Array.isArray(r.data?.value) && r.data.value.length ? r.data.value : null;
    eventCategories = defaults.normalizeCategories(saved || defaults.eventCategories);
  }
  // Active categories, plus the event's current category even if it has been switched off.
  const eventCategoryOptions = (current) => eventCategories
    .filter((c) => c.active || c.name === current)
    .map((c) => ({ value: c.name, label: c.active ? c.name : `${c.name} (off)` }));

  const field = (f, v = '') => {
    const id = `f-${f.key}`, req = f.required ? ' required' : '';
    let input;
    if (f.type === 'select') input = `<select name="${f.key}" id="${id}">${(typeof f.options === 'function' ? f.options(v) : f.options).map((o) => `<option value="${esc(o.value)}">${esc(o.label)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') {
      if (f.preview) {
        return `<div class="mc-field ${f.full ? 'full' : ''}"><div class="mc-md-editor"><div class="mc-md-head"><label for="${id}"><b>${esc(f.label)}</b></label><div class="mc-md-tabs" role="tablist"><button type="button" class="mc-md-tab active" data-tab-for="${id}" data-tab="write">${icon('edit')}Write</button><button type="button" class="mc-md-tab" data-tab-for="${id}" data-tab="preview">${icon('eye')}Live preview</button></div></div><textarea name="${f.key}" id="${id}" rows="${f.rows || 5}" class="mc-md-input"${req}></textarea><div id="${id}-preview" class="mc-md-preview" hidden></div><small class="muted mc-md-hint">Markdown supported: **bold**, *italic*, # heading, - bullet, [link](url), \`code\`, &gt; quote.</small></div></div>`;
      }
      input = `<textarea name="${f.key}" id="${id}" rows="${f.rows || 4}"${req}></textarea>`;
    }
    else if (f.type === 'checkbox') return `<label class="check full"><input type="checkbox" name="${f.key}"> ${esc(f.label)}</label>`;
    else input = `<input name="${f.key}" id="${id}" type="${f.type || 'text'}"${req}${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${f.type === 'number' ? ' step="1"' : ''}>`;
    return `<label class="${f.full ? 'full' : ''}">${esc(f.label)}${input}${f.help ? `<small class="muted">${esc(f.help)}</small>` : ''}</label>`;
  };
  const fill = (form, row, fields) => {
    fields.forEach((f) => {
      const el = form.elements[f.key]; if (!el) return; const v = row?.[f.key];
      if (f.type === 'checkbox') el.checked = !!v;
      else if (f.type === 'datetime') el.value = v ? isoToIst(v) : '';
      else el.value = v == null ? (f.default ?? '') : v;
    });
    if (form.elements.id) form.elements.id.value = row?.id || '';
  };
  const STATUS = [{ value: 'draft', label: 'Draft (hidden)' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }];

  async function entityPage(route, cfg) {
    const { data, error } = await sb().from(cfg.table).select('*').order(cfg.order.col, { ascending: cfg.order.asc ?? true });
    if (error) throw error;
    const rows = data || [];
    const extra = cfg.load ? await cfg.load(rows) : {};
    let q = '', status = 'all';
    const list = () => rows.filter((r) => (status === 'all' || r.status === status) && (!q || `${r[cfg.titleKey]} ${r.category || ''} ${r.author || ''}`.toLowerCase().includes(q)));
    const drawList = () => {
      const l = list();
      $('#mc-list').innerHTML = l.length ? l.map((r) => cfg.row(r, extra)).join('') : `<li class="mc-empty"><b>${rows.length ? 'Nothing matches those filters.' : cfg.empty}</b>${rows.length ? '' : `<button type="button" data-new>${icon('plus')}${esc(cfg.newLabel)}</button>`}</li>`;
      $('#mc-total').textContent = `${l.length} of ${rows.length}`;
    };
    const counts = (s) => s === 'all' ? rows.length : rows.filter((r) => r.status === s).length;
    const summaryHTML = `<div class="mc-summary-bar"><div class="mc-sum-item"><span class="mc-sum-val">${rows.length}</span><span class="mc-sum-label">Total</span></div><div class="mc-sum-item ok"><span class="mc-sum-dot green"></span><span class="mc-sum-val">${counts('published')}</span><span class="mc-sum-label">Published</span></div><div class="mc-sum-item warn"><span class="mc-sum-dot yellow"></span><span class="mc-sum-val">${counts('draft')}</span><span class="mc-sum-label">Drafts</span></div>${cfg.statuses.includes('archived') ? `<div class="mc-sum-item"><span class="mc-sum-dot gray"></span><span class="mc-sum-val">${counts('archived')}</span><span class="mc-sum-label">Archived</span></div>` : ''}</div>`;
    MC.setWorkspace(cfg.title, `<p class="mc-lead">${esc(cfg.lead)}</p>${summaryHTML}<div class="mc-toolbar"><div class="mc-find">${icon('search')}<input type="search" id="mc-q" placeholder="Search ${esc(cfg.title.toLowerCase())}…" aria-label="Search ${esc(cfg.title)}"><button type="button" class="mc-find-clear" id="mc-q-clear" aria-label="Clear search" hidden>×</button></div><div class="mc-chips" role="group" aria-label="Filter by status">${['all', ...cfg.statuses].map((s) => `<button type="button" data-status="${s}" aria-pressed="${s === 'all'}" class="mc-chip-btn ${s}">${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)} <span class="mc-chip-count">${counts(s)}</span></button>`).join('')}</div><span class="muted small" id="mc-total"></span></div><ul class="mc-list" id="mc-list"></ul>`,
      `<button type="button" data-new>${icon('plus')}${esc(cfg.newLabel)}</button>`);
    drawList();

    const open = (row) => {
      const isNew = !row;
      const d = drawer.open({
        title: isNew ? cfg.newLabel : `Edit: ${row[cfg.titleKey]}`, subtitle: cfg.drawerNote || '', wide: true,
        onClose: () => { if (!MC.rendering && MC.route().sub) history.replaceState(null, '', `#/${cfg.key}`); },
        body: `<form id="entity-form" class="mc-form">${cfg.fields.map((f) => field(f)).join('')}<input type="hidden" name="id">${cfg.drawerExtra ? cfg.drawerExtra(row) : ''}</form>`,
        footer: `${isNew ? '' : `<button type="button" class="danger" id="entity-del">${icon('trash')}Delete</button>`}<span class="grow"></span><button type="button" class="button-outline" data-close>Cancel</button><button type="submit" form="entity-form" class="mc-btn-primary">${icon('check')}Save changes <kbd class="mc-key-hint">Ctrl S</kbd></button>`
      });
      const form = $('#entity-form', d.el);
      fill(form, row || {}, cfg.fields);
      if (isNew) cfg.fields.forEach((f) => { if (f.default !== undefined && form.elements[f.key] && f.type !== 'checkbox') form.elements[f.key].value = f.default; });
      d.el.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
          e.preventDefault();
          form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      });
      form.addEventListener('click', (e) => {
        const btn = e.target.closest('.mc-md-tab');
        if (!btn) return;
        e.preventDefault();
        const targetId = btn.dataset.tabFor;
        const mode = btn.dataset.tab;
        const editor = btn.closest('.mc-md-editor');
        const ta = $(`#${targetId}`, form);
        const prev = $(`#${targetId}-preview`, form);
        if (!ta || !prev) return;
        $$('.mc-md-tab', editor).forEach((b) => b.classList.toggle('active', b === btn));
        if (mode === 'preview') {
          prev.innerHTML = MC.renderMarkdown(ta.value);
          ta.hidden = true;
          prev.hidden = false;
        } else {
          ta.hidden = false;
          prev.hidden = true;
          ta.focus();
        }
      });
      const debouncedMd = (MC.debounce || ((fn) => fn))((el) => {
        const prev = $(`#${el.id}-preview`, form);
        if (prev && !prev.hidden) {
          prev.innerHTML = MC.renderMarkdown(el.value);
        }
      }, 100);
      form.addEventListener('input', (e) => {
        if (e.target.matches('.mc-md-input')) {
          debouncedMd(e.target);
        }
      });
      cfg.wire?.(form, row, d, extra);
      form.addEventListener('submit', (e) => { e.preventDefault(); withSaving(form, async () => {
        const f = formObject(form), id = f.id; delete f.id;
        cfg.fields.forEach((x) => { if (x.type === 'checkbox') f[x.key] = form.elements[x.key].checked; if (x.type === 'datetime') f[x.key] = istToIso(f[x.key]); if (x.nullable && f[x.key] === '') f[x.key] = null; if (x.type === 'number') { f[x.key] = Number(f[x.key] || 0); if (!Number.isFinite(f[x.key])) f[x.key] = 0; } });
        const bad = cfg.validate?.(f); if (bad) return toast(bad);
        if (cfg.before) { const stop = await cfg.before(f, id); if (stop) return toast(stop); }
        let r = id ? await sb().from(cfg.table).update(f).eq('id', id).select('id') : await sb().from(cfg.table).insert(f).select('id');
        let usedLegacyFallback = false;
        if (r.error && (r.error.code === '42703' || /column .* does not exist|schema cache/i.test(r.error.message || ''))) {
          // If a new column hasn't been added to the database yet via migration,
          // safely strip new event columns and fallback to legacy columns so save succeeds!
          const legacyPayload = { ...f };
          const newCols = ['event_tier', 'event_mode', 'accent_color', 'banner_url', 'speakers', 'rsvp_url', 'join_link', 'syllabus_url', 'discord_channel_url', 'program_milestones', 'resource_url', 'calendar_enabled', 'certificates_ready'];
          newCols.forEach((k) => delete legacyPayload[k]);
          if (f.speakers) legacyPayload.speaker = f.speakers;
          if (f.rsvp_url) legacyPayload.registration_url = f.rsvp_url;
          if (f.join_link) legacyPayload.online_url = f.join_link;
          if (f.event_tier === 'flagship') legacyPayload.featured = true;
          
          r = id ? await sb().from(cfg.table).update(legacyPayload).eq('id', id).select('id') : await sb().from(cfg.table).insert(legacyPayload).select('id');
          usedLegacyFallback = !r.error;
        }
        if (r.error) return toast(authErrorText(r.error));
        if (id && Array.isArray(r.data) && !r.data.length) return toast('Nothing was saved: this item no longer exists or you do not have permission. Reload and try again.');
        await audit(id ? 'update' : 'create', cfg.table, id || f[cfg.titleKey]); MC.dropCache();
        const saveMsg = usedLegacyFallback 
          ? 'Saved! (Note: Run the SQL migration in Supabase to enable custom poster banners and tier accents).'
          : (f.status && f.status !== 'published' && cfg.table !== 'events' ? `Saved as ${f.status}. Not visible to the public until it is Published.` : f.status === 'published' || !f.status ? 'Saved.' : `Saved as ${f.status}. Not visible to the public until Status is Published.`);
        toast(saveMsg, true);
        d.clean(); await d.close(true); history.replaceState(null, '', `#/${cfg.key}`); MC.render();
      }); });
      $('#entity-del', d.el)?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: `Delete ${row[cfg.titleKey]}?`, body: 'This cannot be undone.', confirm: 'Delete', danger: true }))) return;
        const r = await sb().from(cfg.table).delete().eq('id', row.id); if (r.error) return toast(authErrorText(r.error));
        await audit('delete', cfg.table, row.id); MC.dropCache(); toast('Deleted.', true); d.clean(); await d.close(true); history.replaceState(null, '', `#/${cfg.key}`); MC.render();
      });
    };

    const ws = $('#admin-workspace'), top = $('#mc-page-actions');
    const qIn = $('#mc-q'), qClear = $('#mc-q-clear');
    const debouncedSearch = (MC.debounce || ((fn) => fn))(() => {
      q = qIn.value.trim().toLowerCase();
      if (qClear) qClear.hidden = !q;
      drawList();
    }, 80);
    qIn.addEventListener('input', debouncedSearch);
    qClear?.addEventListener('click', () => {
      qIn.value = '';
      q = '';
      qClear.hidden = true;
      qIn.focus();
      drawList();
    });
    ws.onclick = (e) => {
      const s = e.target.closest('[data-status]'); if (s) { status = s.dataset.status; $$('[data-status]', ws).forEach((b) => b.setAttribute('aria-pressed', String(b === s))); drawList(); return; }
      const ed = e.target.closest('[data-edit]'); if (ed) return go(cfg.key, {}, ed.dataset.edit);
      if (e.target.closest('[data-new]')) return go(cfg.key, {}, 'new');
      const dup = e.target.closest('[data-dup]'); if (dup && cfg.duplicate) cfg.duplicate(rows.find((r) => r.id === dup.dataset.dup)).then(() => { MC.dropCache(); MC.render(); });
    };
    top.onclick = (e) => { if (e.target.closest('[data-new]')) go(cfg.key, {}, 'new'); };
    MC.bindDeleteButtons(ws);
    if (route.sub === 'new') open(null);
    else if (route.sub) { const r = rows.find((x) => x.id === route.sub); if (r) open(r); else toast('That item no longer exists.'); }
  }

  /* ---------------- Events ---------------- */
  const eventFields = [
    { key: 'event_tier', label: 'Event Tier', type: 'select', default: 'standard', options: [
      { value: 'flagship', label: '★ Flagship Event (Hero Showcase Banner)' },
      { value: 'program', label: '◷ Month-Long Program (Cohort, Study Jam)' },
      { value: 'standard', label: '🎟 Standard Event (Workshop, Tech Talk)' }
    ], full: true, help: 'Changes layout and fields automatically.' },
    { key: 'title', label: 'Event Title', required: true, full: true },
    { key: 'slug', label: 'Web address', required: true, help: 'Becomes /events/your-slug' },
    { key: 'category', label: 'Category', type: 'select', default: 'Other', options: (current) => eventCategoryOptions(current) },
    { key: 'summary', label: 'One-line summary', full: true },
    { key: 'description', label: 'Full Description', type: 'textarea', rows: 5, full: true, preview: true },
    { key: 'start_at', label: 'Starts (IST)', type: 'datetime' },
    { key: 'end_at', label: 'Ends (IST)', type: 'datetime', help: 'Event transitions to Past after this time.' },
    { key: 'event_mode', label: 'Event Format', type: 'select', default: 'in_person', options: [
      { value: 'in_person', label: 'In-Person (Campus)' },
      { value: 'virtual', label: 'Virtual (Online / Google Meet)' },
      { value: 'hybrid', label: 'Hybrid (Campus + Online)' }
    ]},
    { key: 'venue', label: 'Venue / Hall (Campus)', nullable: true, placeholder: 'e.g. Block C, Seminar Hall 2' },
    { key: 'join_link', label: 'Join link (Virtual / Meet)', type: 'url', nullable: true, placeholder: 'https://meet.google.com/...' },
    { key: 'speakers', label: 'Speaker(s)', nullable: true, placeholder: 'e.g. Jane Doe (Google), John Smith' },
    { key: 'rsvp_url', label: 'Official RSVP Link (gdg.community.dev)', type: 'url', nullable: true, full: true, placeholder: 'https://gdg.community.dev/events/details/...' },
    { key: 'banner_url', label: '16:9 Poster Banner URL (Flagship & Cards)', type: 'url', nullable: true, full: true, placeholder: 'Upload below or enter URL' },
    { key: 'accent_color', label: 'Showcase Accent Color', type: 'select', default: 'blue', options: [
      { value: 'blue', label: 'Google Blue (#4285f4)' },
      { value: 'red', label: 'Google Red (#ea4335)' },
      { value: 'yellow', label: 'Google Yellow (#fbbc04)' },
      { value: 'green', label: 'Google Green (#34a853)' }
    ]},
    { key: 'syllabus_url', label: 'Curriculum / Syllabus Link (Programs)', type: 'url', nullable: true, placeholder: 'https://docs.google.com/...' },
    { key: 'discord_channel_url', label: 'Discord Track Channel Link (Programs)', type: 'url', nullable: true, placeholder: 'https://discord.com/channels/...' },
    { key: 'program_milestones_text', label: 'Weekly Milestones (Programs — 1 per line)', type: 'textarea', rows: 3, full: true, placeholder: 'Week 1: Orientation & Git basics\nWeek 2: Cloud IAM & Foundations\nWeek 3: Final Demo Day' },
    { key: 'resource_url', label: 'Post-Event Slides / GitHub / Code Link', type: 'url', nullable: true, placeholder: 'https://github.com/gdgsru/...' },
    { key: 'calendar_enabled', label: 'Show "+ Add to Google Calendar" button', type: 'checkbox', default: true },
    { key: 'certificates_ready', label: 'Certificates issued — show "Claim Certificate" button', type: 'checkbox', default: false },
    { key: 'pinned_next_session', label: 'Pin as Next Session countdown widget on Home Page', type: 'checkbox' },
    { key: 'status', label: 'Publishing Status', type: 'select', default: 'draft', options: [
      { value: 'draft', label: 'Draft (hidden from public)' },
      { value: 'published', label: 'Published (live on site)' },
      { value: 'cancelled', label: 'Cancelled' },
      { value: 'archived', label: 'Archived' }
    ]}
  ];
  const eventCfg = {
    key: 'events', title: 'Events', table: 'events', titleKey: 'title', order: { col: 'start_at', asc: false }, statuses: ['published', 'draft', 'archived', 'cancelled'],
    lead: 'Flagship events, month-long cohorts, and hands-on workshops. Pinned events show on the home page; flagship events get the top showcase banner.',
    newLabel: 'New event', empty: 'No events yet. Create one to publish it to the chapter calendar.', fields: eventFields,
    load: async (rows) => ({ facts: await MC.eventFacts(rows) }),
    row: (r, x) => {
      const tierBadge = r.event_tier === 'flagship' ? '<span class="tag" style="background:#4285f4;color:#fff">★ Flagship</span>' : (r.event_tier === 'program' ? '<span class="tag" style="background:#fbbc04;color:#111">◷ Program</span>' : '');
      const modeBadge = `<span class="tag">${r.event_mode === 'virtual' ? 'Online' : (r.event_mode === 'hybrid' ? 'Hybrid' : 'In-Person')}</span>`;
      return `<li class="mc-item"><div class="mc-item-main"><b>${esc(r.title)}</b><small>${esc(r.category || '')} · ${esc(when(r.start_at))}${r.start_at ? ` · ${esc(until(r.start_at))}` : ''}</small><span class="mc-tags">${tierBadge}${modeBadge}${r.pinned_next_session ? '<span class="tag blue">Next session</span>' : ''}<span class="status s-${esc(r.status)}">${esc(r.status)}</span></span></div>${MC.pipeline(r, x.facts[r.id])}<div class="mc-item-actions"><button type="button" class="button-outline" data-edit="${esc(r.id)}">${icon('edit')}Edit</button><button type="button" class="mc-icon-btn" data-dup="${esc(r.id)}" aria-label="Duplicate ${esc(r.title)}" title="Duplicate">${icon('copy')}</button>${r.status === 'published' ? `<a class="mc-icon-btn" href="/events/" target="_blank" rel="noopener" aria-label="View on site" title="View on site">${icon('ext')}</a>` : ''}</div></li>`;
    },
    wire: (form, row, d) => {
      form.addEventListener('input', (e) => {
        if (e.target.name === 'title' && !form.elements.slug.dataset.manual && !form.elements.id.value) form.elements.slug.value = slugify(e.target.value);
        if (e.target.name === 'slug') form.elements.slug.dataset.manual = '1';
      });
      form.elements.slug.addEventListener('change', () => { form.elements.slug.value = slugify(form.elements.slug.value); });
      if (form.elements.id.value) form.elements.slug.dataset.manual = '1';

      // Backward compatibility mapping for old speaker/registration_url columns
      if (row) {
        if (!form.elements.speakers.value && row.speaker) form.elements.speakers.value = row.speaker;
        if (!form.elements.rsvp_url.value && row.registration_url) form.elements.rsvp_url.value = row.registration_url;
        if (!form.elements.join_link.value && row.online_url) form.elements.join_link.value = row.online_url;
        if (Array.isArray(row.program_milestones) && row.program_milestones.length) {
          form.elements.program_milestones_text.value = row.program_milestones.map(m => (m.title ? `Week ${m.week || 1}: ${m.title}` : m)).join('\n');
        }
      }

      // Attach direct poster banner upload
      attachImageUpload(form.elements.banner_url, { folder: 'event-banners', prefix: form.elements.title?.value || 'banner', label: 'Upload 16:9 poster banner', d });

      // Dynamic field visibility according to selected Tier
      const updateTierVisibility = () => {
        const tier = form.elements.event_tier?.value || 'standard';
        const isFlagship = tier === 'flagship';
        const isProgram = tier === 'program';

        const toggle = (el, show) => {
          const container = el?.closest('label') || el?.closest('.mc-field');
          if (container) container.style.display = show ? '' : 'none';
        };

        // Flagship-only fields
        toggle(form.elements.accent_color, isFlagship);

        // Program-only fields
        toggle(form.elements.syllabus_url, isProgram);
        toggle(form.elements.discord_channel_url, isProgram);
        toggle(form.elements.program_milestones_text, isProgram);
      };

      form.elements.event_tier?.addEventListener('change', updateTierVisibility);
      updateTierVisibility();
    },
    before: async (f, id) => {
      // Keep legacy columns populated so any third-party script stays functional
      if (f.speakers) f.speaker = f.speakers;
      if (f.rsvp_url) f.registration_url = f.rsvp_url;
      if (f.join_link) f.online_url = f.join_link;

      // Parse program milestones text into JSON
      if (f.program_milestones_text !== undefined) {
        const lines = String(f.program_milestones_text || '').split('\n').map(l => l.trim()).filter(Boolean);
        f.program_milestones = lines.map((line, idx) => ({ week: idx + 1, title: line.replace(/^Week\s*\d+\s*:\s*/i, '') }));
        delete f.program_milestones_text;
      }

      if (f.event_tier === 'flagship') f.featured = true;
      else f.featured = false;

      if (f.pinned_next_session && f.status === 'published') {
        let un = sb().from('events').update({ pinned_next_session: false }).eq('pinned_next_session', true).eq('status', 'published');
        if (id) un = un.neq('id', id);
        const ur = await un;
        if (ur.error) return authErrorText(ur.error);
      }
      if (f.status !== 'published') f.pinned_next_session = false;
    },
    duplicate: async (r) => {
      const { id, created_at, updated_at, timezone, ...rest } = r;
      const slug = `${r.slug}-copy-${Date.now().toString(36).slice(-4)}`;
      const res = await sb().from('events').insert({ ...rest, title: `${r.title} (copy)`, slug, status: 'draft', featured: false, pinned_next_session: false });
      if (res.error) return toast(authErrorText(res.error)); await audit('create', 'events', slug); toast('Duplicated as a draft.', true);
    }
  };

  /* Helper for direct image uploads in entity drawers */
  function attachImageUpload(inputEl, options = {}) {
    if (!inputEl) return;
    const { folder = 'site-assets', prefix = 'asset', label = 'Upload image', d } = options;
    const parentLabel = inputEl.closest('label');
    if (!parentLabel || parentLabel.querySelector('.mc-img-upload-bar')) return;
    
    const wrapper = document.createElement('div');
    wrapper.className = 'mc-img-upload-bar';
    wrapper.innerHTML = `
      <input type="file" accept="image/png,image/jpeg,image/webp" style="display:none">
      <button type="button" class="button-outline mc-btn-upload">${icon('upload')}${esc(label)}</button>
      <div class="mc-field-img-thumb" ${inputEl.value && safeUrl(inputEl.value) ? '' : 'hidden'}>
        ${inputEl.value && safeUrl(inputEl.value) ? `<img src="${esc(safeUrl(inputEl.value))}" alt="preview">` : ''}
      </div>
    `;
    parentLabel.appendChild(wrapper);
    
    const fileInp = wrapper.querySelector('input[type="file"]');
    const uploadBtn = wrapper.querySelector('.mc-btn-upload');
    const thumbBox = wrapper.querySelector('.mc-field-img-thumb');
    
    uploadBtn.onclick = () => fileInp.click();
    fileInp.onchange = async () => {
      const rawFile = fileInp.files?.[0];
      if (!rawFile) return;
      if (rawFile.size > 20 * 1024 * 1024) return toast('Image must be 20 MB or smaller.');
      const oldHtml = uploadBtn.innerHTML;
      uploadBtn.disabled = true; uploadBtn.textContent = 'Optimizing…';
      try {
        const file = (MC.optimizeImageForWeb ? await MC.optimizeImageForWeb(rawFile, { maxWidth: 1600, maxHeight: 1200, quality: 0.85 }) : rawFile);
        uploadBtn.textContent = 'Uploading…';
        const ext = file.name.split('.').pop().toLowerCase() || 'webp';
        const cleanPrefix = slugify(prefix || 'asset') || 'asset';
        const path = `${folder}/${cleanPrefix}-${Date.now().toString(36)}.${ext}`;
        const up = await MC.uploadStorage('site-assets', path, file, { isPublic: true, contentType: file.type });
        inputEl.value = up.publicUrl;
        d?.markDirty?.();
        thumbBox.innerHTML = `<img src="${esc(up.publicUrl)}" alt="preview">`;
        thumbBox.hidden = false;
        const savedKb = Math.round((rawFile.size - file.size) / 1024);
        toast(savedKb > 40 ? `Optimized by ${savedKb} KB and uploaded!` : 'Image uploaded and linked.', true);
      } catch (err) {
        toast(authErrorText(err));
      } finally {
        uploadBtn.disabled = false; uploadBtn.innerHTML = oldHtml; fileInp.value = '';
      }
    };
    
    inputEl.addEventListener('input', () => {
      const u = inputEl.value.trim();
      if (safeUrl(u)) {
        thumbBox.innerHTML = `<img src="${esc(safeUrl(u))}" alt="preview">`;
        thumbBox.hidden = false;
      } else {
        thumbBox.hidden = true;
      }
    });
  }

  /* ---------------- Blog ---------------- */
  let blogSeries = [];
  async function loadBlogSeries() {
    const r = await sb().from('blog_series').select('id,title,status').order('sort_order');
    blogSeries = r.data || [];
  }
  const seriesOptions = (current) => [{ value: '', label: 'No series' }].concat(
    blogSeries.filter((x) => x.status === 'published' || x.id === current)
      .map((x) => ({ value: x.id, label: x.status === 'published' ? x.title : `${x.title} (${x.status})` })));

  const seriesCfg = {
    key: 'blog-series', title: 'Blog series', table: 'blog_series', titleKey: 'title', order: { col: 'sort_order' }, statuses: ['published', 'draft', 'archived'],
    lead: 'Series group blog posts on the blog page. Create, rename, reorder or retire them here. Posts keep their series when you change it.',
    newLabel: 'New series', empty: 'No series yet. Create the first one.',
    fields: [
      { key: 'title', label: 'Series name', required: true, full: true },
      { key: 'slug', label: 'Link name', required: true, placeholder: 'build-logs', help: 'Lowercase letters, numbers and hyphens only.' },
      { key: 'description', label: 'What this series covers', type: 'textarea', full: true, preview: true, rows: 4 },
      { key: 'color', label: 'Colour', type: 'select', default: 'b', options: [{ value: 'b', label: 'Blue' }, { value: 'g', label: 'Green' }, { value: 'y', label: 'Yellow' }, { value: 'r', label: 'Red' }] },
      { key: 'status', label: 'Status', type: 'select', default: 'published', options: STATUS },
      { key: 'sort_order', label: 'Display order', type: 'number', default: 0, help: 'Lower numbers come first.' }
    ]
  };

  const blogCfg = {
    key: 'blog', title: 'Blog', table: 'blog_entries', titleKey: 'title', order: { col: 'sort_order' }, statuses: ['published', 'draft', 'archived'],
    lead: 'Paste a Blogger article link, fetch the details, review them and publish. The full article stays on its original site.',
    newLabel: 'New blog post', empty: 'No posts yet. Add the link to your first article.',
    fields: [
      { key: 'external_url', label: 'Original article link', type: 'url', required: true, full: true, placeholder: 'https://' },
      { key: 'title', label: 'Article title', required: true, full: true },
      { key: 'author', label: 'Author' }, { key: 'category', label: 'Category' },
      { key: 'series_id', label: 'Series', type: 'select', nullable: true, options: (current) => seriesOptions(current) },
      { key: 'description', label: 'Short description', type: 'textarea', full: true, preview: true, rows: 5 },
      { key: 'image_url', label: 'Preview image link', type: 'url', nullable: true, full: true, placeholder: 'https://' },
      { key: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS },
      { key: 'sort_order', label: 'Display order', type: 'number', default: 0, help: 'Lower numbers come first.' },
      { key: 'featured', label: 'Featured', type: 'checkbox' }
    ],
    row: (r) => `<li class="mc-item">${safeUrl(r.image_url) ? `<div class="mc-item-thumb"><img src="${esc(safeUrl(r.image_url))}" alt="" loading="lazy"></div>` : ''}<div class="mc-item-main"><b>${esc(r.title)}</b><small>${esc(r.author || 'No author')} · ${esc(r.category || 'No category')}</small><span class="mc-tags">${r.featured ? '<span class="tag">Featured</span>' : ''}<span class="status s-${esc(r.status)}">${esc(r.status)}</span></span></div><div class="mc-item-actions"><button type="button" class="button-outline" data-edit="${esc(r.id)}">${icon('edit')}Edit</button>${safeUrl(r.external_url) ? `<a class="mc-icon-btn" href="${esc(safeUrl(r.external_url))}" target="_blank" rel="noopener" aria-label="Open article" title="Open article">${icon('ext')}</a>` : ''}</div></li>`,
    validate: (f) => safeUrl(f.external_url) ? '' : 'Enter a valid http:// or https:// article link.',
    wire: (form, row, d) => {
      const url = form.elements.external_url, b = document.createElement('button');
      b.type = 'button'; b.className = 'button-outline'; b.textContent = 'Fetch article details'; url.closest('label').insertAdjacentElement('afterend', b);
      b.addEventListener('click', async () => {
        const u = url.value.trim(); if (!safeUrl(u)) return toast('Paste a valid https:// article link first.');
        const old = b.textContent; b.disabled = true; b.textContent = 'Fetching…';
        const { data, error } = await sb().functions.invoke('fetch-blog-metadata', { body: { url: u } }); b.disabled = false; b.textContent = old;
        if (error || data?.error) return toast(data?.error || 'Details could not be fetched. You can type them in.');
        let n = 0; ['title', 'author', 'description', 'image_url', 'category'].forEach((k) => { const el = form.elements[k], v = String(data?.[k] || '').trim(); if (el && v && !el.value.trim()) { el.value = v; n++; } });
        if (n) {
          d?.markDirty?.();
          const prev = $('#f-description-preview', form);
          if (prev && !prev.hidden) prev.innerHTML = MC.renderMarkdown(form.elements.description.value);
        }
        toast(n ? `Filled ${n} field${n === 1 ? '' : 's'}. Review them before saving.` : 'Nothing new to fill. Existing fields were kept.', true);
      });
      attachImageUpload(form.elements.image_url, { folder: 'blog', prefix: form.elements.title?.value || 'article', label: 'Upload preview image', d });
    }
  };

  /* ---------------- Resources ---------------- */
  const RT = ['link', 'presentation', 'video', 'notes', 'pdf', 'file', 'other'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }));
  const resCfg = {
    key: 'resources', title: 'Resource Hub', table: 'resources', titleKey: 'title', order: { col: 'sort_order' }, statuses: ['published', 'draft', 'hidden', 'archived'],
    lead: 'Two shelves on one page: free resources from around the web, and the GDG SRU library of event materials.',
    newLabel: 'New resource', empty: 'No resources yet.',
    fields: [
      { key: 'kind', label: 'Shelf', type: 'select', default: 'external', options: [{ value: 'external', label: 'Free resources' }, { value: 'gdg', label: 'GDG SRU library' }] },
      { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description', type: 'textarea', full: true, preview: true, rows: 5 },
      { key: 'category', label: 'Category' }, { key: 'resource_type', label: 'Material type', type: 'select', default: 'link', options: RT },
      { key: 'destination_url', label: 'Resource link', type: 'url', nullable: true, full: true, placeholder: 'https://' },
      { key: 'image_url', label: 'Logo or image link', type: 'url', nullable: true, full: true, placeholder: 'https://' },
      { key: 'access_type', label: 'Access', type: 'select', default: 'free', options: [{ value: 'free', label: 'Free' }, { value: 'free_tier', label: 'Free tier' }, { value: 'student_access', label: 'Student access' }, { value: 'restricted', label: 'Restricted' }] },
      { key: 'status', label: 'Visibility', type: 'select', default: 'draft', options: [...STATUS, { value: 'hidden', label: 'Hidden' }] },
      { key: 'limitations', label: 'Limits and usage notes', type: 'textarea', full: true, preview: true, rows: 4 }, { key: 'eligibility', label: 'Who is eligible', type: 'textarea', full: true, preview: true, rows: 4 },
      { key: 'sort_order', label: 'Display order', type: 'number', default: 0 }, { key: 'featured', label: 'Featured', type: 'checkbox' }
    ],
    row: (r) => `<li class="mc-item">${safeUrl(r.image_url) ? `<div class="mc-item-thumb"><img src="${esc(safeUrl(r.image_url))}" alt="" loading="lazy"></div>` : ''}<div class="mc-item-main"><b>${esc(r.title)}</b><small>${r.kind === 'gdg' ? 'GDG SRU library' : 'Free resources'} · ${esc(r.category || r.resource_type || '')}</small><span class="mc-tags">${r.featured ? '<span class="tag">Featured</span>' : ''}<span class="tag blue">${esc(r.resource_type || 'material')}</span><span class="status s-${esc(r.status)}">${esc(r.status)}</span></span></div><div class="mc-item-actions"><button type="button" class="button-outline" data-edit="${esc(r.id)}">${icon('edit')}Edit</button>${safeUrl(r.destination_url) ? `<a class="mc-icon-btn" href="${esc(safeUrl(r.destination_url))}" target="_blank" rel="noopener" aria-label="Open resource" title="Open resource">${icon('ext')}</a>` : ''}</div></li>`,
    validate: (f) => f.destination_url && !safeUrl(f.destination_url) ? 'Enter a valid resource link.' : '',
    drawerExtra: () => `<div class="mc-upload full"><h3>Attach a file</h3><p class="muted small">PDF, PPT/PPTX, TXT, MP4, WebM or ZIP up to 50 MB. Uploaded files are public to anyone with the link, so never upload private lists or restricted material.</p><input type="file" id="res-file" accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,video/mp4,video/webm,application/zip"><button type="button" class="button-outline" id="res-upload">${icon('upload')}Upload and use as the link</button></div>`,
    wire: (form, row, d) => {
      attachImageUpload(form.elements.image_url, { folder: 'resources', prefix: form.elements.title?.value || 'resource', label: 'Upload logo or thumbnail', d });
      const btn = $('#res-upload'); if (!btn) return;
      btn.addEventListener('click', async () => {
        const file = $('#res-file').files?.[0]; if (!file) return toast('Choose a file first.');
        const types = { 'application/pdf': 'pdf', 'application/vnd.ms-powerpoint': 'presentation', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation', 'video/mp4': 'video', 'video/webm': 'video', 'text/plain': 'notes', 'application/zip': 'file' };
        if (file.size > 50 * 1024 * 1024) return toast('Choose a file smaller than 50 MB.');
        if (!types[file.type]) return toast('This file type is not allowed. Use PDF, PPT/PPTX, TXT, MP4, WebM or ZIP.');
        btn.disabled = true;
        const folder = row?.id || ('new-' + Date.now().toString(36));
        const name = String(file.name || 'resource').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100);
        const path = `${folder}/${Date.now()}-${name}`;
        try {
          const up = await MC.uploadStorage('resource-files', path, file, { isPublic: true, contentType: file.type });
          const url = up.publicUrl;
          form.elements.destination_url.value = url;
          if (form.elements.resource_type) form.elements.resource_type.value = types[file.type];
          if (row?.id) {
            const saved = await sb().from('resources').update({ destination_url: url, resource_type: types[file.type] }).eq('id', row.id);
            if (saved.error) throw saved.error;
            await audit('upload_resource', 'resources', row.id);
          }
          d?.markDirty?.();
          toast('File uploaded and linked.', true);
        } catch (e) {
          toast(authErrorText(e) || 'Failed to upload resource file.');
        } finally {
          btn.disabled = false;
        }
      });
    }
  };

  MC.pages.events = async (r) => { await loadEventCategories(); return entityPage(r, eventCfg); };
  MC.pages.blog = async (r) => { await loadBlogSeries(); return entityPage(r, blogCfg); };
  MC.pages['blog-series'] = (r) => entityPage(r, seriesCfg);
  MC.pages.resources = (r) => entityPage(r, resCfg);
})();
