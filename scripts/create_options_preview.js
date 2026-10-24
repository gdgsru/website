const fs = require('fs');

// Let's create an updated test page that tests both:
// 1. Horizontal ticket layout: 1fr 100px
// 2. Stacked ticket layout (top: event info, bottom: date + RSVP button)
// with box-sizing: border-box and proper width: 100%

const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mobile Event Card Options</title>
<link rel="stylesheet" href="file:///d:/Drafts/Blogs/website/cloudflare-pages-site/assets/css/page-events.css">
<style>
  * { box-sizing: border-box; }
  body {
    background: #f8f9fa;
    padding: 12px;
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Google Sans', Roboto, sans-serif;
    width: 390px;
  }
  .test-title {
    font-size: 18px;
    font-weight: 800;
    margin: 20px 0 10px;
    color: #202124;
  }

  /* OPTION A: Compact Horizontal Ticket */
  .opt-a .g16-tk {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  }
  .opt-a .g16-tk-card {
    display: grid !important;
    grid-template-columns: 1fr 105px !important;
    border-radius: 18px !important;
    background: #0e1522 !important;
    overflow: hidden !important;
  }
  .opt-a .g16-tk-main {
    padding: 14px 12px 14px 16px !important;
    gap: 5px !important;
    min-width: 0 !important;
    border-radius: 18px 0 0 18px !important;
  }
  .opt-a .g16-tk-meta {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin-bottom: 2px !important;
  }
  .opt-a .g16-tk-kind {
    font-size: 10.5px !important;
    font-weight: 700 !important;
    padding: 2px 7px !important;
    border-radius: 99px !important;
  }
  .opt-a .g16-tk-main h3 {
    font-size: 17px !important;
    line-height: 1.2 !important;
    font-weight: 800 !important;
    margin: 2px 0 0 !important;
    letter-spacing: -0.02em !important;
    white-space: normal !important;
    overflow: visible !important;
  }
  .opt-a .g16-tk-main p {
    font-size: 11.5px !important;
    color: rgba(255,255,255,0.7) !important;
    margin: 0 !important;
  }
  .opt-a .g16-tk-speaker {
    margin: 2px 0 !important;
    font-size: 11.5px !important;
  }
  .opt-a .g16-tk-speaker small {
    font-size: 8.5px !important;
  }
  .opt-a .g16-tk-live-bar {
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin-top: 4px !important;
    font-size: 10px !important;
    font-weight: 700 !important;
  }
  .opt-a .g16-tk-cd {
    display: flex !important;
    gap: 3px !important;
    margin: 0 !important;
  }
  .opt-a .g16-tk-cd span {
    padding: 3px 5px !important;
    font-size: 8px !important;
    border-radius: 5px !important;
  }
  .opt-a .g16-tk-cd b {
    font-size: 13px !important;
    line-height: 1 !important;
  }
  .opt-a .g16-tk-stub {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 4px !important;
    padding: 12px 6px !important;
    border-radius: 0 18px 18px 0 !important;
    background: linear-gradient(135deg, #7db0ff, #ff9d93, #ffd870) !important;
    position: relative !important;
  }
  .opt-a .g16-tk-stub:before {
    content: '' !important;
    position: absolute !important;
    left: 0 !important;
    top: 14px !important;
    bottom: 14px !important;
    border-left: 2px dashed rgba(17,27,46,0.3) !important;
  }
  .opt-a .g16-tk-d {
    font-size: 34px !important;
    font-weight: 800 !important;
    line-height: 0.9 !important;
  }
  .opt-a .g16-tk-m {
    font-size: 11px !important;
    font-weight: 800 !important;
    letter-spacing: 0.12em !important;
  }
  .opt-a .g16-tk-btn {
    padding: 6px 10px !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    border-radius: 99px !important;
    white-space: nowrap !important;
    margin-top: 4px !important;
    text-decoration: none !important;
  }
  .opt-a .g16-tk-no {
    font-size: 9px !important;
    opacity: 0.7 !important;
  }

  /* OPTION B: Modern Stacked Pass (Top info, Bottom RSVP + stub) */
  .opt-b .g16-tk {
    width: 100% !important;
    max-width: 100% !important;
    margin: 0 !important;
  }
  .opt-b .g16-tk-card {
    display: flex !important;
    flex-direction: column !important;
    border-radius: 20px !important;
    background: #0e1522 !important;
    overflow: hidden !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18) !important;
  }
  .opt-b .g16-tk-main {
    padding: 16px 18px !important;
    gap: 8px !important;
  }
  .opt-b .g16-tk-meta {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
  }
  .opt-b .g16-tk-kind {
    font-size: 11px !important;
    font-weight: 700 !important;
    padding: 3px 9px !important;
    border-radius: 99px !important;
    background: rgba(255,255,255,0.12) !important;
  }
  .opt-b .g16-tk-main h3 {
    font-size: 20px !important;
    line-height: 1.2 !important;
    font-weight: 800 !important;
    margin: 0 !important;
    letter-spacing: -0.02em !important;
  }
  .opt-b .g16-tk-info-row {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 8px !important;
    padding-top: 4px !important;
  }
  .opt-b .g16-tk-speaker {
    font-size: 12px !important;
    margin: 0 !important;
  }
  .opt-b .g16-tk-speaker small {
    display: block !important;
    font-size: 9px !important;
    color: rgba(255,255,255,0.6) !important;
    text-transform: uppercase !important;
  }
  .opt-b .g16-tk-time {
    font-size: 12px !important;
    color: rgba(255,255,255,0.75) !important;
  }
  .opt-b .g16-tk-stub {
    display: flex !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 10px 18px !important;
    background: linear-gradient(90deg, #1c2738, #111a28) !important;
    border-top: 1px dashed rgba(255,255,255,0.18) !important;
    position: relative !important;
  }
  .opt-b .g16-tk-stub:before,
  .opt-b .g16-tk-stub:after {
    content: '' !important;
    position: absolute !important;
    top: -9px !important;
    width: 18px !important;
    height: 18px !important;
    border-radius: 50% !important;
    background: #f8f9fa !important;
  }
  .opt-b .g16-tk-stub:before { left: -9px !important; }
  .opt-b .g16-tk-stub:after { right: -9px !important; }
  .opt-b .opt-b-date {
    display: flex !important;
    align-items: baseline !important;
    gap: 6px !important;
  }
  .opt-b .g16-tk-d {
    font-size: 26px !important;
    font-weight: 800 !important;
    line-height: 1 !important;
    color: #fff !important;
  }
  .opt-b .g16-tk-m {
    font-size: 13px !important;
    font-weight: 800 !important;
    color: #fbbc04 !important;
    letter-spacing: 0.08em !important;
  }
  .opt-b .g16-tk-btn {
    padding: 8px 18px !important;
    font-size: 12px !important;
    font-weight: 700 !important;
    border-radius: 99px !important;
    background: #ea4335 !important;
    color: #fff !important;
    text-decoration: none !important;
    box-shadow: 0 2px 8px rgba(234,67,53,0.3) !important;
  }
</style>
</head>
<body>

  <div class="test-title">Option 1: Compact Horizontal Ticket (Perforated)</div>
  <div class="opt-a">
    <article class="g16-tk">
      <div class="g16-tk-card">
        <div class="g16-tk-main">
          <div class="g16-tk-meta">
            <span class="g16-tk-kind" style="background:rgba(255,255,255,0.12);color:#fff">Cloud · Live Now</span>
            <span class="g16-tk-badge live" style="background:#ea4335;color:#fff;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px">LIVE NOW</span>
          </div>
          <h3><a href="#" style="color:#fff;text-decoration:none">Learn With Communities</a></h3>
          <p>4:00 pm, In-Person</p>
          <div class="g16-tk-speaker" style="color:#fff">
            <small style="color:rgba(255,255,255,0.6)">SPEAKER</small>
            <b>Narayan Bora</b>
          </div>
          <div class="g16-tk-live-bar" style="color:#ea4335">
            <small style="color:rgba(255,255,255,0.6)">ENDS IN</small>
            <div class="g16-tk-cd">
              <span><b>6</b>d</span>
              <span><b>23</b>h</span>
              <span><b>42</b>m</span>
              <span><b>18</b>s</span>
            </div>
          </div>
        </div>
        <div class="g16-tk-stub">
          <span class="g16-tk-d">19</span>
          <span class="g16-tk-m">OCT</span>
          <a class="g16-tk-btn" href="#" style="background:#ea4335;color:#fff">Join Live ↗</a>
          <span class="g16-tk-no">No. 0001</span>
        </div>
      </div>
    </article>
  </div>

  <div class="test-title" style="margin-top:30px">Option 2: Modern Compact Event Pass (Stacked)</div>
  <div class="opt-b">
    <article class="g16-tk">
      <div class="g16-tk-card">
        <div class="g16-tk-main">
          <div class="g16-tk-meta">
            <span class="g16-tk-kind">Cloud</span>
            <span class="g16-tk-badge live" style="background:#ea4335;color:#fff;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:4px;display:inline-flex;align-items:center;gap:4px">
              <span style="width:5px;height:5px;border-radius:50%;background:#fff"></span> LIVE NOW
            </span>
          </div>
          <h3><a href="#" style="color:#fff;text-decoration:none">Learn With Communities</a></h3>
          <div class="g16-tk-info-row">
            <div class="g16-tk-speaker" style="color:#fff">
              <small>Speaker</small>
              <b>Narayan Bora</b>
            </div>
            <div class="g16-tk-time">4:00 pm · In-Person</div>
          </div>
        </div>
        <div class="g16-tk-stub">
          <div class="opt-b-date">
            <span class="g16-tk-d">19</span>
            <span class="g16-tk-m">OCT</span>
          </div>
          <a class="g16-tk-btn" href="#">Join Live ↗</a>
        </div>
      </div>
    </article>
  </div>

</body>
</html>
`;

fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_options_preview.html', testHtml);
console.log('mobile_options_preview.html created!');
