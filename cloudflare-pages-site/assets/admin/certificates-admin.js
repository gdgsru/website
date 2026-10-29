/* Mission Control: Certificates + Attendance (names) screens.
 * Loaded on demand by mission-control.js. Needs window.GDGCert (cert-engine.js).
 * Certificates are generated on the public page from: active template + per-event settings + the
 * attendance list. Nothing is issued or stored per person.
 */
(() => {
  'use strict';
  const G = window.GDGCert || {};
  const esc = G.esc || ((s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  let c; // context from mission-control.js: { sb, $, $$, setWorkspace, adminMessage, authErrorText, audit, msg, adminUser }

  /* ------------------------------------------------------------------ names CSV */
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
  /** Accepts a CSV with a name header plus a roll number and/or email (and optional attendance_status), or one name per line.
   * Roll numbers or emails are preferred for formal events, but names-only are fully supported for informal Q&A sessions.
   */
  function parseNames(text) {
    const issues = []; let rows = parseRows(String(text || '').replace(/^\uFEFF/, ''));
    if (!rows.length) return { rows: [], issues: ['The file is empty.'], dupes: 0, ambiguousNames: [] };
    const head = rows[0].map((h) => String(h).trim().toLowerCase());
    const nameIdx = head.findIndex((h) => ['name', 'full name', 'fullname', 'attendee_name', 'student name', 'names', 'student', 'attendee', 'attendees'].includes(h));
    let ni = 0, ri = -1, ei = -1, si = -1, hadHeader = false;
    if (nameIdx >= 0) {
      hadHeader = true; ni = nameIdx;
      ri = head.findIndex((h) => ['roll', 'roll no', 'roll no.', 'roll_no', 'roll number', 'roll_number', 'rollno', 'enrollment', 'enrollment no', 'enrollment_no', 'enrollment number'].includes(h));
      ei = head.findIndex((h) => ['email', 'attendee_email', 'email address'].includes(h));
      si = head.findIndex((h) => ['attendance_status', 'attendance status', 'attendee status', 'status'].includes(h));
      rows = rows.slice(1);
    }
    if (rows.length > 10000) return { rows: [], issues: ['A single upload can contain at most 10,000 attendee rows. Split the file into smaller uploads.'], dupes: 0, ambiguousNames: [] };
    const statusMap = new Map([
      ['attended', 'attended'], ['present', 'attended'], ['yes', 'attended'], ['y', 'attended'], ['true', 'attended'], ['1', 'attended'],
      ['absent', 'absent'], ['not attended', 'absent'], ['not-attended', 'absent'], ['not_attended', 'absent'], ['no', 'absent'], ['n', 'absent'], ['false', 'absent'], ['0', 'absent'],
      ['pending', 'pending'],
    ]);
    const byIdentity = new Map(), emailOwner = new Map(), out = []; let dupes = 0;
    rows.forEach((r, i) => {
      const name = String(r[ni] || '').trim().replace(/\s+/g, ' ');
      const rowNo = i + 1 + (hadHeader ? 1 : 0);
      if (!name) { issues.push(`Row ${rowNo}: attendee name is required.`); return; }
      if (name.length < 3 || name.length > 120) { issues.push(`Row ${rowNo}: the name is too short or too long (3–120 characters).`); return; }
      // Without a header row the columns are: name, then roll number or email, then optional status.
      const second = !hadHeader ? String(r[1] || '').trim() : '';
      const rollRaw = ri >= 0 ? String(r[ri] || '').trim() : (second && !second.includes('@') ? second : '');
      if (rollRaw.length > 40) { issues.push(`Row ${rowNo}: the roll number for "${name.slice(0, 30)}" is too long.`); return; }
      const roll = rollRaw.replace(/\s+/g, '').toUpperCase();
      const emailRaw = ei >= 0 ? String(r[ei] || '').trim().toLowerCase() : (second.includes('@') ? second.toLowerCase() : '');
      if (emailRaw && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) { issues.push(`Row ${rowNo}: "${name.slice(0, 30)}" has an invalid email address.`); return; }
      const statusRaw = si >= 0 ? String(r[si] || '').trim().toLowerCase() : (!hadHeader ? String(r[2] || '').trim().toLowerCase() : '');
      if (si >= 0 && !statusRaw) { issues.push(`Row ${rowNo}: attendance status is blank for "${name.slice(0, 30)}". Fill it with attended, absent, or pending.`); return; }
      const status = !statusRaw ? 'attended' : statusMap.get(statusRaw);
      if (!status) { issues.push(`Row ${rowNo}: unsupported status "${statusRaw.slice(0, 30)}" for "${name.slice(0, 30)}". Use attended, absent, or pending (common yes/no variants are supported).`); return; }
      const identity = roll ? `R:${roll}` : (emailRaw ? `E:${emailRaw}` : `N:${norm(name)}`);
      if (emailRaw && emailOwner.has(emailRaw) && emailOwner.get(emailRaw) !== identity) {
        issues.push(`Row ${rowNo}: the email "${emailRaw}" belongs to another attendee.`); return;
      }
      if (byIdentity.has(identity)) {
        const prev = byIdentity.get(identity);
        // The same person repeated with the same name and status is harmless; anything else conflicts.
        if (prev.attendee_name.toLowerCase() === name.toLowerCase() && prev.attendance_status === status) { dupes++; return; }
        if (identity.startsWith('N:')) { issues.push(`Row ${rowNo}: repeated name "${name}". When uploading without roll numbers or emails, each attendee name must be unique.`); return; }
        issues.push(`Row ${rowNo}: ${roll ? `roll number ${roll}` : emailRaw} is already used by another attendee or has a conflicting status.`); return;
      }
      if (emailRaw) emailOwner.set(emailRaw, identity);
      const attendee = { attendee_name: name, roll_no: roll || null, attendee_email: emailRaw || null, attendance_status: status };
      byIdentity.set(identity, attendee); out.push(attendee);
    });
    return { rows: out, issues, dupes, ambiguousNames: [] };
  }

  /** Server-side import keeps replacement and updates atomic. */
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

  /** Reusable "upload names" block. `getEventId()` returns the chosen event. */
  const importerHtml = () => `
    <div class="cert-importer">
      <a class="text-link" href="data:text/csv;charset=utf-8,Name%2CRoll%20No%2CEmail%2CStatus%0AAsha%20Rao%2C26BCE1001%2C%2Cattended%0ARahul%20Verma%2C%2Crahul%40example.com%2Cattended%0APriya%20Sharma%2C%2C%2Cattended" download="gdg-sru-names-sample.csv">Download sample CSV</a><p class="muted small">Columns: <code>Name</code> (required), plus optional <code>Roll No</code>, <code>Email</code>, and <code>Status</code>. If you only have names (e.g. from an informal Q&A session), a simple list of names works too! A pasted list works too: one person per line. Attendees without roll numbers or emails can claim their certificates on the Certificates page using their name.</p>
      <label>CSV or text file<input type="file" data-names-file accept=".csv,.txt,text/csv,text/plain"></label>
      <label>…or paste a list (one per line: name, then roll number or email)<textarea data-names-text rows="4" placeholder="Asha Rao, 26BCE1001&#10;Rahul Verma, rahul@example.com&#10;Priya Sharma"></textarea></label>
      <label class="check"><input type="checkbox" data-names-replace> Replace the current list (remove names that are not in this upload)</label>
      <div data-names-preview></div>
      <button type="button" data-names-import disabled>Import names</button>
    </div>`;
  function wireImporter(root, getEventId, onDone) {
    const $ = (s) => root.querySelector(s); let parsed = { rows: [], issues: [], dupes: 0, ambiguousNames: [] };
    const importButton = $('[data-names-import]');
    const show = (text) => {
      parsed = parseNames(text);
      const ambiguous = parsed.ambiguousNames || [];
      importButton.disabled = !parsed.rows.length || ambiguous.length > 0 || parsed.issues.length > 0;
      if (parsed.rows.length) {
        const warnings = [];
        if (parsed.dupes) warnings.push(`<p class="muted small">${parsed.dupes} repeated row(s) were skipped.</p>`);
        if (ambiguous.length) warnings.push(c.msg(`Cannot import yet: repeated names may belong to different people. Make these names unique (for example, include a middle name) before importing: ${ambiguous.slice(0, 8).map(esc).join(', ')}${ambiguous.length > 8 ? ', …' : ''}.`));
        if (parsed.issues.length) warnings.push(c.msg(parsed.issues.slice(0, 4).join(' ')));
        const withRoll = parsed.rows.filter((r) => r.roll_no).length;
        const withEmail = parsed.rows.filter((r) => r.attendee_email).length;
        const nameOnly = parsed.rows.length - withRoll - withEmail;
        const countParts = [];
        if (withRoll) countParts.push(`${withRoll} with Roll No`);
        if (withEmail) countParts.push(`${withEmail} with Email`);
        if (nameOnly) countParts.push(`${nameOnly} Name only`);
        const previewRows = parsed.rows.slice(0, 5).map((r, i) => `<tr><td style="padding:4px 6px;border-bottom:1px solid #e0e0e0;color:#666">${i+1}</td><td style="padding:4px 6px;border-bottom:1px solid #e0e0e0"><b>${esc(r.attendee_name)}</b></td><td style="padding:4px 6px;border-bottom:1px solid #e0e0e0">${esc(r.roll_no || '—')}</td><td style="padding:4px 6px;border-bottom:1px solid #e0e0e0">${esc(r.attendee_email || '—')}</td><td style="padding:4px 6px;border-bottom:1px solid #e0e0e0">${esc(r.attendance_status || 'attended')}</td></tr>`).join('');
        const previewTable = `<div style="margin:8px 0;overflow-x:auto;max-width:100%"><table style="width:100%;font-size:12px;border-collapse:collapse;border:1px solid #dadce0"><thead><tr style="background:#f8f9fa;text-align:left"><th style="padding:4px 6px;border-bottom:1px solid #dadce0">#</th><th style="padding:4px 6px;border-bottom:1px solid #dadce0">Name</th><th style="padding:4px 6px;border-bottom:1px solid #dadce0">Roll No</th><th style="padding:4px 6px;border-bottom:1px solid #dadce0">Email</th><th style="padding:4px 6px;border-bottom:1px solid #dadce0">Status</th></tr></thead><tbody>${previewRows}</tbody></table></div>`;
        const nameOnlyNote = nameOnly > 0 ? `<p class="muted small" style="color:var(--b,#4285f4);margin:4px 0 8px">ℹ️ <b>Name-only roster:</b> Attendees without roll numbers or emails can claim their certificates on the Certificates page using their name.</p>` : '';
        $('[data-names-preview]').innerHTML = `<p><b>${parsed.rows.length}</b> attendees ready to import <span class="muted small">(${countParts.join(', ') || 'All verified'})</span></p>${nameOnlyNote}${previewTable}${warnings.join('')}`;
      } else {
        $('[data-names-preview]').innerHTML = c.msg(parsed.issues[0] || 'No names found.');
      }
    };
    $('[data-names-file]').addEventListener('change', async (e) => { const f = e.target.files?.[0]; if (f) { $('[data-names-text]').value = ''; show(await f.text()); } });
    $('[data-names-text]').addEventListener('input', (e) => { $('[data-names-file]').value = ''; show(e.target.value); });
    $('[data-names-import]').addEventListener('click', async (e) => {
      const eventId = getEventId();
      if (!eventId) return c.adminMessage('Choose an event first.');
      if (!parsed.rows.length) return c.adminMessage('Add a file or paste names first.');
      if (parsed.issues?.length) return c.adminMessage('Correct the CSV issues shown in the preview before importing.');
      if (parsed.ambiguousNames?.length) return c.adminMessage('Make duplicate names unique before importing; the public certificate form checks names only.');
      const replace = $('[data-names-replace]').checked;
      if (replace && !confirm('Replace the list? Names not in this upload will be removed for this event.')) return;
      e.target.disabled = true;
      try {
        const r = await importNames(eventId, parsed.rows, replace);
        await c.audit('import', 'attendance_records', `${r.added} added, ${r.updated} updated, ${r.removed} removed`);
        await onDone();
        c.adminMessage(`Done: ${r.added} added, ${r.updated} updated, ${r.removed} removed.`, true);
      } catch (err) {
        const errMsg = String(err?.message || '');
        if (err?.code === '23505') {
          c.adminMessage('The import repeats a roll number, email, or name. Correct the file and retry.');
        } else if (/needs a (roll number or email|name, a roll number or email)|attendance_has_identifier/i.test(errMsg)) {
          c.adminMessage('Database migration required: please run migration 20261023120000_allow_name_only_attendance_rosters.sql in your Supabase SQL Editor to enable name-only attendance.');
        } else {
          c.adminMessage(c.authErrorText(err));
        }
      }
      finally { e.target.disabled = false; }
    });
  }



  /* ------------------------------------------------------------------ Attendance tab */
  async function renderAttendance(ctx) {
    c = ctx; const { sb, $, $$, setWorkspace, adminMessage, authErrorText, audit } = c;
    const currentEventId = ctx.preselect || (ctx.keepEvent || '');
    const [{ data: events }, { data: allRows, error }] = await Promise.all([
      sb.from('events').select('id,title').order('start_at', { ascending: false }),
      sb.from('attendance_records').select('id,event_id,attendee_name,roll_no,attendee_email,attendance_status,imported_at').order('imported_at', { ascending: false }).limit(200),
    ]);
    if (error) throw error;
    const title = Object.fromEntries((events || []).map((e) => [e.id, e.title]));
    const rerender = () => renderAttendance(ctx);

    const renderTableRows = (filterEventId, searchFilter = '') => {
      let filtered = allRows || [];
      if (filterEventId) filtered = filtered.filter((r) => r.event_id === filterEventId);
      if (searchFilter) {
        const q = searchFilter.toLowerCase();
        filtered = filtered.filter((r) =>
          String(r.attendee_name || '').toLowerCase().includes(q) ||
          String(r.roll_no || '').toLowerCase().includes(q) ||
          String(r.attendee_email || '').toLowerCase().includes(q)
        );
      }
      if (!filtered.length) {
        return '<tr><td colspan="7" style="text-align:center;color:#666;padding:16px">No attendance records found.</td></tr>';
      }
      return filtered.map((r) => {
        const isNameOnly = !r.roll_no && !r.attendee_email;
        const nameBadge = isNameOnly ? ' <span class="cert-badge" style="background:#e8f0fe;color:#1a73e8;font-size:10px;padding:2px 6px;border-radius:4px;font-weight:normal">Name only</span>' : '';
        return `<tr>
          <td><b>${esc(r.attendee_name)}</b>${nameBadge}</td>
          <td>${r.roll_no ? esc(r.roll_no) : '<span class="muted small">—</span>'}</td>
          <td>${esc(title[r.event_id] || '')}</td>
          <td>${r.attendee_email ? esc(r.attendee_email) : '<span class="muted small">—</span>'}</td>
          <td><span class="cert-badge" style="${r.attendance_status === 'attended' ? 'background:#e6f4ea;color:#137333' : 'background:#f1f3f4;color:#5f6368'}">${esc(r.attendance_status || 'attended')}</span></td>
          <td><small class="muted">${esc(new Date(r.imported_at || Date.now()).toLocaleDateString('en-IN'))}</small></td>
          <td style="text-align:right"><button type="button" class="button-outline" data-att-del="${esc(r.id)}" style="padding:2px 8px;font-size:11px;color:#d93025;border-color:#fad2cf">Delete</button></td>
        </tr>`;
      }).join('');
    };

    setWorkspace('Attendance', `
      <p class="admin-lead">Upload the attendees who participated in an event. Visitors can then claim their certificate on the Certificates page. You can upload a full roster (Name + Roll number / Email) or a simple list of names (e.g. from an informal Q&A session). Keep this list private.</p>
      
      <section class="admin-panel">
        <h2>Upload names</h2>
        <div class="admin-form">
          <label>Event
            <select id="att-event">
              <option value="">Choose event</option>
              ${(events || []).map((e) => `<option value="${esc(e.id)}" ${e.id === currentEventId ? 'selected' : ''}>${esc(e.title)}</option>`).join('')}
            </select>
          </label>
          ${importerHtml()}
        </div>
        
        <details class="cert-details" style="margin-top:16px">
          <summary><b>+ Add a single attendee manually (by name)</b></summary>
          <form id="single-att-form" class="admin-form" style="margin-top:12px">
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:12px">
              <label>Full name *<input name="name" required minlength="3" maxlength="120" placeholder="Asha Rao"></label>
              <label>Roll number (optional)<input name="roll" maxlength="40" placeholder="26BCE1001"></label>
              <label>Email address (optional)<input name="email" type="email" maxlength="80" placeholder="asha@example.com"></label>
              <label>Status
                <select name="status">
                  <option value="attended" selected>Attended</option>
                  <option value="absent">Absent</option>
                  <option value="pending">Pending</option>
                </select>
              </label>
            </div>
            <div style="margin-top:12px;display:flex;gap:8px">
              <button type="submit">Add attendee</button>
            </div>
          </form>
        </details>
      </section>

      <section class="admin-panel">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:12px">
          <h2 style="margin:0">Attendance records (<span id="att-count">${(allRows || []).length}</span>)</h2>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
            <input type="search" id="att-search" placeholder="Search name, roll, email…" style="font-size:12px;padding:4px 8px;width:180px">
            <button type="button" class="button-outline" id="att-clear-event" style="font-size:12px;padding:4px 10px;color:#d93025;border-color:#fad2cf;display:none">Clear event records</button>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll no</th>
                <th>Event</th>
                <th>Email</th>
                <th>Status</th>
                <th>Imported</th>
                <th style="text-align:right">Action</th>
              </tr>
            </thead>
            <tbody id="att-tbody">
              ${renderTableRows(currentEventId)}
            </tbody>
          </table>
        </div>
      </section>
    `);

    // Wire up importer
    wireImporter($('#admin-workspace'), () => $('#att-event').value, rerender);

    // Wire up event selection & filtering
    const attEventSelect = $('#att-event');
    const tbody = $('#att-tbody');
    const countSpan = $('#att-count');
    const searchInp = $('#att-search');
    const clearBtn = $('#att-clear-event');

    const bindDeleteButtons = () => {
      $$('[data-att-del]').forEach((btn) => {
        btn.onclick = async () => {
          if (!confirm('Remove this attendee from the event list?')) return;
          btn.disabled = true;
          try {
            const { error } = await sb.from('attendance_records').delete().eq('id', btn.dataset.attDel);
            if (error) throw error;
            await audit('delete', 'attendance_records', btn.dataset.attDel);
            adminMessage('Attendee removed.', true);
            await rerender();
          } catch (err) {
            adminMessage(authErrorText(err));
            btn.disabled = false;
          }
        };
      });
    };

    const updateView = () => {
      const evId = attEventSelect.value;
      ctx.keepEvent = evId; ctx.preselect = evId;
      const q = searchInp.value.trim();
      tbody.innerHTML = renderTableRows(evId, q);
      countSpan.textContent = evId ? `${(allRows || []).filter(r => r.event_id === evId).length}` : `${(allRows || []).length}`;
      if (clearBtn) clearBtn.style.display = evId ? 'inline-block' : 'none';
      bindDeleteButtons();
    };

    attEventSelect.addEventListener('change', updateView);
    searchInp.addEventListener('input', updateView);
    bindDeleteButtons();

    // Clear event attendance
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        const evId = attEventSelect.value;
        const evTitle = title[evId] || 'this event';
        if (!evId) return;
        if (!confirm(`Are you sure you want to remove ALL attendance records for "${evTitle}"? This cannot be undone.`)) return;
        clearBtn.disabled = true;
        try {
          const { error } = await sb.from('attendance_records').delete().eq('event_id', evId);
          if (error) throw error;
          await audit('delete_all', 'attendance_records', `Cleared all records for event ${evId}`);
          adminMessage(`All attendance records for ${evTitle} removed.`, true);
          await rerender();
        } catch (err) {
          adminMessage(authErrorText(err));
          clearBtn.disabled = false;
        }
      });
    }

    // Add single attendee manually
    const singleForm = $('#single-att-form');
    if (singleForm) {
      singleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const evId = attEventSelect.value;
        if (!evId) return adminMessage('Choose an event first in the dropdown above.');
        const fd = new FormData(singleForm);
        const name = String(fd.get('name') || '').trim();
        const roll = String(fd.get('roll') || '').trim();
        const email = String(fd.get('email') || '').trim().toLowerCase();
        const status = String(fd.get('status') || 'attended');
        if (!name || name.length < 3) return adminMessage('Name must be at least 3 characters.');
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return adminMessage('Please enter a valid email address.');
        
        const submitBtn = singleForm.querySelector('button[type=submit]');
        submitBtn.disabled = true;
        try {
          const { error } = await sb.from('attendance_records').insert({
            event_id: evId,
            attendee_name: name,
            roll_no: roll ? roll.toUpperCase() : null,
            attendee_email: email || null,
            attendance_status: status,
            created_by: c.adminUser?.id || null
          });
          if (error) {
            if (/attendance_has_identifier|needs a name, a roll number or email/i.test(error.message || '')) {
              adminMessage('Database migration required: please run migration 20261023120000_allow_name_only_attendance_rosters.sql in Supabase to save name-only attendees.');
            } else {
              throw error;
            }
            return;
          }
          await audit('create', 'attendance_records', `${name} added to ${evId}`);
          adminMessage(`Attendee "${name}" added successfully.`, true);
          singleForm.reset();
          await rerender();
        } catch (err) {
          adminMessage(authErrorText(err));
        } finally {
          submitBtn.disabled = false;
        }
      });
    }

    if (currentEventId && attEventSelect) {
      attEventSelect.value = currentEventId;
      updateView();
    }
  }

  /* ------------------------------------------------------------------ Certificates tab */
  async function loadStudioLibs() {
    if (window.html2canvas && window.jspdf && window.JSZip) return;
    const loadScript = (src) => new Promise((resolve) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = resolve;
      document.head.appendChild(s);
    });
    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
    ]);
  }

  async function renderCertificates(ctx) {
    c = ctx; const { sb, $, $$, setWorkspace, adminMessage, authErrorText, audit } = c;
    const [ev, tp, cf, att] = await Promise.all([
      sb.from('events').select('id,title,start_at').order('start_at', { ascending: false }),
      sb.from('certificate_templates').select('*').order('created_at', { ascending: false }),
      sb.from('certificate_configs').select('*'),
      sb.from('attendance_records').select('event_id').eq('attendance_status', 'attended').range(0, 19999),
    ]);
    const events = (ev.data && ev.data.length) ? ev.data : [{ id: "live-cloud-jam", title: "Google Cloud Study Jam", start_at: new Date().toISOString() }], templates = tp.data || [], configs = Object.fromEntries((cf.data || []).map((x) => [x.event_id, x]));
    const counts = {}; (att.data || []).forEach((r) => { counts[r.event_id] = (counts[r.event_id] || 0) + 1; });
    const active = templates.find((t) => t.is_active);
    const rerender = () => renderCertificates(ctx);

    if (!document.getElementById('gdg-cert-studio-fonts')) {
      const l = document.createElement('link');
      l.id = 'gdg-cert-studio-fonts';
      l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800;900&family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700;800;900&family=JetBrains+Mono:wght@400;600;700;800&family=Kalam:wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    loadStudioLibs();

    const selectedEventId = ctx.keepEvent || (events[0]?.id || '');
    let currentGdgLogo = { dataUrl: '', path: '', size: 60, x: 0, y: 0, hide_chapter_text: false };

    setWorkspace('Certificates', `
      <style id="mc-cert-native-css">
        .mc-cert-container { display: flex; flex-direction: column; gap: 18px; margin-top: 4px; }
        
        /* Top Action Bar */
        .mc-cert-header-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-l);
          padding: 14px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px;
          box-shadow: var(--sh-sm);
        }
        .mc-cert-header-left { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; flex: 1; min-width: 280px; }
        .mc-cert-header-right { display: flex; align-items: center; gap: 10px; }
        
        /* Two-Column Responsive Layout */
        .mc-cert-grid {
          display: grid;
          grid-template-columns: minmax(360px, 420px) minmax(0, 1fr);
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 1080px) {
          .mc-cert-grid { grid-template-columns: 1fr; }
        }

        /* Form Controls Panels */
        .mc-cert-cards-col { display: flex; flex-direction: column; gap: 16px; }
        .mc-cert-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-l);
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          box-shadow: var(--sh-sm);
        }
        .mc-cert-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2px;
        }
        .mc-cert-card-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: var(--ink);
        }
        .mc-cert-card-header p {
          margin: 2px 0 0;
          font-size: 12px;
          color: var(--ink-3);
        }

        .mc-form-group { display: flex; flex-direction: column; gap: 5px; }
        .mc-form-group label { font-size: 11.5px; font-weight: 600; color: var(--ink-2); text-transform: uppercase; letter-spacing: 0.3px; }
        .mc-form-group input, .mc-form-group textarea, .mc-form-group select {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-m);
          padding: 8px 12px;
          font-size: 13px;
          color: var(--ink);
          font-family: inherit;
          outline: none;
          transition: border-color 0.15s;
        }
        .mc-form-group input:focus, .mc-form-group textarea:focus, .mc-form-group select:focus {
          border-color: var(--primary, #1a73e8);
        }
        .mc-form-row { display: flex; gap: 10px; }
        .mc-form-row > * { flex: 1; }

        /* Item Rows (Signatories & Partners) */
        .mc-item-card {
          background: var(--sunk, #f8f9fa);
          border: 1px solid var(--line);
          border-radius: var(--r-m);
          padding: 10px 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .mc-item-row { display: flex; gap: 8px; align-items: center; }
        .mc-upload-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          padding: 6px 10px;
          background: var(--surface);
          border: 1px dashed var(--line-bold, #c4c7c5);
          border-radius: var(--r-m);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--ink-2);
          cursor: pointer;
        }
        .mc-upload-btn:hover { border-color: var(--primary, #1a73e8); color: var(--primary, #1a73e8); }
        .mc-upload-btn input[type=file] { display: none; }

        /* Preview Canvas Viewport */
        .mc-preview-card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: var(--r-l);
          overflow: hidden;
          box-shadow: var(--sh-sm);
          position: sticky;
          top: calc(var(--top, 56px) + 16px);
        }
        .mc-preview-toolbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 16px;
          background: var(--surface);
          border-bottom: 1px solid var(--line);
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-2);
        }
        .mc-preview-zoom { display: flex; gap: 4px; align-items: center; }
        .mc-p-btn {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 4px;
          padding: 3px 8px;
          font-size: 11px;
          font-weight: 600;
          color: var(--ink-2);
          cursor: pointer;
        }
        .mc-p-btn:hover { background: var(--sunk, #f8f9fa); color: var(--ink); }
        .mc-p-btn.active { background: var(--primary, #1a73e8); border-color: var(--primary, #1a73e8); color: #fff; }

        .mc-preview-stage {
          background: #eef2f6;
          padding: 24px;
          overflow: auto;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          min-height: 480px;
          max-height: calc(100vh - 160px);
        }
        .mc-canvas-scaler { transform-origin: top center; transition: transform 0.15s ease-out; }

        /* Exact Theme Colors & Variables matching master certificate */
        :root {
          --g-blue: #4285F4; --g-red: #EA4335; --g-yellow: #FBBC05; --g-green: #34A853;
          --g-light-yellow: #FEF0C3;
          --paper-bg: #F8F9FA;
          --text-main: #0F172A;
          --text-muted: #475569;
          --font-display: 'Space Grotesk', sans-serif;
          --font-title: 'Outfit', sans-serif;
          --font-body: 'Inter', sans-serif;
          --font-mono: 'JetBrains Mono', monospace;
          --font-sign: 'Kalam', cursive;
        }

        /* Master A4 Landscape (1123 x 794) */
        .a4-landscape {
          width: 1123px;
          height: 794px;
          background: #F8F9FA;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08);
          position: relative;
          color: #0F172A;
          padding: 40px 48px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
          text-align: left;
        }
        .tech-grid { position: absolute; inset: 0; background-image: radial-gradient(rgba(15, 23, 42, 0.08) 1.5px, transparent 1.5px); background-size: 26px 26px; z-index: 0; pointer-events: none; }
        .bleed-watermark-year { position: absolute; top: -60px; right: -30px; font-family: 'Space Grotesk', sans-serif; font-size: 380px; font-weight: 900; line-height: 0.8; color: transparent; -webkit-text-stroke: 4px rgba(15, 23, 42, 0.05); z-index: 1; pointer-events: none; user-select: none; letter-spacing: -14px; }
        .bleed-watermark-gdg { position: absolute; top: 220px; right: 30px; font-family: 'Space Grotesk', sans-serif; font-size: 260px; font-weight: 900; line-height: 0.8; color: transparent; -webkit-text-stroke: 3.5px rgba(66, 133, 244, 0.07); z-index: 1; pointer-events: none; user-select: none; letter-spacing: -6px; }
        .tape-accent { position: absolute; top: 12px; left: -35px; width: 130px; height: 32px; background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(0,0,0,0.06); box-shadow: 0 2px 4px rgba(0,0,0,0.04); transform: rotate(-45deg); z-index: 100; pointer-events: none; }
        .circuit-path { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 3; pointer-events: none; }

        .brutal-shadow { box-shadow: 6px 6px 0px #0F172A; }
        .brutal-shadow-sm { box-shadow: 3px 3px 0px #0F172A; }

        .header-row { display: flex; justify-content: space-between; align-items: center; width: 100%; position: relative; z-index: 20; border-bottom: 2.5px solid #0F172A; padding-bottom: 12px; }
        .main-logo-area { display: flex; align-items: center; gap: 18px; }
                .main-logo-area { display: flex; align-items: center; gap: 16px; position: relative; z-index: 10; }
        .main-logo-area svg { width: 72px; height: auto; flex: none; filter: drop-shadow(2px 2px 0px rgba(15,23,42,0.12)); }
        .gdg-logo-interactive { cursor: grab; touch-action: none; user-select: none; }
        .gdg-logo-interactive.dragging { cursor: grabbing !important; }
        .custom-gdg-logo-img { max-width: 340px; object-fit: contain; display: block; }
        .logo-text h1 { font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 900; margin: 0 0 2px 0; line-height: 1.1; letter-spacing: -0.5px; color: #0F172A; }
        .logo-text h2 { font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 800; margin: 0; color: #475569; text-transform: uppercase; letter-spacing: 2.5px; }

        .partners-cluster { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; justify-content: flex-end; max-width: 54%; }
        .partner-item { display: flex; align-items: center; gap: 10px; background: #FFFFFF; border: 2px solid #0F172A; border-radius: 10px; padding: 6px 14px; box-shadow: 3px 3px 0px #0F172A; height: 48px; box-sizing: border-box; }
        .partner-item img { height: 34px; max-width: 120px; object-fit: contain; }
        .partner-item .partner-title-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; color: #0F172A; line-height: 1.2; }

        .content-body-grid { display: flex; justify-content: space-between; position: relative; z-index: 10; flex: 1; margin-top: 14px; gap: 32px; }
        .left-col { width: 57%; display: flex; flex-direction: column; justify-content: flex-start; z-index: 10; }
        .title-deck { margin-top: 2px; }
        .cert-tag { display: inline-block; background: #FFFFFF; border: 2px solid #0F172A; padding: 4px 12px; border-radius: 14px; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 800; color: #0F172A; margin-bottom: 8px; }
        .cert-title { font-family: 'Outfit', sans-serif; font-size: 40px; font-weight: 900; text-transform: uppercase; letter-spacing: -0.5px; color: #0F172A; margin: 0; line-height: 1.05; }

        .statement-deck { margin: 15px 0 0 0; }
        .cert-statement { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; color: #475569; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
        
        .cert-name-wrapper { margin: 4px 0 16px 0; }
        .cert-name-badge { 
          background: #4285F4; 
          color: #fff; 
          border: 3.5px solid #0F172A; 
          border-radius: 12px; 
          padding: 9px 24px; 
          font-family: 'Outfit', sans-serif; 
          font-size: 52px; 
          letter-spacing: -1px; 
          font-weight: 900; 
          display: inline-block; 
          line-height: 1.1; 
          max-width: 100%; 
          word-break: normal; 
          overflow-wrap: anywhere; 
          box-shadow: 6px 6px 0px #0F172A;
          box-sizing: border-box;
        }

        .cert-event-text { 
          font-family: 'Inter', sans-serif; 
          font-size: 15.5px; 
          color: #475569; 
          line-height: 2.4; 
          margin-bottom: 25px; 
        }
        .highlight-box { 
          background: #FEF0C3; 
          border: 1.5px solid #0F172A; 
          border-radius: 5px; 
          padding: 3px 8px; 
          font-weight: 800; 
          color: #0F172A; 
          display: inline-block; 
          margin: 0 4px; 
          vertical-align: middle; 
          line-height: 1.2;
          box-shadow: 3px 3px 0px #0F172A;
        }

        .event-syllabus-card { 
          background: #FFFFFF; 
          border: 2px solid #0F172A; 
          border-radius: 10px; 
          padding: 12px 16px; 
          box-shadow: 3px 3px 0px #0F172A; 
          margin-bottom: auto; 
          display: flex; 
          flex-direction: column; 
          gap: 6px; 
          width: 95%; 
          box-sizing: border-box;
        }
        .syllabus-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          font-family: 'JetBrains Mono', monospace; 
          font-size: 9px; 
          font-weight: 800; 
          text-transform: uppercase; 
          color: #4285F4; 
          letter-spacing: 0.5px; 
        }
        .syllabus-body { 
          font-family: 'Inter', sans-serif; 
          font-size: 12.5px; 
          color: #475569; 
          line-height: 1.5; 
          font-weight: 500; 
        }

        .signatures-row { display: flex; gap: 20px; align-items: flex-end; width: 100%; margin-top: 40px; }
        .sig-block { flex: 1; min-width: 0; display: flex; flex-direction: column; padding: 2px 4px; }
        .sig-img-container { height: 42px; display: flex; align-items: flex-end; margin-bottom: 4px; width: 100%; position: relative; z-index: 5; }
        .sig-img { height: calc(42px * var(--sig-scale, 1)); width: auto; max-width: none; flex: none; object-fit: contain; mix-blend-mode: multiply; transform: translate(var(--sig-x, 0px), var(--sig-y, 0px)); cursor: grab; touch-action: none; user-select: none; }
        .sig-img.dragging { cursor: grabbing; }
        .sig-fallback { font-family: 'Kalam', cursive; font-size: calc(26px * var(--sig-scale, 1)); color: #0F172A; line-height: 0.8; white-space: normal; transform: translate(var(--sig-x, 0px), var(--sig-y, 0px)); }
        .sig-line { width: 100%; height: 2px; background: #0F172A; margin-bottom: 4px; }
        .sig-name { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: calc(13px * var(--sig-name-scale, 1)); color: #0F172A; line-height: 1.2; word-break: normal; }
        .sig-role { font-family: 'JetBrains Mono', monospace; font-size: calc(9px * var(--sig-role-scale, 1)); font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; line-height: 1.2; word-break: normal; }

        .right-col {
          width: 38%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: flex-end;
          position: relative;
          z-index: 10;
          gap: 25px;
        }

        /* CUSTOMIZABLE TECH STICKER CLUSTER */
        .top-art-row {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          justify-content: flex-end;
          flex-wrap: wrap;
          position: relative;
          margin-top: 10px;
        }
        .dev-badge-card {
          background: #FFFFFF;
          border: 2.5px solid #0F172A;
          border-radius: 12px;
          padding: 7px 14px;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 3px 3px 0px #0F172A;
        }
        .dev-badge-icon {
          width: 28px;
          height: 28px;
          background: #4285F4;
          border: 1.5px solid #0F172A;
          border-radius: 6px;
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'JetBrains Mono', monospace;
          font-weight: 800;
          font-size: 13px;
        }
        .dev-badge-title { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 800; color: #0F172A; }

        .custom-sticker-pill {
          padding: 6px 14px;
          border-radius: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 800;
          border: 2px solid #0F172A;
          box-shadow: 2.5px 2.5px 0px #0F172A;
        }

        .terminal-log-card {
          width: 100%;
          background: #FFFFFF;
          border: 2.5px solid #0F172A;
          border-radius: 12px;
          padding: 10px 14px;
          box-shadow: 4px 4px 0px #0F172A;
          display: flex;
          flex-direction: column;
          gap: 6px;
          box-sizing: border-box;
        }
        .terminal-head {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 2px;
        }
        .term-dot { width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #0F172A; }
        .term-code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          font-weight: 700;
          color: #0F172A;
          line-height: 1.45;
        }
        .term-highlight { color: #34A853; font-weight: 800; }

        .dossier-card-wrap {
          width: 100%;
          position: relative;
          margin-top: auto;
        }
        .dossier-card {
          width: 100%;
          background: #4285F4;
          border: 3px solid #0F172A;
          border-radius: 16px;
          padding: 20px 16px 16px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          box-sizing: border-box;
        }

        .dossier-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 800; color: #FFFFFF; text-transform: uppercase; letter-spacing: 1px; }
        .skills-cluster { display: flex; flex-wrap: wrap; gap: 7px; }
        .skill-pill {
          background: #FFFFFF;
          color: #0F172A;
          border: 2px solid #0F172A;
          font-family: 'JetBrains Mono', monospace;
          font-size: 10.5px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 14px;
          box-shadow: 2px 2px 0px #0F172A;
          white-space: nowrap;
        }

        .meta-console {
          background: rgba(15, 23, 42, 0.35);
          border: 2px solid #0F172A;
          border-radius: 8px;
          padding: 10px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 5px;
        }
        .meta-item { display: flex; flex-direction: column; gap: 2px; }
        .meta-title { font-family: 'JetBrains Mono', monospace; font-size: 7.5px; font-weight: 700; color: #CBD5E1; text-transform: uppercase; }
        .meta-val { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; font-weight: 800; color: #FFFFFF; }

        .sticker-tag {
          position: absolute;
          top: -14px;
          left: -10px;
          background: #FBBC05;
          padding: 5px 12px;
          border-radius: 14px;
          font-family: 'JetBrains Mono', monospace;
          font-size: 11px;
          font-weight: 800;
          color: #0F172A;
          z-index: 10;
          border: 2px solid #0F172A;
          box-shadow: 0 0 0 3px #fff, 4px 4px 0px 3px #0F172A;
        }
        .sticker-heart {
          position: absolute;
          bottom: -12px;
          right: -8px;
          background: #34A853;
          width: 42px;
          height: 42px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          color: #0F172A;
          z-index: 10;
          border: 2px solid #0F172A;
          box-shadow: 0 0 0 3px #fff, 4px 4px 0px 3px #0F172A;
        }

        [contenteditable="true"] { outline: none; }
        [contenteditable="true"]:hover { opacity: 0.85; }
        [contenteditable="true"]:focus { outline: 2px dashed #4285f4; }

        /* Progress Bar */
        .mc-progress-box { display: none; margin: 6px 0; }
        .mc-progress-bar { height: 6px; width: 100%; background: var(--line); border-radius: 3px; overflow: hidden; }
        .mc-progress-fill { height: 100%; width: 0%; background: #34a853; transition: width 0.2s; }
        .mc-progress-text { font-size: 11px; color: var(--ink-2); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }
      </style>

      <div class="mc-cert-container">
        <!-- Top Action Card -->
        <div class="mc-cert-header-card">
          <div class="mc-cert-header-left">
            <label style="font-weight:600;font-size:13px;display:flex;align-items:center;gap:8px">
              <span>Event</span>
              <select id="mc-event-select" style="font-size:13px;padding:6px 12px;border-radius:var(--r-m);border:1px solid var(--line);min-width:240px">
                ${events.map((e) => `<option value="${esc(e.id)}" ${e.id === selectedEventId ? 'selected' : ''}>${esc(e.title)}${configs[e.id]?.enabled ? ' ✓ (Public Open)' : ''}</option>`).join('')}
              </select>
            </label>
            <span id="mc-att-badge" class="cert-badge" style="background:#e8f0fe;color:#1a73e8;font-size:11px;padding:4px 9px">
              ${counts[selectedEventId] || 0} verified attendees
            </span>
            <label class="check" style="font-size:12.5px;font-weight:600;cursor:pointer">
              <input type="checkbox" id="mc-public-toggle" ${configs[selectedEventId]?.enabled ? 'checked' : ''}> Open public claims on /certificates/
            </label>
          </div>
          <div class="mc-cert-header-right">
            <button type="button" id="mc-save-config-btn" style="background:var(--primary, #1a73e8);color:#fff;border:none;padding:8px 16px;border-radius:var(--r-m);font-size:13px;font-weight:700;cursor:pointer">Save Settings</button>
          </div>
        </div>

        <!-- Two-Column Grid -->
        <div class="mc-cert-grid">
          <!-- Left Column: Simple Card Controls -->
          <div class="mc-cert-cards-col">
            <!-- 1. Certificate Content -->
            <section class="mc-cert-card">
              <div class="mc-cert-card-header">
                <h3>1. Content & Details</h3>
                <p>Live preview syncs as you type.</p>
              </div>

              <input type="hidden" id="inpRecipientName" value="Asha Rao">

              <div class="mc-form-group">
                <label>Event Title</label>
                <input type="text" id="inpEventName" value="Google Cloud Study Jam">
              </div>

              <div class="mc-form-row">
                <div class="mc-form-group">
                  <label>Chapter Name</label>
                  <input type="text" id="inpChapterName" value="GDG Chapter Name">
                </div>
                <div class="mc-form-group">
                  <label>Event Date</label>
                  <input type="text" id="inpEventDate" value="October 4, 2026">
                </div>
              </div>

              <!-- GDG Chapter Logo Studio -->
              <div class="mc-cert-card-header" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
                <div style="display:flex;justify-content:space-between;align-items:center;width:100%">
                  <h4 style="margin:0;font-size:12px">// GDG Chapter Logo &amp; Studio</h4>
                  <span id="gdg-logo-status" style="font-size:11px;color:var(--ink-2);font-weight:600">Using Default Vector (&lt; &gt;)</span>
                </div>
              </div>

              <div class="mc-form-row" style="align-items:center">
                <label class="mc-upload-btn" style="flex:1">
                  📁 Upload Custom GDG Logo
                  <input type="file" id="inpGdgLogoFile" accept="image/*">
                </label>
                <button type="button" class="button-outline" id="btn-reset-gdg-logo" style="display:none;padding:6px 10px;font-size:11.5px;color:#d93025;border-color:#fad2cf">✕ Reset to Default</button>
              </div>

              <div id="gdg-logo-controls" style="background:var(--sunk,#f8f9fa);border:1px solid var(--line);border-radius:var(--r-m);padding:10px 12px;margin-top:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:11.5px;font-weight:700;color:var(--ink)">Logo Size (Height)</span>
                  <span id="badge-gdg-logo-size" style="font-size:11px;font-weight:700;color:#1a73e8;background:rgba(26,115,232,0.1);padding:2px 8px;border-radius:4px">Height: 60px</span>
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:11px;color:var(--ink-2)">32px</span>
                  <input type="range" id="rng-gdg-logo-size" min="32" max="140" step="2" value="60" style="flex:1;cursor:pointer">
                  <span style="font-size:11px;color:var(--ink-2)">140px</span>
                </div>
                <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
                  <button type="button" class="mc-p-btn btn-gdg-size" data-size="48">48px</button>
                  <button type="button" class="mc-p-btn btn-gdg-size active" data-size="60">60px</button>
                  <button type="button" class="mc-p-btn btn-gdg-size" data-size="76">76px</button>
                  <button type="button" class="mc-p-btn btn-gdg-size" data-size="96">96px</button>
                  <button type="button" class="mc-p-btn btn-gdg-size" data-size="120">120px</button>
                </div>

                <div style="margin-top:10px;padding-top:10px;border-top:1px dashed var(--line);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
                  <div style="display:flex;align-items:center;gap:4px">
                    <span style="font-size:11px;font-weight:600;color:var(--ink-2);margin-right:2px">Nudge:</span>
                    <button type="button" class="mc-p-btn btn-gdg-nudge" data-axis="x" data-delta="-5" title="Move Left 5px">←</button>
                    <button type="button" class="mc-p-btn btn-gdg-nudge" data-axis="x" data-delta="5" title="Move Right 5px">→</button>
                    <button type="button" class="mc-p-btn btn-gdg-nudge" data-axis="y" data-delta="-5" title="Move Up 5px">↑</button>
                    <button type="button" class="mc-p-btn btn-gdg-nudge" data-axis="y" data-delta="5" title="Move Down 5px">↓</button>
                  </div>
                  <div style="display:flex;align-items:center;gap:6px">
                    <span id="badge-gdg-logo-offset" style="font-size:11px;font-family:var(--font-mono,monospace);color:var(--ink-2)">Offset: X:0px, Y:0px</span>
                    <button type="button" class="mc-p-btn" id="btn-reset-gdg-offset" style="padding:2px 6px;font-size:10.5px">Reset</button>
                  </div>
                </div>
                <div style="margin-top:6px;font-size:10.5px;color:var(--ink-3)">
                  💡 Tip: You can also drag the logo directly on the canvas preview to reposition it!
                </div>

                <div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--line)">
                  <label class="check" style="font-size:11.5px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px">
                    <input type="checkbox" id="chk-hide-chapter-text"> Hide chapter text (if already in your logo)
                  </label>
                </div>
              </div>

              <div class="mc-form-row">
                <div class="mc-form-group">
                  <label>Top Credential Tag</label>
                  <input type="text" id="inpCertTag" value="OFFICIAL CREDENTIAL">
                </div>
                <div class="mc-form-group">
                  <label>Certificate Title</label>
                  <input type="text" id="inpCertTitle" value="Certificate of Participation">
                </div>
              </div>

              <div class="mc-cert-card-header" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
                <h4 style="margin:0;font-size:12px">// Curriculum Overview Card</h4>
              </div>
              <div class="mc-form-row">
                <div class="mc-form-group" style="flex:1">
                  <label>Header Status Tag</label>
                  <input type="text" id="inpSyllabusStatus" value="STATUS: COMPLETED">
                </div>
              </div>
              <div class="mc-form-group">
                <label>Topic / Curriculum Overview</label>
                <textarea id="inpSyllabus" rows="2" placeholder="Summary of topics, labs, or curriculum...">Completed intensive hands-on development labs exploring Google Cloud infrastructure, Vertex AI foundational model deployments, and Gemini API multi-agent workflows.</textarea>
              </div>

              <div class="mc-cert-card-header" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
                <h4 style="margin:0;font-size:12px">// Blue Dossier Card & Competencies</h4>
              </div>
              <div class="mc-form-row">
                <div class="mc-form-group">
                  <label>Dossier Tag (Yellow)</label>
                  <input type="text" id="inpDossierTag" value="BUILD_WITH_AI">
                </div>
                <div class="mc-form-group">
                  <label>Track Name</label>
                  <input type="text" id="inpTrack" value="AI & Cloud">
                </div>
              </div>

              <div class="mc-form-group">
                <label>Skills & Competencies (comma separated)</label>
                <input type="text" id="inpSkills" value="Vertex AI, Gemini 2.5, Cloud Run, Python">
              </div>

              <div class="mc-form-group">
                <label>Credential ID Base</label>
                <input type="text" id="inpCredId" value="GDG-SRU-CERT-001">
              </div>

              <div class="mc-cert-card-header" style="margin-top:12px;padding-top:10px;border-top:1px solid var(--line)">
                <h4 style="margin:0;font-size:12px">// Tech Badges & Stickers</h4>
              </div>
              <div class="mc-form-row">
                <div class="mc-form-group">
                  <label>Dev Tag</label>
                  <input type="text" id="inpDevTag" value="#GoogleDeveloper">
                </div>
                <div class="mc-form-group">
                  <label>Active Node Pill</label>
                  <input type="text" id="inpNodePill" value="NODE_ACTIVE // 2026">
                </div>
              </div>

              <div class="mc-form-group">
                <label>Partner Pill (Optional)</label>
                <input type="text" id="inpPartnerSticker" value="#SRU_ACM // CO-HOST" placeholder="e.g. #SRU_ACM // CO-HOST (leave blank to hide)">
              </div>

            </section>

            <!-- 2. Signatures -->
            <section class="mc-cert-card">
              <div class="mc-cert-card-header">
                <div>
                  <h3>2. Signatories</h3>
                  <p>Drag signatures on preview or use size/position sliders.</p>
                </div>
                <button type="button" class="button-outline" id="btnAddSig" style="padding:3px 8px;font-size:11px">+ Add</button>
              </div>
              <div id="sigsContainer" style="display:flex;flex-direction:column;gap:8px"></div>
            </section>

            <!-- 3. Partners & Co-Branding -->
            <section class="mc-cert-card">
              <div class="mc-cert-card-header">
                <div>
                  <h3>3. Partner & Collaborator Logos</h3>
                  <p>Co-hosts, student clubs, or sponsor marks.</p>
                </div>
                <button type="button" class="button-outline" id="btnAddPartner" style="padding:3px 8px;font-size:11px">+ Add</button>
              </div>
              <div id="partnersContainer" style="display:flex;flex-direction:column;gap:8px"></div>
            </section>

            <!-- 4. Bulk Generation & Export -->
            <section class="mc-cert-card">
              <div class="mc-cert-card-header">
                <div>
                  <h3>4. Bulk Export & Roster</h3>
                  <p>Download certificates for all attendees in one click.</p>
                </div>
              </div>

              <div class="mc-form-row" style="align-items:center;margin-bottom:8px">
                <button type="button" class="button" id="btnPullRoster" style="flex:1;background:var(--sunk,#f8f9fa);color:var(--ink);border:1px solid var(--line);font-size:12px;padding:8px">👥 Pull Event Attendees</button>
                <button type="button" class="button-outline" id="btnToggleManualList" style="font-size:11px;padding:7px 10px">✏️ Paste / CSV</button>
              </div>

              <div class="mc-form-group" id="manualListWrap" style="display:none;margin-bottom:8px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                  <label style="font-size:11px;font-weight:700">Paste Names (one per line):</label>
                  <label class="mc-upload-btn" style="padding:2px 8px;font-size:10.5px">
                    📁 Upload CSV
                    <input type="file" id="inpBulkFile" accept=".csv,.txt,text/csv,text/plain">
                  </label>
                </div>
                <textarea id="inpBulkText" rows="3" placeholder="Asha Rao, 26BCE1001&#10;Rahul Verma, rahul@example.com&#10;Priya Sharma" style="font-size:11px;font-family:monospace"></textarea>
              </div>

              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <span style="font-size:11px;color:var(--ink-2);font-weight:600">Roster Status:</span>
                <span id="bulkCountLabel" style="font-size:11.5px;font-weight:700;color:var(--primary,#1a73e8)">0 loaded</span>
              </div>

              <div class="mc-progress-box" id="exportProgressWrap">
                <div class="mc-progress-bar"><div class="mc-progress-fill" id="exportProgressFill"></div></div>
                <div class="mc-progress-text" id="exportProgressText">Preparing…</div>
              </div>

              <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">
                <button type="button" id="btnExportZip" style="background:var(--primary, #1a73e8);color:#fff;border:none;border-radius:var(--r-m);padding:9px;font-weight:700;font-size:12.5px;cursor:pointer">📦 Download All (ZIP of PDFs)</button>
                <button type="button" class="button-outline" id="btnExportMerged" style="font-size:12px;padding:7px">📄 Download All as One Merged PDF</button>
                <div class="mc-form-row">
                  <button type="button" class="button-outline" id="btnExportSingle" style="font-size:11.5px;padding:6px">🖨️ Export Current PDF</button>
                  <button type="button" class="button-outline" id="btnExportPng" style="font-size:11.5px;padding:6px">🖼️ Download PNG</button>
                </div>
              </div>
            </section>
          </div>

          <!-- Right Column: Live Preview Card -->
          <div class="mc-preview-card">
            <div class="mc-preview-toolbar">
              <span>LIVE CERTIFICATE PREVIEW</span>
              <div class="mc-preview-zoom">
                <button type="button" class="mc-p-btn active" data-zoom="fit">Fit</button>
                <button type="button" class="mc-p-btn" data-zoom="50">50%</button>
                <button type="button" class="mc-p-btn" data-zoom="75">75%</button>
                <button type="button" class="mc-p-btn" data-zoom="100">100%</button>
                <button type="button" class="mc-p-btn" data-zoom="125">125%</button>
                <button type="button" class="mc-p-btn" id="btnZoomOut">−</button>
                <button type="button" class="mc-p-btn" id="btnZoomIn">+</button>
              </div>
            </div>

            <div class="mc-preview-stage" id="canvasScrollArea">
              <div class="mc-canvas-scaler" id="canvasScaler">
                <!-- MASTER A4 CANVAS -->
                <div class="a4-landscape" id="certCanvas">
                  <div class="tech-grid"></div>
                  
                  <!-- DUAL WATERMARKS -->
                  <div class="bleed-watermark-year">2026</div>
                  <div class="bleed-watermark-gdg">GDG</div>
                  
                  <div class="tape-accent"></div>

                  <!-- Orthogonal Circuit Line -->
                  <svg class="circuit-path" viewBox="0 0 1123 794">
                    <path d="M 630,420 L 680,420 L 680,560 L 730,560" fill="none" stroke="#0F172A" stroke-width="2.5" stroke-linejoin="miter" />
                    <circle cx="630" cy="420" r="4" fill="#FBBC05" stroke="#0F172A" stroke-width="2" />
                    <circle cx="730" cy="560" r="4" fill="#4285F4" stroke="#0F172A" stroke-width="2" />
                  </svg>

                  <!-- 1. Header Row -->
                  <div class="header-row">
                    <div class="main-logo-area" id="cvMainLogoArea">
                      <svg id="cvDefLogo" class="gdg-logo-interactive" viewBox="0 0 100 60" style="width: 72px; height: auto;">
                        <path d="M40,10 L10,30 L40,50" fill="none" stroke="#4285F4" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M60,10 L90,30 L60,50" fill="none" stroke="#34A853" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <img id="cvCustomLogo" class="custom-gdg-logo-img gdg-logo-interactive" src="" alt="GDG Logo" style="display:none;">
                      <div class="logo-text" id="cvLogoText">
                        <h1>Google Developer Groups</h1>
                        <h2 contenteditable="true" spellcheck="false" id="cvChapterHead">On Campus SR University</h2>
                      </div>
                    </div>

                    <div class="partners-cluster" id="cvPartnersCluster"></div>
                  </div>

                  <!-- 2. Content Body Grid -->
                  <div class="content-body-grid">
                    <!-- Left Column -->
                    <div class="left-col">
                      <div>
                        <div class="title-deck">
                          <div class="cert-tag brutal-shadow-sm" id="cvCertTag" contenteditable="true" spellcheck="false">OFFICIAL CREDENTIAL</div>
                          <h1 class="cert-title" id="cvCertTitle" contenteditable="true" spellcheck="false">Certificate of Participation</h1>
                        </div>

                        <div class="statement-deck">
                          <div class="cert-statement" contenteditable="true" spellcheck="false">This document certifies that</div>
                          <div class="cert-name-wrapper">
                            <div class="cert-name-badge brutal-shadow" id="cvCertName" contenteditable="true" spellcheck="false">Asha Rao</div>
                          </div>

                          <div class="cert-event-text">
                            <span contenteditable="true" spellcheck="false">has successfully attended and contributed to</span>&nbsp;<span class="highlight-box brutal-shadow-sm" id="cvEventName" contenteditable="true" spellcheck="false">Google Cloud Study Jam</span>&nbsp;<span contenteditable="true" spellcheck="false">hosted by</span>&nbsp;<span class="highlight-box brutal-shadow-sm" id="cvChapterName" contenteditable="true" spellcheck="false">GDG Chapter Name</span>&nbsp;<span contenteditable="true" spellcheck="false">on</span>&nbsp;<span class="highlight-box brutal-shadow-sm" id="cvEventDate" contenteditable="true" spellcheck="false">October 4, 2026</span>.
                          </div>

                          <div class="event-syllabus-card">
                            <div class="syllabus-header">
                              <span>// CURRICULUM OVERVIEW</span>
                              <span id="cvSyllabusStatus" contenteditable="true" spellcheck="false">STATUS: COMPLETED</span>
                            </div>
                            <div class="syllabus-body" id="cvSyllabus" contenteditable="true" spellcheck="false">
                              Completed intensive hands-on development labs exploring Google Cloud infrastructure, Vertex AI foundational model deployments, and Gemini API multi-agent workflows.
                            </div>
                          </div>
                        </div>
                      </div>

                      <!-- Signatures Cluster -->
                      <div class="signatures-row" id="cvSignaturesCluster"></div>
                    </div>

                    <!-- RIGHT COLUMN -->
                    <div class="right-col">
                      <!-- CUSTOMIZABLE TECH STICKER CLUSTER -->
                      <div class="top-art-row">
                        <div class="dev-badge-card">
                          <div class="dev-badge-icon">&lt;/&gt;</div>
                          <div class="dev-badge-title" id="cvDevTag" contenteditable="true" spellcheck="false">#GoogleDeveloper</div>
                        </div>
                        <div class="custom-sticker-pill" id="cvNodePillBadge" style="background:#EA4335; color:#fff;">
                          <span id="cvNodePill" contenteditable="true" spellcheck="false">NODE_ACTIVE // 2026</span>
                        </div>
                        <div class="custom-sticker-pill" id="cvPartnerStickerBadge" style="background:#FBBC05; color:#0F172A; display:flex;">
                          <span id="cvPartnerStickerText" contenteditable="true" spellcheck="false">#SRU_ACM // CO-HOST</span>
                        </div>
                      </div>

                      <!-- TERMINAL LOG CARD -->
                      <div class="terminal-log-card">
                        <div class="terminal-head">
                          <div class="term-dot" style="background:#EA4335;"></div>
                          <div class="term-dot" style="background:#FBBC05;"></div>
                          <div class="term-dot" style="background:#34A853;"></div>
                          <span style="font-family:'JetBrains Mono',monospace; font-size:8px; font-weight:800; margin-left:4px; color:#475569;">SHELL_SESSION_NODE</span>
                        </div>
                        <div class="term-code">
                          &gt; node deploy_credential.js --auth=true<br>
                          &gt; status: <span class="term-highlight">200_OK_VERIFIED</span><br>
                          &gt; ref_sha: <span id="cvTermId" style="color:#4285F4;">GDG-SRU-CERT-001</span>
                        </div>
                      </div>

                      <!-- DOSSIER CARD -->
                      <div class="dossier-card-wrap">
                        <div class="sticker-tag" id="cvDossierTag" contenteditable="true" spellcheck="false">BUILD_WITH_AI</div>
                        <div class="dossier-card brutal-shadow">
                          <div class="dossier-label">// Verified Competencies</div>
                          <div class="skills-cluster" id="cvSkillsCluster"></div>
                          <div class="meta-console">
                            <div class="meta-item">
                              <span class="meta-title">Credential ID</span>
                              <span class="meta-val" id="cvDossierRef">GDG-SRU-CERT-001</span>
                            </div>
                            <div class="meta-item">
                              <span class="meta-title">Track</span>
                              <span class="meta-val" id="cvMetaTrack">AI & Cloud</span>
                            </div>
                            <div class="meta-item">
                              <span class="meta-title">Issued</span>
                              <span class="meta-val" id="cvMetaDate">Oct 4, 2026</span>
                            </div>
                          </div>
                        </div>
                        <div class="sticker-heart">&hearts;</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>

        <!-- Optional Collapsible: Advanced HTML Templates -->
        <details class="cert-details" style="margin-top:8px">
          <summary style="font-size:12.5px;color:var(--ink-2)"><b>Advanced: Programmatic HTML Templates</b></summary>
          <div style="margin-top:12px">
            <p class="muted small">Active template: <b>${esc(active ? active.name : 'Master Template')}</b>. Templates are stored in Supabase for programmatic and automated issuance.</p>
            <div id="tpl-list" style="margin:10px 0">${templates.map((t) => `<div class="admin-list-row"><div><b>${esc(t.name)}</b>${t.is_active ? ' <span class="cert-badge">Active</span>' : ''}<small>Updated ${esc(new Date(t.updated_at || t.created_at).toLocaleDateString('en-IN'))}</small></div><div class="row-actions"><button type="button" class="button-outline" data-tpl-edit="${esc(t.id)}">Edit</button>${t.is_active ? '' : `<button type="button" class="button-outline" data-tpl-activate="${esc(t.id)}">Make active</button>`}<button type="button" class="button-outline" data-tpl-delete="${esc(t.id)}">Delete</button></div></div>`).join('') || '<p class="muted">No custom templates yet.</p>'}</div>
            <form id="tpl-form" class="admin-form" style="margin-top:12px"><input type="hidden" name="id">
              <label>Template Name<input name="name" required maxlength="80" placeholder="GDG SRU Master Design"></label>
              <div class="cert-row"><button type="button" id="tpl-builtin" class="button-outline">Load Master HTML Template</button><label class="cert-filebtn">Upload .html file<input type="file" id="tpl-file" accept=".html,.htm,text/html"></label></div>
              <label>Template HTML<textarea name="html_template" id="tpl-html" rows="8" spellcheck="false" class="cert-code"></textarea></label>
              <label class="check"><input type="checkbox" name="is_active"> Make this the active template</label>
              <div class="cert-row"><button type="submit">Save template to Supabase</button><button type="button" id="tpl-reset" class="button-outline">Clear</button></div>
            </form>
          </div>
        </details>
      </div>
    `);

    /* ------------------------------------------------------------------ Logic & State */
    const uid = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

    const compressImageFile = (file, maxWidth = 600, maxHeight = 300, quality = 0.85) => new Promise((resolve) => {
      if (!file) return resolve({ blob: null, dataUrl: '' });
      if (typeof Image === 'undefined') {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ blob: file, dataUrl: e.target.result });
        reader.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(img, 0, 0, width, height);
        const isPng = (file.type && file.type.includes('png')) || !file.type;
        const mime = isPng ? 'image/png' : 'image/jpeg';
        canvas.toBlob((blob) => {
          const dataUrl = canvas.toDataURL(mime, quality);
          resolve({ blob: blob || file, dataUrl, width, height });
        }, mime, quality);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = (e) => resolve({ blob: file, dataUrl: e.target.result });
        reader.readAsDataURL(file);
      };
      img.src = url;
    });

    const processSignatureFile = (file, maxWidth = 500, maxHeight = 200) => new Promise((resolve) => {
      if (!file) return resolve({ blob: null, dataUrl: '' });
      if (typeof Image === 'undefined') {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ blob: file, dataUrl: e.target.result });
        reader.readAsDataURL(file);
        return;
      }
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx2d = canvas.getContext('2d');
        ctx2d.drawImage(img, 0, 0, width, height);

        // Transparent background conversion for photographed/scanned signatures on paper
        try {
          const imgData = ctx2d.getImageData(0, 0, width, height);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
            if (brightness > 215) {
              if (brightness >= 240) {
                data[i + 3] = 0; // Transparent
              } else {
                const factor = (240 - brightness) / 25;
                data[i + 3] = Math.round(data[i + 3] * factor);
              }
            }
          }
          ctx2d.putImageData(imgData, 0, 0);
        } catch (_) {}

        canvas.toBlob((blob) => {
          const dataUrl = canvas.toDataURL('image/png');
          resolve({ blob: blob || file, dataUrl, width, height });
        }, 'image/png');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        const reader = new FileReader();
        reader.onload = (e) => resolve({ blob: file, dataUrl: e.target.result });
        reader.readAsDataURL(file);
      };
      img.src = url;
    });
    let currentEvent = events.find((e) => e.id === selectedEventId) || events[0] || null;
    let currentConfig = (currentEvent ? configs[currentEvent.id] : null) || {};

    let signatories = [
      { id: uid(), name: "Narayan Bora", role: "Lead Organizer", img: "", scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 },
      { id: uid(), name: "Dr. Siddhartha Bhattacharyya", role: "Faculty Advisor", img: "", scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 }
    ];

    let partners = [
      { id: uid(), name: "SR University ACM", logo: "" }
    ];

    let recipients = [];
    let currentRecIndex = 0;
    let nameScale = 1;
    let currentZoom = 'fit';
    let zoomLevel = 0.85;

    function applyEventToStudio(evId) {
      currentEvent = events.find((e) => e.id === evId) || null;
      currentConfig = configs[evId] || {};
      const f = currentConfig.fields || {};

      $('#mc-att-badge').textContent = `${counts[evId] || 0} verified attendees`;
      $('#mc-public-toggle').checked = !!currentConfig.enabled;

      if (f.event_name || currentEvent?.title) {
        $('#inpEventName').value = f.event_name || currentEvent.title;
        $('#cvEventName').textContent = f.event_name || currentEvent.title;
      }
      if (f.chapter_name) {
        $('#inpChapterName').value = f.chapter_name;
        $('#cvChapterName').textContent = f.chapter_name;
      }
      if (f.date || currentEvent?.start_at) {
        const dStr = f.date || new Date(currentEvent.start_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        $('#inpEventDate').value = dStr;
        $('#cvEventDate').textContent = dStr;
        $('#cvMetaDate').textContent = dStr.slice(0, 12);
      }
      if (f.syllabus) {
        $('#inpSyllabus').value = f.syllabus;
        $('#cvSyllabus').textContent = f.syllabus;
      }
      const certTag = f.cert_tag || 'OFFICIAL CREDENTIAL';
      if ($('#inpCertTag')) $('#inpCertTag').value = certTag;
      if ($('#cvCertTag')) $('#cvCertTag').textContent = certTag;

      const certTitle = f.cert_title || 'Certificate of Participation';
      if ($('#inpCertTitle')) $('#inpCertTitle').value = certTitle;
      if ($('#cvCertTitle')) $('#cvCertTitle').textContent = certTitle;

      const syllabusStatus = f.syllabus_status || 'STATUS: COMPLETED';
      if ($('#inpSyllabusStatus')) $('#inpSyllabusStatus').value = syllabusStatus;
      if ($('#cvSyllabusStatus')) $('#cvSyllabusStatus').textContent = syllabusStatus;

      if (f.track) {
        $('#inpTrack').value = f.track;
        $('#cvMetaTrack').textContent = f.track;
      }
      const devTag = f.dev_tag || '#GoogleDeveloper';
      if ($('#inpDevTag')) $('#inpDevTag').value = devTag;
      if ($('#cvDevTag')) $('#cvDevTag').textContent = devTag;

      const nodePill = f.node_pill || 'NODE_ACTIVE // 2026';
      if ($('#inpNodePill')) $('#inpNodePill').value = nodePill;
      if ($('#cvNodePill')) $('#cvNodePill').textContent = nodePill;

      const dossierTag = f.dossier_tag || 'BUILD_WITH_AI';
      if ($('#inpDossierTag')) $('#inpDossierTag').value = dossierTag;
      if ($('#cvDossierTag')) $('#cvDossierTag').textContent = dossierTag;

      const partnerSticker = f.partner_sticker !== undefined ? f.partner_sticker : '#SRU_ACM // CO-HOST';
      if ($('#inpPartnerSticker')) $('#inpPartnerSticker').value = partnerSticker;
      if ($('#cvPartnerStickerText')) $('#cvPartnerStickerText').textContent = partnerSticker;
      if ($('#cvPartnerStickerBadge')) $('#cvPartnerStickerBadge').style.display = partnerSticker ? 'flex' : 'none';

      const baseCred = f.credential_id || 'GDG-SRU-CERT-001';
      if ($('#inpCredId')) $('#inpCredId').value = baseCred;
      if ($('#cvDossierRef')) $('#cvDossierRef').textContent = baseCred;
      if ($('#cvTermId')) $('#cvTermId').textContent = baseCred;

      if (Array.isArray(f.signatories) && f.signatories.length) {
        signatories = f.signatories.map((s) => ({ id: s.id || uid(), ...s }));
      }
      if (Array.isArray(f.partners) && f.partners.length) {
        partners = f.partners.map((p) => ({ id: p.id || uid(), ...p }));
      }
      if (f.skills) {
        const sk = Array.isArray(f.skills) ? f.skills.map((x) => x.tag || x).join(', ') : String(f.skills);
        $('#inpSkills').value = sk;
        renderSkills(sk);
      }
      if (f.dossier_tag && $('#cvDossierTag')) {
        $('#cvDossierTag').textContent = f.dossier_tag;
      }
      // Apply GDG Logo configuration
      const gdgLogo = f.gdg_logo || {};
      currentGdgLogo = {
        dataUrl: gdgLogo.dataUrl || f.gdg_custom_logo || '',
        path: gdgLogo.path || '',
        size: Number(gdgLogo.size) || 60,
        x: Number(gdgLogo.x) || 0,
        y: Number(gdgLogo.y) || 0,
        hide_chapter_text: gdgLogo.hide_chapter_text !== undefined ? !!gdgLogo.hide_chapter_text : !!f.hide_chapter_text
      };
      applyGdgLogo();

      renderSignatories();
      renderPartners();
      fitName();
      loadEventRoster(true);
    }


    /* ------------------------------------------------------------------ GDG Chapter Logo Studio */
    function applyGdgLogo() {
      const defSvg = $('#cvDefLogo');
      const customImg = $('#cvCustomLogo');
      const logoText = $('#cvLogoText');
      const status = $('#gdg-logo-status');
      const resetBtn = $('#btn-reset-gdg-logo');
      const rngSize = $('#rng-gdg-logo-size');
      const badgeSize = $('#badge-gdg-logo-size');
      const badgeOffset = $('#badge-gdg-logo-offset');
      const chkHideText = $('#chk-hide-chapter-text');

      const hasCustom = !!(currentGdgLogo.dataUrl || currentGdgLogo.path);
      const size = currentGdgLogo.size || 60;
      const x = currentGdgLogo.x || 0;
      const y = currentGdgLogo.y || 0;

      if (customImg && defSvg) {
        if (hasCustom) {
          customImg.src = currentGdgLogo.dataUrl || currentGdgLogo.path;
          customImg.style.display = 'block';
          customImg.style.height = `${size}px`;
          customImg.style.maxHeight = `${size}px`;
          customImg.style.transform = `translate(${x}px, ${y}px)`;
          defSvg.style.display = 'none';
        } else {
          customImg.style.display = 'none';
          defSvg.style.display = 'block';
          defSvg.style.height = `${size}px`;
          defSvg.style.width = 'auto';
          defSvg.style.transform = `translate(${x}px, ${y}px)`;
        }
      }
      if (logoText) {
        logoText.style.display = currentGdgLogo.hide_chapter_text ? 'none' : 'block';
      }
      if (status) {
        status.textContent = hasCustom ? 'Custom Logo Uploaded' : 'Using Default Vector (< >)';
      }
      if (resetBtn) {
        resetBtn.style.display = hasCustom ? 'inline-flex' : 'none';
      }
      if (rngSize) rngSize.value = size;
      if (badgeSize) badgeSize.textContent = `Height: ${size}px`;
      if (badgeOffset) badgeOffset.textContent = `Offset: X:${x > 0 ? '+' : ''}${x}px, Y:${y > 0 ? '+' : ''}${y}px`;
      if (chkHideText) chkHideText.checked = !!currentGdgLogo.hide_chapter_text;

      $$('.btn-gdg-size').forEach((b) => {
        b.classList.toggle('active', Number(b.dataset.size) === size);
      });
    }

    function enableLogoDrag(el) {
      if (!el) return;
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        const currentScale = scaler ? (scaler.getBoundingClientRect().width / 1123 || 1) : 1;
        const sx = e.clientX, sy = e.clientY, ox = currentGdgLogo.x || 0, oy = currentGdgLogo.y || 0;
        el.setPointerCapture(e.pointerId);
        el.classList.add('dragging');
        const move = (ev) => {
          currentGdgLogo.x = Math.max(-400, Math.min(400, Math.round(ox + (ev.clientX - sx) / currentScale)));
          currentGdgLogo.y = Math.max(-250, Math.min(250, Math.round(oy + (ev.clientY - sy) / currentScale)));
          applyGdgLogo();
        };
        const up = () => {
          el.classList.remove('dragging');
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
          el.removeEventListener('pointercancel', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
      });
    }

    function initGdgLogoControls() {
      const inp = $('#inpGdgLogoFile');
      if (inp) {
        inp.onchange = async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const { blob, dataUrl } = await compressImageFile(file, 600, 200, 0.85);
          currentGdgLogo.dataUrl = dataUrl;
          applyGdgLogo();
          adminMessage('Custom GDG logo loaded! Drag on preview or use sliders to adjust.', true);

          try {
            const ext = (file.type && file.type.includes('png')) ? 'png' : (file.name.split('.').pop() || 'png');
            const path = `logos/${selectedEventId || 'common'}/gdg_logo_${Date.now()}.${ext}`;
            const targetBucket = 'site-assets';
            if (window.MC?.uploadStorage) {
              const up = await window.MC.uploadStorage(targetBucket, path, blob || file, { isPublic: true, contentType: blob?.type || file.type || 'image/png' });
              if (up?.publicUrl) currentGdgLogo.path = up.publicUrl;
            } else if (sb?.storage) {
              const up = await sb.storage.from(targetBucket).upload(path, blob || file, { upsert: true });
              if (up?.data?.path) {
                const { data } = sb.storage.from(targetBucket).getPublicUrl(up.data.path);
                if (data?.publicUrl) currentGdgLogo.path = data.publicUrl;
              }
            }
          } catch (err) {
            console.warn('Storage background upload notice:', err);
          }
        };
      }

      const resetBtn = $('#btn-reset-gdg-logo');
      if (resetBtn) {
        resetBtn.onclick = () => {
          if (!confirm('Reset back to standard GDG vector logo?')) return;
          currentGdgLogo.dataUrl = '';
          currentGdgLogo.path = '';
          currentGdgLogo.x = 0;
          currentGdgLogo.y = 0;
          currentGdgLogo.size = 60;
          currentGdgLogo.hide_chapter_text = false;
          applyGdgLogo();
          adminMessage('GDG Logo reset to default vector.', true);
        };
      }

      const rng = $('#rng-gdg-logo-size');
      if (rng) {
        rng.oninput = (e) => {
          currentGdgLogo.size = Number(e.target.value) || 60;
          applyGdgLogo();
        };
      }

      $$('.btn-gdg-size').forEach((btn) => {
        btn.onclick = () => {
          currentGdgLogo.size = Number(btn.dataset.size) || 60;
          applyGdgLogo();
        };
      });

      $$('.btn-gdg-nudge').forEach((btn) => {
        btn.onclick = () => {
          const axis = btn.dataset.axis;
          const delta = Number(btn.dataset.delta) || 0;
          if (axis === 'x') {
            currentGdgLogo.x = Math.max(-400, Math.min(400, (currentGdgLogo.x || 0) + delta));
          } else {
            currentGdgLogo.y = Math.max(-250, Math.min(250, (currentGdgLogo.y || 0) + delta));
          }
          applyGdgLogo();
        };
      });

      const resetOffsetBtn = $('#btn-reset-gdg-offset');
      if (resetOffsetBtn) {
        resetOffsetBtn.onclick = () => {
          currentGdgLogo.x = 0;
          currentGdgLogo.y = 0;
          applyGdgLogo();
        };
      }

      const chkHide = $('#chk-hide-chapter-text');
      if (chkHide) {
        chkHide.onchange = (e) => {
          currentGdgLogo.hide_chapter_text = !!e.target.checked;
          applyGdgLogo();
        };
      }

      enableLogoDrag($('#cvDefLogo'));
      enableLogoDrag($('#cvCustomLogo'));
    }

    /* ------------------------------------------------------------------ Zoom & Canvas Fit */
    const scaler = $('#canvasScaler');
    const scrollArea = $('#canvasScrollArea');
    function fitCanvas() {
      if (!scrollArea || !scaler) return;
      const availableW = scrollArea.clientWidth - 48;
      const fitScale = Math.min(1.0, Math.max(0.35, availableW / 1123));
      scaler.style.transform = `scale(${fitScale})`;
      scaler.style.marginBottom = `${-(794 * (1 - fitScale))}px`;
    }

    function scaleCanvas(factor) {
      if (!scaler) return;
      scaler.style.transform = `scale(${factor})`;
      scaler.style.marginBottom = `${-(794 * (1 - factor))}px`;
    }

    $$('.mc-p-btn[data-zoom]').forEach((b) => {
      b.onclick = () => {
        $$('.mc-p-btn').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
        currentZoom = b.dataset.zoom;
        if (currentZoom === 'fit') fitCanvas();
        else { zoomLevel = Number(currentZoom) / 100; scaleCanvas(zoomLevel); }
      };
    });
    $('#btnZoomIn').onclick = () => { zoomLevel = Math.min(1.5, zoomLevel + 0.1); scaleCanvas(zoomLevel); };
    $('#btnZoomOut').onclick = () => { zoomLevel = Math.max(0.3, zoomLevel - 0.1); scaleCanvas(zoomLevel); };
    window.addEventListener('resize', () => { if (currentZoom === 'fit') fitCanvas(); });

    /* ------------------------------------------------------------------ Name Fitting */
    function fitName() {
      const el = $('#cvCertName');
      if (!el || !el.parentElement) return;
      const max = el.parentElement.clientWidth || 540;
      const MAX = 52 * nameScale, MIN_ONE = 34 * nameScale, MIN_TWO = 28 * nameScale;
      el.style.whiteSpace = 'nowrap';
      let size = MAX; el.style.fontSize = size + 'px';
      while (el.scrollWidth > max && size > MIN_ONE) { size--; el.style.fontSize = size + 'px'; }
      if (el.scrollWidth <= max) return;
      el.style.whiteSpace = 'normal';
      size = 40 * nameScale; el.style.fontSize = size + 'px';
      while (el.scrollHeight > size * 2.4 && size > MIN_TWO) { size--; el.style.fontSize = size + 'px'; }
    }

    function renderSkills(str) {
      const cluster = $('#cvSkillsCluster');
      if (!cluster) return;
      cluster.innerHTML = '';
      const items = String(str || '').split(',').map((s) => s.trim()).filter(Boolean);
      items.forEach((item) => {
        const pill = document.createElement('div');
        pill.className = 'skill-pill';
        pill.textContent = item.startsWith('#') ? item : `#${item.replace(/\s+/g, '')}`;
        cluster.appendChild(pill);
      });
    }

    /* ------------------------------------------------------------------ Partners */
    function renderPartners() {
      const inputList = $('#partnersContainer'), cluster = $('#cvPartnersCluster');
      if (!inputList || !cluster) return;
      inputList.innerHTML = ''; cluster.innerHTML = '';

      partners.forEach((p) => {
        const card = document.createElement('div');
        card.className = 'mc-item-card';
        card.innerHTML = `
          <div class="mc-item-row">
            <input type="text" data-p-name="${esc(p.id)}" value="${esc(p.name)}" placeholder="Partner Name / Club" style="flex:1">
            <button type="button" class="button-outline" data-p-del="${esc(p.id)}" style="color:#d93025;padding:4px 8px;font-size:11px">✕</button>
          </div>
          <div class="mc-item-row">
            <label class="mc-upload-btn" style="flex:1">
              ${p.logo ? 'Change Logo' : 'Upload Logo'}
              <input type="file" data-p-file="${esc(p.id)}" accept="image/*">
            </label>
            ${p.logo ? `<img src="${esc(p.logo)}" alt="" style="height:24px;max-width:60px;object-fit:contain">` : '<small class="muted" style="font-size:10px">No logo</small>'}
          </div>`;
        inputList.appendChild(card);

        if (p.name || p.logo) {
          const badge = document.createElement('div');
          badge.className = 'partner-item';
          badge.innerHTML = `${p.logo ? `<img src="${esc(p.logo)}" alt="">` : ''}<span class="partner-title-badge">${esc(p.name)}</span>`;
          cluster.appendChild(badge);
        }
      });

      $$('[data-p-name]', inputList).forEach((inp) => {
        inp.oninput = (e) => {
          const t = partners.find((x) => x.id === inp.dataset.pName);
          if (t) { t.name = e.target.value; renderPartners(); }
        };
      });
      $$('[data-p-file]', inputList).forEach((inp) => {
        inp.onchange = async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const t = partners.find((x) => x.id === inp.dataset.pFile);
          if (!t) return;
          adminMessage('Optimizing partner logo...', true);
          const { blob, dataUrl } = await compressImageFile(f, 400, 160, 0.9);
          t.logo = dataUrl;
          renderPartners();

          try {
            const evId = $('#mc-event-select') ? $('#mc-event-select').value : 'common';
            const ext = (f.type && f.type.includes('png')) ? 'png' : 'webp';
            const path = `partners/${evId}/partner_${t.id}_${Date.now()}.${ext}`;
            const targetBucket = 'site-assets';
            if (window.MC?.uploadStorage) {
              const up = await window.MC.uploadStorage(targetBucket, path, blob || f, { isPublic: true, contentType: blob?.type || 'image/png' });
              if (up?.publicUrl) {
                t.logo = up.publicUrl;
                t.path = up.publicUrl;
                renderPartners();
              }
            } else if (sb?.storage) {
              const up = await sb.storage.from(targetBucket).upload(path, blob || f, { upsert: true });
              if (up?.data?.path) {
                const { data } = sb.storage.from(targetBucket).getPublicUrl(up.data.path);
                if (data?.publicUrl) {
                  t.logo = data.publicUrl;
                  t.path = data.publicUrl;
                  renderPartners();
                }
              }
            }
            adminMessage('Partner logo uploaded.', true);
          } catch (err) {
            console.warn('Partner logo background upload notice:', err);
          }
        };
      });
      $$('[data-p-del]', inputList).forEach((btn) => {
        btn.onclick = () => {
          partners = partners.filter((x) => x.id !== btn.dataset.pDel);
          renderPartners();
        };
      });
    }

    $('#btnAddPartner').onclick = () => {
      partners.push({ id: uid(), name: "SR University ACM", logo: "" });
      renderPartners();
    };

    /* ------------------------------------------------------------------ Signatories */
    function applySigPos(id) {
      const s = signatories.find((x) => x.id === id); if (!s) return;
      const blk = $(`#cvSignaturesCluster .sig-block[data-id="${id}"]`);
      if (blk) {
        blk.style.setProperty('--sig-x', (s.x || 0) + 'px');
        blk.style.setProperty('--sig-y', (s.y || 0) + 'px');
      }
      const card = $(`#sigsContainer [data-sig-card="${id}"]`);
      if (card) {
        const rx = card.querySelector('[data-r="x"]'), ry = card.querySelector('[data-r="y"]');
        if (rx) rx.value = s.x || 0;
        if (ry) ry.value = s.y || 0;
      }
    }

    function enableSigDrag(img, id) {
      img.addEventListener('pointerdown', (e) => {
        const s = signatories.find((x) => x.id === id); if (!s) return;
        e.preventDefault();
        const currentScale = scaler.getBoundingClientRect().width / 1123 || 1;
        const sx = e.clientX, sy = e.clientY, ox = s.x || 0, oy = s.y || 0;
        img.setPointerCapture(e.pointerId);
        img.classList.add('dragging');
        const move = (ev) => {
          s.x = Math.max(-300, Math.min(300, Math.round(ox + (ev.clientX - sx) / currentScale)));
          s.y = Math.max(-200, Math.min(200, Math.round(oy + (ev.clientY - sy) / currentScale)));
          applySigPos(id);
        };
        const up = () => {
          img.classList.remove('dragging');
          img.removeEventListener('pointermove', move);
          img.removeEventListener('pointerup', up);
          img.removeEventListener('pointercancel', up);
        };
        img.addEventListener('pointermove', move);
        img.addEventListener('pointerup', up);
        img.addEventListener('pointercancel', up);
      });
    }

    function renderSignatories() {
      const box = $('#sigsContainer'), cluster = $('#cvSignaturesCluster');
      if (!box || !cluster) return;
      box.innerHTML = ''; cluster.innerHTML = '';

      signatories.forEach((s) => {
        const card = document.createElement('div');
        card.className = 'mc-item-card';
        card.dataset.sigCard = s.id;
        card.innerHTML = `
          <div class="mc-item-row">
            <input type="text" data-s-name="${esc(s.id)}" value="${esc(s.name)}" placeholder="Signatory Full Name" style="flex:1">
            <button type="button" class="button-outline" data-s-del="${esc(s.id)}" style="color:#d93025;padding:4px 8px;font-size:11px">✕</button>
          </div>
          <div class="mc-item-row">
            <input type="text" data-s-role="${esc(s.id)}" value="${esc(s.role)}" placeholder="Role / Title" style="flex:1">
            <label class="mc-upload-btn" style="width:auto;padding:5px 8px">
              Upload Sign
              <input type="file" data-s-file="${esc(s.id)}" accept="image/*">
            </label>
          </div>
          <div class="mc-item-row" style="font-size:11px;color:var(--ink-2)">
            <span style="width:40px">Size</span>
            <input type="range" data-s-range="scale" data-id="${esc(s.id)}" min="30" max="300" step="5" value="${s.scale || 100}" style="flex:1;accent-color:#1a73e8">
            <span class="val" style="width:34px;text-align:right">${s.scale || 100}%</span>
          </div>
          <div class="mc-item-row" style="font-size:11px;color:var(--ink-2)">
            <span style="width:40px">Pos X</span>
            <input type="range" data-r="x" data-s-range="x" data-id="${esc(s.id)}" min="-250" max="250" step="1" value="${s.x || 0}" style="flex:1;accent-color:#1a73e8">
            <span style="width:40px;margin-left:6px">Pos Y</span>
            <input type="range" data-r="y" data-s-range="y" data-id="${esc(s.id)}" min="-150" max="150" step="1" value="${s.y || 0}" style="flex:1;accent-color:#1a73e8">
          </div>
        `;
        box.appendChild(card);

        const blk = document.createElement('div');
        blk.className = 'sig-block';
        blk.dataset.id = s.id;
        blk.style.setProperty('--sig-scale', (s.scale || 100) / 100);
        blk.style.setProperty('--sig-name-scale', (s.nameSize || 100) / 100);
        blk.style.setProperty('--sig-role-scale', (s.roleSize || 100) / 100);
        blk.style.setProperty('--sig-x', (s.x || 0) + 'px');
        blk.style.setProperty('--sig-y', (s.y || 0) + 'px');
        blk.innerHTML = `
          <div class="sig-img-container">
            ${s.img ? `<img class="sig-img" src="${esc(s.img)}" alt="" crossorigin="anonymous">` : `<div class="sig-fallback">${esc(s.name)}</div>`}
          </div>
          <div class="sig-line"></div>
          <div class="sig-name" contenteditable="true" spellcheck="false">${esc(s.name)}</div>
          <div class="sig-role" contenteditable="true" spellcheck="false">${esc(s.role)}</div>
        `;
        cluster.appendChild(blk);

        const imgEl = blk.querySelector('.sig-img');
        if (imgEl) enableSigDrag(imgEl, s.id);
      });

      $$('[data-s-name]', box).forEach((inp) => {
        inp.oninput = (e) => {
          const t = signatories.find((x) => x.id === inp.dataset.sName);
          if (t) { t.name = e.target.value; renderSignatories(); }
        };
      });
      $$('[data-s-role]', box).forEach((inp) => {
        inp.oninput = (e) => {
          const t = signatories.find((x) => x.id === inp.dataset.sRole);
          if (t) { t.role = e.target.value; renderSignatories(); }
        };
      });
      $$('[data-s-file]', box).forEach((inp) => {
        inp.onchange = async (e) => {
          const f = e.target.files?.[0]; if (!f) return;
          const t = signatories.find((x) => x.id === inp.dataset.sFile);
          if (!t) return;

          adminMessage('Optimizing signature (removing paper background)...', true);
          const { blob, dataUrl } = await processSignatureFile(f);
          t.img = dataUrl;
          renderSignatories();

          try {
            const evId = $('#mc-event-select') ? $('#mc-event-select').value : 'common';
            const path = `signatures/${evId}/sig_${t.id}_${Date.now()}.png`;
            const targetBucket = 'site-assets';
            if (window.MC?.uploadStorage) {
              const up = await window.MC.uploadStorage(targetBucket, path, blob || f, { isPublic: true, contentType: 'image/png' });
              if (up?.publicUrl) {
                t.img = up.publicUrl;
                t.path = up.publicUrl;
                renderSignatories();
              }
            } else if (sb?.storage) {
              const up = await sb.storage.from(targetBucket).upload(path, blob || f, { upsert: true });
              if (up?.data?.path) {
                const { data } = sb.storage.from(targetBucket).getPublicUrl(up.data.path);
                if (data?.publicUrl) {
                  t.img = data.publicUrl;
                  t.path = data.publicUrl;
                  renderSignatories();
                }
              }
            }
            adminMessage('Signature uploaded and optimized.', true);
          } catch (err) {
            console.warn('Signature storage background upload notice:', err);
            adminMessage('Signature optimized.', true);
          }
        };
      });
      $$('[data-s-range]', box).forEach((rng) => {
        rng.oninput = (e) => {
          const t = signatories.find((x) => x.id === rng.dataset.id);
          if (!t) return;
          const k = rng.dataset.sRange;
          t[k] = Number(e.target.value);
          if (k === 'scale') {
            const blk = $(`#cvSignaturesCluster .sig-block[data-id="${t.id}"]`);
            if (blk) blk.style.setProperty('--sig-scale', t.scale / 100);
            const valSpan = rng.parentElement.querySelector('.val');
            if (valSpan) valSpan.textContent = t.scale + '%';
          } else {
            applySigPos(t.id);
          }
        };
      });
      $$('[data-s-del]', box).forEach((btn) => {
        btn.onclick = () => {
          signatories = signatories.filter((x) => x.id !== btn.dataset.sDel);
          renderSignatories();
        };
      });
    }

    $('#btnAddSig').onclick = () => {
      signatories.push({ id: uid(), name: "Lead Speaker", role: "Special Guest", img: "", scale: 100, x: 0, y: 0, nameSize: 100, roleSize: 100 });
      renderSignatories();
    };

    /* ------------------------------------------------------------------ Live Form Bindings */
    const bindSync = (inpId, cvId, extra) => {
      const inp = $(inpId), cv = $(cvId);
      if (!inp || !cv) return;
      inp.addEventListener('input', () => {
        cv.textContent = inp.value;
        if (extra) extra(inp.value);
      });
      cv.addEventListener('input', () => {
        inp.value = cv.textContent;
        if (extra) extra(cv.textContent);
      });
    };

    bindSync('#inpRecipientName', '#cvCertName', () => fitName());
    bindSync('#inpEventName', '#cvEventName');
    bindSync('#inpChapterName', '#cvChapterName');
    bindSync('#inpEventDate', '#cvEventDate', (v) => { $('#cvMetaDate').textContent = String(v).slice(0, 12); });
    bindSync('#inpCertTag', '#cvCertTag');
    bindSync('#inpCertTitle', '#cvCertTitle');
    bindSync('#inpSyllabusStatus', '#cvSyllabusStatus');
    bindSync('#inpSyllabus', '#cvSyllabus');
    bindSync('#inpTrack', '#cvMetaTrack');
    bindSync('#inpCredId', '#cvDossierRef', (v) => { if ($('#cvTermId')) $('#cvTermId').textContent = v; });
    bindSync('#inpDevTag', '#cvDevTag');
    bindSync('#inpNodePill', '#cvNodePill');
    bindSync('#inpDossierTag', '#cvDossierTag');
    if ($('#inpPartnerSticker') && $('#cvPartnerStickerText')) {
      $('#inpPartnerSticker').addEventListener('input', (e) => {
        const val = e.target.value.trim();
        $('#cvPartnerStickerText').textContent = val;
        if ($('#cvPartnerStickerBadge')) {
          $('#cvPartnerStickerBadge').style.display = val ? 'flex' : 'none';
        }
      });
      $('#cvPartnerStickerText').addEventListener('input', () => {
        $('#inpPartnerSticker').value = $('#cvPartnerStickerText').textContent.trim();
      });
    }
    $('#inpSkills').addEventListener('input', (e) => renderSkills(e.target.value));
    /* ------------------------------------------------------------------ Bulk Generation */
    function setRecipientsList(list) {
      recipients = list;
      currentRecIndex = 0;
      const count = recipients.length;
      $('#bulkCountLabel').textContent = count ? `${count} attendees ready` : '0 loaded';
      applyRecipient(currentRecIndex);
    }

    function applyRecipient(i) {
      if (!recipients.length || !recipients[i]) return;
      const r = recipients[i];
      $('#cvCertName').textContent = r.name;
      fitName();
      const baseId = $('#inpCredId').value || 'GDG-SRU-CERT-001';
      const cred = r.id || `${baseId}-${String(i + 1).padStart(3, '0')}`;
      $('#cvDossierRef').textContent = cred;
      $('#cvTermId').textContent = cred;
    }

    $('#inpBulkText').addEventListener('input', (e) => {
      const parsed = parseNames(e.target.value);
      if (parsed.rows?.length) {
        setRecipientsList(parsed.rows.map((r) => ({ name: r.attendee_name, roll_no: r.roll_no, email: r.attendee_email })));
      } else {
        const lines = e.target.value.split('\n').map((l) => l.trim()).filter(Boolean);
        setRecipientsList(lines.map((l) => ({ name: l })));
      }
    });

    $('#inpBulkFile').addEventListener('change', async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      const text = await f.text();
      const parsed = parseNames(text);
      if (parsed.rows?.length) {
        $('#inpBulkText').value = parsed.rows.map((r) => `${r.attendee_name}${r.roll_no ? ', ' + r.roll_no : ''}`).join('\n');
        setRecipientsList(parsed.rows.map((r) => ({ name: r.attendee_name, roll_no: r.roll_no, email: r.attendee_email })));
        adminMessage(`${parsed.rows.length} attendee(s) loaded from file.`, true);
      }
      e.target.value = '';
    });

    async function loadEventRoster(silent = false) {
      const evId = $('#mc-event-select') ? $('#mc-event-select').value : null;
      if (!evId) {
        if (!silent) adminMessage('Choose an event first.');
        return;
      }
      try {
        const { data, error } = await sb.from('attendance_records').select('attendee_name,roll_no,attendee_email').eq('event_id', evId).eq('attendance_status', 'attended');
        if (error) {
          if (!silent) adminMessage(authErrorText(error));
          return;
        }
        if (!data?.length) {
          if (!silent) adminMessage('No attended records found in database. Click "Paste / CSV" to enter names manually or upload attendance in Attendance tab.');
          return;
        }
        if ($('#inpBulkText')) $('#inpBulkText').value = data.map((r) => `${r.attendee_name}${r.roll_no ? ', ' + r.roll_no : ''}`).join('\n');
        setRecipientsList(data.map((r) => ({ name: r.attendee_name, roll_no: r.roll_no, email: r.attendee_email })));
        if (!silent) adminMessage(`${data.length} attendee(s) loaded from event roster!`, true);
      } catch (err) {
        if (!silent) adminMessage('Could not load attendees: ' + err.message);
      }
    }
    if ($('#btnPullRoster')) $('#btnPullRoster').onclick = () => loadEventRoster(false);
    if ($('#btnToggleManualList')) {
      $('#btnToggleManualList').onclick = () => {
        const wrap = $('#manualListWrap');
        if (wrap) wrap.style.display = (wrap.style.display === 'none' ? 'block' : 'none');
      };
    }

    /* ------------------------------------------------------------------ Export Suite */
    async function renderCertCanvas() {
      await loadStudioLibs();
      const cert = $('#certCanvas');
      return await window.html2canvas(cert, {
        scale: 2, width: 1123, height: 794, backgroundColor: '#f8f9fa', useCORS: true, logging: false
      });
    }

    function newPdf() {
      return new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    }

    function setProgress(show, pct, text) {
      const wrap = $('#exportProgressWrap'), fill = $('#exportProgressFill'), txt = $('#exportProgressText');
      if (!wrap) return;
      wrap.style.display = show ? 'block' : 'none';
      if (fill && pct != null) fill.style.width = pct + '%';
      if (txt && text) txt.textContent = text;
    }

    async function exportBulk(mode) {
      if (!recipients.length) {
        setProgress(true, 5, 'Checking attendee roster...');
        await loadEventRoster(true);
      }
      if (!recipients.length) {
        setProgress(false);
        const wrap = $('#manualListWrap');
        if (wrap) wrap.style.display = 'block';
        return adminMessage('No attendees found for this event. Click "Paste / CSV" to enter names, or upload attendance in Attendance tab.');
      }
      await loadStudioLibs();
      const prevScale = scaler.style.transform;
      scaler.style.transform = 'scale(1)';
      setProgress(true, 5, `Starting batch export (${recipients.length} certificates)…`);

      try {
        const zip = mode === 'zip' ? new window.JSZip() : null;
        const merged = mode === 'merged' ? newPdf() : null;

        for (let i = 0; i < recipients.length; i++) {
          setProgress(true, Math.round((i / recipients.length) * 100), `Generating ${i + 1} of ${recipients.length}: ${recipients[i].name}`);
          applyRecipient(i);
          await new Promise((r) => setTimeout(r, 80));
          const canvas = await renderCertCanvas();
          const imgData = canvas.toDataURL('image/jpeg', 0.92);

          if (mode === 'zip') {
            const pdf = newPdf();
            pdf.addImage(imgData, 'JPEG', 0, 0, 297, 210);
            const fname = `GDG_Certificate_${recipients[i].name.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
            zip.file(fname, pdf.output('arraybuffer'));
          } else {
            if (i > 0) merged.addPage();
            merged.addImage(imgData, 'JPEG', 0, 0, 297, 210);
          }
        }

        setProgress(true, 98, 'Finalizing download package…');
        if (mode === 'zip') {
          const blob = await zip.generateAsync({ type: 'blob' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = `GDG_Certificates_${Date.now()}.zip`;
          document.body.appendChild(a); a.click(); a.remove();
        } else {
          merged.save(`GDG_Certificates_Batch_${Date.now()}.pdf`);
        }
        setProgress(true, 100, `Done! Generated ${recipients.length} certificates.`);
        setTimeout(() => setProgress(false), 3000);
      } catch (err) {
        adminMessage('Export failed: ' + err.message);
        setProgress(false);
      } finally {
        scaler.style.transform = prevScale;
        applyRecipient(currentRecIndex);
      }
    }

    $('#btnExportZip').onclick = () => exportBulk('zip');
    $('#btnExportMerged').onclick = () => exportBulk('merged');
    $('#btnExportSingle').onclick = async () => {
      await loadStudioLibs();
      const canvas = await renderCertCanvas();
      const pdf = newPdf();
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 297, 210);
      pdf.save(`GDG_Certificate_${$('#cvCertName').textContent.trim().replace(/\s+/g, '_')}.pdf`);
      adminMessage('Certificate PDF downloaded.', true);
    };
    $('#btnExportPng').onclick = async () => {
      await loadStudioLibs();
      const canvas = await renderCertCanvas();
      const a = document.createElement('a'); a.href = canvas.toDataURL('image/png');
      a.download = `GDG_Certificate_${$('#cvCertName').textContent.trim().replace(/\s+/g, '_')}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      adminMessage('High-resolution PNG downloaded.', true);
    };

    /* ------------------------------------------------------------------ Save Settings to Supabase */
    $('#mc-event-select').addEventListener('change', (e) => {
      ctx.keepEvent = e.target.value;
      applyEventToStudio(e.target.value);
    });

    $('#mc-save-config-btn').addEventListener('click', async (e) => {
      const evId = $('#mc-event-select').value;
      if (!evId) return adminMessage('Choose an event first.');
      const enabled = $('#mc-public-toggle').checked;

      // Clean gdg_logo so we don't store duplicate or oversized dataUrls if path exists
      const cleanGdgLogo = { ...currentGdgLogo };
      if (cleanGdgLogo.path && cleanGdgLogo.dataUrl) {
        cleanGdgLogo.dataUrl = ''; // Omit bulky inline dataUrl from DB if path is available
      } else if (cleanGdgLogo.dataUrl && cleanGdgLogo.dataUrl.length > 30000 && typeof Image !== 'undefined') {
        // Compress dataUrl using canvas if it wasn't uploaded to storage
        try {
          const cImg = new Image();
          await new Promise((res) => {
            cImg.onload = () => {
              const canvas = document.createElement('canvas');
              const ratio = Math.min(600 / cImg.width, 200 / cImg.height, 1);
              canvas.width = Math.max(1, Math.round(cImg.width * ratio));
              canvas.height = Math.max(1, Math.round(cImg.height * ratio));
              const cctx = canvas.getContext('2d');
              cctx.drawImage(cImg, 0, 0, canvas.width, canvas.height);
              cleanGdgLogo.dataUrl = canvas.toDataURL('image/png', 0.85);
              res();
            };
            cImg.onerror = res;
            cImg.src = cleanGdgLogo.dataUrl;
          });
        } catch {}
      }
      const gdgLogoUrl = cleanGdgLogo.path || cleanGdgLogo.dataUrl || '';

      // Prepare signatories with computed style and ensure paths/dataUrls are intact
      const preparedSignatories = signatories.map((s) => {
        const scale = Number(s.scale) || 100;
        const nameSize = Number(s.nameSize) || 100;
        const roleSize = Number(s.roleSize) || 100;
        const x = Number(s.x) || 0;
        const y = Number(s.y) || 0;
        return {
          id: s.id || uid(),
          name: (s.name || '').trim(),
          role: (s.role || '').trim(),
          img: s.path || s.img || '',
          path: s.path || '',
          scale,
          nameSize,
          roleSize,
          x,
          y,
          style: `--sig-scale: ${scale / 100}; --sig-name-scale: ${nameSize / 100}; --sig-role-scale: ${roleSize / 100}; --sig-x: ${x}px; --sig-y: ${y}px;`
        };
      });

      const preparedPartners = partners.map((p) => ({
        id: p.id || uid(),
        name: (p.name || '').trim(),
        logo: p.path || p.logo || '',
        path: p.path || '',
        scale: Number(p.scale) || 100,
        style: `--partner-scale: ${(Number(p.scale) || 100) / 100};`
      }));

      const payload = {
        event_name: $('#inpEventName').value.trim(),
        chapter_name: $('#inpChapterName').value.trim() || 'GDG on Campus SR University',
        chapter: $('#inpChapterName').value.trim() || 'GDG on Campus SR University',
        host_chapter: $('#inpChapterName').value.trim() || 'GDG on Campus SR University',
        date: $('#inpEventDate').value.trim(),
        cert_tag: $('#inpCertTag') ? $('#inpCertTag').value.trim() : 'OFFICIAL CREDENTIAL',
        cert_title: $('#inpCertTitle') ? $('#inpCertTitle').value.trim() : 'Certificate of Participation',
        syllabus: $('#inpSyllabus').value.trim(),
        syllabus_status: $('#inpSyllabusStatus') ? $('#inpSyllabusStatus').value.trim() : 'STATUS: COMPLETED',
        track: $('#inpTrack').value.trim(),
        skills: $('#inpSkills').value.split(',').map((x) => ({ tag: x.trim() })).filter((x) => x.tag),
        dev_tag: $('#inpDevTag') ? $('#inpDevTag').value.trim() : '#GoogleDeveloper',
        node_pill: $('#inpNodePill') ? $('#inpNodePill').value.trim() : 'NODE_ACTIVE // 2026',
        dossier_tag: $('#inpDossierTag') ? $('#inpDossierTag').value.trim() : 'BUILD_WITH_AI',
        partner_sticker: $('#inpPartnerSticker') ? $('#inpPartnerSticker').value.trim() : '#SRU_ACM // CO-HOST',
        signatories: preparedSignatories,
        partners: preparedPartners,
        gdg_logo: cleanGdgLogo,
        gdg_custom_logo: gdgLogoUrl,
        gdg_logo_style: `height:${cleanGdgLogo.size || 60}px;max-height:${cleanGdgLogo.size || 60}px;max-width:${Math.max(320, Math.round((cleanGdgLogo.size || 60) * 5))}px;object-fit:contain;display:block;transform:translate(${cleanGdgLogo.x || 0}px,${cleanGdgLogo.y || 0}px);`,
        hide_chapter_text: !!cleanGdgLogo.hide_chapter_text
      };

      // Safeguard against column size limit (< 200,000 bytes) without wiping images
      if (JSON.stringify(payload).length > 180000) {
        if (cleanGdgLogo.dataUrl && cleanGdgLogo.path) {
          cleanGdgLogo.dataUrl = '';
          payload.gdg_logo = cleanGdgLogo;
          if (payload.gdg_custom_logo.startsWith('data:')) payload.gdg_custom_logo = cleanGdgLogo.path;
        }
        payload.signatories = payload.signatories.map((s) => ({
          ...s,
          img: s.path || (s.img && s.img.length > 50000 ? '' : s.img)
        }));
        payload.partners = payload.partners.map((p) => ({
          ...p,
          logo: p.path || (p.logo && p.logo.length > 50000 ? '' : p.logo)
        }));
      }

      e.target.disabled = true;
      try {
        const { error } = await sb.from('certificate_configs').upsert({
          event_id: evId,
          enabled,
          fields: payload,
          updated_at: new Date().toISOString()
        });
        if (error) throw error;
        await audit('update', 'certificate_configs', evId);
        adminMessage(`Certificate settings saved to Supabase for ${$('#inpEventName').value}!`, true);
        configs[evId] = { event_id: evId, enabled, fields: payload };
      } catch (err) {
        console.error('Certificate Studio save error:', err);
        adminMessage(authErrorText(err));
      } finally {
        e.target.disabled = false;
      }
    });

    /* ------------------------------------------------------------------ Advanced Templates */
    const tf = $('#tpl-form'), html = $('#tpl-html');
    $('#tpl-builtin').onclick = async () => {
      try {
        const r = await fetch('/assets/data/certificate-default-template.html', { cache: 'no-cache' });
        if (!r.ok) throw new Error();
        html.value = await r.text();
        if (!tf.elements.name.value) tf.elements.name.value = 'GDG SRU Master Template';
        adminMessage('Loaded Master HTML Template into editor.', true);
      } catch { adminMessage('Could not load built-in HTML template.'); }
    };
    $('#tpl-file').onchange = async (e) => {
      const f = e.target.files?.[0]; if (!f) return;
      html.value = await f.text();
      if (!tf.elements.name.value) tf.elements.name.value = f.name.replace(/\.[^.]+$/, '');
    };
    $('#tpl-reset').onclick = () => { tf.reset(); tf.elements.id.value = ''; };
    $$('[data-tpl-edit]').forEach((b) => b.onclick = () => {
      const t = templates.find((x) => x.id === b.dataset.tplEdit); if (!t) return;
      tf.elements.id.value = t.id; tf.elements.name.value = t.name; html.value = t.html_template;
      tf.elements.is_active.checked = t.is_active;
      tf.closest('details').open = true;
      tf.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    $$('[data-tpl-activate]').forEach((b) => b.onclick = async () => {
      try {
        const { error } = await sb.rpc('activate_certificate_template', { p_template_id: b.dataset.tplActivate });
        if (error) throw error;
        await audit('update', 'certificate_templates', b.dataset.tplActivate);
        await rerender();
        adminMessage('Template activated.', true);
      } catch (e) { adminMessage(authErrorText(e)); }
    });
    $$('[data-tpl-delete]').forEach((b) => b.onclick = async () => {
      if (!confirm('Delete this template?')) return;
      const r = await sb.from('certificate_templates').delete().eq('id', b.dataset.tplDelete);
      if (r.error) return adminMessage(authErrorText(r.error));
      await audit('delete', 'certificate_templates', b.dataset.tplDelete);
      await rerender();
      adminMessage('Template deleted.', true);
    });
    tf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = tf.elements.id.value, name = tf.elements.name.value.trim(), tpl = html.value;
      if (!tpl.trim()) return adminMessage('Template HTML is empty.');
      try {
        const payload = { name, html_template: tpl, updated_at: new Date().toISOString() };
        const r = id ? await sb.from('certificate_templates').update(payload).eq('id', id).select('id').single() : await sb.from('certificate_templates').insert({ ...payload, is_active: false }).select('id').single();
        if (r.error) throw r.error;
        if (tf.elements.is_active.checked) await sb.rpc('activate_certificate_template', { p_template_id: r.data.id });
        await audit(id ? 'update' : 'create', 'certificate_templates', r.data.id);
        await rerender();
        adminMessage('Template saved to Supabase.', true);
      } catch (err) { adminMessage(authErrorText(err)); }
    });

    initGdgLogoControls();
    if (selectedEventId) applyEventToStudio(selectedEventId);
    setTimeout(fitCanvas, 50);
  }

  window.GDGCertAdmin = { renderCertificates, renderAttendance, parseNames, importNames };
})();
