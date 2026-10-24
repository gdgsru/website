const fs = require('fs');

const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Mobile Visual Comparison</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #f8f9fa;
    color: #1f1f23;
    font-family: -apple-system, BlinkMacSystemFont, 'Google Sans', Roboto, sans-serif;
    padding: 14px;
    width: 375px;
    margin: 0 auto;
  }
  .section-tag {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #5f6368;
    margin-bottom: 4px;
  }
  .section-h {
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.03em;
    margin-bottom: 12px;
    color: #111;
  }
  .section-h sup {
    font-size: 11px;
    font-weight: 600;
    color: #5f6368;
  }

  /* 2x2 BENTO GRID FOR TRACKS */
  .track-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 28px;
    width: 100%;
  }
  .tr-card {
    min-height: 130px;
    border-radius: 18px;
    padding: 12px;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    box-shadow: 0 4px 14px rgba(17, 27, 46, 0.06);
    border: 1px solid rgba(0,0,0,0.06);
    overflow: hidden;
  }
  .tr-card.blue { background: radial-gradient(120% 120% at 90% 10%, #e8f0fe 0%, #fff 70%); border-color: rgba(66, 133, 244, 0.2); }
  .tr-card.red  { background: radial-gradient(120% 120% at 90% 10%, #fce8e6 0%, #fff 70%); border-color: rgba(234, 67, 53, 0.2); }
  .tr-card.yellow { background: radial-gradient(120% 120% at 90% 10%, #fef7e0 0%, #fff 70%); border-color: rgba(251, 188, 4, 0.2); }
  .tr-card.green { background: radial-gradient(120% 120% at 90% 10%, #e6f4ea 0%, #fff 70%); border-color: rgba(52, 168, 83, 0.2); }

  .tr-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .tr-num {
    font-size: 10px;
    font-weight: 800;
    padding: 2px 7px;
    border-radius: 99px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(0,0,0,0.08);
    color: #3c4043;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }
  .tr-orb {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: grid;
    place-content: center;
    color: #fff;
  }
  .tr-orb.blue { background: #4285f4; box-shadow: 0 0 10px rgba(66, 133, 244, 0.45); }
  .tr-orb.red  { background: #ea4335; box-shadow: 0 0 10px rgba(234, 67, 53, 0.45); }
  .tr-orb.yellow { background: #f9ab00; box-shadow: 0 0 10px rgba(249, 171, 0, 0.45); }
  .tr-orb.green { background: #34a853; box-shadow: 0 0 10px rgba(52, 168, 83, 0.45); }
  .tr-orb svg { width: 14px; height: 14px; fill: currentColor; }

  .tr-content {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .tr-title {
    font-size: 14.5px;
    font-weight: 800;
    color: #111b2e;
    letter-spacing: -0.02em;
  }
  .tr-desc {
    font-size: 10.5px;
    line-height: 1.35;
    color: #5f6368;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* EVENT TICKET CARD (COMPACT FULL WIDTH MOBILE) */
  .tk-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 98px;
    border-radius: 18px;
    background: #fff;
    box-shadow: 0 4px 16px rgba(17, 27, 46, 0.08);
    border: 1px solid rgba(0,0,0,0.08);
    overflow: hidden;
    position: relative;
    width: 100%;
  }
  .tk-main {
    padding: 12px 10px 12px 14px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 4px;
    min-width: 0;
  }
  .tk-meta {
    display: flex;
    align-items: center;
    gap: 5px;
  }
  .tk-kind {
    font-size: 9.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 99px;
    background: #1f1f23;
    color: #fff;
    white-space: nowrap;
  }
  .tk-live-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #ea4335;
    display: inline-block;
  }
  .tk-title {
    font-size: 15.5px;
    font-weight: 800;
    line-height: 1.2;
    color: #111b2e;
    letter-spacing: -0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tk-time {
    font-size: 11px;
    color: #5f6368;
    white-space: nowrap;
  }
  .tk-speaker {
    font-size: 11px;
    color: #1f1f23;
  }
  .tk-speaker small {
    display: block;
    font-size: 8px;
    font-weight: 700;
    color: #80868b;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .tk-live-bar {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 2px;
  }
  .tk-live-bar small {
    font-size: 8.5px;
    font-weight: 800;
    color: #ea4335;
    letter-spacing: 0.06em;
  }
  .tk-cd {
    display: flex;
    gap: 2.5px;
  }
  .tk-cd span {
    padding: 1.5px 3.5px;
    border-radius: 4px;
    background: rgba(0,0,0,0.05);
    border: 1px solid rgba(0,0,0,0.06);
    font-size: 7.5px;
    text-align: center;
    color: #5f6368;
  }
  .tk-cd b {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: #111b2e;
    line-height: 1;
  }

  .tk-stub {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 10px 6px;
    background: linear-gradient(145deg, #7db0ff 0%, #ff9d93 45%, #ffd870 100%);
    position: relative;
    text-align: center;
  }
  .tk-stub::before {
    content: '';
    position: absolute;
    left: 0;
    top: 12px;
    bottom: 12px;
    border-left: 2px dashed rgba(17, 27, 46, 0.28);
  }
  .tk-stub::after {
    content: '';
    position: absolute;
    top: -7px;
    left: -7px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f8f9fa;
  }
  .tk-notch-b {
    position: absolute;
    bottom: -7px;
    left: -7px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #f8f9fa;
  }
  .tk-d {
    font-size: 30px;
    font-weight: 800;
    line-height: 0.92;
    color: #111b2e;
    letter-spacing: -0.04em;
  }
  .tk-m {
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.12em;
    color: #111b2e;
  }
  .tk-btn {
    padding: 5px 10px;
    font-size: 10.5px;
    font-weight: 700;
    border-radius: 99px;
    background: #ea4335;
    color: #fff;
    text-decoration: none;
    margin-top: 2px;
    box-shadow: 0 2px 6px rgba(234, 67, 53, 0.35);
    white-space: nowrap;
  }
  .tk-no {
    font-size: 8.5px;
    font-family: monospace;
    opacity: 0.7;
    margin-top: 1px;
  }
</style>
</head>
<body>

  <div class="section-tag">FIX 1 · TRACK CARDS (CLEAN 2x2 BENTO)</div>
  <div class="section-h">Pick your track <sup>04</sup></div>
  
  <div class="track-grid">
    <!-- Cloud -->
    <div class="tr-card blue">
      <div class="tr-top">
        <span class="tr-num">01</span>
        <div class="tr-orb blue">
          <svg viewBox="0 0 24 24"><path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/></svg>
        </div>
      </div>
      <div class="tr-content">
        <span class="tr-title">Cloud</span>
        <span class="tr-desc">Google Cloud, Skills Boost and deployment.</span>
      </div>
    </div>

    <!-- AI / ML -->
    <div class="tr-card red">
      <div class="tr-top">
        <span class="tr-num">02</span>
        <div class="tr-orb red">
          <svg viewBox="0 0 24 24"><path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z"/></svg>
        </div>
      </div>
      <div class="tr-content">
        <span class="tr-title">AI / ML</span>
        <span class="tr-desc">Gemini, AI Studio and applied ML.</span>
      </div>
    </div>

    <!-- Web / Mobile -->
    <div class="tr-card yellow">
      <div class="tr-top">
        <span class="tr-num">03</span>
        <div class="tr-orb yellow">
          <svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="18" r="1"/></svg>
        </div>
      </div>
      <div class="tr-content">
        <span class="tr-title">Web / Mobile</span>
        <span class="tr-desc">Frontend, Android and full stack.</span>
      </div>
    </div>

    <!-- Open Source -->
    <div class="tr-card green">
      <div class="tr-top">
        <span class="tr-num">04</span>
        <div class="tr-orb green">
          <svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-11 6.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>
        </div>
      </div>
      <div class="tr-content">
        <span class="tr-title">Open Source</span>
        <span class="tr-desc">Git, GitHub and collaborative development.</span>
      </div>
    </div>
  </div>

  <div class="section-tag">FIX 2 · EVENT TICKET (COMPACT FULL WIDTH)</div>
  <div class="section-h">Upcoming Event</div>

  <div class="tk-card">
    <div class="tk-main">
      <div class="tk-meta">
        <span class="tk-kind"><span class="tk-live-dot"></span> Cloud · Live Now</span>
      </div>
      <div class="tk-title">Learn With Communities</div>
      <div class="tk-time">4:00 pm, In-Person</div>
      <div class="tk-speaker">
        <small>Speaker</small>
        <b>Narayan Bora</b>
      </div>
      <div class="tk-live-bar">
        <small>ENDS IN</small>
        <div class="tk-cd">
          <span><b>6</b>d</span>
          <span><b>23</b>h</span>
          <span><b>42</b>m</span>
          <span><b>18</b>s</span>
        </div>
      </div>
    </div>
    <div class="tk-stub">
      <div class="tk-notch-b"></div>
      <span class="tk-d">19</span>
      <span class="tk-m">OCT</span>
      <a class="tk-btn" href="#">Join Live ↗</a>
      <span class="tk-no">No. 0001</span>
    </div>
  </div>

</body>
</html>
`;

fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_perfect_preview.html', testHtml);
console.log('mobile_perfect_preview.html updated!');
