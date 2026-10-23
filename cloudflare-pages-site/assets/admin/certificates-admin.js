/* Mission Control: Certificates & Attendance Redesign
 * 3-Tab Per-Event Workbench: Attendance, Certificate, and Publish.
 * Loaded on demand by mission-control.js.
 */
(() => {
  'use strict';
  const G = window.GDGCert || {};
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let c; // context from mission-control.js: { sb, $, $$, setWorkspace, adminMessage, authErrorText, audit, msg, adminUser, keepEvent }

  /* ------------------------------------------------------------------ Attendance CSV Parser */
  function parseRows(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    row.push(cell); rows.push(row);
    return rows.filter((r) => r.some((x) => String(x).trim()));
  }

  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();

  function parseNames(text) {
    const issues = []; let rows = parseRows(String(text || '').replace(/^\uFEFF/, ''));
    if (!rows.length) return { rows: [], issues: ['The file is empty.'], dupes: 0, ambiguousNames: [] };
    const head = rows[0].map((h) => String(h).trim().toLowerCase());
    const nameIdx = head.findIndex((h) => ['name', 'full name', 'fullname', 'attendee_name', 'student name', 'names', 'student', 'attendee', 'attendees'].includes(h));
    let ni = 0, ri = -1, ei = -1, si = -1, hadHeader = false;
    if (nameIdx >= 0) {
      hadHeader = true; ni = nameIdx;
      ri = head.findIndex((h) => ['roll', 'roll no', 'roll no.', 'roll_no', 'roll number', 'roll_number', 'rollno', 'enrollment', 'enrollment no', 'enrollment_no'].includes(h));
      ei = head.findIndex((h) => ['email', 'attendee_email', 'email address'].includes(h));
      si = head.findIndex((h) => ['attendance_status', 'attendance status', 'attendee status', 'status'].includes(h));
      rows = rows.slice(1);
    }
    if (rows.length > 10000) return { rows: [], issues: ['A single upload can contain at most 10,000 attendee rows.'], dupes: 0, ambiguousNames: [] };
    const statusMap = new Map([
      ['attended', 'attended'], ['present', 'attended'], ['yes', 'attended'], ['y', 'attended'], ['true', 'attended'], ['1', 'attended'],
      ['absent', 'absent'], ['not attended', 'absent'], ['no', 'absent'], ['n', 'absent'], ['false', 'absent'], ['0', 'absent'],
      ['pending', 'pending'],
    ]);
    const byIdentity = new Map(), emailOwner = new Map(), out = []; let dupes = 0;
    rows.forEach((r, i) => {
      const name = String(r[ni] || '').trim().replace(/\s+/g, ' ');
      const rowNo = i + 1 + (hadHeader ? 1 : 0);
      if (!name) { issues.push(`Row ${rowNo}: attendee name is required.`); return; }
      if (name.length < 3 || name.length > 120) { issues.push(`Row ${rowNo}: name must be 3-120 characters.`); return; }
      const second = !hadHeader ? String(r[1] || '').trim() : '';
      const rollRaw = ri >= 0 ? String(r[ri] || '').trim() : (second && !second.includes('@') ? second : '');
      const roll = rollRaw.replace(/\s+/g, '').toUpperCase();
      const emailRaw = ei >= 0 ? String(r[ei] || '').trim().toLowerCase() : (second.includes('@') ? second.toLowerCase() : '');
      if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) { issues.push(`Row ${rowNo}: invalid email address for "${name}".`); return; }
      const statusRaw = si >= 0 ? String(r[si] || '').trim().toLowerCase() : (!hadHeader ? String(r[2] || '').trim().toLowerCase() : '');
      const status = !statusRaw ? 'attended' : (statusMap.get(statusRaw) || 'attended');
      const identity = roll ? `R:${roll}` : (emailRaw ? `E:${emailRaw}` : `N:${norm(name)}`);
      if (emailRaw && emailOwner.has(emailRaw) && emailOwner.get(emailRaw) !== identity) {
        issues.push(`Row ${rowNo}: email "${emailRaw}" belongs to another attendee.`); return;
      }
      if (byIdentity.has(identity)) {
        const prev = byIdentity.get(identity);
        if (prev.attendee_name.toLowerCase() === name.toLowerCase() && prev.attendance_status === status) { dupes++; return; }
        if (identity.startsWith('N:')) { issues.push(`Row ${rowNo}: duplicate attendee name "${name}". Unique roll number or email is required.`); return; }
        issues.push(`Row ${rowNo}: ${roll ? `roll ${roll}` : emailRaw} already exists.`); return;
      }
      if (emailRaw) emailOwner.set(emailRaw, identity);
      const attendee = { attendee_name: name, roll_no: roll || null, attendee_email: emailRaw || null, attendance_status: status };
      byIdentity.set(identity, attendee); out.push(attendee);
    });
    return { rows: out, issues, dupes, ambiguousNames: [] };
  }

  async function importNames(eventId, rows, replace) {
    const { sb } = c;
    const payload = rows.map((r) => ({
      attendee_name: r.attendee_name,
      roll_no: r.roll_no || null,
      attendee_email: r.attendee_email || null,
      attendance_status: r.attendance_status || 'attended',
    }));
    const { data, error } = await sb.rpc('import_attendance_roster', {
      p_event_id: eventId, p_rows: payload, p_replace: !!replace,
    });
    if (error) throw error;
    return data || { added: 0, updated: 0, removed: 0 };
  }

  /* ------------------------------------------------------------------ Image Upload Processing */
  async function processImageUpload(file, maxWidth = 600) {
    const name = file.name.toLowerCase();
    const isSvg = name.endsWith('.svg') || file.type === 'image/svg+xml';
    const isPng = name.endsWith('.png') || file.type === 'image/png';
    const isJpg = name.endsWith('.jpg') || name.endsWith('.jpeg') || file.type === 'image/jpeg';
    if (!isSvg && !isPng && !isJpg) {
      throw new Error('Please upload a PNG, JPG, or SVG image.');
    }

    let blob;
    if (isSvg) {
      const text = await file.text();
      const svgBlob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Could not parse SVG.'));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      const w = img.width || 600, h = img.height || 400;
      const scale = Math.min(1, maxWidth / w);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
    } else {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Could not parse image.'));
        img.src = url;
      });
      URL.revokeObjectURL(url);
      if (img.width > maxWidth) {
        const scale = maxWidth / img.width;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        blob = await new Promise((res) => canvas.toBlob(res, isPng ? 'image/png' : 'image/jpeg', 0.92));
      } else {
        blob = file;
      }
    }
    if (blob.size > 1024 * 1024) {
      throw new Error(`Image size is ${(blob.size / 1024 / 1024).toFixed(2)} MB, exceeding the 1 MB limit.`);
    }
    return blob;
  }

  async function uploadToStorage(sb, path, blob) {
    const { error } = await sb.storage.from('certificate-logos').upload(path, blob, {
      contentType: blob.type || 'image/png',
      upsert: true,
    });
    if (error) throw error;
    return path;
  }

  async function getStorageDataUrl(sb, path) {
    if (!path) return '';
    try {
      const { data, error } = await sb.storage.from('certificate-logos').download(path);
      if (error || !data) return '';
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(data);
      });
    } catch {
      return '';
    }
  }

  /* ------------------------------------------------------------------ Studio Libs */
  async function loadStudioLibs() {
    if (window.html2canvas && window.jspdf && window.JSZip) return;
    const loadScriptWithFallback = (localSrc, fallbackSrc) => new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${localSrc}"], script[src="${fallbackSrc}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = localSrc;
      s.onload = resolve;
      s.onerror = () => {
        const fb = document.createElement('script');
        fb.src = fallbackSrc;
        fb.onload = resolve;
        fb.onerror = reject;
        document.head.appendChild(fb);
      };
      document.head.appendChild(s);
    });
    await Promise.all([
      loadScriptWithFallback('/assets/vendor/html2canvas.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScriptWithFallback('/assets/vendor/jspdf.umd.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScriptWithFallback('/assets/vendor/jszip.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
    ]);
  }

  /* ------------------------------------------------------------------ Main Per-Event Workbench */
  async function renderWorkbench(ctx, activeTabName = 'certificate') {
    c = ctx; const { sb, $, $$, setWorkspace, adminMessage, authErrorText, audit } = c;

    // Load initial data
    const [eventsRes, globalRes] = await Promise.all([
      sb.from('events').select('id,title,start_at').order('start_at', { ascending: false }),
      sb.from('certificate_global_settings').select('default_layout').eq('id', 1).maybeSingle(),
    ]);

    const events = (eventsRes.data && eventsRes.data.length) ? eventsRes.data : [];
    if (!events.length) {
      setWorkspace('Certificates', `<div class="card pp" style="margin-top:20px"><p>No events found. Please create an event before configuring certificates.</p></div>`);
      return;
    }

    let selectedEventId = ctx.keepEvent || ctx.preselect || events[0].id;
    if (!events.some((e) => e.id === selectedEventId)) selectedEventId = events[0].id;

    let globalDefaultLayout = globalRes.data?.default_layout || {};

    if (!document.getElementById('gdg-cert-studio-fonts')) {
      const l = document.createElement('link');
      l.id = 'gdg-cert-studio-fonts';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&family=Kalam:wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    loadStudioLibs();

    // Render Workbench Shell
    setWorkspace('Certificates & Attendance', `
      <style id="mc-workbench-css">
        .mc-wb-container { display: flex; flex-direction: column; gap: 16px; margin-top: 4px; }
        .mc-wb-header {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-l);
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          box-shadow: var(--sh-sm);
        }
        .mc-wb-header-left { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        .mc-wb-header-right { display: flex; align-items: center; gap: 8px; }
        
        /* 3-Tab Bar */
        .mc-wb-tabs {
          display: flex;
          gap: 6px;
          background: var(--sunk, #f1f3f4);
          padding: 4px;
          border-radius: var(--r-m);
          border: 1px solid var(--line);
          width: fit-content;
        }
        .mc-wb-tab-btn {
          border: none;
          background: none;
          padding: 6px 16px;
          border-radius: calc(var(--r-m) - 2px);
          font-size: 13px;
          font-weight: 700;
          color: var(--ink-2);
          cursor: pointer;
          transition: all 0.15s ease;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .mc-wb-tab-btn:hover { color: var(--ink); }
        .mc-wb-tab-btn.active {
          background: var(--surface);
          color: var(--primary, #1a73e8);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        /* Panes */
        .mc-wb-pane { display: none; }
        .mc-wb-pane.active { display: block; }

        /* General Forms */
        .mc-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-l);
          padding: 18px 20px;
          box-shadow: var(--sh-sm);
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .mc-f-group { display: flex; flex-direction: column; gap: 5px; }
        .mc-f-group label { font-size: 11.5px; font-weight: 700; color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.3px; }
        .mc-f-group input, .mc-f-group textarea, .mc-f-group select {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-m);
          padding: 8px 12px;
          font-size: 13px;
          color: var(--ink);
          font-family: inherit;
          outline: none;
        }
        .mc-f-group input:focus, .mc-f-group textarea:focus, .mc-f-group select:focus {
          border-color: var(--primary, #1a73e8);
        }
        .mc-f-row { display: flex; gap: 12px; }
        .mc-f-row > * { flex: 1; }

        /* Certificate Grid */
        .mc-cert-grid {
          display: grid;
          grid-template-columns: minmax(360px, 440px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1080px) {
          .mc-cert-grid { grid-template-columns: 1fr; }
        }

        /* Preview card */
        .mc-preview-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-l);
          overflow: hidden;
          box-shadow: var(--sh-sm);
          position: sticky;
          top: 72px;
        }
        .mc-preview-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 16px;
          background: var(--surface);
          border-bottom: 1px solid var(--line);
          font-size: 12px;
          font-weight: 600;
        }
        .mc-preview-stage {
          background: #eef2f6;
          padding: 20px;
          overflow: auto;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: 480px;
          max-height: calc(100vh - 180px);
        }
        .mc-canvas-scaler { transform-origin: top center; transition: transform 0.1s ease-out; }

        /* Draggable elements on canvas */
        .live-drag-target {
          cursor: move !important;
          outline: 1.5px dashed rgba(66, 133, 244, 0.4) !important;
          transition: outline-color 0.15s;
        }
        .live-drag-target:hover {
          outline: 2px dashed #4285f4 !important;
        }
        .live-drag-target.selected {
          outline: 2.5px solid #1a73e8 !important;
          box-shadow: 0 0 8px rgba(26, 115, 232, 0.3) !important;
        }

        /* Checklist */
        .checklist-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          background: var(--sunk, #f8f9fa);
          border: 1px solid var(--line);
          border-radius: var(--r-m);
        }
        .checklist-item.pass { border-left: 4px solid #34a853; }
        .checklist-item.fail { border-left: 4px solid #ea4335; }
      </style>

      <div class="mc-wb-container">
        <!-- Header: Event Selector + 3-Tab Switcher -->
        <div class="mc-wb-header">
          <div class="mc-wb-header-left">
            <label style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px">
              <span>Event:</span>
              <select id="wb-event-select" style="font-size:13px;padding:6px 12px;border-radius:var(--r-m);border:1px solid var(--line);min-width:240px">
                ${events.map((e) => `<option value="${esc(e.id)}" ${e.id === selectedEventId ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}
              </select>
            </label>
            <div class="mc-wb-tabs">
              <button type="button" class="mc-wb-tab-btn ${activeTabName === 'attendance' ? 'active' : ''}" data-tab="attendance">👥 Attendance</button>
              <button type="button" class="mc-wb-tab-btn ${activeTabName === 'certificate' ? 'active' : ''}" data-tab="certificate">📜 Certificate</button>
              <button type="button" class="mc-wb-tab-btn ${activeTabName === 'publish' ? 'active' : ''}" data-tab="publish">🚀 Publish</button>
            </div>
          </div>
          <div class="mc-wb-header-right">
            <button type="button" class="btn o sm" id="wb-global-defaults-btn">⚙️ Default Layout</button>
          </div>
        </div>

        <!-- TAB 1: Attendance Pane -->
        <div id="pane-attendance" class="mc-wb-pane ${activeTabName === 'attendance' ? 'active' : ''}"></div>

        <!-- TAB 2: Certificate Pane -->
        <div id="pane-certificate" class="mc-wb-pane ${activeTabName === 'certificate' ? 'active' : ''}"></div>

        <!-- TAB 3: Publish Pane -->
        <div id="pane-publish" class="mc-wb-pane ${activeTabName === 'publish' ? 'active' : ''}"></div>
      </div>

      <!-- Global Default Layout Modal -->
      <dialog id="wb-global-modal" style="border:none;border-radius:var(--r-l);box-shadow:var(--sh-l);padding:24px;width:90%;max-width:540px;background:var(--surface);color:var(--ink)">
        <h3 style="margin:0 0 8px">Global Default Layout</h3>
        <p style="font-size:13px;color:var(--ink-2);margin:0 0 16px">Shared layout settings applied across all certificates (unless overridden per event).</p>
        <div class="mc-f-group" style="margin-bottom:12px">
          <label>GDG Logo Default Position (X, Y, Scale)</label>
          <div class="mc-f-row">
            <input type="number" id="g-inp-gdg-x" placeholder="X (e.g. 40)">
            <input type="number" id="g-inp-gdg-y" placeholder="Y (e.g. 30)">
            <input type="number" step="0.05" id="g-inp-gdg-s" placeholder="Scale (e.g. 1)">
          </div>
        </div>
        <div class="mc-f-group" style="margin-bottom:16px">
          <label>Raw Default Layout (JSON)</label>
          <textarea id="g-inp-raw-json" rows="6" style="font-family:'JetBrains Mono',monospace;font-size:12px"></textarea>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px">
          <button type="button" class="btn o sm" id="wb-global-modal-close">Cancel</button>
          <button type="button" class="btn sm" id="wb-global-modal-save">Save Global Defaults</button>
        </div>
      </dialog>
    `);

    // Tab Switching logic
    const tabBtns = $$('.mc-wb-tab-btn');
    const panes = {
      attendance: $('#pane-attendance'),
      certificate: $('#pane-certificate'),
      publish: $('#pane-publish'),
    };
    function switchTab(name) {
      tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
      Object.keys(panes).forEach((k) => panes[k].classList.toggle('active', k === name));
      if (name === 'certificate') setTimeout(fitStudioCanvas, 60);
      if (name === 'publish') refreshPublishTab();
    }
    tabBtns.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // Event Switcher logic
    $('#wb-event-select').addEventListener('change', (e) => {
      ctx.keepEvent = e.target.value;
      const currentActive = document.querySelector('.mc-wb-tab-btn.active')?.dataset.tab || 'certificate';
      renderWorkbench(ctx, currentActive);
    });

    // Global Modal logic
    const globalModal = $('#wb-global-modal');
    $('#wb-global-defaults-btn').addEventListener('click', () => {
      const gdg = globalDefaultLayout.gdg || {};
      $('#g-inp-gdg-x').value = gdg.x ?? 40;
      $('#g-inp-gdg-y').value = gdg.y ?? 30;
      $('#g-inp-gdg-s').value = gdg.scale ?? 1;
      $('#g-inp-raw-json').value = JSON.stringify(globalDefaultLayout, null, 2);
      globalModal.showModal();
    });
    $('#wb-global-modal-close').addEventListener('click', () => globalModal.close());
    $('#wb-global-modal-save').addEventListener('click', async () => {
      try {
        let parsed = {};
        try { parsed = JSON.parse($('#g-inp-raw-json').value); } catch {
          parsed = { ...globalDefaultLayout };
        }
        parsed.gdg = {
          x: Number($('#g-inp-gdg-x').value) || 0,
          y: Number($('#g-inp-gdg-y').value) || 0,
          scale: Number($('#g-inp-gdg-s').value) || 1,
        };
        const { error } = await sb.from('certificate_global_settings').upsert({ id: 1, default_layout: parsed });
        if (error) throw error;
        globalDefaultLayout = parsed;
        adminMessage('Global default layout saved.', true);
        globalModal.close();
        renderCertificateTab();
      } catch (err) {
        adminMessage(authErrorText(err));
      }
    });

    /* ==================================================================
       TAB 1: ATTENDANCE IMPLEMENTATION
       ================================================================== */
    async function renderAttendanceTab() {
      const root = panes.attendance;
      root.innerHTML = `<div class="mc-loading" role="status"><span>Loading roster…</span></div>`;

      const { data: records, error } = await sb.from('attendance_records')
        .select('*')
        .eq('event_id', selectedEventId)
        .order('attendee_name');

      if (error) {
        root.innerHTML = `<div class="card pp"><p role="alert">Could not load roster: ${esc(authErrorText(error))}</p></div>`;
        return;
      }

      const rows = records || [];
      const purgeDate = rows[0]?.purge_at ? new Date(rows[0].purge_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '1 year after event';

      root.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px">
          <!-- Top Stats & Import Card -->
          <div class="mc-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <div>
                <h3 style="margin:0 0 4px">Event Attendance Roster</h3>
                <p style="margin:0;font-size:13px;color:var(--ink-2)"><b>${rows.length}</b> attendees registered for this event. Retention purge date: <b>${purgeDate}</b>.</p>
              </div>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn sm" id="att-btn-open-import">📥 Upload / Import CSV</button>
                ${rows.length ? `<button type="button" class="btn o sm" id="att-btn-clear" style="color:var(--r)">Delete Roster</button>` : ''}
              </div>
            </div>

            <!-- Import Collapse Box -->
            <div id="att-import-box" style="display:none;margin-top:12px;padding:16px;background:var(--sunk,#f8f9fa);border-radius:var(--r-m);border:1px solid var(--line)">
              <h4 style="margin:0 0 6px;font-size:13px">Import Attendees</h4>
              <p style="font-size:12px;color:var(--ink-2);margin:0 0 10px">Upload a CSV with <code>name</code>, optional <code>roll_no</code>, <code>email</code>, and <code>status</code>. Or paste names below.</p>
              
              <div class="mc-f-row" style="margin-bottom:10px">
                <label class="btn o sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                  📁 Choose CSV File
                  <input type="file" id="att-file-input" accept=".csv,.txt" style="display:none">
                </label>
                <label class="check" style="font-size:12px;display:flex;align-items:center;gap:6px">
                  <input type="checkbox" id="att-chk-replace"> Replace existing roster
                </label>
              </div>

              <textarea id="att-paste-area" rows="4" placeholder="Name, Roll No, Email&#10;Asha Rao, 26BCE1001, asha@example.com&#10;Rahul Verma, 26BCE1002" style="font-family:monospace;font-size:12px;width:100%;margin-bottom:10px;box-sizing:border-box"></textarea>
              
              <div style="display:flex;justify-content:flex-end;gap:8px">
                <button type="button" class="btn o sm" id="att-btn-cancel-import">Cancel</button>
                <button type="button" class="btn sm" id="att-btn-run-import">Start Import</button>
              </div>
              <div id="att-import-feedback" style="margin-top:8px;font-size:12px"></div>
            </div>
          </div>

          <!-- Attendee Table Card -->
          <div class="mc-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
              <input type="text" id="att-search" placeholder="Search attendees by name, roll, or email…" style="font-size:13px;padding:6px 12px;border-radius:var(--r-m);border:1px solid var(--line);min-width:280px">
              <span id="att-filter-count" style="font-size:12px;color:var(--ink-3)">Showing ${rows.length} of ${rows.length}</span>
            </div>

            <div style="overflow-x:auto;max-height:480px">
              <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                <thead>
                  <tr style="border-bottom:1.5px solid var(--line);background:var(--sunk,#f8f9fa)">
                    <th style="padding:10px 12px">Attendee Name</th>
                    <th style="padding:10px 12px">Roll Number</th>
                    <th style="padding:10px 12px">Email</th>
                    <th style="padding:10px 12px">Status</th>
                    <th style="padding:10px 12px">Action</th>
                  </tr>
                </thead>
                <tbody id="att-table-body">
                  ${rows.length ? rows.map((r) => `
                    <tr style="border-bottom:1px solid var(--line)" data-att-row="${esc(r.id)}">
                      <td style="padding:10px 12px;font-weight:600">${esc(r.attendee_name)}</td>
                      <td style="padding:10px 12px;font-family:monospace">${esc(r.roll_no || '—')}</td>
                      <td style="padding:10px 12px;color:var(--ink-2)">${esc(r.attendee_email || '—')}</td>
                      <td style="padding:10px 12px"><span class="tag ${r.attendance_status === 'attended' ? 't3' : 't2'}" style="font-size:11px">${esc(r.attendance_status)}</span></td>
                      <td style="padding:10px 12px">
                        <button type="button" class="btn o sm" data-del-att="${esc(r.id)}" style="padding:2px 8px;font-size:11px;color:var(--r)">✕</button>
                      </td>
                    </tr>
                  `).join('') : `<tr><td colspan="5" style="padding:24px;text-align:center;color:var(--ink-3)">No attendees on record for this event yet.</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;

      // Import toggle
      const importBox = $('#att-import-box');
      $('#att-btn-open-import').onclick = () => { importBox.style.display = importBox.style.display === 'none' ? 'block' : 'none'; };
      $('#att-btn-cancel-import').onclick = () => { importBox.style.display = 'none'; };

      // File input
      $('#att-file-input').onchange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => { $('#att-paste-area').value = evt.target.result; };
        reader.readAsText(file);
      };

      // Run import
      $('#att-btn-run-import').onclick = async () => {
        const text = $('#att-paste-area').value.trim();
        const replace = $('#att-chk-replace').checked;
        const fb = $('#att-import-feedback');
        if (!text) { fb.innerHTML = '<span style="color:var(--r)">Please paste attendee data or choose a CSV file.</span>'; return; }
        fb.innerHTML = '<span>Parsing and validating records…</span>';
        const parsed = parseNames(text);
        if (parsed.issues.length) {
          fb.innerHTML = `<span style="color:var(--r)">Found ${parsed.issues.length} issue(s):<br>${parsed.issues.slice(0, 4).join('<br>')}</span>`;
          return;
        }
        fb.innerHTML = `<span>Uploading ${parsed.rows.length} attendee(s)…</span>`;
        try {
          const res = await importNames(selectedEventId, parsed.rows, replace);
          adminMessage(`Roster updated: ${res.added} added, ${res.updated} updated, ${res.removed} removed.`, true);
          await renderAttendanceTab();
          refreshPublishTab();
        } catch (err) {
          fb.innerHTML = `<span style="color:var(--r)">Import failed: ${esc(authErrorText(err))}</span>`;
        }
      };

      // Delete attendee
      $$('[data-del-att]', root).forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Remove this attendee from the roster?')) return;
          const id = btn.dataset.delAtt;
          const { error } = await sb.from('attendance_records').delete().eq('id', id);
          if (error) return adminMessage(authErrorText(error));
          adminMessage('Attendee removed.', true);
          await renderAttendanceTab();
          refreshPublishTab();
        };
      });

      // Clear roster
      const clearBtn = $('#att-btn-clear');
      if (clearBtn) {
        clearBtn.onclick = async () => {
          if (!confirm('Are you sure you want to delete ALL attendees for this event? This cannot be undone.')) return;
          const { error } = await sb.from('attendance_records').delete().eq('event_id', selectedEventId);
          if (error) return adminMessage(authErrorText(error));
          adminMessage('Attendance roster cleared.', true);
          await renderAttendanceTab();
          refreshPublishTab();
        };
      }

      // Search filter
      $('#att-search').oninput = (e) => {
        const q = e.target.value.toLowerCase().trim();
        const trs = $$('#att-table-body tr', root);
        let visible = 0;
        trs.forEach((tr) => {
          const text = tr.textContent.toLowerCase();
          const show = text.includes(q);
          tr.style.display = show ? '' : 'none';
          if (show) visible++;
        });
        $('#att-filter-count').textContent = `Showing ${visible} of ${rows.length}`;
      };
    }

    /* ==================================================================
       TAB 2: CERTIFICATE DETAILS & LAYOUT EDITOR IMPLEMENTATION
       ================================================================== */
    let currentEc = null;
    let currentPartners = [];
    let currentEventObj = events.find((e) => e.id === selectedEventId) || events[0];
    let studioTemplateHtml = '';

    async function renderCertificateTab() {
      const root = panes.certificate;
      root.innerHTML = `<div class="mc-loading" role="status"><span>Loading certificate designer…</span></div>`;

      // Fetch event certificate row, partners, and master template
      const [ecRes, partRes, tplRes] = await Promise.all([
        sb.from('event_certificates').select('*').eq('event_id', selectedEventId).maybeSingle(),
        sb.from('event_partners').select('*').eq('event_id', selectedEventId).order('sort_order'),
        fetch('/assets/data/certificate-default-template.html').then((r) => r.text()).catch(() => ''),
      ]);

      studioTemplateHtml = tplRes || '';
      currentEc = ecRes.data || {
        event_id: selectedEventId,
        event_date: currentEventObj.start_at ? currentEventObj.start_at.slice(0, 10) : new Date().toISOString().slice(0, 10),
        host_chapter: 'GDG on Campus SR University',
        cert_tag: 'OFFICIAL CREDENTIAL',
        cert_title: 'Certificate of Participation',
        track: 'Community Learning',
        skills: ['Web Development', 'Git', 'Open Source', 'Cloud'],
        dossier_tag: 'LEARN_WITH_COMMUNITY',
        curriculum_status: 'STATUS: Topic / Curriculum Overview',
        curriculum_text: 'Active participation and hands-on contributions in community learning sessions, exploring developer tools, open-source practices, and foundational computing skills.',
        curriculum_bullets: false,
        signatories: [],
        layout: {
          credential_base: 'GDGSRU-2026-LWC',
          dev_tag: 'DEV_COMMUNITY',
          node_pill: 'ACTIVE_NODE // 01',
          partner_sticker: '',
        },
        claims_enabled: false,
      };

      if (!currentEc.curriculum_status) {
        currentEc.curriculum_status = 'STATUS: Topic / Curriculum Overview';
      }
      if (!currentEc.layout) currentEc.layout = {};
      if (currentEc.layout.event_title_override) {
        currentEc.event_title_override = currentEc.layout.event_title_override;
      }

      currentPartners = partRes.data || [];

      // Render Designer Layout
      root.innerHTML = `
        <div class="mc-cert-grid">
          <!-- Left: Control Panels -->
          <div style="display:flex;flex-direction:column;gap:16px">
            <!-- 1. Event & Certificate Identity -->
            <div class="mc-card">
              <h3 style="margin:0 0 2px;font-size:15px">1. Event & Certificate Identity</h3>
              <p style="margin:0 0 10px;font-size:12px;color:var(--ink-2)">Core titles, dates, and chapter identification.</p>
              
              <div class="mc-f-group">
                <label>Event Title</label>
                <input type="text" id="inp-event-title" value="${esc(currentEc.event_title_override || currentEventObj.title || '')}" placeholder="e.g. Learn with Community">
              </div>

              <div class="mc-f-group">
                <label>GDG Chapter Name</label>
                <input type="text" id="inp-host-chapter" value="${esc(currentEc.host_chapter || 'GDG on Campus SR University')}" maxlength="120" placeholder="GDG on Campus SR University">
              </div>

              <div class="mc-f-row">
                <div class="mc-f-group">
                  <label>Event Date</label>
                  <input type="date" id="inp-event-date" value="${esc(currentEc.event_date || '')}">
                </div>
                <div class="mc-f-group">
                  <label>Top Credential Tag</label>
                  <input type="text" id="inp-cert-tag" value="${esc(currentEc.cert_tag || 'OFFICIAL CREDENTIAL')}" placeholder="OFFICIAL CREDENTIAL">
                </div>
              </div>

              <div class="mc-f-group">
                <label>Certificate Title</label>
                <input type="text" id="inp-cert-title" value="${esc(currentEc.cert_title || 'Certificate of Participation')}" maxlength="80" placeholder="Certificate of Participation">
              </div>
            </div>

            <!-- 2. Curriculum Overview Card -->
            <div class="mc-card">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <h3 style="margin:0;font-size:15px">// Curriculum Overview Card</h3>
                <label class="check" style="font-size:12px;font-weight:700">
                  <input type="checkbox" id="chk-curriculum-bullets" ${currentEc.curriculum_bullets ? 'checked' : ''}> Show as bullets (one per line)
                </label>
              </div>
              <p style="margin:2px 0 8px;font-size:12px;color:var(--ink-2)">Syllabus, topics, and completion status displayed on the certificate.</p>
              
              <div class="mc-f-group">
                <label>Header Status Tag</label>
                <input type="text" id="inp-curriculum-status" value="${esc(currentEc.curriculum_status || 'STATUS: Topic / Curriculum Overview')}" placeholder="STATUS: Topic / Curriculum Overview">
              </div>
              <div class="mc-f-group">
                <label>Curriculum / Topic Details</label>
                <textarea id="inp-curriculum-text" rows="3" maxlength="2000" placeholder="Enter workshop curriculum topics or bullet points...">${esc(currentEc.curriculum_text || '')}</textarea>
              </div>
            </div>

            <!-- 3. Blue Dossier Card & Competencies -->
            <div class="mc-card">
              <h3 style="margin:0 0 2px;font-size:15px">// Blue Dossier Card & Competencies</h3>
              <p style="margin:0 0 8px;font-size:12px;color:var(--ink-2)">Verified skills, track, and credential reference.</p>
              
              <div class="mc-f-row">
                <div class="mc-f-group">
                  <label>Dossier Tag (Yellow)</label>
                  <input type="text" id="inp-dossier-tag" value="${esc(currentEc.dossier_tag || 'LEARN_WITH_COMMUNITY')}" placeholder="e.g. LEARN_WITH_COMMUNITY">
                </div>
                <div class="mc-f-group">
                  <label>Track Name</label>
                  <input type="text" id="inp-track" value="${esc(currentEc.track || 'Web & Community')}" placeholder="e.g. Web Development / AI & Cloud">
                </div>
              </div>

              <div class="mc-f-group">
                <label>Skills & Competencies (comma separated)</label>
                <input type="text" id="inp-skills" value="${esc((currentEc.skills || []).join(', '))}" placeholder="e.g. HTML, CSS, JavaScript, Git, Cloud">
              </div>

              <div class="mc-f-group">
                <label>Credential ID Base</label>
                <input type="text" id="inp-credential-base" value="${esc(currentEc.layout?.credential_base || 'GDGSRU-2026-LWC')}" placeholder="e.g. GDGSRU-2026-LWC">
              </div>
            </div>

            <!-- 4. Tech Badges & Stickers -->
            <div class="mc-card">
              <h3 style="margin:0 0 2px;font-size:15px">// Tech Badges & Stickers</h3>
              <p style="margin:0 0 8px;font-size:12px;color:var(--ink-2)">Header and sidebar tech accent badges.</p>

              <div class="mc-f-row">
                <div class="mc-f-group">
                  <label>Dev Tag</label>
                  <input type="text" id="inp-dev-tag" value="${esc(currentEc.layout?.dev_tag || 'DEV_COMMUNITY')}" placeholder="e.g. DEV_COMMUNITY or CLOUD_NATIVE">
                </div>
                <div class="mc-f-group">
                  <label>Active Node Pill</label>
                  <input type="text" id="inp-node-pill" value="${esc(currentEc.layout?.node_pill || 'ACTIVE_NODE // 01')}" placeholder="e.g. ACTIVE_NODE // 01">
                </div>
              </div>

              <div class="mc-f-group">
                <label>Partner Pill (Optional)</label>
                <input type="text" id="inp-partner-pill" value="${esc(currentEc.layout?.partner_sticker || '')}" placeholder="Optional, e.g. PARTNER // SRU">
              </div>
            </div>

            <!-- 5. GDG Logo, Partner Logos & Details -->
            <div class="mc-card">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <h3 style="margin:0;font-size:15px">GDG Logo, Partner Logos & Details</h3>
                  <p style="margin:2px 0 0;font-size:12px;color:var(--ink-2)">Sponsors, co-hosts, and authorized signatures.</p>
                </div>
                <div style="display:flex;gap:6px">
                  <button type="button" class="btn o sm" id="btn-add-partner" ${currentPartners.length >= 8 ? 'disabled' : ''}>+ Add Partner</button>
                  <button type="button" class="btn o sm" id="btn-add-sig" ${(currentEc.signatories || []).length >= 2 ? 'disabled' : ''}>+ Add Signatory</button>
                </div>
              </div>
              <div id="partners-list-wrap" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"></div>
              <div id="sigs-list-wrap" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"></div>
            </div>

            <!-- 6. Manual X/Y Positioning & Scale -->
            <div class="mc-card" id="layout-editor-panel">
              <div style="display:flex;justify-content:space-between;align-items:center">
                <div>
                  <h3 style="margin:0;font-size:15px">6. Manual X/Y Positioning & Scale</h3>
                  <p style="margin:2px 0 0;font-size:12px;color:var(--ink-2)">Select an element below to fine-tune its pixel coordinates or drag directly on the preview canvas.</p>
                </div>
                <div style="display:flex;gap:6px">
                  <button type="button" class="btn o sm" id="btn-reset-element" title="Reset selected element to default">Reset Element</button>
                  <button type="button" class="btn o sm" id="btn-reset-all-layout" title="Reset all elements to default">Reset All</button>
                </div>
              </div>

              <div class="mc-f-group" style="margin-top:10px">
                <label>Target Element</label>
                <select id="sel-layout-target">
                  <option value="gdg">GDG Chapter Logo</option>
                  <option value="cert_tag">Top Credential Tag</option>
                  <option value="title">Certificate Title</option>
                  <option value="name">Attendee Name Badge</option>
                  <option value="event">Event Statement Text</option>
                  <option value="curriculum">Curriculum Overview Card</option>
                  <option value="dossier">Blue Dossier Card (Competencies)</option>
                  <option value="credential">Terminal Log Card</option>
                  <option value="sig_1">Signatory 1</option>
                  <option value="sig_2">Signatory 2</option>
                </select>
              </div>

              <div class="mc-f-row">
                <div class="mc-f-group">
                  <label>X Position (px)</label>
                  <input type="number" id="inp-pos-x" min="0" max="1123" placeholder="e.g. 48">
                </div>
                <div class="mc-f-group">
                  <label>Y Position (px)</label>
                  <input type="number" id="inp-pos-y" min="0" max="794" placeholder="e.g. 180">
                </div>
                <div class="mc-f-group">
                  <label>Scale (0.3 - 2)</label>
                  <input type="number" step="0.05" id="inp-pos-s" min="0.3" max="2" placeholder="1.0">
                </div>
                <div class="mc-f-group">
                  <label>Width (px, opt)</label>
                  <input type="number" id="inp-pos-w" min="120" max="1000" placeholder="Auto">
                </div>
              </div>
            </div>

            <!-- Save Action Button -->
            <button type="button" class="btn" id="btn-save-ec" style="padding:12px;font-size:14px;font-weight:700">💾 Save Certificate Settings</button>
          </div>

          <!-- Right: Live Interactive Canvas Preview -->
          <div class="mc-preview-card">
            <div class="mc-preview-bar">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:700">Live Preview</span>
                <input type="text" id="inp-preview-name" value="Asha Rao" placeholder="Preview Name" style="font-size:11px;padding:3px 8px;border:1px solid var(--line);border-radius:4px;width:120px">
              </div>
              <div style="display:flex;gap:4px;align-items:center">
                <span style="font-size:11px;font-family:var(--font-mono);color:var(--ink-2);margin-right:2px">Zoom:</span>
                <button type="button" class="btn o sm" id="btn-zoom-fit" style="padding:2px 6px;font-size:11px" title="Fit to screen">Fit</button>
                <button type="button" class="btn o sm" id="btn-zoom-50" style="padding:2px 6px;font-size:11px">50%</button>
                <button type="button" class="btn o sm" id="btn-zoom-75" style="padding:2px 6px;font-size:11px">75%</button>
                <button type="button" class="btn o sm" id="btn-zoom-100" style="padding:2px 6px;font-size:11px">100%</button>
                <button type="button" class="btn o sm" id="btn-zoom-125" style="padding:2px 6px;font-size:11px">125%</button>
              </div>
            </div>
            <div class="mc-preview-stage" id="studio-stage">
              <div class="mc-canvas-scaler" id="studio-scaler">
                <div id="studio-canvas-wrap"></div>
              </div>
            </div>
          </div>
        </div>
      `;

      // Wire Partners list
      renderPartnersList();
      // Wire Signatories list
      renderSignatoriesList();
      // Populate Layout inputs for current target
      updateLayoutInputs();
      // Render Initial Certificate Canvas
      updateStudioPreview();

      // Form change listeners
      const inputs = [
        '#inp-event-title', '#inp-host-chapter', '#inp-event-date', '#inp-cert-tag', '#inp-cert-title',
        '#inp-curriculum-status', '#inp-curriculum-text', '#chk-curriculum-bullets',
        '#inp-dossier-tag', '#inp-track', '#inp-skills', '#inp-credential-base',
        '#inp-dev-tag', '#inp-node-pill', '#inp-partner-pill',
        '#inp-preview-name'
      ];
      inputs.forEach((sel) => {
        $(sel, root)?.addEventListener('input', () => {
          syncFormToEc();
          updateStudioPreview();
        });
      });

      // Layout selector change (if present)
      $('#sel-layout-target', root)?.addEventListener('change', () => {
        updateLayoutInputs();
        highlightActiveDragTarget();
      });

      // Layout numeric inputs change (if present)
      ['#inp-pos-x', '#inp-pos-y', '#inp-pos-s', '#inp-pos-w'].forEach((sel) => {
        $(sel, root)?.addEventListener('input', () => {
          applyLayoutInputsToEc();
          updateStudioPreview();
        });
      });

      // Reset Element button (if present)
      $('#btn-reset-element', root)?.addEventListener('click', () => {
        const target = $('#sel-layout-target', root)?.value;
        if (target && currentEc.layout && currentEc.layout[target]) {
          delete currentEc.layout[target];
          updateLayoutInputs();
          updateStudioPreview();
          adminMessage(`Position for "${target}" reset to default.`, true);
        }
      });

      // Reset All Layout button (if present)
      $('#btn-reset-all-layout', root)?.addEventListener('click', () => {
        if (!confirm('Reset all element positions for this event to default layout?')) return;
        currentEc.layout = {};
        updateLayoutInputs();
        updateStudioPreview();
        adminMessage('All element positions reset to default.', true);
      });

      // Add Partner button
      $('#btn-add-partner', root).addEventListener('click', () => {
        if (currentPartners.length >= 8) return;
        const newP = {
          id: 'temp_' + Date.now(),
          event_id: selectedEventId,
          role: 'cohost',
          name: 'Partner Name',
          logo_path: null,
          sort_order: currentPartners.length,
          isNew: true,
        };
        currentPartners.push(newP);
        renderPartnersList();
        updateStudioPreview();
      });

      // Add Signatory button
      $('#btn-add-sig', root).addEventListener('click', () => {
        if (!currentEc.signatories) currentEc.signatories = [];
        if (currentEc.signatories.length >= 2) return;
        currentEc.signatories.push({
          name: 'Signatory Name',
          role: 'Lead Organizer',
          image_path: null,
        });
        renderSignatoriesList();
        updateStudioPreview();
      });

      // Save Certificate Settings
      $('#btn-save-ec', root).addEventListener('click', async () => {
        syncFormToEc();
        const saveBtn = $('#btn-save-ec', root);
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving…';
        try {
          // 1. Save partners
          for (let i = 0; i < currentPartners.length; i++) {
            const p = currentPartners[i];
            p.sort_order = i;
            const payload = {
              event_id: selectedEventId,
              role: p.role,
              name: p.name.trim().slice(0, 80),
              logo_path: p.logo_path || null,
              sort_order: i,
            };
            if (p.isNew || String(p.id).startsWith('temp_')) {
              const { data, error } = await sb.from('event_partners').insert(payload).select('id').single();
              if (error) throw error;
              p.id = data.id;
              delete p.isNew;
            } else {
              const { error } = await sb.from('event_partners').update(payload).eq('id', p.id);
              if (error) throw error;
            }
          }

          // 2. Save event certificate details
          const ecPayload = {
            event_id: selectedEventId,
            event_date: currentEc.event_date || null,
            host_chapter: currentEc.host_chapter.trim().slice(0, 120),
            cert_tag: currentEc.cert_tag.trim(),
            cert_title: currentEc.cert_title.trim().slice(0, 80),
            track: currentEc.track.trim(),
            skills: currentEc.skills.slice(0, 12),
            dossier_tag: currentEc.dossier_tag.trim(),
            curriculum_status: currentEc.curriculum_status.trim(),
            curriculum_text: currentEc.curriculum_text.trim().slice(0, 2000),
            curriculum_bullets: !!currentEc.curriculum_bullets,
            signatories: (currentEc.signatories || []).slice(0, 2),
            layout: currentEc.layout || {},
            claims_enabled: !!currentEc.claims_enabled,
          };

          const { error: ecErr } = await sb.from('event_certificates').upsert(ecPayload);
          if (ecErr) throw ecErr;

          adminMessage('Certificate details and layout saved successfully.', true);
          refreshPublishTab();
        } catch (err) {
          adminMessage(authErrorText(err));
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = '💾 Save Certificate Settings';
        }
      });

      // Zoom buttons
      $('#btn-zoom-fit', root).onclick = fitStudioCanvas;
      $('#btn-zoom-50', root).onclick = () => setStudioZoom(0.5);
      $('#btn-zoom-75', root).onclick = () => setStudioZoom(0.75);
      $('#btn-zoom-100', root).onclick = () => setStudioZoom(1);
      $('#btn-zoom-125', root).onclick = () => setStudioZoom(1.25);

      setTimeout(fitStudioCanvas, 80);
    }

    /* Helper: Sync Form to Memory Model */
    function syncFormToEc() {
      if (!currentEc) return;
      if (!currentEc.layout) currentEc.layout = {};

      currentEc.event_title_override = $('#inp-event-title')?.value.trim() || '';
      currentEc.host_chapter = $('#inp-host-chapter')?.value.trim() || 'GDG on Campus SR University';
      currentEc.event_date = $('#inp-event-date')?.value || null;
      currentEc.cert_tag = $('#inp-cert-tag')?.value.trim() || 'OFFICIAL CREDENTIAL';
      currentEc.cert_title = $('#inp-cert-title')?.value.trim() || 'Certificate of Participation';

      currentEc.curriculum_status = $('#inp-curriculum-status')?.value.trim() || 'STATUS: Topic / Curriculum Overview';
      currentEc.curriculum_text = $('#inp-curriculum-text')?.value.trim() || '';
      currentEc.curriculum_bullets = $('#chk-curriculum-bullets')?.checked || false;

      currentEc.dossier_tag = $('#inp-dossier-tag')?.value.trim() || '';
      currentEc.track = $('#inp-track')?.value.trim() || '';
      const rawSkills = $('#inp-skills')?.value || '';
      currentEc.skills = rawSkills.split(',').map((s) => s.trim()).filter(Boolean);

      currentEc.layout.credential_base = $('#inp-credential-base')?.value.trim() || '';
      currentEc.layout.dev_tag = $('#inp-dev-tag')?.value.trim() || '';
      currentEc.layout.node_pill = $('#inp-node-pill')?.value.trim() || '';
      currentEc.layout.partner_sticker = $('#inp-partner-pill')?.value.trim() || '';
      if (currentEc.event_title_override) {
        currentEc.layout.event_title_override = currentEc.event_title_override;
      } else {
        delete currentEc.layout.event_title_override;
      }
    }

    /* Helper: Update Layout Editor Inputs */
    function updateLayoutInputs() {
      const target = $('#sel-layout-target')?.value || 'gdg';
      const eventBox = (currentEc.layout && currentEc.layout[target]) || {};
      const globalBox = (globalDefaultLayout && globalDefaultLayout[target]) || {};
      const box = { ...globalBox, ...eventBox };
      if ($('#inp-pos-x')) $('#inp-pos-x').value = box.x ?? '';
      if ($('#inp-pos-y')) $('#inp-pos-y').value = box.y ?? '';
      if ($('#inp-pos-s')) $('#inp-pos-s').value = box.scale ?? '';
      if ($('#inp-pos-w')) $('#inp-pos-w').value = box.w ?? '';
    }

    function applyLayoutInputsToEc() {
      const target = $('#sel-layout-target')?.value || 'gdg';
      if (!currentEc.layout) currentEc.layout = {};
      const x = $('#inp-pos-x').value !== '' ? Number($('#inp-pos-x').value) : null;
      const y = $('#inp-pos-y').value !== '' ? Number($('#inp-pos-y').value) : null;
      const s = $('#inp-pos-s').value !== '' ? Number($('#inp-pos-s').value) : null;
      const w = $('#inp-pos-w').value !== '' ? Number($('#inp-pos-w').value) : null;

      if (x === null && y === null && s === null && w === null) {
        delete currentEc.layout[target];
      } else {
        currentEc.layout[target] = {
          ...(x !== null ? { x } : {}),
          ...(y !== null ? { y } : {}),
          ...(s !== null ? { scale: s } : {}),
          ...(w !== null ? { w } : {}),
        };
      }
    }

    /* Helper: Partners list */
    function renderPartnersList() {
      const wrap = $('#partners-list-wrap');
      if (!wrap) return;
      $('#btn-add-partner').disabled = currentPartners.length >= 8;
      wrap.innerHTML = currentPartners.length ? currentPartners.map((p, idx) => `
        <div class="checklist-item" style="gap:8px" data-partner-idx="${idx}">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <select class="p-role" style="font-size:11.5px;padding:4px">
              <option value="cohost" ${p.role === 'cohost' ? 'selected' : ''}>Co-host</option>
              <option value="sponsor" ${p.role === 'sponsor' ? 'selected' : ''}>Sponsor</option>
            </select>
            <input type="text" class="p-name" value="${esc(p.name)}" placeholder="Partner Name" style="font-size:12px;padding:4px 8px;flex:1">
            <label class="btn o sm" style="cursor:pointer;padding:3px 8px;font-size:11px">
              ${p.logo_path ? 'Change Logo' : 'Upload Logo'}
              <input type="file" class="p-file" accept=".png,.jpg,.jpeg,.svg" style="display:none">
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <button type="button" class="btn o sm p-up" ${idx === 0 ? 'disabled' : ''} style="padding:2px 6px">▲</button>
            <button type="button" class="btn o sm p-dn" ${idx === currentPartners.length - 1 ? 'disabled' : ''} style="padding:2px 6px">▼</button>
            <button type="button" class="btn o sm p-del" style="padding:2px 6px;color:var(--r)">✕</button>
          </div>
        </div>
      `).join('') : `<p style="font-size:12px;color:var(--ink-3);margin:4px 0">No co-hosts or sponsors added yet.</p>`;

      // Wire partner controls
      $$('#partners-list-wrap [data-partner-idx]').forEach((el) => {
        const idx = Number(el.dataset.partnerIdx);
        const p = currentPartners[idx];
        $('.p-role', el).onchange = (e) => { p.role = e.target.value; updateStudioPreview(); };
        $('.p-name', el).oninput = (e) => { p.name = e.target.value; updateStudioPreview(); };
        $('.p-up', el).onclick = () => {
          if (idx > 0) {
            const temp = currentPartners[idx - 1]; currentPartners[idx - 1] = p; currentPartners[idx] = temp;
            renderPartnersList(); updateStudioPreview();
          }
        };
        $('.p-dn', el).onclick = () => {
          if (idx < currentPartners.length - 1) {
            const temp = currentPartners[idx + 1]; currentPartners[idx + 1] = p; currentPartners[idx] = temp;
            renderPartnersList(); updateStudioPreview();
          }
        };
        $('.p-del', el).onclick = async () => {
          if (!confirm(`Delete partner "${p.name}"?`)) return;
          if (!String(p.id).startsWith('temp_')) {
            await sb.from('event_partners').delete().eq('id', p.id);
          }
          currentPartners.splice(idx, 1);
          renderPartnersList(); updateStudioPreview();
        };
        $('.p-file', el).onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const blob = await processImageUpload(file, 600);
            const path = `partners/${selectedEventId}/${crypto.randomUUID()}.png`;
            await uploadToStorage(sb, path, blob);
            p.logo_path = path;
            p.dataUrl = URL.createObjectURL(blob);
            adminMessage('Partner logo uploaded successfully.', true);
            renderPartnersList();
            updateStudioPreview();
          } catch (err) {
            adminMessage(authErrorText(err));
          }
        };
      });
    }

    /* Helper: Signatories list */
    function renderSignatoriesList() {
      const wrap = $('#sigs-list-wrap');
      if (!wrap) return;
      const sigs = currentEc.signatories || [];
      $('#btn-add-sig').disabled = sigs.length >= 2;
      wrap.innerHTML = sigs.length ? sigs.map((s, idx) => `
        <div class="checklist-item" style="gap:8px" data-sig-idx="${idx}">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <input type="text" class="s-name" value="${esc(s.name)}" placeholder="Signatory Name" style="font-size:12px;padding:4px 8px;flex:1">
            <input type="text" class="s-role" value="${esc(s.role)}" placeholder="Role / Title" style="font-size:12px;padding:4px 8px;flex:1">
            <label class="btn o sm" style="cursor:pointer;padding:3px 8px;font-size:11px">
              ${s.image_path ? 'Change Signature' : 'Upload Image'}
              <input type="file" class="s-file" accept=".png,.jpg,.jpeg,.svg" style="display:none">
            </label>
          </div>
          <button type="button" class="btn o sm s-del" style="padding:2px 6px;color:var(--r)">✕</button>
        </div>
      `).join('') : `<p style="font-size:12px;color:var(--ink-3);margin:4px 0">No signatories configured yet.</p>`;

      $$('#sigs-list-wrap [data-sig-idx]').forEach((el) => {
        const idx = Number(el.dataset.sigIdx);
        const s = sigs[idx];
        $('.s-name', el).oninput = (e) => { s.name = e.target.value; updateStudioPreview(); };
        $('.s-role', el).oninput = (e) => { s.role = e.target.value; updateStudioPreview(); };
        $('.s-del', el).onclick = () => {
          sigs.splice(idx, 1);
          renderSignatoriesList(); updateStudioPreview();
        };
        $('.s-file', el).onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const blob = await processImageUpload(file, 600);
            const path = `signatures/${selectedEventId}/${idx + 1}.png`;
            await uploadToStorage(sb, path, blob);
            s.image_path = path;
            s.dataUrl = URL.createObjectURL(blob);
            adminMessage('Signature image uploaded.', true);
            renderSignatoriesList();
            updateStudioPreview();
          } catch (err) {
            adminMessage(authErrorText(err));
          }
        };
      });
    }

    /* Helper: Build Preview Document & Mount */
    async function updateStudioPreview() {
      const wrap = $('#studio-canvas-wrap');
      if (!wrap || !studioTemplateHtml) return;

      const layout = { ...globalDefaultLayout, ...(currentEc.layout || {}) };
      const pos = (key) => {
        const b = layout[key];
        if (!b || (b.x == null && b.y == null && b.scale == null && b.w == null)) return '';
        const x = b.x ?? 0, y = b.y ?? 0, s = b.scale ?? 1, w = b.w;
        return `position:absolute;left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}transform:scale(${s});transform-origin:0 0`;
      };

      // Inline partner images
      const cohosts = [], sponsors = [];
      for (const p of currentPartners) {
        let logo = p.dataUrl || '';
        if (!logo && p.logo_path) logo = await getStorageDataUrl(sb, p.logo_path);
        const item = { name: p.name, logo, style: pos(`partner_${p.id}`) };
        (p.role === 'cohost' ? cohosts : sponsors).push(item);
      }

      // Inline signatories
      const signatories = [];
      for (const [idx, s] of (currentEc.signatories || []).entries()) {
        let img = s.dataUrl || '';
        if (!img && s.image_path) img = await getStorageDataUrl(sb, s.image_path);
        signatories.push({
          name: s.name,
          role: s.role,
          img,
          style: pos(`sig_${idx + 1}`),
        });
      }

      const previewName = $('#inp-preview-name')?.value.trim() || 'Asha Rao';
      const lines = String(currentEc.curriculum_text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);

      const eventTitle = currentEc.event_title_override || currentEc.layout?.event_title_override || currentEventObj.title;
      const credId = currentEc.layout?.credential_base || 'GDGSRU-SAMPLE01';
      const devTag = currentEc.layout?.dev_tag || 'DEV_COMMUNITY';
      const nodePill = currentEc.layout?.node_pill || 'ACTIVE_NODE // 01';
      const partnerSticker = currentEc.layout?.partner_sticker || '';

      const fields = {
        event_name: eventTitle,
        chapter: currentEc.host_chapter,
        host_chapter: currentEc.host_chapter,
        cert_tag: currentEc.cert_tag,
        cert_title: currentEc.cert_title,
        track: currentEc.track,
        skills: (currentEc.skills || []).join(', '),
        dossier_tag: currentEc.dossier_tag,
        curriculum_status: currentEc.curriculum_status,
        curriculum_text: currentEc.curriculum_text,
        curriculum_bullets: currentEc.curriculum_bullets ? lines.map((text) => ({ text })) : [],
        date: currentEc.event_date ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(currentEc.event_date + 'T00:00:00')) : '',
        date_short: currentEc.event_date ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(currentEc.event_date + 'T00:00:00')) : '',
        dev_tag: devTag,
        node_pill: nodePill,
        partner_sticker: partnerSticker,
        cohosts,
        sponsors,
        signatories,
        pos_gdg: pos('gdg'),
        pos_cert_tag: pos('cert_tag'),
        pos_title: pos('title'),
        pos_name: pos('name'),
        pos_event: pos('event'),
        pos_host: pos('host'),
        pos_curriculum: pos('curriculum'),
        pos_dossier: pos('dossier'),
        pos_credential: pos('credential'),
      };

      const payload = {
        template_html: studioTemplateHtml,
        recipient_name: previewName,
        credential_id: credId,
        event_title: eventTitle,
        event_start: currentEc.event_date ? `${currentEc.event_date}T00:00:00+05:30` : new Date().toISOString(),
        fields,
      };

      const built = window.GDGCert.buildDocument(payload);
      wrap.innerHTML = '';
      const frame = await window.GDGCert.mount(wrap, built.html);
      enableDirectCanvasDragging(frame);
    }

    /* Helper: Dragging elements on canvas */
    function enableDirectCanvasDragging(frame) {
      const doc = frame.contentDocument;
      if (!doc) return;

      const elementMap = [
        { key: 'gdg', sel: '.main-logo-area' },
        { key: 'cert_tag', sel: '.title-deck' },
        { key: 'title', sel: '.cert-title' },
        { key: 'name', sel: '.cert-name-wrapper' },
        { key: 'event', sel: '.cert-event-text' },
        { key: 'curriculum', sel: '.event-syllabus-card' },
        { key: 'dossier', sel: '.dossier-card-wrap' },
        { key: 'credential', sel: '.terminal-log-card' },
      ];

      elementMap.forEach(({ key, sel }) => {
        const el = doc.querySelector(sel);
        if (!el) return;
        el.classList.add('live-drag-target');
        el.dataset.dragKey = key;

        let startX, startY, origX, origY, isDragging = false;
        el.addEventListener('mousedown', (e) => {
          e.preventDefault();
          $('#sel-layout-target').value = key;
          updateLayoutInputs();
          highlightActiveDragTarget();

          isDragging = true;
          startX = e.clientX;
          startY = e.clientY;
          const rect = el.getBoundingClientRect();
          const frameRect = doc.body.getBoundingClientRect();
          origX = rect.left - frameRect.left;
          origY = rect.top - frameRect.top;

          const onMove = (mv) => {
            if (!isDragging) return;
            const dx = mv.clientX - startX;
            const dy = mv.clientY - startY;
            const nx = Math.max(0, Math.min(1123, Math.round(origX + dx)));
            const ny = Math.max(0, Math.min(794, Math.round(origY + dy)));
            if (!currentEc.layout) currentEc.layout = {};
            currentEc.layout[key] = { ...(currentEc.layout[key] || {}), x: nx, y: ny };
            el.style.position = 'absolute';
            el.style.left = nx + 'px';
            el.style.top = ny + 'px';
            if ($('#inp-pos-x')) $('#inp-pos-x').value = nx;
            if ($('#inp-pos-y')) $('#inp-pos-y').value = ny;
          };

          const onUp = () => {
            isDragging = false;
            doc.removeEventListener('mousemove', onMove);
            doc.removeEventListener('mouseup', onUp);
          };
          doc.addEventListener('mousemove', onMove);
          doc.addEventListener('mouseup', onUp);
        });
      });
      highlightActiveDragTarget();
    }

    function highlightActiveDragTarget() {
      const frame = $('#studio-canvas-wrap iframe');
      if (!frame || !frame.contentDocument) return;
      const target = $('#sel-layout-target')?.value;
      const all = frame.contentDocument.querySelectorAll('.live-drag-target');
      all.forEach((el) => el.classList.toggle('selected', el.dataset.dragKey === target));
    }

    function fitStudioCanvas() {
      const stage = $('#studio-stage');
      const scaler = $('#studio-scaler');
      if (!stage || !scaler) return;
      const availableW = stage.clientWidth - 40;
      const scale = Math.min(1, Math.max(0.3, availableW / 1123));
      scaler.style.transform = `scale(${scale})`;
      scaler.style.width = '1123px';
      scaler.style.height = `${Math.round(794 * scale)}px`;
    }

    function setStudioZoom(scale) {
      const scaler = $('#studio-scaler');
      if (!scaler) return;
      scaler.style.transform = `scale(${scale})`;
      scaler.style.width = '1123px';
      scaler.style.height = `${Math.round(794 * scale)}px`;
    }

    /* ==================================================================
       TAB 3: PUBLISH IMPLEMENTATION
       ================================================================== */
    async function refreshPublishTab() {
      const root = panes.publish;
      root.innerHTML = `<div class="mc-loading" role="status"><span>Validating publish readiness…</span></div>`;

      // 1. Fetch attendee count
      const { count } = await sb.from('attendance_records')
        .select('id', { count: 'exact', head: true })
        .eq('event_id', selectedEventId);
      const attCount = count || 0;

      // 2. Fetch event certificate details
      const { data: ec } = await sb.from('event_certificates')
        .select('*')
        .eq('event_id', selectedEventId)
        .maybeSingle();

      const hasRoster = attCount > 0;
      const hasDate = !!ec?.event_date;
      const hasCurriculum = (ec?.curriculum_text || '').trim().length > 0;
      const hasHost = (ec?.host_chapter || '').trim().length > 0;
      const previewRenders = !!studioTemplateHtml;

      const allReady = hasRoster && hasDate && hasCurriculum && hasHost && previewRenders;

      root.innerHTML = `
        <div style="max-width:760px;display:flex;flex-direction:column;gap:18px">
          <div class="mc-card">
            <h3 style="margin:0 0 4px;font-size:16px">Publish Readiness Checklist</h3>
            <p style="margin:0 0 14px;font-size:13px;color:var(--ink-2)">All 5 requirements must be satisfied before public certificate claiming can be enabled on the website.</p>

            <div style="display:flex;flex-direction:column;gap:10px">
              <div class="checklist-item ${hasRoster ? 'pass' : 'fail'}">
                <div>
                  <b>1. Attendance Roster Uploaded</b>
                  <div style="font-size:12px;color:var(--ink-2)">${hasRoster ? `✓ ${attCount} confirmed attendees on record.` : '✕ Attendance roster has not been uploaded yet.'}</div>
                </div>
                <span class="tag ${hasRoster ? 't3' : 't2'}">${hasRoster ? 'READY' : 'ACTION REQUIRED'}</span>
              </div>

              <div class="checklist-item ${hasDate ? 'pass' : 'fail'}">
                <div>
                  <b>2. Event Date Set</b>
                  <div style="font-size:12px;color:var(--ink-2)">${hasDate ? `✓ Event date confirmed: ${ec.event_date}.` : '✕ Event date must be specified.'}</div>
                </div>
                <span class="tag ${hasDate ? 't3' : 't2'}">${hasDate ? 'READY' : 'ACTION REQUIRED'}</span>
              </div>

              <div class="checklist-item ${hasCurriculum ? 'pass' : 'fail'}">
                <div>
                  <b>3. Curriculum Overview Filled</b>
                  <div style="font-size:12px;color:var(--ink-2)">${hasCurriculum ? `✓ Curriculum text provided (${ec.curriculum_text.length} characters).` : '✕ Curriculum overview cannot be blank.'}</div>
                </div>
                <span class="tag ${hasCurriculum ? 't3' : 't2'}">${hasCurriculum ? 'READY' : 'ACTION REQUIRED'}</span>
              </div>

              <div class="checklist-item ${hasHost ? 'pass' : 'fail'}">
                <div>
                  <b>4. Host Chapter Set</b>
                  <div style="font-size:12px;color:var(--ink-2)">${hasHost ? `✓ Chapter confirmed: ${esc(ec.host_chapter)}.` : '✕ Chapter name cannot be blank.'}</div>
                </div>
                <span class="tag ${hasHost ? 't3' : 't2'}">${hasHost ? 'READY' : 'ACTION REQUIRED'}</span>
              </div>

              <div class="checklist-item ${previewRenders ? 'pass' : 'fail'}">
                <div>
                  <b>5. Certificate Template & Preview</b>
                  <div style="font-size:12px;color:var(--ink-2)">${previewRenders ? '✓ Master template loaded and rendered.' : '✕ Master template error.'}</div>
                </div>
                <span class="tag ${previewRenders ? 't3' : 't2'}">${previewRenders ? 'READY' : 'ACTION REQUIRED'}</span>
              </div>
            </div>
          </div>

          <!-- Public Claims Toggle Card -->
          <div class="mc-card" style="border-top:4px solid ${allReady ? 'var(--g)' : 'var(--r)'}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
              <div>
                <h4 style="margin:0 0 4px;font-size:15px">Enable Public Claims</h4>
                <p style="margin:0;font-size:13px;color:var(--ink-2)">When enabled, attendees can generate their verified certificate on <code>/certificates/</code>.</p>
              </div>
              <label class="check" style="font-size:14px;font-weight:700">
                <input type="checkbox" id="pub-claims-toggle" ${ec?.claims_enabled ? 'checked' : ''} ${allReady ? '' : 'disabled'}> Enable Claims
              </label>
            </div>
            ${!allReady ? `<p style="margin:6px 0 0;font-size:12px;color:var(--r);font-weight:600">Claims cannot be enabled until all 5 checklist items above are passed.</p>` : ''}
            
            <div style="margin-top:10px;padding-top:12px;border-top:1px solid var(--line);display:flex;gap:12px;align-items:center;font-size:12.5px">
              <a class="btn o sm" href="/certificates/" target="_blank">View /certificates/ →</a>
              <a class="btn o sm" href="/verify/" target="_blank">View /verify/ →</a>
            </div>
          </div>
        </div>
      `;

      $('#pub-claims-toggle')?.addEventListener('change', async (e) => {
        const enabled = e.target.checked;
        try {
          const { error } = await sb.from('event_certificates')
            .update({ claims_enabled: enabled })
            .eq('event_id', selectedEventId);
          if (error) throw error;
          if (currentEc) currentEc.claims_enabled = enabled;
          adminMessage(enabled ? 'Public certificate claims are now OPEN for this event.' : 'Public certificate claims have been closed.', true);
        } catch (err) {
          e.target.checked = !enabled;
          adminMessage(authErrorText(err));
        }
      });
    }

    // Initialize the default selected tab
    if (activeTabName === 'attendance') {
      await renderAttendanceTab();
    } else if (activeTabName === 'publish') {
      await refreshPublishTab();
    } else {
      await renderCertificateTab();
    }
  }

  /* ------------------------------------------------------------------ Module Exports */
  async function renderCertificates(ctx) {
    return renderWorkbench(ctx, 'certificate');
  }

  async function renderAttendance(ctx) {
    return renderWorkbench(ctx, 'attendance');
  }

  window.GDGCertAdmin = {
    renderCertificates,
    renderAttendance,
    parseNames,
    importNames,
  };
})();