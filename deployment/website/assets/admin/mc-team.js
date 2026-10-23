/* Mission Control → Team Studio.
 * Every detail on a public team card is edited here: name, role, member ID, level, colour, photo and its framing,
 * the line on the back, social links, and which department it sits in. Departments (their headings, blurbs and
 * order) and the team page headline are edited here too. A live preview shows the real card as visitors see it.
 */
(() => {
  'use strict';
  const MC = window.MC;
  const { $, $$, esc, safeUrl, slugify, icon, go, toast, audit, authErrorText, withSaving, confirmDialog, drawer } = MC;
  const sb = () => MC.sb;
  const ACCENT = { b: 'Blue', r: 'Red', y: 'Yellow', g: 'Green' };
  const LEVEL = { lead: 'Lead', organizer: 'Organizer', member: 'Member', advisor: 'Advisor' };
  const SOCIAL = [['linkedin', 'LinkedIn'], ['github', 'GitHub'], ['instagram', 'Instagram'], ['discord', 'Discord'], ['googleDeveloper', 'Google Developer Profile'], ['x', 'X'], ['website', 'Website']];
  const PAGE_FIELDS = [['eyebrow', 'Small line above the headline'], ['title_top', 'Headline, first line'], ['title_accent', 'Headline, highlighted line'], ['lead', 'Sentence under the headline'], ['cta_label', 'Button label'], ['map_label', 'Map title'], ['core_small', 'Centre of the map, small text'], ['core_big', 'Centre of the map, large text']];
  const PAGE_DEFAULTS = { eyebrow: 'GDG SRU / TEAM', title_top: 'Meet the', title_accent: 'team.', lead: 'The people behind the community.', cta_label: 'Meet everyone', map_label: 'THE TEAM', core_small: 'GDG SRU', core_big: 'One team.' };
  const COLS = 'id,name,role,department,leadership_order,bio,photo_url,social_links,status,sort_order,member_code,card_subtitle,level,accent,photo_position';

  async function load() {
    const [m, d, s] = await Promise.all([
      sb().from('team_members').select(COLS).order('sort_order').order('name'),
      sb().from('team_departments').select('*').order('sort_order'),
      sb().from('site_settings').select('value').eq('key', 'team_page').maybeSingle()
    ]);
    if (m.error) throw m.error;
    return { members: m.data || [], deps: d.error ? null : d.data || [], page: { ...PAGE_DEFAULTS, ...(s.data?.value && typeof s.data.value === 'object' ? s.data.value : {}) }, depsError: d.error };
  }

  /* ---------- live preview: the real public card inside a same-origin frame ---------- */
  function previewFrame() {
    const f = document.createElement('iframe');
    f.className = 'mc-preview-frame'; f.title = 'Live preview of the team card'; f.src = '/team-card-preview.html'; f.loading = 'eager';
    let ready = false, queued = null;
    window.addEventListener('message', function onMsg(e) { if (e.origin === location.origin && e.data?.type === 'card-preview-height') f.style.height = Math.min(760, e.data.h + 4) + 'px';
      if (e.origin === location.origin && e.data === 'card-preview-ready') { ready = true; if (queued) f.contentWindow.postMessage(queued, location.origin); } });
    f.send = (payload) => { queued = payload; if (ready) f.contentWindow.postMessage(payload, location.origin); };
    return f;
  }

  /* ---------- the card editor ---------- */
  function memberForm(m, deps) {
    const dep = (n) => deps.map((d) => `<option value="${esc(d.name)}"${d.name === n ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
    const soc = m.social_links && typeof m.social_links === 'object' ? m.social_links : {};
    const known = new Set(SOCIAL.map((s) => s[0]));
    const other = Object.entries(soc).filter(([k]) => !known.has(k));
    return `<form id="member-form" class="mc-form" autocomplete="off"><input type="hidden" name="id" value="${esc(m.id || '')}">
<fieldset class="full"><legend>Who</legend><div class="mc-form inner">
<label>Full name<input name="name" required value="${esc(m.name || '')}"></label>
<label>Role on the card<input name="role" required value="${esc(m.role || '')}" placeholder="Design Lead"></label>
<label>Department<select name="department">${m.department && !deps.some((d) => d.name === m.department) ? `<option selected>${esc(m.department)}</option>` : ''}${dep(m.department)}</select></label>
<label>Level<select name="level">${Object.entries(LEVEL).map(([k, v]) => `<option value="${k}"${(m.level || 'member') === k ? ' selected' : ''}>${v}</option>`).join('')}</select><small class="muted">The badge on the card. A Lead in the leadership department gets the large featured card.</small></label>
<label class="full">Line under the role on the back<input name="card_subtitle" value="${esc(m.card_subtitle || '')}" placeholder="Executive Lead"></label>
<label class="full">Short bio (optional, shown on the back)<textarea name="bio" rows="3" maxlength="240">${esc(m.bio || '')}</textarea></label></div></fieldset>
<fieldset class="full"><legend>Card details</legend><div class="mc-form inner">
<label>Member ID<input name="member_code" value="${esc(m.member_code || '')}" placeholder="26-DSN-01"><small class="muted">Printed on the card. Must be unique.</small></label>
<label class="full">Card colour<span class="mc-swatches" role="radiogroup" aria-label="Card colour">${Object.entries(ACCENT).map(([k, v]) => `<label class="sw sw-${k}"><input type="radio" name="accent" value="${k}"${(m.accent || 'b') === k ? ' checked' : ''}><span>${v}</span></label>`).join('')}</span></label></div></fieldset>
<fieldset class="full"><legend>Photo</legend><div class="mc-photo">
<div class="mc-photo-thumb" id="photo-thumb">${safeUrl(m.photo_url) ? `<img src="${esc(safeUrl(m.photo_url))}" alt="">` : '<span>No photo</span>'}</div>
<div class="mc-photo-controls"><input type="file" id="photo-file" accept="image/png,image/jpeg,image/webp"><div class="mc-row"><button type="button" class="button-outline" id="photo-upload">${icon('upload')}Upload photo</button><button type="button" class="button-outline" id="photo-reposition"${safeUrl(m.photo_url) ? '' : ' hidden'}>${icon('edit')}Crop or reposition</button><button type="button" class="button-outline" id="photo-clear">Remove photo</button></div>
<label>Photo link<input name="photo_url" type="url" value="${esc(m.photo_url || '')}" placeholder="https://"></label>
<label>Framing<input name="photo_position" value="${esc(m.photo_position || '50% 100%')}" placeholder="50% 100%"><small class="muted">Horizontal and vertical focus, for example "50% 20%". Higher second number shows more of the bottom.</small></label>
<div class="mc-pos"><label>Left to right<input type="range" min="0" max="100" id="pos-x"></label><label>Top to bottom<input type="range" min="0" max="100" id="pos-y"></label></div></div></div></fieldset>
<fieldset class="full"><legend>Links on the back of the card</legend><div class="mc-form inner">${SOCIAL.map(([k, l]) => `<label>${l}<input type="url" name="soc_${k}" value="${esc(soc[k] || '')}" placeholder="https://"></label>`).join('')}</div>${other.length ? `<p class="muted small">Also stored: ${other.map(([k]) => esc(k)).join(', ')}. These are kept as they are.</p>` : ''}</fieldset>
<fieldset class="full"><legend>Visibility and order</legend><div class="mc-form inner"><label>Status<select name="status">${[['published', 'Published (shown on the site)'], ['draft', 'Draft (hidden)'], ['archived', 'Archived (hidden)']].map(([v, l]) => `<option value="${v}"${(m.status || 'draft') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
<label>Order inside the department<input type="number" name="sort_order" value="${Number(m.sort_order || 0)}"><small class="muted">Lower comes first. You can also drag people in the list.</small></label></div></fieldset></form>`;
  }

  function readMember(form, base) {
    const f = Object.fromEntries(new FormData(form));
    const links = { ...(base?.social_links && typeof base.social_links === 'object' ? base.social_links : {}) };
    SOCIAL.forEach(([k]) => { const v = String(f['soc_' + k] || '').trim(); if (v) links[k] = v; else delete links[k]; });
    return { name: String(f.name || '').trim(), role: String(f.role || '').trim(), department: f.department || '', level: f.level, card_subtitle: String(f.card_subtitle || '').trim(), bio: String(f.bio || '').trim(), member_code: String(f.member_code || '').trim(), accent: f.accent || 'b', photo_url: String(f.photo_url || '').trim() || null, photo_position: String(f.photo_position || '50% 100%').trim(), social_links: links, status: f.status, sort_order: Number(f.sort_order || 0) };
  }



  /** Pan and zoom a photo inside the card's 4:5 frame. Resolves to a WebP Blob, or null if cancelled. */
  function cropPhoto(source) {
    return new Promise((resolve) => {
      const W = 320, H = 400, OUT_W = 800, OUT_H = 1000;
      const isFile = source instanceof Blob;
      const src = isFile ? URL.createObjectURL(source) : source;
      const img = new Image();
      if (!isFile) img.crossOrigin = 'anonymous';
      const wrap = document.createElement('div');
      wrap.className = 'mc-cropper'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Crop photo');
      wrap.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:16px';
      wrap.innerHTML = `<div style="background:#fff;color:#1f1f23;border-radius:16px;padding:20px;max-width:420px;width:100%;box-sizing:border-box">
<h3 style="margin:0 0 4px">Crop photo</h3>
<p style="margin:0 0 12px;color:#5f6368;font-size:14px">Drag to reposition. Use the slider to zoom. The frame matches the card.</p>
<canvas width="${W}" height="${H}" style="width:100%;max-width:${W}px;display:block;margin:0 auto;border-radius:12px;touch-action:none;cursor:grab;background:#111"></canvas>
<label style="display:block;margin:12px 0 0;font-size:14px">Zoom <input type="range" min="1" max="3" step="0.01" value="1" style="width:100%"></label>
<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button type="button" class="button-outline" data-cancel>Cancel</button><button type="button" data-ok>Use this crop</button></div></div>`;
      const canvas = wrap.querySelector('canvas'), ctx = canvas.getContext('2d'), range = wrap.querySelector('input[type=range]');
      let zoom = 1, fx = 0.5, fy = 0.5, drag = null, base = 1;
      const size = () => ({ w: img.naturalWidth * base * zoom, h: img.naturalHeight * base * zoom });
      const fit = () => { const s = size(); fx = Math.min(1 - W / (2 * s.w), Math.max(W / (2 * s.w), fx)); fy = Math.min(1 - H / (2 * s.h), Math.max(H / (2 * s.h), fy)); };
      const place = () => { const s = size(); return { x: W / 2 - fx * s.w, y: H / 2 - fy * s.h, w: s.w, h: s.h }; };
      const draw = () => { const p = place(); ctx.clearRect(0, 0, W, H); ctx.drawImage(img, p.x, p.y, p.w, p.h); };
      const finish = (value) => { wrap.remove(); document.removeEventListener('keydown', onKey); if (isFile) URL.revokeObjectURL(src); resolve(value); };
      const onKey = (e) => { if (e.key === 'Escape') finish(null); };
      canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, fx, fy }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
      canvas.addEventListener('pointermove', (e) => {
        if (!drag) return; const k = W / canvas.getBoundingClientRect().width, s = size();
        fx = drag.fx - ((e.clientX - drag.x) * k) / s.w; fy = drag.fy - ((e.clientY - drag.y) * k) / s.h; fit(); draw();
      });
      const endDrag = () => { drag = null; canvas.style.cursor = 'grab'; };
      canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
      range.addEventListener('input', () => { zoom = Number(range.value); fit(); draw(); });
      wrap.querySelector('[data-cancel]').addEventListener('click', () => finish(null));
      wrap.querySelector('[data-ok]').addEventListener('click', () => {
        const out = document.createElement('canvas'); out.width = OUT_W; out.height = OUT_H;
        const p = place(), k = OUT_W / W; out.getContext('2d').drawImage(img, p.x * k, p.y * k, p.w * k, p.h * k);
        out.toBlob((b) => { if (b) finish(b); else { toast('Could not save this crop.'); } }, 'image/webp', 0.9);
      });
      document.addEventListener('keydown', onKey);
      img.onerror = () => { wrap.remove(); if (isFile) URL.revokeObjectURL(src); toast('Could not open this photo. If it is a link, check that it allows image access.'); resolve(null); };
      img.onload = () => { base = Math.max(W / img.naturalWidth, H / img.naturalHeight); document.body.appendChild(wrap); draw(); };
      img.src = src;
    });
  }

  function openMember(data, member, onSaved) {
    const m = member || { status: 'draft', level: 'member', accent: 'b', photo_position: '50% 100%', department: data.deps?.find((d) => d.kind === 'department')?.name || data.deps?.[0]?.name || '', sort_order: data.members.length + 1, social_links: {} };
    const isNew = !member;
    const d = drawer.open({ title: isNew ? 'Add a team member' : m.name, subtitle: isNew ? 'Fill in the card and it appears on the site once Published.' : 'Changes show in the preview straight away.', wide: true,
      onClose: () => { if (!MC.rendering && MC.route().sub) history.replaceState(null, '', '#/team'); },
      body: `<div class="mc-studio"><div class="mc-studio-form">${memberForm(m, data.deps || [])}</div><aside class="mc-studio-preview" aria-label="Preview"><div class="mc-preview-bar"><b>Live preview</b><button type="button" class="button-outline" id="preview-flip">${icon('flip')}Flip card</button></div><div id="preview-host"></div><p class="muted small">This is the real site card. Click it to flip it.</p></aside></div>`,
      footer: `${isNew ? '' : `<button type="button" class="danger" id="member-del">${icon('trash')}Delete</button>`}<span class="grow"></span><button type="button" class="button-outline" data-close>Cancel</button><button type="submit" form="member-form" class="mc-btn-primary">${icon('check')}Save profile <kbd class="mc-key-hint">Ctrl S</kbd></button>` });
    const form = $('#member-form', d.el), frame = previewFrame();
    d.el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
    $('#preview-host', d.el).appendChild(frame);
    const kindOf = () => data.deps?.find((x) => x.name === form.elements.department.value)?.kind || 'department';
    const push = () => { const v = readMember(form, m); frame.send({ type: 'card', member: { ...v, status: undefined }, kind: kindOf(), index: Math.max(0, data.members.findIndex((x) => x.id === m.id)) }); };
    form.addEventListener('input', () => { syncSliders(); push(); }); form.addEventListener('change', push); push();
    $('#preview-flip', d.el).addEventListener('click', () => frame.contentWindow?.postMessage({ type: 'flip' }, location.origin));

    const px = $('#pos-x', d.el), py = $('#pos-y', d.el), pos = form.elements.photo_position;
    const readPos = () => { const [a, b] = String(pos.value).split(' ').map((n) => parseInt(n, 10)); px.value = Number.isFinite(a) ? a : 50; py.value = Number.isFinite(b) ? b : 100; };
    const syncSliders = () => { const t = $('#photo-thumb img', d.el); if (t) t.style.objectPosition = pos.value; };
    px.addEventListener('input', () => { pos.value = `${px.value}% ${py.value}%`; push(); syncSliders(); }); py.addEventListener('input', () => { pos.value = `${px.value}% ${py.value}%`; push(); syncSliders(); });
    pos.addEventListener('change', readPos); readPos(); syncSliders();
    const setPhoto = (url) => { form.elements.photo_url.value = url || ''; $('#photo-thumb', d.el).innerHTML = url ? `<img src="${esc(url)}" alt="" style="object-position:${esc(pos.value)}">` : '<span>No photo</span>'; push(); };
    form.elements.photo_url.addEventListener('change', () => setPhoto(safeUrl(form.elements.photo_url.value)));
    const syncRepo = () => { const r = $('#photo-reposition', d.el); if (r) r.hidden = !safeUrl(form.elements.photo_url.value); }; form.elements.photo_url.addEventListener('change', syncRepo); syncRepo();
    $('#photo-clear', d.el).addEventListener('click', () => { setPhoto(''); d.markDirty?.(); });
    $('#photo-reposition', d.el)?.addEventListener('click', async (ev) => {
      const url = safeUrl(form.elements.photo_url.value); if (!url) return toast('Upload or link a photo first.');
      const b = ev.currentTarget; b.disabled = true;
      try {
        const blob = await cropPhoto(url); if (!blob) return;
        const key = slugify(form.elements.member_code.value || form.elements.name.value || 'member'), path = `team/${key}-${Date.now().toString(36)}.webp`;
        const up = await MC.uploadStorage('site-assets', path, blob, { isPublic: true, contentType: 'image/webp' });
        pos.value = '50% 50%'; readPos(); setPhoto(up.publicUrl); d.markDirty?.(); toast('Photo updated. Save to publish the change.', true);
      } catch (e) { toast(authErrorText(e)); } finally { b.disabled = false; }
    });
    $('#photo-upload', d.el).addEventListener('click', async (ev) => {
      const file = $('#photo-file', d.el).files?.[0]; if (!file) return toast('Choose a photo first.');
      if (file.size > 12 * 1024 * 1024) return toast('Choose a photo smaller than 12 MB.');
      const b = ev.currentTarget; b.disabled = true; b.lastChild.textContent = 'Uploading…';
      try {
        const blob = await cropPhoto(file); if (!blob) return;
        const key = slugify(form.elements.member_code.value || form.elements.name.value || 'member'), path = `team/${key}-${Date.now().toString(36)}.webp`;
        const up = await MC.uploadStorage('site-assets', path, blob, { isPublic: true, contentType: 'image/webp' });
        setPhoto(up.publicUrl); d.markDirty?.(); toast('Photo uploaded. Save to publish the change.', true);
      } catch (e) { toast(authErrorText(e)); } finally { b.disabled = false; b.lastChild.textContent = 'Upload photo'; }
    });

    form.addEventListener('submit', (e) => { e.preventDefault(); withSaving(form, async () => {
      const row = readMember(form, m);
      if (row.photo_url && !safeUrl(row.photo_url)) return toast('The photo link must start with http:// or https://.');
      if (!/^\d{1,3}% \d{1,3}%$/.test(row.photo_position)) return toast('Framing must look like "50% 100%".');
      for (const [k, v] of Object.entries(row.social_links)) if (!safeUrl(v)) return toast(`The ${k} link must start with http:// or https://.`);
      const r = member ? await sb().from('team_members').update({ ...row, updated_at: new Date().toISOString() }).eq('id', member.id).select('id') : await sb().from('team_members').insert(row).select('id');
      if (r.error) return toast(authErrorText(r.error));
      if (member && Array.isArray(r.data) && !r.data.length) return toast('Nothing was saved: this person no longer exists or you do not have permission. Reload and try again.');
      await audit(member ? 'update' : 'create', 'team_members', member?.id || row.name); MC.dropCache();
      toast(row.status === 'published' ? 'Saved. The team page is updated.' : `Saved as ${row.status}. Not visible on the team page until Published.`, true);
      d.clean(); await d.close(true); history.replaceState(null, '', '#/team'); onSaved();
    }); });
    $('#member-del', d.el)?.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: `Delete ${m.name}?`, body: 'The card is removed from the team page. To hide it temporarily, set the status to Draft instead.', confirm: 'Delete', danger: true }))) return;
      const r = await sb().from('team_members').delete().eq('id', m.id); if (r.error) return toast(authErrorText(r.error));
      await audit('delete', 'team_members', m.id); MC.dropCache(); toast('Deleted.', true); d.clean(); await d.close(true); history.replaceState(null, '', '#/team'); onSaved();
    });
  }

  /* ---------- starter roster import / sync (from assets/data/team-seed.json) ---------- */
  async function syncStarter(status) {
    const note = (t) => { status.textContent = t; };
    const seed = await (await fetch('/assets/data/team-seed.json', { cache: 'no-cache' })).json();
    note('Reading the current team…');
    const [cur, deps] = await Promise.all([sb().from('team_members').select('id,name,member_code,bio,card_subtitle,photo_url,level,accent,photo_position'), sb().from('team_departments').select('name')]);
    if (cur.error) throw cur.error;
    const haveDep = new Set((deps.data || []).map((d) => d.name.toLowerCase()));
    if (!deps.error) for (const d of seed.departments || []) if (!haveDep.has(d.name.toLowerCase())) { const r = await sb().from('team_departments').insert(d); if (r.error) throw r.error; }
    const byName = new Map((cur.data || []).map((m) => [m.name.trim().toLowerCase(), m])), byCode = new Map((cur.data || []).filter((m) => m.member_code).map((m) => [m.member_code.toLowerCase(), m]));
    let added = 0, updated = 0, photos = 0, i = 0;
    for (const s of seed.members || []) {
      i++; note(`Syncing ${i} of ${seed.members.length}: ${s.name}`);
      const have = byCode.get(String(s.member_code).toLowerCase()) || byName.get(s.name.trim().toLowerCase());
      let photoUrl = have?.photo_url || null;
      if (!photoUrl && s.photo_path) {
        try {
          const blob = await (await fetch(s.photo_path)).blob();
          const up = await MC.uploadStorage('site-assets', `team/${s.member_code}.webp`, blob, { isPublic: true, contentType: 'image/webp' });
          photoUrl = up.publicUrl;
          photos++;
        } catch (e) { console.warn('Photo skipped', s.name, e); }
      }
      if (!have) {
        const { legacy_title, photo_path, ...row } = s;
        const r = await sb().from('team_members').insert({ ...row, photo_url: photoUrl, bio: '', leadership_order: 100 }); if (r.error) throw r.error; added++;
      } else {
        const patch = {};
        if (!have.member_code) patch.member_code = s.member_code;
        if (!have.card_subtitle && s.card_subtitle) patch.card_subtitle = s.card_subtitle;
        if (have.bio && have.bio === s.legacy_title) patch.bio = '';
        if (have.level === 'member' && s.level !== 'member') patch.level = s.level;
        if (have.accent === 'b' && s.accent !== 'b') patch.accent = s.accent;
        if (!have.photo_url && photoUrl) patch.photo_url = photoUrl;
        if (Object.keys(patch).length) { const r = await sb().from('team_members').update(patch).eq('id', have.id); if (r.error) throw r.error; updated++; }
      }
    }
    await audit('sync_team', 'team_members', `added:${added};updated:${updated}`);
    return { added, updated, photos };
  }

  /* ---------- departments + page copy ---------- */
  function pageView(data, rerender) {
    const deps = data.deps;
    const body = `<p class="mc-lead">The words and structure of the public team page. Departments appear in this order; the hero map shows the first five departments.</p>
<section class="mc-card"><div class="mc-card-head"><h2>Page headline</h2></div><form id="page-form" class="mc-form">${PAGE_FIELDS.map(([k, l]) => `<label class="${k === 'lead' || k === 'eyebrow' ? 'full' : ''}">${esc(l)}<input name="${k}" value="${esc(data.page[k] || '')}"></label>`).join('')}<div class="full mc-row"><button type="submit">Save page text</button><button type="button" class="button-outline" id="page-reset">Restore defaults</button></div></form></section>
<section class="mc-card"><div class="mc-card-head"><h2>Departments</h2><button type="button" id="dep-new">${icon('plus')}Add department</button></div>${deps ? `<ul class="mc-deps" id="dep-list">${deps.map((d) => `<li data-id="${esc(d.id)}" draggable="true"><span class="grip" aria-hidden="true">${icon('grip')}</span><div><b>${esc(d.name)}</b><small>${esc(d.kind)} · ${data.members.filter((m) => m.department === d.name).length} people${d.visible ? '' : ' · hidden'}</small></div><div class="mc-item-actions"><button type="button" class="mc-icon-btn" data-up aria-label="Move ${esc(d.name)} up">↑</button><button type="button" class="mc-icon-btn" data-down aria-label="Move ${esc(d.name)} down">↓</button><button type="button" class="button-outline" data-dep-edit>${icon('edit')}Edit</button></div></li>`).join('')}</ul>` : '<p class="msg err">The departments table is missing. Run the 20261020100000 migration in Supabase, then reload.</p>'}</section>`;
    MC.setWorkspace('Team', `<nav class="mc-tabs" aria-label="Team views"><button type="button" data-view="people" aria-pressed="false">People</button><button type="button" data-view="page" aria-pressed="true">Page and departments</button></nav>${body}`);
    $('.mc-tabs').onclick = (e) => { if (e.target.dataset.view === 'people') go('team'); };
    $('#page-form').addEventListener('submit', (e) => { e.preventDefault(); withSaving(e.target, async () => {
      const v = Object.fromEntries(new FormData(e.target)); PAGE_FIELDS.forEach(([k]) => { v[k] = String(v[k] || '').trim() || PAGE_DEFAULTS[k]; });
      const r = await MC.upsertSetting('team_page', v); if (r.error) return toast(authErrorText(r.error));
      await audit('update', 'site_settings', 'team_page'); toast('Page text saved.', true); data.page = v;
    }); });
    $('#page-reset').addEventListener('click', async () => { if (!(await confirmDialog({ title: 'Restore the default headline text?', confirm: 'Restore' }))) return; const r = await MC.upsertSetting('team_page', PAGE_DEFAULTS); if (r.error) return toast(authErrorText(r.error)); toast('Defaults restored.', true); rerender(); });
    if (!deps) return;
    const save = async (list) => { for (let i = 0; i < list.length; i++) { const r = await sb().from('team_departments').update({ sort_order: i * 10, updated_at: new Date().toISOString() }).eq('id', list[i].id); if (r.error) return toast(authErrorText(r.error)); } await audit('reorder', 'team_departments', 'order'); rerender(); };
    $('#dep-list').addEventListener('click', (e) => {
      const li = e.target.closest('li[data-id]'); if (!li) return; const i = deps.findIndex((d) => d.id === li.dataset.id);
      if (e.target.closest('[data-up]') && i > 0) { const l = deps.slice(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; save(l); }
      else if (e.target.closest('[data-down]') && i < deps.length - 1) { const l = deps.slice(); [l[i + 1], l[i]] = [l[i], l[i + 1]]; save(l); }
      else if (e.target.closest('[data-dep-edit]')) openDep(deps[i], data, rerender);
    });
    let dragId = null; const list = $('#dep-list');
    list.addEventListener('dragstart', (e) => { dragId = e.target.closest('li')?.dataset.id; });
    list.addEventListener('dragover', (e) => e.preventDefault());
    list.addEventListener('drop', (e) => { e.preventDefault(); const to = e.target.closest('li')?.dataset.id; if (!dragId || !to || to === dragId) return; const l = deps.slice(); const [mv] = l.splice(l.findIndex((d) => d.id === dragId), 1); l.splice(l.findIndex((d) => d.id === to), 0, mv); save(l); });
    $('#dep-new').addEventListener('click', () => openDep(null, data, rerender));
  }
  function openDep(dep, data, rerender) {
    const d0 = dep || { name: '', slug: '', heading: '', description: '', blurb: '', kind: 'department', visible: true, sort_order: (data.deps.length + 1) * 10 };
    const d = drawer.open({ title: dep ? `Edit ${dep.name}` : 'Add a department', subtitle: 'Shown as a section on the team page.',
      body: `<form id="dep-form" class="mc-form"><label>Name<input name="name" required value="${esc(d0.name)}"><small class="muted">People are matched to this exact name.</small></label><label>Section heading<input name="heading" value="${esc(d0.heading)}" placeholder="Same as the name"></label><label class="full">Sentence under the heading<input name="description" value="${esc(d0.description)}"></label><label class="full">Short line on the hero map<input name="blurb" value="${esc(d0.blurb)}"></label><label>Type<select name="kind">${[['department', 'Department'], ['leadership', 'Leadership (large featured card for the Lead)'], ['advisory', 'Advisory board']].map(([v, l]) => `<option value="${v}"${d0.kind === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label><label class="check"><input type="checkbox" name="visible"${d0.visible ? ' checked' : ''}> Show this section on the site</label></form>`,
      footer: `${dep ? `<button type="button" class="danger" id="dep-del">${icon('trash')}Delete</button>` : ''}<span class="grow"></span><button type="button" class="button-outline" data-close>Cancel</button><button type="submit" form="dep-form" class="mc-btn-primary">${icon('check')}Save department <kbd class="mc-key-hint">Ctrl S</kbd></button>` });
    const form = $('#dep-form', d.el);
    d.el.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); withSaving(form, async () => {
      const f = Object.fromEntries(new FormData(form)), name = String(f.name).trim(); if (!name) return toast('Give the department a name.');
      const row = { name, heading: String(f.heading || '').trim(), description: String(f.description || '').trim(), blurb: String(f.blurb || '').trim(), kind: f.kind, visible: form.elements.visible.checked, slug: dep?.slug || (f.kind === 'leadership' ? 'leadership' : f.kind === 'advisory' ? 'advisory' : slugify(name)), updated_at: new Date().toISOString() };
      if (!dep) row.sort_order = d0.sort_order;
      const r = dep ? await sb().from('team_departments').update(row).eq('id', dep.id) : await sb().from('team_departments').insert(row);
      if (r.error) return toast(authErrorText(r.error));
      if (dep && dep.name !== name) { const mr = await sb().from('team_members').update({ department: name }).eq('department', dep.name); if (mr.error) return toast(authErrorText(mr.error)); }
      await audit(dep ? 'update' : 'create', 'team_departments', name); toast('Department saved.', true); d.clean(); await d.close(true); rerender();
    }); });
    $('#dep-del', d.el)?.addEventListener('click', async () => {
      const n = data.members.filter((m) => m.department === dep.name).length;
      if (n) return toast(`Move or delete the ${n} ${n === 1 ? 'person' : 'people'} in ${dep.name} first.`);
      if (!(await confirmDialog({ title: `Delete ${dep.name}?`, confirm: 'Delete', danger: true }))) return;
      const r = await sb().from('team_departments').delete().eq('id', dep.id); if (r.error) return toast(authErrorText(r.error));
      await audit('delete', 'team_departments', dep.name); toast('Deleted.', true); d.clean(); await d.close(true); rerender();
    });
  }

  /* ---------- people list ---------- */
  function peopleView(data, route) {
    let q = '', filter = route.params.filter || 'all';
    const filters = [['all', 'Everyone'], ['published', 'Published'], ['draft', 'Draft'], ['nophoto', 'No photo']];
    const match = (m) => (filter === 'all' || (filter === 'nophoto' ? !m.photo_url : m.status === filter)) && (!q || `${m.name} ${m.role} ${m.department} ${m.member_code}`.toLowerCase().includes(q));
    const depNames = [...(data.deps || []).map((d) => d.name)]; data.members.forEach((m) => { if (!depNames.includes(m.department)) depNames.push(m.department); });
    const card = (m) => `<li class="mc-person${m.status === 'published' ? '' : ' off'}" draggable="true" data-id="${esc(m.id)}"><span class="grip" aria-hidden="true">${icon('grip')}</span><span class="ph ac-${esc(m.accent || 'b')}">${safeUrl(m.photo_url) ? `<img src="${esc(safeUrl(m.photo_url))}" alt="" loading="lazy" style="object-position:${esc(m.photo_position || '50% 100%')}">` : `<i>${esc((m.name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase())}</i>`}</span><div class="who"><b>${esc(m.name)}</b><small>${esc(m.role)}${m.member_code ? ` · <code>${esc(m.member_code)}</code>` : ''}</small></div><span class="tags">${m.status !== 'published' ? `<span class="status s-${esc(m.status)}">${esc(m.status)}</span>` : ''}${!m.photo_url ? '<span class="tag">No photo</span>' : ''}<span class="tag">${esc(LEVEL[m.level] || 'Member')}</span></span><div class="mc-item-actions"><button type="button" class="mc-icon-btn" data-team-up="${esc(m.id)}" title="Move up" aria-label="Move up">↑</button><button type="button" class="mc-icon-btn" data-team-down="${esc(m.id)}" title="Move down" aria-label="Move down">↓</button><button type="button" class="button-outline" data-edit="${esc(m.id)}">${icon('edit')}Edit</button></div></li>`;
    const draw = () => {
      const shown = data.members.filter(match);
      $('#team-groups').innerHTML = depNames.map((n) => { const items = shown.filter((m) => m.department === n); if (!items.length && (q || filter !== 'all')) return ''; return `<section class="mc-group" data-dep="${esc(n)}"><h3>${esc(n || 'No department')} <span class="mc-count">${items.length}</span></h3><ul class="mc-people">${items.map(card).join('') || '<li class="mc-drop">Nothing here yet. Drag a person in, or add one.</li>'}</ul></section>`; }).join('') || '<p class="mc-empty"><b>No people match.</b></p>';
    };
    const empty = !data.members.length;
    MC.setWorkspace('Team', `<nav class="mc-tabs" aria-label="Team views"><button type="button" data-view="people" aria-pressed="true">People</button><button type="button" data-view="page" aria-pressed="false">Page and departments</button></nav>
${empty ? `<section class="mc-card mc-starter"><h2>Start with the current roster</h2><p>Your 18 existing profiles, their photos and card details are ready to import. Everything stays editable afterwards, and the public page reads only from this database.</p><button type="button" id="starter">${icon('download')}Import starter roster</button><p class="muted small" id="starter-status" role="status" aria-live="polite"></p></section>` : ''}
<div class="mc-toolbar"><label class="mc-find">${icon('search')}<input type="search" id="mc-q" placeholder="Search people, roles, member IDs" aria-label="Search people"></label><div class="mc-chips" role="group" aria-label="Filter">${filters.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div></div>
<div id="team-groups"></div>
${empty ? '' : `<details class="mc-card mc-tools"><summary>Roster tools</summary><p class="muted small">Re-run the starter sync to fill in any missing card details or photos from the bundled roster. Existing edits are never overwritten.</p><div class="mc-row"><button type="button" class="button-outline" id="starter">${icon('download')}Sync starter roster</button><button type="button" class="button-outline" id="export">${icon('download')}Export roster (JSON)</button></div><p class="muted small" id="starter-status" role="status" aria-live="polite"></p></details>`}`,
      `<button type="button" data-new>${icon('plus')}Add team member</button>`);
    draw();
    const ws = $('#admin-workspace');
    $('.mc-tabs').onclick = (e) => { if (e.target.dataset.view === 'page') go('team', { view: 'page' }); };
    $('#mc-q').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
    ws.onclick = async (e) => {
      const f = e.target.closest('[data-filter]'); if (f) { filter = f.dataset.filter; $$('[data-filter]', ws).forEach((b) => b.setAttribute('aria-pressed', String(b === f))); draw(); return; }
      const up = e.target.closest('[data-team-up]');
      const down = e.target.closest('[data-team-down]');
      if (up || down) {
        const id = (up || down).dataset[up ? 'teamUp' : 'teamDown'];
        const m = data.members.find((x) => x.id === id);
        if (!m) return;
        const depMembers = data.members.filter((x) => x.department === m.department);
        const idx = depMembers.findIndex((x) => x.id === id);
        const targetIdx = up ? idx - 1 : idx + 1;
        if (targetIdx < 0 || targetIdx >= depMembers.length) return;
        const other = depMembers[targetIdx];
        const ord1 = m.sort_order || 0;
        const ord2 = other.sort_order || 0;
        const newOrd1 = ord1 === ord2 ? (up ? ord1 - 1 : ord1 + 1) : ord2;
        const newOrd2 = ord1 === ord2 ? ord1 : ord1;
        m.sort_order = newOrd1;
        other.sort_order = newOrd2;
        try {
          await Promise.all([
            sb().from('team_members').update({ sort_order: newOrd1 }).eq('id', m.id),
            sb().from('team_members').update({ sort_order: newOrd2 }).eq('id', other.id)
          ]);
          await audit('reorder', 'team_members', m.name);
          toast(`Updated order for ${m.name}.`, true);
          MC.dropCache();
          MC.render();
        } catch (err) {
          toast(authErrorText(err));
        }
        return;
      }
      const ed = e.target.closest('[data-edit]'); if (ed) return go('team', {}, ed.dataset.edit);
    };
    $('#mc-page-actions').onclick = (e) => { if (e.target.closest('[data-new]')) go('team', {}, 'new'); };
    const starter = $('#starter'); const status = $('#starter-status');
    starter?.addEventListener('click', async () => { starter.disabled = true; try { const r = await syncStarter(status); status.textContent = `Done: ${r.added} added, ${r.updated} updated, ${r.photos} photos uploaded.`; toast('Roster synced.', true); MC.dropCache(); setTimeout(() => MC.render(), 900); } catch (err) { status.textContent = `Stopped: ${authErrorText(err)} You can run it again to resume.`; starter.disabled = false; } });
    $('#export')?.addEventListener('click', () => { const blob = new Blob([JSON.stringify(data.members, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'gdg-sru-team.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });

    // Drag a person onto a department to move them; drop above/below a person to reorder.
    let drag = null; const tg = $('#team-groups');
    tg.addEventListener('dragstart', (e) => { const li = e.target.closest?.('.mc-person'); if (li) { drag = li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', drag); } catch { /* ignore */ } } });
    tg.addEventListener('dragend', () => { drag = null; $$('.dragging', tg).forEach((x) => x.classList.remove('dragging')); });
    tg.addEventListener('dragover', (e) => { if (drag && e.target.closest?.('.mc-group')) e.preventDefault(); });
    tg.addEventListener('drop', async (e) => {
      const group = e.target.closest?.('.mc-group'); if (!drag || !group) return; e.preventDefault();
      const dep = group.dataset.dep, over = e.target.closest('.mc-person')?.dataset.id, me = data.members.find((m) => m.id === drag);
      const list = data.members.filter((m) => m.department === dep && m.id !== drag); const at = over ? list.findIndex((m) => m.id === over) : list.length;
      list.splice(at < 0 ? list.length : at, 0, { ...me, department: dep });
      try {
        for (let i = 0; i < list.length; i++) { const m = list[i]; if (m.id === drag || m.sort_order !== i + 1) { const patch = { sort_order: i + 1 }; if (m.id === drag) patch.department = dep; const r = await sb().from('team_members').update(patch).eq('id', m.id); if (r.error) throw r.error; } }
        await audit('reorder', 'team_members', dep); toast('Order saved.', true); MC.dropCache(); MC.render();
      } catch (err) { toast(authErrorText(err)); }
    });
  }

  MC.pages.team = async (route) => {
    const data = await load();
    const again = () => MC.render();
    if (route.params.view === 'page') return pageView(data, again);
    peopleView(data, route);
    if (route.sub === 'new') openMember(data, null, again);
    else if (route.sub) { const m = data.members.find((x) => x.id === route.sub); if (m) openMember(data, m, again); else toast('That person no longer exists.'); }
  };
})();
