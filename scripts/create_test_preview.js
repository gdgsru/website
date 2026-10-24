const fs = require('fs');

const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mobile Cards Comparison</title>
<link rel="stylesheet" href="file:///d:/Drafts/Blogs/website/cloudflare-pages-site/assets/css/page-home.css">
<style>
  body {
    background: #f8f9fa;
    padding: 16px;
    font-family: 'Google Sans', sans-serif;
    max-width: 420px;
    margin: 0 auto;
  }
  .section-label {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #5f6368;
    margin: 24px 0 8px;
    padding-bottom: 4px;
    border-bottom: 2px solid #e8eaed;
  }
  .test-title {
    font-size: 22px;
    font-weight: 800;
    margin: 4px 0 16px;
    letter-spacing: -0.03em;
  }
  
  /* FIXED TRACK CARDS CSS */
  @media (max-width: 680px) {
    /* Hide the cluttered action buttons and explore link on mobile */
    .g16-tl .g16-tl-acts {
      display: none !important;
    }
    .g16-tl .g16-tl-more {
      display: none !important;
    }
    /* Show clean number badge in top-left */
    .g16-tl .g16-tl-num {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 26px !important;
      height: 22px !important;
      padding: 0 8px !important;
      font-size: 10.5px !important;
      font-weight: 800 !important;
      border-radius: 99px !important;
      background: rgba(255,255,255,0.85) !important;
      color: #1f1f23 !important;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08) !important;
      letter-spacing: 0.02em !important;
    }
    :root[data-theme="dark"] .g16-tl .g16-tl-num {
      background: rgba(255,255,255,0.15) !important;
      color: #fff !important;
    }
    /* Event ticket container: MUST BE 1 COLUMN FULL WIDTH */
    .g16-row.g16-tickets,
    [data-runtime-events],
    .editorial-grid.g16-row.g16-tickets {
      grid-template-columns: 1fr !important;
      gap: 14px !important;
    }
    .g16-tk {
      grid-column: 1 / -1 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    .g16-tk-card {
      grid-template-columns: 1fr 110px !important;
      min-height: 180px !important;
      border-radius: 20px !important;
    }
    .g16-tk-main {
      padding: 16px 14px 16px 18px !important;
      gap: 6px !important;
    }
    .g16-tk-main h3 {
      font-size: 19px !important;
      line-height: 1.15 !important;
      letter-spacing: -0.03em !important;
    }
    .g16-tk-main p {
      font-size: 12px !important;
    }
    .g16-tk-kind {
      font-size: 10.5px !important;
      padding: 3px 8px !important;
    }
    .g16-tk-speaker {
      margin: 2px 0 4px !important;
      font-size: 11.5px !important;
    }
    .g16-tk-speaker small {
      font-size: 8.5px !important;
    }
    .g16-tk-cd {
      gap: 4px !important;
      margin-top: 4px !important;
    }
    .g16-tk-cd span {
      max-width: none !important;
      padding: 4px 2px !important;
      font-size: 8.5px !important;
      border-radius: 6px !important;
    }
    .g16-tk-cd b {
      font-size: 15px !important;
      margin-bottom: 2px !important;
    }
    .g16-tk-img {
      max-height: 48px !important;
      width: auto !important;
      border-radius: 8px !important;
    }
    .g16-tk-stub {
      padding: 14px 8px !important;
      gap: 4px !important;
    }
    .g16-tk-d {
      font-size: 38px !important;
      line-height: 0.95 !important;
    }
    .g16-tk-m {
      font-size: 12px !important;
      letter-spacing: 0.1em !important;
    }
    .g16-tk-btn {
      padding: 7px 12px !important;
      font-size: 11.5px !important;
      white-space: nowrap !important;
      margin-top: 2px !important;
    }
    .g16-tk-no {
      font-size: 9.5px !important;
    }
  }
</style>
</head>
<body>

  <div class="section-label">Section 1: Pick your track (FIXED 2x2 Bento)</div>
  <h2 class="test-title">Pick your track <sup>04</sup></h2>
  
  <div class="g16-row">
    <!-- Cloud -->
    <div class="g16-tl g16-tl-b">
      <div class="g16-tl-card">
        <div class="g16-tl-glass">
          <div class="g16-tl-content">
            <span class="g16-tl-title">Cloud</span>
            <span class="g16-tl-text">Google Cloud, Skills Boost and deployment.</span>
          </div>
          <div class="g16-tl-bottom">
            <span class="g16-tl-num">01</span>
          </div>
        </div>
        <div class="g16-tl-logo" aria-hidden="true">
          <span class="g16-tl-c g16-tl-c5">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/></svg>
          </span>
        </div>
      </div>
    </div>

    <!-- AI / ML -->
    <div class="g16-tl g16-tl-r">
      <div class="g16-tl-card">
        <div class="g16-tl-glass">
          <div class="g16-tl-content">
            <span class="g16-tl-title">AI / ML</span>
            <span class="g16-tl-text">Gemini, AI Studio and applied ML.</span>
          </div>
          <div class="g16-tl-bottom">
            <span class="g16-tl-num">02</span>
          </div>
        </div>
        <div class="g16-tl-logo" aria-hidden="true">
          <span class="g16-tl-c g16-tl-c5">
            <svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z"/></svg>
          </span>
        </div>
      </div>
    </div>

    <!-- Web / Mobile -->
    <div class="g16-tl g16-tl-y">
      <div class="g16-tl-card">
        <div class="g16-tl-glass">
          <div class="g16-tl-content">
            <span class="g16-tl-title">Web / Mobile</span>
            <span class="g16-tl-text">Frontend, Android and full stack.</span>
          </div>
          <div class="g16-tl-bottom">
            <span class="g16-tl-num">03</span>
          </div>
        </div>
        <div class="g16-tl-logo" aria-hidden="true">
          <span class="g16-tl-c g16-tl-c5">
            <svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M11 18.5h2" stroke="currentColor" stroke-width="2"/></svg>
          </span>
        </div>
      </div>
    </div>

    <!-- Open Source -->
    <div class="g16-tl g16-tl-g">
      <div class="g16-tl-card">
        <div class="g16-tl-glass">
          <div class="g16-tl-content">
            <span class="g16-tl-title">Open Source</span>
            <span class="g16-tl-text">Git, GitHub and collaborative development.</span>
          </div>
          <div class="g16-tl-bottom">
            <span class="g16-tl-num">04</span>
          </div>
        </div>
        <div class="g16-tl-logo" aria-hidden="true">
          <span class="g16-tl-c g16-tl-c5">
            <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5" fill="currentColor"/><circle cx="6" cy="18" r="2.5" fill="currentColor"/><circle cx="18" cy="8" r="2.5" fill="currentColor"/><path d="M6 8.5v7M18 10.5c0 4-6 3-11 6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </span>
        </div>
      </div>
    </div>
  </div>

  <div class="section-label" style="margin-top: 36px;">Section 2: Event Ticket Card (FIXED Full-Width)</div>
  <h2 class="test-title">Upcoming Event</h2>

  <div class="g16-row g16-tickets">
    <article class="g16-tk" style="--a: #4285f4;">
      <div class="g16-tk-card">
        <div class="g16-tk-main">
          <div class="g16-tk-meta">
            <span class="g16-tk-kind">Cloud · Live Now</span>
            <span class="g16-tk-badge live" style="background:#ea4335!important;color:#fff!important;display:inline-flex;align-items:center;gap:4px;font-weight:700">
              <span style="width:6px;height:6px;border-radius:50%;background:#fff;display:inline-block"></span> LIVE
            </span>
          </div>
          <h3><a href="#" style="color:inherit;text-decoration:none">Learn With Communities</a></h3>
          <p>4:00 pm, In-Person</p>
          <div class="g16-tk-speaker">
            <small>Speaker</small>
            <b>Narayan Bora</b>
          </div>
          <div class="g16-tk-live-bar" style="display:flex;align-items:center;gap:6px;font-size:11px;font-weight:700;color:#ea4335">
            <small style="font-family:monospace;text-transform:uppercase">ENDS IN</small>
            <div class="g16-tk-cd" style="display:flex;gap:4px">
              <span><b>6</b>day</span>
              <span><b>23</b>hrs</span>
              <span><b>42</b>min</span>
              <span><b>18</b>sec</span>
            </div>
          </div>
        </div>
        <div class="g16-tk-stub">
          <span class="g16-tk-d">19</span>
          <span class="g16-tk-m">OCT</span>
          <a class="g16-tk-btn g16-tk-live" href="#" style="background:#ea4335!important;color:#fff!important;text-decoration:none">Join Live ↗</a>
          <span class="g16-tk-no">No. 0001</span>
        </div>
      </div>
    </article>
  </div>

</body>
</html>
`;

fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_fix_preview.html', testHtml);
console.log('Test HTML created successfully!');
