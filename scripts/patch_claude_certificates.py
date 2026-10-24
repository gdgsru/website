import os
import re

src_path = 'files/certificates-admin.js'
with open(src_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 0. Safe esc fallback
safe_esc_target = "  const G = window.GDGCert;\n  const esc = G.esc;"
safe_esc_repl = "  const G = window.GDGCert || {};\n  const esc = G.esc || ((s) => String(s ?? '').replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' }[c])));"
if safe_esc_target in content:
    content = content.replace(safe_esc_target, safe_esc_repl)

# 1. Styles
style_target = ".main-logo-area svg { width: 72px; height: auto; flex: none; filter: drop-shadow(2px 2px 0px rgba(15,23,42,0.12)); }"
style_repl = """        .main-logo-area { display: flex; align-items: center; gap: 16px; position: relative; z-index: 10; }
        .main-logo-area svg { width: 72px; height: auto; flex: none; filter: drop-shadow(2px 2px 0px rgba(15,23,42,0.12)); }
        .gdg-logo-interactive { cursor: grab; touch-action: none; user-select: none; }
        .gdg-logo-interactive.dragging { cursor: grabbing !important; }
        .custom-gdg-logo-img { max-width: 340px; object-fit: contain; display: block; }"""
assert style_target in content, "style_target not found"
content = content.replace(style_target, style_repl)

# 2. Form controls
form_target = """              <div class="mc-form-row">
                <div class="mc-form-group">
                  <label>Chapter Name</label>
                  <input type="text" id="inpChapterName" value="GDG Chapter Name">
                </div>
                <div class="mc-form-group">
                  <label>Event Date</label>
                  <input type="text" id="inpEventDate" value="October 4, 2026">
                </div>
              </div>"""

form_repl = form_target + """

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
              </div>"""
assert form_target in content, "form_target not found"
content = content.replace(form_target, form_repl)

# 3. Canvas header row
canvas_target = """                  <div class="header-row">
                    <div class="main-logo-area">
                      <svg id="cvDefLogo" viewBox="0 0 100 60">
                        <path d="M40,10 L10,30 L40,50" fill="none" stroke="#4285F4" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M60,10 L90,30 L60,50" fill="none" stroke="#34A853" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      <div class="logo-text">
                        <h1>Google Developer Groups</h1>
                        <h2 contenteditable="true" spellcheck="false" id="cvChapterHead">On Campus SR University</h2>
                      </div>
                    </div>"""

canvas_repl = """                  <div class="header-row">
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
                    </div>"""
assert canvas_target in content, "canvas_target not found"
content = content.replace(canvas_target, canvas_repl)

# 4. Zoom button 125%
zoom_target = '<button type="button" class="mc-p-btn" data-zoom="100">100%</button>'
zoom_repl = '<button type="button" class="mc-p-btn" data-zoom="100">100%</button>\n                <button type="button" class="mc-p-btn" data-zoom="125">125%</button>'
assert zoom_target in content, "zoom_target not found"
content = content.replace(zoom_target, zoom_repl)

# 5. Add GDG Logo State Variable at start of renderCertificates
state_target = "    const selectedEventId = ctx.keepEvent || (events[0]?.id || '');"
state_repl = """    const selectedEventId = ctx.keepEvent || (events[0]?.id || '');
    let currentGdgLogo = { dataUrl: '', path: '', size: 60, x: 0, y: 0, hide_chapter_text: false };"""
assert state_target in content, "state_target not found"
content = content.replace(state_target, state_repl)

# 6. Apply GDG Logo in applyEventToStudio
apply_target = "      renderSignatories();\n      renderPartners();\n      fitName();"
apply_repl = """      // Apply GDG Logo configuration
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
      fitName();"""
assert apply_target in content, "apply_target not found"
content = content.replace(apply_target, apply_repl)

# 7. Add helper functions: applyGdgLogo, enableLogoDrag, initGdgLogoControls
helper_funcs = """
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
        inp.onchange = (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (ev) => {
            currentGdgLogo.dataUrl = ev.target.result;
            applyGdgLogo();
            adminMessage('Custom GDG logo loaded! Drag on preview or use sliders to adjust.', true);

            try {
              const ext = file.name.split('.').pop() || 'png';
              const path = `logos/${selectedEventId || 'common'}/gdg_logo_${Date.now()}.${ext}`;
              if (window.MC?.uploadStorage) {
                await window.MC.uploadStorage('certificate-logos', path, file, { isPublic: true, contentType: file.type });
                currentGdgLogo.path = path;
              } else if (sb?.storage) {
                await sb.storage.from('certificate-logos').upload(path, file, { upsert: true });
                currentGdgLogo.path = path;
              }
            } catch (err) {
              console.warn('Storage background upload notice:', err);
            }
          };
          reader.readAsDataURL(file);
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
"""

anchor_helpers = "    /* ------------------------------------------------------------------ Zoom & Canvas Fit */"
assert anchor_helpers in content, "anchor_helpers not found"
content = content.replace(anchor_helpers, helper_funcs + "\n" + anchor_helpers)

# 8. Save config payload update
save_target = """        signatories,
        partners
      };"""

save_repl = """        signatories,
        partners,
        gdg_logo: currentGdgLogo,
        gdg_custom_logo: currentGdgLogo.dataUrl || currentGdgLogo.path || '',
        gdg_logo_style: `height:${currentGdgLogo.size || 60}px;max-height:${currentGdgLogo.size || 60}px;max-width:${Math.max(320, Math.round((currentGdgLogo.size || 60) * 5))}px;object-fit:contain;display:block;transform:translate(${currentGdgLogo.x || 0}px,${currentGdgLogo.y || 0}px);`,
        hide_chapter_text: !!currentGdgLogo.hide_chapter_text
      };"""
assert save_target in content, "save_target not found"
content = content.replace(save_target, save_repl)

# 9. Call initGdgLogoControls at end of renderCertificates
end_target = "    if (selectedEventId) applyEventToStudio(selectedEventId);\n    setTimeout(fitCanvas, 50);\n  }"
end_repl = """    initGdgLogoControls();
    if (selectedEventId) applyEventToStudio(selectedEventId);
    setTimeout(fitCanvas, 50);
  }"""
assert end_target in content, "end_target not found"
content = content.replace(end_target, end_repl)

# 10. Ensure export has importNames
export_target = "window.GDGCertAdmin = { renderCertificates, renderAttendance, parseNames };"
export_repl = "window.GDGCertAdmin = { renderCertificates, renderAttendance, parseNames, importNames };"
if export_target in content:
    content = content.replace(export_target, export_repl)

# Write to destinations
dest1 = 'cloudflare-pages-site/assets/admin/certificates-admin.js'
dest2 = 'deployment/website/assets/admin/certificates-admin.js'

with open(dest1, 'w', encoding='utf-8') as f:
    f.write(content)
with open(dest2, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Successfully patched and written to {dest1} and {dest2}! Final length: {len(content)}")
