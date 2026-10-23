/* Mission Control → Events, Blog, Resource Hub.
 * One pattern for all three: a searchable list, and a side drawer for creating or editing.
 * The URL carries the open item (#/events/<id>, #/events/new) so any record can be linked to. */
(() => {
  'use strict';
  const MC = window.MC;
  const { esc, safeUrl, slugify, when, until, icon, go, toast, audit, authErrorText, withSaving, formObject, istToIso, isoToIst, confirmDialog, drawer } = MC;
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
    else if (f.type === 'textarea') input = `<textarea name="${f.key}" id="${id}" rows="${f.rows || 4}"${req}></textarea>`;
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
    MC.setWorkspace(cfg.title, `<p class="mc-lead">${esc(cfg.lead)}</p><div class="mc-toolbar"><label class="mc-find">${icon('search')}<input type="search" id="mc-q" placeholder="Search ${esc(cfg.title.toLowerCase())}" aria-label="Search"></label><div class="mc-chips" role="group" aria-label="Filter by status">${['all', ...cfg.statuses].map((s) => `<button type="button" data-status="${s}" aria-pressed="${s === 'all'}">${s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)} <span>${counts(s)}</span></button>`).join('')}</div><span class="muted small" id="mc-total"></span></div><ul class="mc-list" id="mc-list"></ul>`,
      `<button type="button" data-new>${icon('plus')}${esc(cfg.newLabel)}</button>`);
    drawList();

    const open = (row) => {
      const isNew = !row;
      const d = drawer.open({
        title: isNew ? cfg.newLabel : `Edit: ${row[cfg.titleKey]}`, subtitle: cfg.drawerNote || '', wide: true,
        onClose: () => { if (!MC.rendering && MC.route().sub) history.replaceState(null, '', `#/${cfg.key}`); },
        body: `<form id="entity-form" class="mc-form">${cfg.fields.map((f) => field(f)).join('')}<input type="hidden" name="id">${cfg.drawerExtra ? cfg.drawerExtra(row) : ''}</form>`,
        footer: `${isNew ? '' : `<button type="button" class="danger" id="entity-del">${icon('trash')}Delete</button>`}<span class="grow"></span><button type="button" class="button-outline" data-close>Cancel</button><button type="submit" form="entity-form">Save</button>`
      });
      const form = $('#entity-form', d.el);
      fill(form, row || {}, cfg.fields);
      if (isNew) cfg.fields.forEach((f) => { if (f.default !== undefined && form.elements[f.key] && f.type !== 'checkbox') form.elements[f.key].value = f.default; });
      cfg.wire?.(form, row, d, extra);
      form.addEventListener('submit', (e) => { e.preventDefault(); withSaving(form, async () => {
        const f = formObject(form), id = f.id; delete f.id;
        cfg.fields.forEach((x) => { if (x.type === 'checkbox') f[x.key] = form.elements[x.key].checked; if (x.type === 'datetime') f[x.key] = istToIso(f[x.key]); if (x.nullable && f[x.key] === '') f[x.key] = null; if (x.type === 'number') { f[x.key] = Number(f[x.key] || 0); if (!Number.isFinite(f[x.key])) f[x.key] = 0; } });
        const bad = cfg.validate?.(f); if (bad) return toast(bad);
        if (cfg.before) { const stop = await cfg.before(f, id); if (stop) return toast(stop); }
        const r = id ? await sb().from(cfg.table).update(f).eq('id', id).select('id') : await sb().from(cfg.table).insert(f).select('id');
        if (r.error) return toast(authErrorText(r.error));
        if (id && Array.isArray(r.data) && !r.data.length) return toast('Nothing was saved: this item no longer exists or you do not have permission. Reload and try again.');
        await audit(id ? 'update' : 'create', cfg.table, id || f[cfg.titleKey]); MC.dropCache();
        toast(f.status && f.status !== 'published' && cfg.table !== 'events' ? `Saved as ${f.status}. Not visible to the public until it is Published.` : f.status === 'published' || !f.status ? 'Saved.' : `Saved as ${f.status}. Not visible to the public until Status is Published.`, true);
        d.clean(); await d.close(true); history.replaceState(null, '', `#/${cfg.key}`); MC.render();
      }); });
      $('#entity-del', d.el)?.addEventListener('click', async () => {
        if (!(await confirmDialog({ title: `Delete ${row[cfg.titleKey]}?`, body: 'This cannot be undone.', confirm: 'Delete', danger: true }))) return;
        const r = await sb().from(cfg.table).delete().eq('id', row.id); if (r.error) return toast(authErrorText(r.error));
        await audit('delete', cfg.table, row.id); MC.dropCache(); toast('Deleted.', true); d.clean(); await d.close(true); history.replaceState(null, '', `#/${cfg.key}`); MC.render();
      });
    };

    const ws = $('#admin-workspace'), top = $('#mc-page-actions');
    $('#mc-q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); drawList(); });
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
    { key: 'title', label: 'Title', required: true, full: true },
    { key: 'slug', label: 'Web address', required: true, help: 'Becomes /events/your-slug' },
    { key: 'category', label: 'Category', type: 'select', default: 'Other', options: (current) => eventCategoryOptions(current) },
    { key: 'summary', label: 'One-line summary', full: true },
    { key: 'description', label: 'Description', type: 'textarea', rows: 5, full: true },
    { key: 'start_at', label: 'Starts (IST)', type: 'datetime' },
    { key: 'end_at', label: 'Ends (IST)', type: 'datetime' },
    { key: 'venue', label: 'Venue', nullable: true },
    { key: 'online_url', label: 'Online session link', type: 'url', nullable: true, placeholder: 'https://' },
    { key: 'registration_url', label: 'Registration link', type: 'url', nullable: true, placeholder: 'https://' },
    { key: 'image_url', label: 'Banner image link', type: 'url', nullable: true, placeholder: 'https://' },
    { key: 'status', label: 'Status', type: 'select', default: 'draft', options: [{ value: 'draft', label: 'Draft (hidden)' }, { value: 'published', label: 'Published' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'archived', label: 'Archived' }] },
    { key: 'featured', label: 'Feature this event on the home page', type: 'checkbox' },
    { key: 'pinned_next_session', label: 'Pin as the Next Session countdown', type: 'checkbox' }
  ];
  const eventCfg = {
    key: 'events', title: 'Events', table: 'events', titleKey: 'title', order: { col: 'start_at', asc: false }, statuses: ['published', 'draft', 'archived', 'cancelled'],
    lead: 'Each event moves from draft to published, then attendance, then certificates. The dots show where it is. Click one to jump to that step.',
    newLabel: 'New event', empty: 'No events yet. Create one and it will be tracked from draft to certificates.', fields: eventFields,
    load: async (rows) => ({ facts: await MC.eventFacts(rows) }),
    row: (r, x) => `<li class="mc-item"><div class="mc-item-main"><b>${esc(r.title)}</b><small>${esc(r.category || '')} · ${esc(when(r.start_at))}${r.start_at ? ` · ${esc(until(r.start_at))}` : ''}</small><span class="mc-tags">${r.pinned_next_session ? '<span class="tag blue">Next session</span>' : ''}${r.featured ? '<span class="tag">Featured</span>' : ''}<span class="status s-${esc(r.status)}">${esc(r.status)}</span></span></div>${MC.pipeline(r, x.facts[r.id])}<div class="mc-item-actions"><button type="button" class="button-outline" data-edit="${esc(r.id)}">${icon('edit')}Edit</button><button type="button" class="mc-icon-btn" data-dup="${esc(r.id)}" aria-label="Duplicate ${esc(r.title)}" title="Duplicate">${icon('copy')}</button>${r.status === 'published' ? `<a class="mc-icon-btn" href="/event.html?slug=${encodeURIComponent(r.slug)}" target="_blank" rel="noopener" aria-label="View ${esc(r.title)} on the site" title="View on site">${icon('ext')}</a>` : ''}</div></li>`,
    wire: (form) => {
      form.addEventListener('input', (e) => { if (e.target.name === 'title' && !form.elements.slug.dataset.manual && !form.elements.id.value) form.elements.slug.value = slugify(e.target.value); if (e.target.name === 'slug') form.elements.slug.dataset.manual = '1'; });
      form.elements.slug.addEventListener('change', () => { form.elements.slug.value = slugify(form.elements.slug.value); });
      if (form.elements.id.value) form.elements.slug.dataset.manual = '1';
    },
    before: async (f, id) => {
      if (f.pinned_next_session && f.status === 'published') {
        let un = sb().from('events').update({ pinned_next_session: false }).eq('pinned_next_session', true).eq('status', 'published'); if (id) un = un.neq('id', id);
        const ur = await un; if (ur.error) return authErrorText(ur.error);
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
      { key: 'description', label: 'What this series covers', type: 'textarea', full: true },
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
      { key: 'description', label: 'Short description', type: 'textarea', full: true },
      { key: 'image_url', label: 'Preview image link', type: 'url', nullable: true, full: true, placeholder: 'https://' },
      { key: 'status', label: 'Status', type: 'select', default: 'draft', options: STATUS },
      { key: 'sort_order', label: 'Display order', type: 'number', default: 0, help: 'Lower numbers come first.' },
      { key: 'featured', label: 'Featured', type: 'checkbox' }
    ],
    row: (r) => `<li class="mc-item"><div class="mc-item-main"><b>${esc(r.title)}</b><small>${esc(r.author || 'No author')} · ${esc(r.category || 'No category')}</small><span class="mc-tags">${r.featured ? '<span class="tag">Featured</span>' : ''}<span class="status s-${esc(r.status)}">${esc(r.status)}</span></span></div><div class="mc-item-actions"><button type="button" class="button-outline" data-edit="${esc(r.id)}">${icon('edit')}Edit</button>${safeUrl(r.external_url) ? `<a class="mc-icon-btn" href="${esc(safeUrl(r.external_url))}" target="_blank" rel="noopener" aria-label="Open article" title="Open article">${icon('ext')}</a>` : ''}</div></li>`,
    validate: (f) => safeUrl(f.external_url) ? '' : 'Enter a valid http:// or https:// article link.',
    wire: (form) => {
      const url = form.elements.external_url, b = document.createElement('button');
      b.type = 'button'; b.className = 'button-outline'; b.textContent = 'Fetch article details'; url.closest('label').insertAdjacentElement('afterend', b);
      b.addEventListener('click', async () => {
        const u = url.value.trim(); if (!safeUrl(u)) return toast('Paste a valid https:// article link first.');
        const old = b.textContent; b.disabled = true; b.textContent = 'Fetching…';
        const { data, error } = await sb().functions.invoke('fetch-blog-metadata', { body: { url: u } }); b.disabled = false; b.textContent = old;
        if (error || data?.error) return toast(data?.error || 'Details could not be fetched. You can type them in.');
        let n = 0; ['title', 'author', 'description', 'image_url', 'category'].forEach((k) => { const el = form.elements[k], v = String(data?.[k] || '').trim(); if (el && v && !el.value.trim()) { el.value = v; n++; } });
        toast(n ? `Filled ${n} field${n === 1 ? '' : 's'}. Review them before saving.` : 'Nothing new to fill. Existing fields were kept.', true);
      });
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
      { key: 'title', label: 'Title', required: true }, { key: 'description', label: 'Description', type: 'textarea', full: true },
      { key: 'category', label: 'Category' }, { key: 'resource_type', label: 'Material type', type: 'select', default: 'link', options: RT },
      { key: 'destination_url', label: 'Resource link', type: 'url', nullable: true, full: true, placeholder: 'https://' },
      { key: 'image_url', label: 'Logo or image link', type: 'url', nullable: true, full: true, placeholder: 'https://' },
      { key: 'access_type', label: 'Access', type: 'select', default: 'free', options: [{ value: 'free', label: 'Free' }, { value: 'free_tier', label: 'Free tier' }, { value: 'student_access', label: 'Student access' }, { value: 'restricted', label: 'Restricted' }] },
      { key: 'status', label: 'Visibility', type: 'select', default: 'draft', options: [...STATUS, { value: 'hidden', label: 'Hidden' }] },
      { key: 'limitations', label: 'Limits and usage notes', type: 'textarea', full: true }, { key: 'eligibility', label: 'Who is eligible', type: 'textarea', full: true },
      { key: 'sort_order', label: 'Display order', type: 'number', default: 0 }, { key: 'featured', label: 'Featured', type: 'checkbox' }
    ],
    row: (r) => `<li class="mc-item"><div class="mc-item-main"><b>${esc(r.title)}</b><small>${r.kind === 'gdg' ? 'GDG SRU library' : 'Free resources'} · ${esc(r.category || r.resource_type || '')}</small><span class="mc-tags">${r.featured ? '<span class="tag">Featured</span>' : ''}<span class="status s-${esc(r.status)}">${esc(r.status)}</span></span></div><div class="mc-item-actions"><button type="button" class="button-outline" data-edit="${esc(r.id)}">${icon('edit')}Edit</button></div></li>`,
    validate: (f) => f.destination_url && !safeUrl(f.destination_url) ? 'Enter a valid resource link.' : '',
    drawerExtra: (row) => row ? `<div class="mc-upload full"><h3>Attach a file</h3><p class="muted small">PDF, PPT/PPTX, TXT, MP4, WebM or ZIP up to 50 MB. Uploaded files are public to anyone with the link, so never upload private lists or restricted material.</p><input type="file" id="res-file" accept="application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain,video/mp4,video/webm,application/zip"><button type="button" class="button-outline" id="res-upload">${icon('upload')}Upload and use as the link</button></div>` : '',
    wire: (form, row) => {
      const btn = $('#res-upload'); if (!btn || !row) return;
      btn.addEventListener('click', async () => {
        const file = $('#res-file').files?.[0]; if (!file) return toast('Choose a file first.');
        const types = { 'application/pdf': 'pdf', 'application/vnd.ms-powerpoint': 'presentation', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'presentation', 'video/mp4': 'video', 'video/webm': 'video', 'text/plain': 'notes', 'application/zip': 'file' };
        if (file.size > 50 * 1024 * 1024) return toast('Choose a file smaller than 50 MB.');
        if (!types[file.type]) return toast('This file type is not allowed. Use PDF, PPT/PPTX, TXT, MP4, WebM or ZIP.');
        btn.disabled = true;
        const name = String(file.name || 'resource').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-100), path = `${row.id}/${Date.now()}-${name}`;
        const up = await sb().storage.from('resource-files').upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type });
        if (up.error) { btn.disabled = false; return toast(authErrorText(up.error)); }
        const url = sb().storage.from('resource-files').getPublicUrl(up.data.path).data.publicUrl;
        const saved = await sb().from('resources').update({ destination_url: url, resource_type: types[file.type] }).eq('id', row.id); btn.disabled = false;
        if (saved.error) return toast(authErrorText(saved.error));
        form.elements.destination_url.value = url; form.elements.resource_type.value = types[file.type];
        await audit('upload_resource', 'resources', row.id); toast('File uploaded and attached.', true);
      });
    }
  };

  MC.pages.events = async (r) => { await loadEventCategories(); return entityPage(r, eventCfg); };
  MC.pages.blog = async (r) => { await loadBlogSeries(); return entityPage(r, blogCfg); };
  MC.pages['blog-series'] = (r) => entityPage(r, seriesCfg);
  MC.pages.resources = (r) => entityPage(r, resCfg);
})();
