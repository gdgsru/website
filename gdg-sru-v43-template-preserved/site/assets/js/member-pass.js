/* GDG SRU · Official Member Pass Preview Banner
   Mounted seamlessly on /join/ without cluttering the page.
   Clicking the preview or CTA launches the full dedicated /member-badge/ studio.
*/
(() => {
  'use strict';

  const STUDIO_URL = '/member-badge/';
  const CHAPTER_URL = 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/';

  function injectBannerStyles() {
    if (document.getElementById('gdg-pass-banner-styles')) return;
    const style = document.createElement('style');
    style.id = 'gdg-pass-banner-styles';
    style.textContent = `
      /* ---- Member Pass Teaser Banner on /join/ ---- */
      .gdg-pass-teaser {
        margin: 28px 0 !important;
        position: relative !important;
        overflow: hidden !important;
        border-radius: 28px !important;
        border: 1.5px solid #d5daee !important;
        background: #ffffff !important;
        box-shadow: 0 16px 40px -15px rgba(10, 15, 40, 0.08) !important;
        padding: clamp(24px, 4vw, 40px) !important;
        transition: background 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease !important;
      }
      [data-theme="dark"] .gdg-pass-teaser {
        background: #141722 !important;
        border: 1.5px solid rgba(255, 255, 255, 0.12) !important;
        box-shadow: 0 20px 60px -15px rgba(0, 0, 0, 0.5) !important;
      }

      .gdg-pass-grid {
        display: grid !important;
        grid-template-columns: 1.15fr 0.85fr !important;
        gap: clamp(28px, 4vw, 48px) !important;
        align-items: center !important;
      }
      @media (max-width: 860px) {
        .gdg-pass-grid { grid-template-columns: 1fr !important; }
      }

      /* Left Content */
      .gdg-pass-info { display: flex !important; flex-direction: column !important; }
      .gdg-pass-pill {
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        background: #eef1fb !important;
        border: 1px solid #d5daee !important;
        border-radius: 999px !important;
        padding: 6px 14px !important;
        font: 700 11px "JetBrains Mono", monospace !important;
        letter-spacing: 1.2px !important;
        color: #4285F4 !important;
        width: fit-content !important;
        margin-bottom: 14px !important;
        text-transform: uppercase !important;
      }
      [data-theme="dark"] .gdg-pass-pill {
        background: rgba(66, 133, 244, 0.12) !important;
        border-color: rgba(66, 133, 244, 0.28) !important;
        color: #6ba4ff !important;
      }
      .gdg-pass-dots { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 3px !important; }
      .gdg-pass-dots i { width: 5.5px !important; height: 5.5px !important; border-radius: 50% !important; display: block !important; }

      .gdg-pass-title {
        font: 800 clamp(24px, 3.2vw, 36px)/1.15 "Space Grotesk", Inter, system-ui, sans-serif !important;
        color: #111 !important;
        letter-spacing: -0.6px !important;
        margin: 0 0 12px 0 !important;
      }
      [data-theme="dark"] .gdg-pass-title { color: #ffffff !important; }

      .gdg-pass-desc {
        font-size: 15.5px !important;
        line-height: 1.55 !important;
        color: #5f6368 !important;
        margin: 0 0 20px 0 !important;
        max-width: 540px !important;
      }
      [data-theme="dark"] .gdg-pass-desc { color: #a8abb0 !important; }

      .gdg-pass-chips {
        display: flex !important;
        gap: 8px !important;
        flex-wrap: wrap !important;
        margin-bottom: 24px !important;
      }
      .gdg-pass-chips span {
        font: 600 12px "JetBrains Mono", monospace !important;
        padding: 5px 12px !important;
        border-radius: 999px !important;
        background: #f4f6fc !important;
        border: 1px solid #d5daee !important;
        color: #111 !important;
        letter-spacing: 0.3px !important;
      }
      [data-theme="dark"] .gdg-pass-chips span {
        background: rgba(255, 255, 255, 0.05) !important;
        border-color: rgba(255, 255, 255, 0.12) !important;
        color: #e4e9f7 !important;
      }

      .gdg-pass-actions {
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        flex-wrap: wrap !important;
      }
      .gdg-btn-launch {
        background: #4285F4 !important;
        color: #fff !important;
        border: 0 !important;
        padding: 13px 24px !important;
        border-radius: 999px !important;
        font: 700 15px Inter, sans-serif !important;
        text-decoration: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 8px !important;
        box-shadow: 0 10px 24px -6px rgba(66, 133, 244, 0.5) !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease !important;
      }
      .gdg-btn-launch:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 14px 28px -6px rgba(66, 133, 244, 0.65) !important;
      }
      .gdg-btn-gateway {
        background: transparent !important;
        color: #111 !important;
        border: 1.5px solid #d5daee !important;
        padding: 12px 20px !important;
        border-radius: 999px !important;
        font: 600 14px Inter, sans-serif !important;
        text-decoration: none !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 6px !important;
        transition: border-color 0.15s ease, background 0.15s ease !important;
      }
      [data-theme="dark"] .gdg-btn-gateway {
        color: #fff !important;
        border-color: rgba(255, 255, 255, 0.18) !important;
      }
      .gdg-btn-gateway:hover {
        border-color: #4285F4 !important;
      }

      /* Right Miniature Interactive Pass */
      .gdg-pass-visual {
        display: flex !important;
        justify-content: center !important;
        align-items: center !important;
        perspective: 900px !important;
      }
      .gdg-mini-card-link {
        text-decoration: none !important;
        display: block !important;
        transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      .gdg-mini-card-link:hover {
        transform: translateY(-6px) rotate(1.5deg) scale(1.02) !important;
      }

      .gdg-mini-pass {
        width: min(290px, 80vw) !important;
        border-radius: 24px !important;
        padding: 0 0 16px 0 !important;
        overflow: hidden !important;
        position: relative !important;
        color: #fff !important;
        background:
          radial-gradient(110% 55% at 100% 0%, rgba(66, 133, 244, 0.4), transparent 60%),
          radial-gradient(90% 50% at 0% 100%, rgba(234, 67, 53, 0.3), transparent 60%),
          radial-gradient(70% 40% at 50% 50%, rgba(52, 168, 83, 0.15), transparent 70%),
          linear-gradient(160deg, #10152e, #070a18) !important;
        box-shadow: 0 30px 60px -20px rgba(7, 10, 24, 0.7), 0 0 0 1.5px rgba(255, 255, 255, 0.15) inset !important;
      }
      .gdg-mini-pass::after {
        content: "" !important; position: absolute !important; inset: 0 !important; z-index: 1 !important; pointer-events: none !important; opacity: 0.45 !important;
        background-image: linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px) !important;
        background-size: 20px 20px !important;
      }
      .gdg-mini-pass > * { position: relative !important; z-index: 2 !important; }

      .gdg-mini-slot { width: 56px !important; height: 9px !important; border-radius: 99px !important; margin: 12px auto 0 !important; background: rgba(0, 0, 0, 0.6) !important; box-shadow: inset 0 1px 3px #000, 0 1px 0 rgba(255, 255, 255, 0.12) !important; }
      .gdg-mini-bar { display: flex !important; height: 5px !important; margin-top: 10px !important; }
      .gdg-mini-bar i { flex: 1 !important; }
      .gdg-mini-bar i:nth-child(1) { background: #4285F4 !important; }
      .gdg-mini-bar i:nth-child(2) { background: #EA4335 !important; }
      .gdg-mini-bar i:nth-child(3) { background: #FBBC04 !important; }
      .gdg-mini-bar i:nth-child(4) { background: #34A853 !important; }

      .gdg-mini-top { padding: 14px 18px 0 !important; display: flex !important; align-items: center !important; gap: 8px !important; }
      .gdg-mini-dots { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 3px !important; }
      .gdg-mini-dots b { width: 8px !important; height: 8px !important; border-radius: 50% !important; display: block !important; }
      .gdg-mini-dots b:nth-child(1) { background: #4285F4 !important; }
      .gdg-mini-dots b:nth-child(2) { background: #EA4335 !important; }
      .gdg-mini-dots b:nth-child(3) { background: #FBBC04 !important; }
      .gdg-mini-dots b:nth-child(4) { background: #34A853 !important; }
      .gdg-mini-brandtxt b { display: block !important; font: 700 13px "Space Grotesk", sans-serif !important; line-height: 1.1 !important; color: #fff !important; }
      .gdg-mini-brandtxt span { display: flex !important; align-items: center !important; gap: 4px !important; margin-top: 3px !important; font: 700 9px "JetBrains Mono", monospace !important; letter-spacing: 0.8px !important; color: #fff !important; }
      .gdg-mini-brandtxt u { text-decoration: none !important; background: #FBBC04 !important; color: #111 !important; padding: 1.5px 5px !important; border-radius: 4px !important; }

      .gdg-mini-hero { padding: 14px 18px 10px !important; text-align: center !important; }
      .gdg-mini-ring {
        width: 86px !important; height: 86px !important; border-radius: 50% !important; padding: 3px !important; margin: 0 auto !important;
        background: conic-gradient(#4285F4, #EA4335, #FBBC04, #34A853, #4285F4) !important;
        box-shadow: 0 0 35px rgba(66, 133, 244, 0.5) !important;
      }
      .gdg-mini-av {
        width: 100% !important; height: 100% !important; border-radius: 50% !important; background: #1b2140 !important;
        display: grid !important; place-items: center !important; font-size: 42px !important; border: 3px solid #10152e !important;
      }
      .gdg-mini-name {
        font: 700 20px "Space Grotesk", Inter, sans-serif !important; margin-top: 10px !important;
        letter-spacing: -0.4px !important;
        background: linear-gradient(90deg, #fff, #cfe0ff 50%, #fff) !important;
        -webkit-background-clip: text !important; background-clip: text !important; color: transparent !important;
      }
      .gdg-mini-track {
        display: inline-flex !important; align-items: center !important; gap: 6px !important; margin-top: 8px !important;
        padding: 5px 12px !important; border-radius: 99px !important; font-weight: 700 !important; font-size: 11px !important;
        background: linear-gradient(90deg, rgba(66, 133, 244, 0.25), rgba(234, 67, 53, 0.25)) !important;
        border: 1px solid rgba(255, 255, 255, 0.2) !important;
        color: #fff !important;
      }

      .gdg-mini-perf { position: relative !important; height: 22px !important; margin-top: 8px !important; }
      .gdg-mini-perf::before, .gdg-mini-perf::after {
        content: "" !important; position: absolute !important; top: 0 !important; width: 22px !important; height: 22px !important;
        border-radius: 50% !important; background: #ffffff !important;
      }
      [data-theme="dark"] .gdg-mini-perf::before,
      [data-theme="dark"] .gdg-mini-perf::after { background: #141722 !important; }
      .gdg-mini-perf::before { left: -11px !important; }
      .gdg-mini-perf::after { right: -11px !important; }
      .gdg-mini-perf hr { position: absolute !important; top: 10px !important; left: 18px !important; right: 18px !important; border: 0 !important; border-top: 1.5px dashed rgba(255, 255, 255, 0.25) !important; margin: 0 !important; }

      .gdg-mini-foot { display: flex !important; justify-content: space-between !important; align-items: center !important; padding: 2px 18px 4px !important; }
      .gdg-mini-foot small { display: block !important; font: 500 8px "JetBrains Mono", monospace !important; letter-spacing: 0.8px !important; color: #98a2cc !important; }
      .gdg-mini-foot strong { display: block !important; font-size: 12px !important; margin-top: 2px !important; color: #fff !important; }
      .gdg-mini-qr { width: 52px !important; height: 52px !important; background: #fff !important; border-radius: 8px !important; padding: 4px !important; }
      .gdg-mini-qr svg { width: 100% !important; height: 100% !important; display: block !important; }

      .gdg-mini-overlay-badge {
        position: absolute !important;
        bottom: 12px !important;
        right: 14px !important;
        background: #4285F4 !important;
        color: #fff !important;
        font: 700 11px Inter, sans-serif !important;
        padding: 5px 12px !important;
        border-radius: 999px !important;
        box-shadow: 0 4px 14px rgba(66, 133, 244, 0.6) !important;
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
        z-index: 5 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function renderPreviewBanner(container) {
    if (document.getElementById('gdg-pass-teaser')) return;
    injectBannerStyles();

    const banner = document.createElement('section');
    banner.className = 'gdg-pass-teaser';
    banner.id = 'gdg-pass-teaser';
    banner.setAttribute('aria-label', 'Claim Your Official GDG Member Pass');

    banner.innerHTML = `
      <div class="gdg-pass-grid">
        <!-- Left Column: Pitch & Action -->
        <div class="gdg-pass-info">
          <div class="gdg-pass-pill">
            <span class="gdg-pass-dots" aria-hidden="true">
              <i style="background:#4285F4"></i>
              <i style="background:#EA4335"></i>
              <i style="background:#FBBC04"></i>
              <i style="background:#34A853"></i>
            </span>
            OFFICIAL MEMBER CREDENTIAL · 2026
          </div>
          <h2 class="gdg-pass-title">Claim your 3D Member Pass &amp; LinkedIn Card</h2>
          <p class="gdg-pass-desc">
            Joined our chapter on Google Community Dev? Flex your membership with a customized 3D holographic conference pass and a ready-to-share 1200×627 LinkedIn banner.
          </p>
          <div class="gdg-pass-chips">
            <span>✦ 3D Interactive Foil</span>
            <span>✦ Custom Tech Track</span>
            <span>✦ Procedural QR</span>
            <span>✦ 1-Click LinkedIn Export</span>
          </div>
          <div class="gdg-pass-actions">
            <a class="gdg-btn-launch" href="${STUDIO_URL}">
              Launch Member Pass Studio <span aria-hidden="true">↗</span>
            </a>
            <a class="gdg-btn-gateway" href="${CHAPTER_URL}" target="_blank" rel="noopener">
              Join Official Chapter ↗
            </a>
          </div>
        </div>

        <!-- Right Column: Interactive Visual Card Preview -->
        <div class="gdg-pass-visual">
          <a href="${STUDIO_URL}" class="gdg-mini-card-link" title="Open Full 3D Member Pass Studio">
            <div class="gdg-mini-pass">
              <div class="gdg-mini-slot"></div>
              <div class="gdg-mini-bar"><i></i><i></i><i></i><i></i></div>
              <div class="gdg-mini-top">
                <span class="gdg-mini-dots"><b></b><b></b><b></b><b></b></span>
                <div class="gdg-mini-brandtxt">
                  <b>Google Developer Group</b>
                  <span><u>on Campus</u>SR UNIVERSITY</span>
                </div>
              </div>
              <div class="gdg-mini-hero">
                <div class="gdg-mini-ring"><div class="gdg-mini-av">&lt;/&gt;</div></div>
                <div class="gdg-mini-name">SRU Developer</div>
                <div class="gdg-mini-track">Web &amp; AI Track</div>
              </div>
              <div class="gdg-mini-perf"><hr></div>
              <div class="gdg-mini-foot">
                <div>
                  <small>GOOGLE DEVELOPER GROUP</small>
                  <strong>SR University · 2026</strong>
                </div>
                <div class="gdg-mini-qr">
                  <svg viewBox="0 0 21 21" shape-rendering="crispEdges">
                    <rect x="0" y="0" width="7" height="7" fill="#070a18"/><rect x="1" y="1" width="5" height="5" fill="#fff"/><rect x="2" y="2" width="3" height="3" fill="#070a18"/>
                    <rect x="14" y="0" width="7" height="7" fill="#070a18"/><rect x="15" y="1" width="5" height="5" fill="#fff"/><rect x="16" y="2" width="3" height="3" fill="#070a18"/>
                    <rect x="0" y="14" width="7" height="7" fill="#070a18"/><rect x="1" y="15" width="5" height="5" fill="#fff"/><rect x="2" y="16" width="3" height="3" fill="#070a18"/>
                    <rect x="9" y="3" width="2" height="3" fill="#070a18"/><rect x="9" y="9" width="3" height="3" fill="#070a18"/><rect x="3" y="9" width="3" height="2" fill="#070a18"/><rect x="15" y="9" width="3" height="3" fill="#070a18"/><rect x="9" y="15" width="3" height="2" fill="#070a18"/>
                  </svg>
                </div>
              </div>
              <div class="gdg-mini-overlay-badge">Customize ↗</div>
            </div>
          </a>
        </div>
      </div>
    `;

    // Insert right before contact section if present, else after page intro
    const contactSec = document.querySelector('.join-contact-section');
    if (contactSec) {
      contactSec.before(banner);
    } else {
      const pageIntro = document.querySelector('.page-intro');
      if (pageIntro) {
        pageIntro.after(banner);
      } else {
        const app = document.querySelector('#app') || document.body;
        app.appendChild(banner);
      }
    }
  }

  function checkMount() {
    const isJoin = document.body && (document.body.dataset.route === 'join' || location.pathname.includes('/join'));
    if (!isJoin) return;
    if (document.getElementById('gdg-pass-teaser')) return;

    const mainApp = document.querySelector('#app');
    if (!mainApp) return;

    const targetSec = mainApp.querySelector('.reference-card') || mainApp.querySelector('.join-contact-section') || mainApp.querySelector('.page-intro');
    if (targetSec) {
      renderPreviewBanner(mainApp);
    } else {
      setTimeout(checkMount, 120);
    }
  }

  window.addEventListener('DOMContentLoaded', checkMount);
  const obs = new MutationObserver(checkMount);
  if (document.body) {
    obs.observe(document.body, { childList: true, subtree: true });
  }

  window.openMemberPassStudio = () => {
    location.assign(STUDIO_URL);
  };
})();
