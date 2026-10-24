const fs = require('fs');

// Create a standalone HTML test with just the navbar on a 390px viewport to test its standalone behavior
const html = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Inter, sans-serif; background: #eef1fb; overflow-x: hidden; }
  
  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    gap: 8px;
    background: #eef1fb;
  }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: #111;
  }
  .brand-logo-mark {
    display: flex;
    align-items: center;
  }
  .brand-logo-text {
    display: flex;
    flex-direction: column;
  }
  .brand-name {
    font-size: 15px;
    font-weight: 800;
    line-height: 1.1;
    color: #111;
  }
  .brand-sub {
    font-size: 10px;
    color: #5f6368;
    font-family: monospace;
    white-space: nowrap;
  }
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .btn-nav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 32px;
    padding: 0 12px;
    border-radius: 99px;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
  }
  .btn-nav.primary {
    background: #4285F4;
    color: #fff;
  }
  .btn-nav.outline {
    background: #fff;
    color: #111;
    border: 1px solid #d5daee;
  }
</style>
</head>
<body>
  <header class="top-nav">
    <a href="/" class="brand-logo">
      <span class="brand-logo-mark">
        <svg viewBox="185 345 710 390" width="30" height="17">
          <line x1="279" y1="540" x2="432" y2="430" stroke="#EA4335" stroke-width="128" stroke-linecap="round"/>
          <line x1="279" y1="540" x2="432" y2="650" stroke="#4285F4" stroke-width="128" stroke-linecap="round"/>
          <line x1="648" y1="650" x2="801" y2="540" stroke="#FBBC04" stroke-width="128" stroke-linecap="round"/>
          <line x1="648" y1="430" x2="801" y2="540" stroke="#34A853" stroke-width="128" stroke-linecap="round"/>
        </svg>
      </span>
      <span class="brand-logo-text">
        <span class="brand-name">GDG SRU</span>
        <span class="brand-sub">Member Pass Studio</span>
      </span>
    </a>
    <div class="nav-actions">
      <a href="#" class="btn-nav outline">← Back</a>
      <a href="#" class="btn-nav primary">Join ↗</a>
    </div>
  </header>
</body>
</html>`;

fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html', html);
console.log('nav_test.html written');
