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

  function blobToDataUrl(blob) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || '');
      reader.onerror = () => resolve('');
      reader.readAsDataURL(blob);
    });
  }

  async function uploadToStorage(sb, path, blob) {
    let { error } = await sb.storage.from('certificate-logos').upload(path, blob, {
      contentType: blob.type || 'image/png',
      upsert: true,
    });
    if (error && (error.message?.toLowerCase().includes('not found') || error.statusCode === '404' || error.status === 404)) {
      try {
        const { error: createErr } = await sb.storage.createBucket('certificate-logos', { public: false });
        if (!createErr) {
          const retry = await sb.storage.from('certificate-logos').upload(path, blob, {
            contentType: blob.type || 'image/png',
            upsert: true,
          });
          error = retry.error;
        }
      } catch (_) {}
    }
    if (error) {
      if (error.message?.toLowerCase().includes('bucket not found')) {
        throw new Error('Storage bucket "certificate-logos" does not exist in Supabase. Please create the "certificate-logos" bucket under Supabase Storage.');
      }
      throw error;
    }
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
    let isDirty = false;
    let currentViewMode = localStorage.getItem('gdg_cert_view_mode') || 'split';

    // Fetch initial badge data
    const [attCountRes, ecStatusRes] = await Promise.all([
      sb.from('attendance_records').select('id', { count: 'exact', head: true }).eq('event_id', selectedEventId),
      sb.from('event_certificates').select('claims_enabled').eq('event_id', selectedEventId).maybeSingle(),
    ]);
    let rosterCount = attCountRes.count || 0;
    let claimsActive = !!ecStatusRes.data?.claims_enabled;

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

        /* Stepper & Badges */
        .mc-tab-num {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: rgba(0,0,0,0.07);
          font-size: 11px;
          font-weight: 800;
          line-height: 1;
        }
        .mc-wb-tab-btn.active .mc-tab-num {
          background: var(--primary, #1a73e8);
          color: #fff;
        }
        .mc-tab-badge {
          background: rgba(0,0,0,0.06);
          color: var(--ink-2);
          font-size: 11px;
          padding: 1px 6px;
          border-radius: 10px;
          font-weight: 700;
        }
        .mc-tab-pill {
          font-size: 10px;
          font-weight: 800;
          padding: 2px 6px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .mc-tab-pill.live {
          background: #DCFCE7;
          color: #15803D;
        }
        .mc-tab-pill.draft {
          background: #F1F5F9;
          color: #64748B;
        }

        /* Designer Sub-Toolbar */
        .mc-designer-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-m);
          padding: 8px 14px;
          margin-bottom: 16px;
        }
        .mc-quick-nav {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-wrap: wrap;
        }
        .mc-qn-label, .mc-vm-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--ink-2);
          text-transform: uppercase;
          letter-spacing: 0.4px;
        }
        .mc-qn-btn {
          font-size: 11.5px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--r-m);
          background: var(--sunk, #f1f3f4);
          color: var(--ink-2);
          text-decoration: none;
          transition: all 0.15s ease;
          border: 1px solid transparent;
          cursor: pointer;
        }
        .mc-qn-btn:hover {
          background: var(--surface);
          border-color: var(--line);
          color: var(--primary, #1a73e8);
        }
        .mc-view-mode-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mc-view-modes {
          display: flex;
          gap: 4px;
          background: var(--sunk, #f1f3f4);
          padding: 3px;
          border-radius: var(--r-m);
          border: 1px solid var(--line);
        }
        .mc-vm-btn {
          border: none;
          background: none;
          padding: 4px 12px;
          border-radius: calc(var(--r-m) - 2px);
          font-size: 12px;
          font-weight: 700;
          color: var(--ink-2);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .mc-vm-btn:hover { color: var(--ink); }
        .mc-vm-btn.active {
          background: var(--surface);
          color: var(--primary, #1a73e8);
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        /* Certificate Grid Layout Variants */
        .mc-cert-grid {
          display: grid;
          grid-template-columns: minmax(380px, 460px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        .mc-cert-grid.view-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .mc-cert-grid.view-form .mc-controls-col { width: 100%; }
        .mc-cert-grid.view-form .mc-preview-card { position: static; width: 100%; }

        .mc-cert-grid.view-canvas {
          display: flex;
          flex-direction: column-reverse;
          gap: 20px;
        }
        .mc-cert-grid.view-canvas .mc-preview-card { position: static; width: 100%; }
        .mc-cert-grid.view-canvas .mc-preview-stage { min-height: 700px; max-height: 85vh; }
        .mc-cert-grid.view-canvas .mc-controls-col { width: 100%; }

        @media (max-width: 1180px) {
          .mc-cert-grid:not(.view-canvas) { grid-template-columns: 1fr; }
          .mc-preview-card { position: static; }
        }

        /* Floating Sticky Save Bar */
        .mc-save-bar {
          position: sticky;
          bottom: 16px;
          z-index: 50;
          background: var(--surface);
          border: 1.5px solid var(--line);
          border-radius: var(--r-l);
          padding: 10px 18px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          box-shadow: 0 4px 18px rgba(0,0,0,0.12);
          margin-top: 10px;
        }
        .mc-save-status {
          font-size: 12.5px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .mc-save-status.dirty { color: #b45309; }
        .mc-save-status.clean { color: #15803d; }

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
        <!-- Header: Event Selector + 1-2-3 Stepper Tabs -->
        <div class="mc-wb-header">
          <div class="mc-wb-header-left">
            <div style="display:flex;align-items:center;gap:8px">
              <label style="font-weight:700;font-size:13px;display:flex;align-items:center;gap:6px">
                <span>Event:</span>
                <select id="wb-event-select" style="font-size:13px;padding:6px 12px;border-radius:var(--r-m);border:1px solid var(--line);min-width:240px">
                  ${events.map((e) => `<option value="${esc(e.id)}" ${e.id === selectedEventId ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}
                </select>
              </label>
              <span id="wb-event-status-pill" class="tag ${claimsActive ? 't3' : 't2'}" style="font-size:11px;padding:3px 8px">${claimsActive ? '● Claims Active' : '○ Draft'}</span>
            </div>
            
            <div class="mc-wb-tabs">
              <button type="button" class="mc-wb-tab-btn ${activeTabName === 'attendance' ? 'active' : ''}" data-tab="attendance">
                <span class="mc-tab-num">1</span>
                <span>Event Roster</span>
                <span class="mc-tab-badge" id="wb-tab-roster-badge">(${rosterCount})</span>
              </button>
              <button type="button" class="mc-wb-tab-btn ${activeTabName === 'certificate' ? 'active' : ''}" data-tab="certificate">
                <span class="mc-tab-num">2</span>
                <span>Certificate Designer</span>
              </button>
              <button type="button" class="mc-wb-tab-btn ${activeTabName === 'publish' ? 'active' : ''}" data-tab="publish">
                <span class="mc-tab-num">3</span>
                <span>Publish & Claims</span>
                <span class="mc-tab-pill ${claimsActive ? 'live' : 'draft'}" id="wb-tab-pub-pill">${claimsActive ? 'Live' : 'Draft'}</span>
              </button>
            </div>
          </div>
          <div class="mc-wb-header-right">
            <button type="button" class="btn sm" id="wb-test-claim-btn-top" style="font-size:12px;display:inline-flex;align-items:center;gap:6px">🎯 Test Claim Preview</button>
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

      <!-- Test Claim Preview Modal -->
      <dialog id="wb-test-claim-modal" style="border:none;border-radius:var(--r-l);box-shadow:var(--sh-l);padding:24px;width:95%;max-width:980px;background:var(--surface);color:var(--ink)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;border-bottom:1px solid var(--line);padding-bottom:12px">
          <div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:20px">🎯</span>
              <h3 style="margin:0;font-size:17px;font-weight:800">Live Test Claim Preview</h3>
              <span class="tag t3" style="font-size:11px">SAMPLE AUDIT READY</span>
            </div>
            <p style="font-size:12.5px;color:var(--ink-2);margin:3px 0 0">Simulate attendee claim verification, test real export fidelity, and inspect download packages without leaving Mission Control.</p>
          </div>
          <button type="button" class="btn o sm" id="wb-test-claim-close">✕ Close</button>
        </div>

        <!-- Test Claim Controls Bar -->
        <div style="background:var(--sunk,#f8f9fa);border:1px solid var(--line);border-radius:var(--r-m);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:14px">
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <label style="font-size:12px;font-weight:700">
              Recipient:
              <select id="tc-attendee-select" style="font-size:12px;padding:5px 8px;margin-left:4px;border:1px solid var(--line);border-radius:var(--r-m);background:var(--surface)">
                <option value="">Loading attendees…</option>
              </select>
            </label>
            <input type="text" id="tc-custom-name" placeholder="Or test custom name" style="font-size:12px;padding:5px 8px;border:1px solid var(--line);border-radius:var(--r-m);width:150px;background:var(--surface)">
            <button type="button" class="btn o sm" id="tc-btn-apply-name">Update</button>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <button type="button" class="btn sm" id="tc-btn-download-png">📥 Download PNG</button>
            <button type="button" class="btn sm" id="tc-btn-download-pdf">📥 Download PDF</button>
            <button type="button" class="btn o sm" id="tc-btn-copy-link">🔗 Copy Verify URL</button>
          </div>
        </div>

        <!-- Test Preview Stage -->
        <div id="tc-stage" style="background:#eef2f6;padding:16px;border-radius:var(--r-m);border:1px solid var(--line);overflow:auto;display:flex;justify-content:center;align-items:flex-start;min-height:380px;max-height:55vh">
          <div id="tc-scaler" style="transform-origin:top center;transition:transform 0.1s ease-out">
            <div id="tc-canvas-wrap"></div>
          </div>
        </div>
        <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px;color:var(--ink-2);flex-wrap:wrap;gap:8px">
          <span>✓ Dynamic QR codes, SHA-256 fingerprint simulation, and responsive styling active.</span>
          <span id="tc-cred-id-display" style="font-family:monospace;font-weight:700"></span>
        </div>
      </dialog>

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
    async function switchTab(name) {
      tabBtns.forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
      Object.keys(panes).forEach((k) => panes[k].classList.toggle('active', k === name));
      if (name === 'attendance') await renderAttendanceTab();
      if (name === 'certificate') {
        if (!panes.certificate.hasChildNodes()) await renderCertificateTab();
        setTimeout(fitStudioCanvas, 60);
      }
      if (name === 'publish') refreshPublishTab();
    }
    tabBtns.forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

    // Event Switcher logic with dirty protection
    $('#wb-event-select').addEventListener('change', (e) => {
      if (isDirty && !confirm('You have unsaved changes in the Certificate Designer. Discard them and switch event?')) {
        e.target.value = selectedEventId;
        return;
      }
      ctx.keepEvent = e.target.value;
      const currentActive = document.querySelector('.mc-wb-tab-btn.active')?.dataset.tab || 'certificate';
      renderWorkbench(ctx, currentActive);
    });

    // Test Claim Modal logic
    const testClaimModal = $('#wb-test-claim-modal');
    $('#wb-test-claim-close')?.addEventListener('click', () => testClaimModal.close());
    $('#wb-test-claim-btn-top')?.addEventListener('click', () => openTestClaimModal());

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
      rosterCount = rows.length;
      if ($('#wb-tab-roster-badge')) $('#wb-tab-roster-badge').textContent = `(${rosterCount})`;
      const currentEv = events.find((e) => e.id === selectedEventId) || currentEventObj;
      const purgeDate = rows[0]?.purge_at ? new Date(rows[0].purge_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '1 year after event';
      const eventDateStr = currentEv?.start_at ? new Date(currentEv.start_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Date not set';

      root.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:18px">
          <!-- Multi-Event Context Header Banner -->
          <div style="background:var(--card,#fff);border:2px solid var(--line);border-radius:var(--r-m);padding:16px 20px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;box-shadow:var(--sh-s,0 2px 8px rgba(0,0,0,0.04))">
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:28px">📋</span>
              <div>
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px">
                  <span class="tag t1" style="font-size:10.5px;font-weight:700;letter-spacing:0.5px">EVENT ROSTER</span>
                  <span style="font-size:12px;color:var(--ink-2)">📅 ${esc(eventDateStr)}</span>
                </div>
                <h2 style="margin:0;font-size:18px;font-weight:900;color:var(--ink-0)">${esc(currentEv?.title || 'Selected Event')}</h2>
              </div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span class="tag ${rows.length ? 't3' : 't2'}" style="font-size:12px;font-weight:700;padding:5px 12px">${rows.length} Confirmed Attendees</span>
              ${rows.length ? `<button type="button" class="btn o sm" id="att-btn-export" style="font-size:12px">📥 Export CSV</button>` : ''}
              <button type="button" class="btn sm" id="att-btn-open-import">➕ Add / Import Attendees</button>
            </div>
          </div>

          <!-- Import / Add Attendees Card -->
          <div id="att-import-box" style="display:none;" class="mc-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
              <h3 style="margin:0;font-size:15px">Add or Import Attendees</h3>
              <button type="button" class="btn o sm" id="att-btn-cancel-import">✕ Close</button>
            </div>

            <!-- Single Attendee Quick Add -->
            <div style="background:var(--sunk,#f8f9fa);padding:12px 14px;border-radius:var(--r-m);border:1px solid var(--line);margin-bottom:16px">
              <b style="font-size:12px;display:block;margin-bottom:8px">Quick Add Single Attendee:</b>
              <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)) auto;gap:8px;align-items:flex-end">
                <div class="mc-f-group" style="margin:0">
                  <label style="font-size:11px">Full Name *</label>
                  <input type="text" id="att-quick-name" placeholder="e.g. Asha Rao" style="font-size:12px;padding:6px 10px">
                </div>
                <div class="mc-f-group" style="margin:0">
                  <label style="font-size:11px">Roll Number (optional)</label>
                  <input type="text" id="att-quick-roll" placeholder="e.g. 26BCE1001" style="font-size:12px;padding:6px 10px">
                </div>
                <div class="mc-f-group" style="margin:0">
                  <label style="font-size:11px">Email (optional)</label>
                  <input type="email" id="att-quick-email" placeholder="e.g. asha@example.com" style="font-size:12px;padding:6px 10px">
                </div>
                <button type="button" class="btn sm" id="att-btn-quick-add" style="height:32px;font-size:12px;font-weight:700">+ Add</button>
              </div>
            </div>

            <!-- Bulk CSV / Text Import -->
            <h4 style="margin:0 0 6px;font-size:13px">Bulk CSV Import:</h4>
            <p style="font-size:12px;color:var(--ink-2);margin:0 0 10px">Upload a CSV file containing <code>name</code>, optional <code>roll_no</code>, <code>email</code>, or paste comma-separated lines below.</p>
            
            <div class="mc-f-row" style="margin-bottom:10px">
              <label class="btn o sm" style="cursor:pointer;display:inline-flex;align-items:center;gap:6px">
                📁 Choose CSV File
                <input type="file" id="att-file-input" accept=".csv,.txt" style="display:none">
              </label>
              <label class="check" style="font-size:12px;display:flex;align-items:center;gap:6px">
                <input type="checkbox" id="att-chk-replace"> Replace entire existing roster
              </label>
            </div>

            <textarea id="att-paste-area" rows="4" placeholder="Name, Roll No, Email&#10;Asha Rao, 26BCE1001, asha@example.com&#10;Rahul Verma, 26BCE1002, rahul@example.com" style="font-family:monospace;font-size:12px;width:100%;margin-bottom:10px;box-sizing:border-box"></textarea>
            
            <div style="display:flex;justify-content:flex-end;gap:8px">
              <button type="button" class="btn sm" id="att-btn-run-import">Start Bulk Import</button>
            </div>
            <div id="att-import-feedback" style="margin-top:8px;font-size:12px"></div>
          </div>

          <!-- Attendee Table Card -->
          <div class="mc-card">
            <!-- Top Search and Filter Bar -->
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <input type="text" id="att-search" placeholder="Search attendees by name, roll, or email…" style="font-size:13px;padding:7px 12px;border-radius:var(--r-m);border:1px solid var(--line);min-width:300px">
                <span id="att-filter-count" style="font-size:12px;color:var(--ink-2);font-weight:600">Showing ${rows.length} of ${rows.length}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                ${rows.length ? `<button type="button" class="btn o sm" id="att-btn-clear" style="color:var(--r);font-size:11px">Delete Entire Roster</button>` : ''}
              </div>
            </div>

            <!-- Bulk Multi-Select Action Bar (Shows when 1+ checkboxes are checked) -->
            <div id="att-bulk-bar" style="display:none;background:#FEF2F2;border:1.5px solid #F87171;border-radius:var(--r-m);padding:10px 16px;margin-bottom:14px;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:16px">☑️</span>
                <span style="font-weight:800;color:#991B1B;font-size:13px" id="att-selected-count">0 attendees selected</span>
              </div>
              <div style="display:flex;gap:8px">
                <button type="button" class="btn o sm" id="att-btn-deselect-all" style="font-size:12px;background:#fff">Deselect All</button>
                <button type="button" class="btn sm" id="att-btn-bulk-delete" style="background:#DC2626;color:#fff;border-color:#DC2626;font-size:12px;font-weight:700">🗑️ Delete Selected (<span id="att-del-count">0</span>)</button>
              </div>
            </div>

            <!-- Table -->
            <div style="overflow-x:auto;max-height:520px;border:1px solid var(--line);border-radius:var(--r-m)">
              <table style="width:100%;border-collapse:collapse;font-size:13px;text-align:left">
                <thead>
                  <tr style="border-bottom:1.5px solid var(--line);background:var(--sunk,#f8f9fa)">
                    <th style="width:40px;padding:10px 12px;text-align:center">
                      <input type="checkbox" id="att-chk-all" style="cursor:pointer" title="Select all visible attendees">
                    </th>
                    <th style="padding:10px 12px">Attendee Name</th>
                    <th style="padding:10px 12px">Roll Number</th>
                    <th style="padding:10px 12px">Email</th>
                    <th style="padding:10px 12px">Status</th>
                    <th style="padding:10px 12px;text-align:right">Action</th>
                  </tr>
                </thead>
                <tbody id="att-table-body">
                  ${rows.length ? rows.map((r) => `
                    <tr style="border-bottom:1px solid var(--line)" data-att-row="${esc(r.id)}">
                      <td style="padding:10px 12px;text-align:center">
                        <input type="checkbox" class="att-chk" data-id="${esc(r.id)}" style="cursor:pointer">
                      </td>
                      <td style="padding:10px 12px;font-weight:700">${esc(r.attendee_name)}</td>
                      <td style="padding:10px 12px;font-family:monospace">${esc(r.roll_no || '—')}</td>
                      <td style="padding:10px 12px;color:var(--ink-2)">${esc(r.attendee_email || '—')}</td>
                      <td style="padding:10px 12px"><span class="tag ${r.attendance_status === 'attended' ? 't3' : 't2'}" style="font-size:11px">${esc(r.attendance_status)}</span></td>
                      <td style="padding:10px 12px;text-align:right">
                        <button type="button" class="btn o sm" data-del-att="${esc(r.id)}" style="padding:2px 8px;font-size:11px;color:var(--r)" title="Delete single attendee">✕</button>
                      </td>
                    </tr>
                  `).join('') : `
                    <tr>
                      <td colspan="6" style="padding:0">
                        <div style="padding:36px 20px;text-align:center;color:var(--ink-2);background:var(--sunk,#f8f9fa)">
                          <div style="font-size:32px;margin-bottom:8px">👥</div>
                          <b style="font-size:14px;color:var(--ink-0);display:block;margin-bottom:4px">No attendees on record for this event yet.</b>
                          <p style="font-size:12.5px;max-width:440px;margin:0 auto 16px">You can upload a CSV file with your attendee list, add attendees one-by-one, or load 3 demo records to test the certificate workflow right away.</p>
                          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
                            <button type="button" class="btn sm" id="att-btn-add-demo">✨ Load 3 Demo Attendees</button>
                            <button type="button" class="btn o sm" id="att-btn-csv-template">📥 Download Sample CSV Template</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  `}
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

      // Quick Add Single Attendee
      $('#att-btn-quick-add').onclick = async () => {
        const nameInp = $('#att-quick-name');
        const rollInp = $('#att-quick-roll');
        const emailInp = $('#att-quick-email');
        const name = (nameInp?.value || '').trim();
        const roll = (rollInp?.value || '').trim();
        const email = (emailInp?.value || '').trim();

        if (!name || name.length < 3) {
          return adminMessage('Please enter a valid attendee name (min 3 characters).');
        }

        const singleRow = [{
          attendee_name: name,
          roll_no: roll || null,
          attendee_email: email || null,
          attendance_status: 'attended',
        }];

        try {
          await importNames(selectedEventId, singleRow, false);
          adminMessage(`Added "${name}" to attendance roster.`, true);
          nameInp.value = '';
          if (rollInp) rollInp.value = '';
          if (emailInp) emailInp.value = '';
          nameInp.focus();
          await renderAttendanceTab();
          refreshPublishTab();
        } catch (err) {
          adminMessage(authErrorText(err));
        }
      };

      // Demo roster button
      const demoBtn = $('#att-btn-add-demo', root);
      if (demoBtn) {
        demoBtn.onclick = async () => {
          demoBtn.disabled = true;
          demoBtn.textContent = 'Adding demo roster…';
          try {
            const demoRows = [
              { attendee_name: 'Asha Rao', roll_no: '26BCE1001', attendee_email: 'asha@example.com', attendance_status: 'attended' },
              { attendee_name: 'Rahul Verma', roll_no: '26BCE1002', attendee_email: 'rahul@example.com', attendance_status: 'attended' },
              { attendee_name: 'Priya Sharma', roll_no: '26BCE1003', attendee_email: 'priya@example.com', attendance_status: 'attended' },
            ];
            await importNames(selectedEventId, demoRows, false);
            adminMessage('Added 3 demo attendees to the roster!', true);
            await renderAttendanceTab();
            refreshPublishTab();
          } catch (err) {
            adminMessage(authErrorText(err));
          }
        };
      }

      // Sample CSV Template download
      const tplBtn = $('#att-btn-csv-template', root);
      if (tplBtn) {
        tplBtn.onclick = () => {
          const csvContent = 'Name,Roll Number,Email\nAsha Rao,26BCE1001,asha@example.com\nRahul Verma,26BCE1002,rahul@example.com\nPriya Sharma,26BCE1003,priya@example.com\n';
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'sample_attendance_roster.csv';
          a.click();
          URL.revokeObjectURL(url);
          adminMessage('Downloaded sample CSV template.', true);
        };
      }

      // Run bulk import
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

      // Export CSV
      const exportBtn = $('#att-btn-export');
      if (exportBtn) {
        exportBtn.onclick = () => {
          if (!rows.length) return;
          const headers = ['Attendee Name', 'Roll Number', 'Email', 'Status'];
          const lines = [headers.join(',')];
          rows.forEach((r) => {
            const escCsv = (s) => `"${String(s || '').replace(/"/g, '""')}"`;
            lines.push([
              escCsv(r.attendee_name),
              escCsv(r.roll_no),
              escCsv(r.attendee_email),
              escCsv(r.attendance_status),
            ].join(','));
          });
          const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          const safeTitle = (currentEv?.title || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '_');
          a.download = `${safeTitle}_attendance_roster.csv`;
          a.click();
          URL.revokeObjectURL(url);
          adminMessage('Attendance roster CSV downloaded.', true);
        };
      }

      // Checkbox Selection Logic
      const selectAllChk = $('#att-chk-all');
      const bulkBar = $('#att-bulk-bar');
      const selectedCountEl = $('#att-selected-count');
      const delCountEl = $('#att-del-count');

      function updateBulkBar() {
        const checkedBoxes = Array.from($$('.att-chk:checked', root));
        const count = checkedBoxes.length;
        if (count > 0) {
          bulkBar.style.display = 'flex';
          selectedCountEl.textContent = `${count} attendee${count > 1 ? 's' : ''} selected`;
          delCountEl.textContent = String(count);
        } else {
          bulkBar.style.display = 'none';
        }
        // Update header checkbox indeterminate/checked state
        const visibleBoxes = Array.from($$('.att-chk', root)).filter((cb) => cb.closest('tr').style.display !== 'none');
        if (visibleBoxes.length > 0) {
          const visibleChecked = visibleBoxes.filter((cb) => cb.checked).length;
          selectAllChk.checked = visibleChecked === visibleBoxes.length;
          selectAllChk.indeterminate = visibleChecked > 0 && visibleChecked < visibleBoxes.length;
        } else {
          selectAllChk.checked = false;
          selectAllChk.indeterminate = false;
        }
      }

      // Select All Toggle
      selectAllChk.onchange = () => {
        const visibleBoxes = Array.from($$('.att-chk', root)).filter((cb) => cb.closest('tr').style.display !== 'none');
        visibleBoxes.forEach((cb) => { cb.checked = selectAllChk.checked; });
        updateBulkBar();
      };

      // Individual row checkboxes
      $$('.att-chk', root).forEach((cb) => {
        cb.onchange = updateBulkBar;
      });

      // Deselect All button
      $('#att-btn-deselect-all').onclick = () => {
        $$('.att-chk', root).forEach((cb) => { cb.checked = false; });
        updateBulkBar();
      };

      // Batch Delete Selected
      $('#att-btn-bulk-delete').onclick = async () => {
        const checked = Array.from($$('.att-chk:checked', root)).map((cb) => cb.dataset.id);
        if (!checked.length) return;
        if (!confirm(`Are you sure you want to permanently delete ${checked.length} selected attendee(s)?`)) return;

        const delBtn = $('#att-btn-bulk-delete');
        delBtn.disabled = true;
        delBtn.textContent = 'Deleting…';

        try {
          const { error: delErr } = await sb.from('attendance_records').delete().in('id', checked);
          if (delErr) throw delErr;
          adminMessage(`Successfully deleted ${checked.length} attendee(s).`, true);
          await renderAttendanceTab();
          refreshPublishTab();
        } catch (err) {
          adminMessage(authErrorText(err));
        }
      };

      // Single Delete Attendee
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

      // Clear entire roster
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
        updateBulkBar();
      };
    }

    /* ==================================================================
       TAB 2: CERTIFICATE DETAILS & LAYOUT EDITOR IMPLEMENTATION
       ================================================================== */
    let currentEc = null;
    let currentPartners = [];
    let currentEventObj = events.find((e) => e.id === selectedEventId) || events[0];
    let studioTemplateHtml = '';

    function markDirty() {
      isDirty = true;
      const ind = $('#mc-save-indicator');
      if (ind) {
        ind.className = 'mc-save-status dirty';
        ind.innerHTML = `<span class="mc-save-icon">⚠️</span> <span class="mc-save-text">Unsaved changes</span>`;
      }
    }

    function markClean() {
      isDirty = false;
      const ind = $('#mc-save-indicator');
      if (ind) {
        ind.className = 'mc-save-status clean';
        ind.innerHTML = `<span class="mc-save-icon">✓</span> <span class="mc-save-text">All changes saved</span>`;
      }
    }

    function setViewMode(mode) {
      currentViewMode = mode;
      localStorage.setItem('gdg_cert_view_mode', mode);
      const grid = $('#mc-cert-grid');
      if (grid) {
        grid.className = `mc-cert-grid view-${mode}`;
      }
      $$('.mc-vm-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === mode));
      setTimeout(fitStudioCanvas, 80);
    }

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
        <!-- Designer Sub-Toolbar: Quick Nav + View Mode Switcher -->
        <div class="mc-designer-toolbar">
          <div class="mc-quick-nav">
            <span class="mc-qn-label">Jump to:</span>
            <button type="button" class="mc-qn-btn" data-jump="#card-identity">1. Identity</button>
            <button type="button" class="mc-qn-btn" data-jump="#card-curriculum">2. Curriculum</button>
            <button type="button" class="mc-qn-btn" data-jump="#card-dossier">3. Dossier</button>
            <button type="button" class="mc-qn-btn" data-jump="#card-badges">4. Badges</button>
            <button type="button" class="mc-qn-btn" data-jump="#card-logos">5. Logos & Sigs</button>
            <button type="button" class="mc-qn-btn" data-jump="#card-positioning">6. Coordinates</button>
          </div>
          <div class="mc-view-mode-group">
            <span class="mc-vm-label">View:</span>
            <div class="mc-view-modes">
              <button type="button" class="mc-vm-btn ${currentViewMode === 'split' ? 'active' : ''}" data-view="split" title="Side-by-side view">◫ Split View</button>
              <button type="button" class="mc-vm-btn ${currentViewMode === 'form' ? 'active' : ''}" data-view="form" title="Full-width editing forms for laptops">▤ Form Focus</button>
              <button type="button" class="mc-vm-btn ${currentViewMode === 'canvas' ? 'active' : ''}" data-view="canvas" title="Full-width enlarged preview">🖼️ Canvas Focus</button>
            </div>
          </div>
        </div>

        <div class="mc-cert-grid view-${currentViewMode}" id="mc-cert-grid">
          <!-- Left: Control Panels -->
          <div class="mc-controls-col" style="display:flex;flex-direction:column;gap:16px">
            <!-- 1. Event & Certificate Identity -->
            <div class="mc-card" id="card-identity">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <h3 style="margin:0 0 2px;font-size:15px">1. Event & Certificate Identity</h3>
                  <p style="margin:0;font-size:12px;color:var(--ink-2)">Core titles, dates, and chapter identification.</p>
                </div>
                <button type="button" class="btn o sm" id="btn-fill-defaults" style="font-size:11.5px">✨ Fill GDG Defaults</button>
              </div>
              
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
            <div class="mc-card" id="card-curriculum">
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
            <div class="mc-card" id="card-dossier">
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
            <div class="mc-card" id="card-badges">
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
            <div class="mc-card" id="card-logos">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <h3 style="margin:0;font-size:15px">GDG Logo, Partner Logos & Details</h3>
                  <p style="margin:2px 0 0;font-size:12px;color:var(--ink-2)">Sponsors, co-hosts, and authorized signatures.</p>
                </div>
                <div style="display:flex;gap:6px">
                  <button type="button" class="btn o sm" id="btn-add-partner" ${currentPartners.length >= 8 ? 'disabled' : ''}>+ Add Partner</button>
                  <button type="button" class="btn o sm" id="btn-add-sig" ${(currentEc.signatories || []).length >= 2 ? 'disabled' : ''}>+ Add Signatory</button>
                </div>
              </div>

              <!-- GDG Chapter Logo Uploader -->
              <div style="background:var(--sunk,#f8f9fa);padding:12px 14px;border-radius:var(--r-m);border:1px solid var(--line);margin-top:12px">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
                  <div>
                    <b style="font-size:12.5px;display:block">GDG Chapter Logo:</b>
                    <span id="gdg-logo-status" style="font-size:11.5px;color:var(--ink-2)">${currentEc.layout?.gdg_logo_path ? 'Custom Logo Uploaded' : 'Using Default Vector Logo (&lt; &gt;)'}</span>
                  </div>
                  <div style="display:flex;gap:8px;align-items:center">
                    <label class="btn o sm" style="cursor:pointer;font-size:11.5px;display:inline-flex;align-items:center;gap:6px">
                      📷 Upload GDG Logo
                      <input type="file" id="inp-gdg-logo-file" accept=".png,.jpg,.jpeg,.svg,.webp" style="display:none">
                    </label>
                    <button type="button" class="btn o sm" id="btn-reset-gdg-logo" style="font-size:11.5px;color:var(--r);${currentEc.layout?.gdg_logo_path ? '' : 'display:none;'}">✕ Reset to Default</button>
                  </div>
                </div>
                <div id="gdg-logo-preview-thumb" style="margin-top:8px;${currentEc.layout?.gdg_logo_path ? '' : 'display:none;'}">
                  <img id="gdg-logo-img" src="" alt="GDG Logo" style="max-height:48px;max-width:240px;object-fit:contain;background:#fff;padding:4px 8px;border-radius:6px;border:1px solid var(--line)">
                </div>
              </div>

              <div id="partners-list-wrap" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"></div>
              <div id="sigs-list-wrap" style="display:flex;flex-direction:column;gap:8px;margin-top:10px"></div>
            </div>

            <!-- 6. Manual X/Y Positioning & Scale -->
            <div class="mc-card" id="card-positioning">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                <div>
                  <h3 style="margin:0;font-size:15px">6. Manual X/Y Positioning & Scale</h3>
                  <p style="margin:2px 0 0;font-size:12px;color:var(--ink-2)">Select an element below to fine-tune coordinates, use directional nudge buttons, or drag on the preview canvas.</p>
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

              <!-- Micro-Adjustment Nudge Pad -->
              <div style="background:var(--sunk,#f8f9fa);border:1px solid var(--line);border-radius:var(--r-m);padding:12px 14px;margin-top:4px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:11.5px;font-weight:700;color:var(--ink-2);text-transform:uppercase;letter-spacing:0.3px">Direct Nudge Controls</span>
                  <span style="font-size:11px;color:var(--ink-3)">Shortcut: Arrow keys / Shift+Arrows</span>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
                  <span style="font-size:11px;font-weight:700;color:var(--ink-2);min-width:32px">Move:</span>
                  <button type="button" class="btn o sm btn-nudge" data-axis="x" data-delta="-10" title="Move Left 10px" style="padding:3px 8px;font-size:11.5px">◀◀ 10</button>
                  <button type="button" class="btn o sm btn-nudge" data-axis="x" data-delta="-1" title="Move Left 1px" style="padding:3px 8px;font-size:11.5px">◀ 1</button>
                  <button type="button" class="btn o sm btn-nudge" data-axis="x" data-delta="1" title="Move Right 1px" style="padding:3px 8px;font-size:11.5px">1 ▶</button>
                  <button type="button" class="btn o sm btn-nudge" data-axis="x" data-delta="10" title="Move Right 10px" style="padding:3px 8px;font-size:11.5px">10 ▶▶</button>
                  <div style="width:1px;height:18px;background:var(--line);margin:0 2px"></div>
                  <button type="button" class="btn o sm btn-nudge" data-axis="y" data-delta="-10" title="Move Up 10px" style="padding:3px 8px;font-size:11.5px">▲▲ 10</button>
                  <button type="button" class="btn o sm btn-nudge" data-axis="y" data-delta="-1" title="Move Up 1px" style="padding:3px 8px;font-size:11.5px">▲ 1</button>
                  <button type="button" class="btn o sm btn-nudge" data-axis="y" data-delta="1" title="Move Down 1px" style="padding:3px 8px;font-size:11.5px">▼ 1</button>
                  <button type="button" class="btn o sm btn-nudge" data-axis="y" data-delta="10" title="Move Down 10px" style="padding:3px 8px;font-size:11.5px">▼▼ 10</button>
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px">
                  <span style="font-size:11px;font-weight:700;color:var(--ink-2);min-width:32px">Scale:</span>
                  <button type="button" class="btn o sm btn-scale-step" data-delta="-0.05" style="padding:3px 8px;font-size:11.5px">- 5%</button>
                  <button type="button" class="btn o sm btn-scale-step" data-delta="0.05" style="padding:3px 8px;font-size:11.5px">+ 5%</button>
                  <button type="button" class="btn o sm btn-scale-step" data-delta="-0.10" style="padding:3px 8px;font-size:11.5px">- 10%</button>
                  <button type="button" class="btn o sm btn-scale-step" data-delta="0.10" style="padding:3px 8px;font-size:11.5px">+ 10%</button>
                  <button type="button" class="btn o sm btn-scale-step" data-val="1.0" style="padding:3px 8px;font-size:11.5px">100%</button>
                </div>
              </div>

              <!-- Numeric Coordinate Inputs -->
              <div class="mc-f-row" style="margin-top:10px">
                <div class="mc-f-group">
                  <label>X Position (px)</label>
                  <input type="number" id="inp-pos-x" min="0" max="1123" placeholder="e.g. 48">
                </div>
                <div class="mc-f-group">
                  <label>Y Position (px)</label>
                  <input type="number" id="inp-pos-y" min="0" max="794" placeholder="e.g. 180">
                </div>
                <div class="mc-f-group">
                  <label>Scale (0.2 - 2.5)</label>
                  <input type="number" step="0.05" id="inp-pos-s" min="0.2" max="2.5" placeholder="1.0">
                </div>
                <div class="mc-f-group">
                  <label>Width (px, opt)</label>
                  <input type="number" id="inp-pos-w" min="120" max="1000" placeholder="Auto">
                </div>
              </div>
            </div>

            <!-- Sticky Floating Save Bar -->
            <div class="mc-save-bar">
              <div class="mc-save-status clean" id="mc-save-indicator">
                <span class="mc-save-icon">✓</span>
                <span class="mc-save-text">All changes saved</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button type="button" class="btn o sm" id="btn-test-claim-designer">🎯 Test Claim Preview</button>
                <button type="button" class="btn sm" id="btn-save-ec" style="font-weight:700;padding:8px 16px">💾 Save Certificate Settings</button>
              </div>
            </div>
          </div>

          <!-- Right: Live Interactive Canvas Preview -->
          <div class="mc-preview-card">
            <div class="mc-preview-bar">
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:700">Live Preview</span>
                <input type="text" id="inp-preview-name" value="Asha Rao" placeholder="Preview Name" style="font-size:11px;padding:3px 8px;border:1px solid var(--line);border-radius:4px;width:120px">
              </div>
              <div style="display:flex;gap:4px;align-items:center">
                <button type="button" class="btn o sm" id="btn-test-claim-designer-top" style="padding:2px 8px;font-size:11px;font-weight:700;color:var(--primary,#1a73e8);border-color:var(--primary,#1a73e8)">🎯 Test Claim</button>
                <div style="width:1px;height:16px;background:var(--line);margin:0 4px"></div>
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

      // Wire Quick Nav jump buttons
      $$('.mc-qn-btn', root).forEach((btn) => {
        btn.onclick = () => {
          const target = $(btn.dataset.jump, root);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
      });

      // Wire View Mode buttons
      $$('.mc-vm-btn', root).forEach((btn) => {
        btn.onclick = () => setViewMode(btn.dataset.view);
      });

      // Wire Preset Defaults Button
      $('#btn-fill-defaults', root)?.addEventListener('click', () => {
        if (!confirm('Populate empty fields with recommended GDG on Campus SR University defaults?')) return;
        if (!$('#inp-host-chapter').value) $('#inp-host-chapter').value = 'GDG on Campus SR University';
        if (!$('#inp-cert-tag').value) $('#inp-cert-tag').value = 'OFFICIAL CREDENTIAL';
        if (!$('#inp-cert-title').value) $('#inp-cert-title').value = 'Certificate of Participation';
        if (!$('#inp-curriculum-status').value) $('#inp-curriculum-status').value = 'STATUS: Topic / Curriculum Overview';
        if (!$('#inp-curriculum-text').value) {
          $('#inp-curriculum-text').value = 'Active participation in hands-on developer workshops, exploring Google developer technologies, system architecture design, collaborative git workflows, and cloud-native solutions.';
        }
        if (!$('#inp-dossier-tag').value) $('#inp-dossier-tag').value = 'SRU_TECH_ACADEMY';
        if (!$('#inp-track').value) $('#inp-track').value = 'Web & Cloud Technologies';
        if (!$('#inp-skills').value) $('#inp-skills').value = 'Modern Web, JavaScript, Cloud Architecture, Git, Open Source';
        if (!$('#inp-dev-tag').value) $('#inp-dev-tag').value = 'DEV_COMMUNITY';
        if (!$('#inp-node-pill').value) $('#inp-node-pill').value = 'ACTIVE_NODE // 01';
        if (!$('#inp-credential-base').value) {
          const slug = (currentEventObj?.title || 'WORKSHOP').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
          $('#inp-credential-base').value = `GDGSRU-2026-${slug}`;
        }
        syncFormToEc();
        markDirty();
        updateStudioPreview();
        adminMessage('Standard GDG defaults applied.', true);
      });

      // Wire GDG Logo uploader
      initGdgLogoUploader();
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
          markDirty();
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
          markDirty();
          updateStudioPreview();
        });
      });

      // Wire Nudge Buttons
      function nudgeTargetElement(axis, delta) {
        const target = $('#sel-layout-target')?.value || 'gdg';
        if (!currentEc.layout) currentEc.layout = {};
        const globalBox = (globalDefaultLayout && globalDefaultLayout[target]) || {};
        const curBox = currentEc.layout[target] || {};
        const effective = { ...globalBox, ...curBox };

        let currentVal = effective[axis];
        if (currentVal == null) currentVal = axis === 'x' ? 40 : 40;
        const maxLimit = axis === 'x' ? 1123 : 794;
        const newVal = Math.max(0, Math.min(maxLimit, Math.round(Number(currentVal) + delta)));

        currentEc.layout[target] = {
          ...effective,
          [axis]: newVal,
        };

        if (axis === 'x' && $('#inp-pos-x')) $('#inp-pos-x').value = newVal;
        if (axis === 'y' && $('#inp-pos-y')) $('#inp-pos-y').value = newVal;

        markDirty();
        updateStudioPreview();
      }

      function scaleTargetElement(delta, absoluteVal) {
        const target = $('#sel-layout-target')?.value || 'gdg';
        if (!currentEc.layout) currentEc.layout = {};
        const globalBox = (globalDefaultLayout && globalDefaultLayout[target]) || {};
        const curBox = currentEc.layout[target] || {};
        const effective = { ...globalBox, ...curBox };

        let newScale;
        if (absoluteVal != null) {
          newScale = Number(absoluteVal);
        } else {
          const curScale = effective.scale != null ? Number(effective.scale) : 1;
          newScale = Math.max(0.2, Math.min(2.5, Math.round((curScale + delta) * 100) / 100));
        }

        currentEc.layout[target] = {
          ...effective,
          scale: newScale,
        };

        if ($('#inp-pos-s')) $('#inp-pos-s').value = newScale;

        markDirty();
        updateStudioPreview();
      }

      $$('.btn-nudge', root).forEach((btn) => {
        btn.onclick = () => {
          const axis = btn.dataset.axis;
          const delta = Number(btn.dataset.delta);
          nudgeTargetElement(axis, delta);
        };
      });

      $$('.btn-scale-step', root).forEach((btn) => {
        btn.onclick = () => {
          if (btn.dataset.val) {
            scaleTargetElement(0, Number(btn.dataset.val));
          } else {
            scaleTargetElement(Number(btn.dataset.delta), null);
          }
        };
      });

      // Keyboard nudge shortcuts
      const onDocKeyDown = (e) => {
        if (!panes.certificate.classList.contains('active')) return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') && !['inp-pos-x', 'inp-pos-y', 'inp-pos-s'].includes(document.activeElement.id)) {
          return;
        }
        if (testClaimModal && testClaimModal.open) return;

        const step = e.shiftKey ? 10 : 1;
        if (e.key === 'ArrowUp') { e.preventDefault(); nudgeTargetElement('y', -step); }
        else if (e.key === 'ArrowDown') { e.preventDefault(); nudgeTargetElement('y', step); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); nudgeTargetElement('x', -step); }
        else if (e.key === 'ArrowRight') { e.preventDefault(); nudgeTargetElement('x', step); }
      };
      document.removeEventListener('keydown', onDocKeyDown);
      document.addEventListener('keydown', onDocKeyDown);

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
      async function handleSaveEc() {
        syncFormToEc();
        const saveBtns = $$('#btn-save-ec', root);
        saveBtns.forEach((b) => { b.disabled = true; b.textContent = 'Saving…'; });
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

          markClean();
          adminMessage('Certificate details and layout saved successfully.', true);
          refreshPublishTab();
        } catch (err) {
          adminMessage(authErrorText(err));
        } finally {
          saveBtns.forEach((b) => { b.disabled = false; b.textContent = '💾 Save Certificate Settings'; });
        }
      }

      $$('#btn-save-ec', root).forEach((b) => { b.onclick = handleSaveEc; });

      // Test Claim buttons in Designer
      $('#btn-test-claim-designer', root)?.addEventListener('click', () => openTestClaimModal());
      $('#btn-test-claim-designer-top', root)?.addEventListener('click', () => openTestClaimModal());

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

    /* Helper: GDG Chapter Logo */
    function initGdgLogoUploader() {
      const gdgLogoInp = $('#inp-gdg-logo-file');
      const gdgLogoReset = $('#btn-reset-gdg-logo');
      const gdgLogoStatus = $('#gdg-logo-status');
      const gdgLogoThumb = $('#gdg-logo-preview-thumb');
      const gdgLogoImg = $('#gdg-logo-img');

      const currentLogoPath = currentEc.layout?.gdg_logo_path;
      if (currentLogoPath) {
        if (currentEc.gdg_logo_dataUrl) {
          if (gdgLogoImg) gdgLogoImg.src = currentEc.gdg_logo_dataUrl;
          if (gdgLogoThumb) gdgLogoThumb.style.display = 'block';
        } else {
          getStorageDataUrl(sb, currentLogoPath).then((url) => {
            if (url) {
              currentEc.gdg_logo_dataUrl = url;
              if (gdgLogoImg) gdgLogoImg.src = url;
              if (gdgLogoThumb) gdgLogoThumb.style.display = 'block';
              updateStudioPreview();
            }
          });
        }
      }

      if (gdgLogoInp) {
        gdgLogoInp.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          try {
            const blob = await processImageUpload(file, 800);
            const path = `logos/${selectedEventId}/gdg_logo_${Date.now()}.png`;
            const dataUrl = await blobToDataUrl(blob);
            if (!currentEc.layout) currentEc.layout = {};
            currentEc.layout.gdg_logo_path = path;
            currentEc.gdg_logo_dataUrl = dataUrl;

            if (gdgLogoStatus) gdgLogoStatus.textContent = 'Custom Logo Uploaded';
            if (gdgLogoThumb) gdgLogoThumb.style.display = 'block';
            if (gdgLogoImg) gdgLogoImg.src = dataUrl;
            if (gdgLogoReset) gdgLogoReset.style.display = 'inline-flex';

            await uploadToStorage(sb, path, blob);
            adminMessage('GDG Chapter Logo uploaded successfully.', true);
            await updateStudioPreview();
          } catch (err) {
            adminMessage(authErrorText(err));
          }
        };
      }

      if (gdgLogoReset) {
        gdgLogoReset.onclick = async () => {
          if (!confirm('Reset to standard GDG vector logo?')) return;
          if (!currentEc.layout) currentEc.layout = {};
          currentEc.layout.gdg_logo_path = null;
          currentEc.gdg_logo_dataUrl = null;
          if (gdgLogoStatus) gdgLogoStatus.textContent = 'Using Default Vector Logo (< >)';
          if (gdgLogoThumb) gdgLogoThumb.style.display = 'none';
          if (gdgLogoReset) gdgLogoReset.style.display = 'none';
          adminMessage('GDG Logo reset to default vector.', true);
          await updateStudioPreview();
        };
      }
    }

    /* Helper: Partners list */
    function renderPartnersList() {
      const wrap = $('#partners-list-wrap');
      if (!wrap) return;
      $('#btn-add-partner').disabled = currentPartners.length >= 8;
      wrap.innerHTML = currentPartners.length ? currentPartners.map((p, idx) => {
        const thumb = p.dataUrl || '';
        return `
        <div class="checklist-item" style="gap:8px" data-partner-idx="${idx}">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <div class="partner-thumb-box" style="width:34px;height:34px;border-radius:4px;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
              ${thumb ? `<img src="${esc(thumb)}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain">` : `<span style="font-size:13px;color:var(--ink-3)">🏢</span>`}
            </div>
            <select class="p-role" style="font-size:11.5px;padding:4px">
              <option value="cohost" ${p.role === 'cohost' ? 'selected' : ''}>Co-host</option>
              <option value="sponsor" ${p.role === 'sponsor' ? 'selected' : ''}>Sponsor</option>
            </select>
            <input type="text" class="p-name" value="${esc(p.name)}" placeholder="Partner Name" style="font-size:12px;padding:4px 8px;flex:1">
            <label class="btn o sm" style="cursor:pointer;padding:3px 8px;font-size:11px">
              ${(p.logo_path || p.dataUrl) ? 'Change Logo (✓)' : 'Upload Logo'}
              <input type="file" class="p-file" accept=".png,.jpg,.jpeg,.svg,.webp" style="display:none">
            </label>
          </div>
          <div style="display:flex;align-items:center;gap:4px">
            <button type="button" class="btn o sm p-up" ${idx === 0 ? 'disabled' : ''} style="padding:2px 6px">▲</button>
            <button type="button" class="btn o sm p-dn" ${idx === currentPartners.length - 1 ? 'disabled' : ''} style="padding:2px 6px">▼</button>
            <button type="button" class="btn o sm p-del" style="padding:2px 6px;color:var(--r)">✕</button>
          </div>
        </div>
      `;
      }).join('') : `<p style="font-size:12px;color:var(--ink-3);margin:4px 0">No co-hosts or sponsors added yet.</p>`;

      // Load remote thumbnail URLs if not already in memory
      currentPartners.forEach(async (p, idx) => {
        if (!p.dataUrl && p.logo_path) {
          const url = await getStorageDataUrl(sb, p.logo_path);
          if (url) {
            p.dataUrl = url;
            const el = wrap.querySelector(`[data-partner-idx="${idx}"] .partner-thumb-box`);
            if (el) el.innerHTML = `<img src="${esc(url)}" alt="Logo" style="max-width:100%;max-height:100%;object-fit:contain">`;
          }
        }
      });

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
            const dataUrl = await blobToDataUrl(blob);
            p.dataUrl = dataUrl;
            p.logo_path = path;
            await uploadToStorage(sb, path, blob);
            adminMessage('Partner logo uploaded successfully.', true);
            renderPartnersList();
            await updateStudioPreview();
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
      wrap.innerHTML = sigs.length ? sigs.map((s, idx) => {
        const thumb = s.dataUrl || '';
        return `
        <div class="checklist-item" style="gap:8px" data-sig-idx="${idx}">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <div class="sig-thumb-box" style="width:48px;height:32px;border-radius:4px;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0">
              ${thumb ? `<img src="${esc(thumb)}" alt="Sig" style="max-width:100%;max-height:100%;object-fit:contain">` : `<span style="font-size:12px;color:var(--ink-3)">✍️</span>`}
            </div>
            <input type="text" class="s-name" value="${esc(s.name)}" placeholder="Signatory Name" style="font-size:12px;padding:4px 8px;flex:1">
            <input type="text" class="s-role" value="${esc(s.role)}" placeholder="Role / Title" style="font-size:12px;padding:4px 8px;flex:1">
            <label class="btn o sm" style="cursor:pointer;padding:3px 8px;font-size:11px">
              ${(s.image_path || s.dataUrl) ? 'Change Signature (✓)' : 'Upload Image'}
              <input type="file" class="s-file" accept=".png,.jpg,.jpeg,.svg,.webp" style="display:none">
            </label>
          </div>
          <button type="button" class="btn o sm s-del" style="padding:2px 6px;color:var(--r)">✕</button>
        </div>
      `;
      }).join('') : `<p style="font-size:12px;color:var(--ink-3);margin:4px 0">No signatories configured yet.</p>`;

      // Load remote thumbnail URLs if not already in memory
      sigs.forEach(async (s, idx) => {
        if (!s.dataUrl && s.image_path) {
          const url = await getStorageDataUrl(sb, s.image_path);
          if (url) {
            s.dataUrl = url;
            const el = wrap.querySelector(`[data-sig-idx="${idx}"] .sig-thumb-box`);
            if (el) el.innerHTML = `<img src="${esc(url)}" alt="Sig" style="max-width:100%;max-height:100%;object-fit:contain">`;
          }
        }
      });

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
            const dataUrl = await blobToDataUrl(blob);
            s.dataUrl = dataUrl;
            s.image_path = path;
            await uploadToStorage(sb, path, blob);
            adminMessage('Signature image uploaded.', true);
            renderSignatoriesList();
            await updateStudioPreview();
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

      // Inline GDG Chapter Logo if uploaded
      let gdgCustomLogo = currentEc.gdg_logo_dataUrl || '';
      if (!gdgCustomLogo && currentEc.layout?.gdg_logo_path) {
        gdgCustomLogo = await getStorageDataUrl(sb, currentEc.layout.gdg_logo_path);
        currentEc.gdg_logo_dataUrl = gdgCustomLogo;
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
        gdg_custom_logo: gdgCustomLogo,
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
       TEST CLAIM SIMULATION MODAL
       ================================================================== */
    async function openTestClaimModal() {
      if (!testClaimModal) return;
      testClaimModal.showModal();

      const { data: attendees } = await sb.from('attendance_records')
        .select('attendee_name, roll_no')
        .eq('event_id', selectedEventId)
        .order('attendee_name');

      const select = $('#tc-attendee-select');
      const customInp = $('#tc-custom-name');
      const list = attendees || [];
      if (select) {
        select.innerHTML = `
          <option value="">-- Choose from Roster (${list.length}) --</option>
          ${list.map((a) => `<option value="${esc(a.attendee_name)}">${esc(a.attendee_name)}${a.roll_no ? ` (${esc(a.roll_no)})` : ''}</option>`).join('')}
        `;
        if (list.length > 0) {
          select.value = list[0].attendee_name;
        }
      }

      let activeRecipient = (select && select.value) || $('#inp-preview-name')?.value.trim() || 'Asha Rao';
      if (customInp) customInp.value = activeRecipient;

      async function renderTestPreview(name) {
        activeRecipient = name || 'Asha Rao';
        const wrap = $('#tc-canvas-wrap');
        if (!wrap || !studioTemplateHtml) return;

        const layout = { ...globalDefaultLayout, ...(currentEc?.layout || {}) };
        const pos = (key) => {
          const b = layout[key];
          if (!b || (b.x == null && b.y == null && b.scale == null && b.w == null)) return '';
          const x = b.x ?? 0, y = b.y ?? 0, s = b.scale ?? 1, w = b.w;
          return `position:absolute;left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}transform:scale(${s});transform-origin:0 0`;
        };

        const cohosts = [], sponsors = [];
        for (const p of currentPartners) {
          let logo = p.dataUrl || '';
          if (!logo && p.logo_path) logo = await getStorageDataUrl(sb, p.logo_path);
          const item = { name: p.name, logo, style: pos(`partner_${p.id}`) };
          (p.role === 'cohost' ? cohosts : sponsors).push(item);
        }

        const signatories = [];
        for (const [idx, s] of (currentEc?.signatories || []).entries()) {
          let img = s.dataUrl || '';
          if (!img && s.image_path) img = await getStorageDataUrl(sb, s.image_path);
          signatories.push({
            name: s.name,
            role: s.role,
            img,
            style: pos(`sig_${idx + 1}`),
          });
        }

        let gdgCustomLogo = currentEc?.gdg_logo_dataUrl || '';
        if (!gdgCustomLogo && currentEc?.layout?.gdg_logo_path) {
          gdgCustomLogo = await getStorageDataUrl(sb, currentEc.layout.gdg_logo_path);
          currentEc.gdg_logo_dataUrl = gdgCustomLogo;
        }

        const lines = String(currentEc?.curriculum_text || '').split(/\n+/).map((s) => s.trim()).filter(Boolean);
        const eventTitle = currentEc?.event_title_override || currentEc?.layout?.event_title_override || currentEventObj.title;
        const credId = currentEc?.layout?.credential_base ? `${currentEc.layout.credential_base}-SAMPLE` : 'GDGSRU-SAMPLE01';
        const devTag = currentEc?.layout?.dev_tag || 'DEV_COMMUNITY';
        const nodePill = currentEc?.layout?.node_pill || 'ACTIVE_NODE // 01';
        const partnerSticker = currentEc?.layout?.partner_sticker || '';

        const fields = {
          event_name: eventTitle,
          chapter: currentEc?.host_chapter || 'GDG on Campus SR University',
          host_chapter: currentEc?.host_chapter || 'GDG on Campus SR University',
          cert_tag: currentEc?.cert_tag || 'OFFICIAL CREDENTIAL',
          cert_title: currentEc?.cert_title || 'Certificate of Participation',
          track: currentEc?.track || '',
          skills: (currentEc?.skills || []).join(', '),
          dossier_tag: currentEc?.dossier_tag || '',
          curriculum_status: currentEc?.curriculum_status || 'STATUS: Topic / Curriculum Overview',
          curriculum_text: currentEc?.curriculum_text || '',
          curriculum_bullets: currentEc?.curriculum_bullets ? lines.map((text) => ({ text })) : [],
          date: currentEc?.event_date ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(currentEc.event_date + 'T00:00:00')) : '',
          date_short: currentEc?.event_date ? new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(currentEc.event_date + 'T00:00:00')) : '',
          dev_tag: devTag,
          node_pill: nodePill,
          partner_sticker: partnerSticker,
          gdg_custom_logo: gdgCustomLogo,
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
          recipient_name: activeRecipient,
          credential_id: credId,
          event_title: eventTitle,
          event_start: currentEc?.event_date ? `${currentEc.event_date}T00:00:00+05:30` : new Date().toISOString(),
          fields,
        };

        const built = window.GDGCert.buildDocument(payload);
        wrap.innerHTML = '';
        const frame = await window.GDGCert.mount(wrap, built.html);

        const stage = $('#tc-stage');
        const scaler = $('#tc-scaler');
        if (stage && scaler) {
          const availW = stage.clientWidth - 40;
          const s = Math.min(1, Math.max(0.3, availW / 1123));
          scaler.style.transform = `scale(${s})`;
          scaler.style.width = '1123px';
          scaler.style.height = `${Math.round(794 * s)}px`;
        }

        if ($('#tc-cred-id-display')) {
          $('#tc-cred-id-display').textContent = `Credential Base: ${credId}`;
        }
      }

      await renderTestPreview(activeRecipient);

      if (select) {
        select.onchange = (e) => {
          if (e.target.value) {
            if (customInp) customInp.value = e.target.value;
            renderTestPreview(e.target.value);
          }
        };
      }
      if ($('#tc-btn-apply-name')) {
        $('#tc-btn-apply-name').onclick = () => {
          const val = customInp?.value.trim();
          if (val) renderTestPreview(val);
        };
      }

      $('#tc-btn-download-png').onclick = async () => {
        const frame = $('#tc-canvas-wrap iframe');
        if (!frame) return;
        const btn = $('#tc-btn-download-png');
        btn.disabled = true;
        btn.textContent = 'Rendering…';
        try {
          await window.GDGCert.downloadPng(frame, `Certificate_${activeRecipient}`);
          adminMessage('Test Certificate PNG downloaded!', true);
        } catch (err) {
          adminMessage('PNG generation error: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = '📥 Download PNG';
        }
      };

      $('#tc-btn-download-pdf').onclick = async () => {
        const frame = $('#tc-canvas-wrap iframe');
        if (!frame) return;
        const btn = $('#tc-btn-download-pdf');
        btn.disabled = true;
        btn.textContent = 'Rendering…';
        try {
          await window.GDGCert.downloadPdf(frame, `Certificate_${activeRecipient}`);
          adminMessage('Test Certificate PDF downloaded!', true);
        } catch (err) {
          adminMessage('PDF generation error: ' + err.message);
        } finally {
          btn.disabled = false;
          btn.textContent = '📥 Download PDF';
        }
      };

      $('#tc-btn-copy-link').onclick = async () => {
        const credId = currentEc?.layout?.credential_base ? `${currentEc.layout.credential_base}-SAMPLE` : 'GDGSRU-SAMPLE01';
        const verifyUrl = `${window.location.origin}/verify/?id=${encodeURIComponent(credId)}`;
        try {
          await navigator.clipboard.writeText(verifyUrl);
          adminMessage('Verification URL copied to clipboard!', true);
        } catch {
          prompt('Copy verification URL:', verifyUrl);
        }
      };
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
      rosterCount = attCount;
      if ($('#wb-tab-roster-badge')) $('#wb-tab-roster-badge').textContent = `(${rosterCount})`;

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
      claimsActive = !!ec?.claims_enabled;

      if ($('#wb-tab-pub-pill')) {
        $('#wb-tab-pub-pill').className = `mc-tab-pill ${claimsActive ? 'live' : 'draft'}`;
        $('#wb-tab-pub-pill').textContent = claimsActive ? 'Live' : (allReady ? 'Ready' : 'Draft');
      }
      if ($('#wb-event-status-pill')) {
        $('#wb-event-status-pill').className = `tag ${claimsActive ? 't3' : 't2'}`;
        $('#wb-event-status-pill').textContent = claimsActive ? '● Claims Active' : '○ Draft';
      }

      root.innerHTML = `
        <div style="max-width:760px;display:flex;flex-direction:column;gap:18px">
          <div class="mc-card">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
              <div>
                <h3 style="margin:0 0 4px;font-size:16px">Publish Readiness Checklist</h3>
                <p style="margin:0;font-size:13px;color:var(--ink-2)">All 5 requirements must be satisfied before public certificate claiming can be enabled on the website.</p>
              </div>
              <button type="button" class="btn sm" id="btn-test-claim-pub" style="font-size:12px">🎯 Test Claim Preview</button>
            </div>

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
              <a class="btn o sm" href="/certificates/?event=${selectedEventId}" target="_blank">View /certificates/ portal →</a>
              <a class="btn o sm" href="/verify/" target="_blank">View /verify/ portal →</a>
            </div>
          </div>
        </div>
      `;

      $('#btn-test-claim-pub')?.addEventListener('click', () => openTestClaimModal());

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