import os

path = r'cloudflare-pages-site/member-badge/index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update CSS
old_css = """  /* ---- Header Nav ---- */
  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1180px;
    margin: 0 auto 36px;
    padding: 18px 24px;
  }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: #111;
    font: 800 17px/1.1 Inter, sans-serif;
    letter-spacing: -0.02em;
  }
  .brand-logo small {
    display: block;
    font: 500 11px/1 "JetBrains Mono", monospace;
    color: #5f6368;
    letter-spacing: 0.5px;
    margin-top: 2px;
  }
  .brand-logo-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .btn-nav {
    display: inline-flex;
    align-items: center;
    padding: 8px 18px;
    border-radius: 99px;
    font: 600 13.5px Inter, sans-serif;
    text-decoration: none;
    transition: all 0.15s ease;
  }
  .btn-nav.primary {
    background: var(--blue);
    color: #fff;
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.28);
  }
  .btn-nav.primary:hover { background: #3367d6; transform: translateY(-1px); }
  .btn-nav.outline {
    background: #fff;
    color: #111;
    border: 1px solid #d5daee;
  }
  .btn-nav.outline:hover { background: #f8f9fa; }"""

new_css = """  /* ---- Header Nav ---- */
  .top-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1180px;
    margin: 0 auto 36px;
    padding: 18px 24px;
    gap: 12px;
  }
  .brand-logo {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: #111;
    font: 800 17px/1.1 Inter, sans-serif;
    letter-spacing: -0.02em;
    min-width: 0;
    flex-shrink: 1;
  }
  .brand-logo-text {
    min-width: 0;
    overflow: hidden;
  }
  .brand-logo small {
    display: block;
    font: 500 11px/1 "JetBrains Mono", monospace;
    color: #5f6368;
    letter-spacing: 0.5px;
    margin-top: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .brand-logo-mark {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }
  .btn-nav {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 36px;
    padding: 0 16px;
    border-radius: 99px;
    font: 600 13px Inter, sans-serif;
    text-decoration: none;
    white-space: nowrap;
    transition: all 0.15s ease;
    flex-shrink: 0;
  }
  .btn-nav.primary {
    background: var(--blue);
    color: #fff;
    box-shadow: 0 4px 12px rgba(66, 133, 244, 0.28);
  }
  .btn-nav.primary:hover { background: #3367d6; transform: translateY(-1px); }
  .btn-nav.outline {
    background: #fff;
    color: #111;
    border: 1px solid #d5daee;
  }
  .btn-nav.outline:hover { background: #f8f9fa; }
  .btn-text-mobile { display: none; }

  @media (max-width: 680px) {
    .top-nav {
      margin-bottom: 16px;
      padding: 12px 16px;
      gap: 8px;
    }
    .brand-logo {
      gap: 8px;
    }
    .brand-name-full {
      display: none;
    }
    .brand-name-short {
      display: block;
      font: 800 15px/1.1 Inter, sans-serif;
      letter-spacing: -0.02em;
    }
    .brand-logo small {
      font-size: 10px;
    }
    .nav-actions {
      gap: 6px;
    }
    .btn-nav {
      height: 32px;
      padding: 0 11px;
      font-size: 11.5px;
      font-weight: 600;
    }
    .btn-text-full { display: none; }
    .btn-text-mobile { display: inline; }
  }
  @media (min-width: 681px) {
    .brand-name-short { display: none; }
  }"""

# 2. Update HTML
old_html = """<header class="top-nav">
  <a href="/" class="brand-logo" aria-label="GDG SR University Home">
    <span class="brand-logo-mark" aria-hidden="true">
      <svg viewBox="185 345 710 390" width="34" height="19" role="img" aria-label="Google Developer Group logo">
        <line x1="279" y1="540" x2="432" y2="430" stroke="#EA4335" stroke-width="128" stroke-linecap="round"/>
        <line x1="279" y1="540" x2="432" y2="650" stroke="#4285F4" stroke-width="128" stroke-linecap="round"/>
        <line x1="648" y1="650" x2="801" y2="540" stroke="#FBBC04" stroke-width="128" stroke-linecap="round"/>
        <line x1="648" y1="430" x2="801" y2="540" stroke="#34A853" stroke-width="128" stroke-linecap="round"/>
      </svg>
    </span>
    <span>Google Developer Group <small>SR University · Member Pass Studio</small></span>
  </a>

  <div class="nav-actions">
    <a href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener" class="btn-nav primary">
      Join Chapter ↗
    </a>
    <a href="/join/" class="btn-nav outline">
      ← Back to Site
    </a>
  </div>
</header>"""

new_html = """<header class="top-nav">
  <a href="/" class="brand-logo" aria-label="GDG SR University Home">
    <span class="brand-logo-mark" aria-hidden="true">
      <svg viewBox="185 345 710 390" width="32" height="18" role="img" aria-label="Google Developer Group logo">
        <line x1="279" y1="540" x2="432" y2="430" stroke="#EA4335" stroke-width="128" stroke-linecap="round"/>
        <line x1="279" y1="540" x2="432" y2="650" stroke="#4285F4" stroke-width="128" stroke-linecap="round"/>
        <line x1="648" y1="650" x2="801" y2="540" stroke="#FBBC04" stroke-width="128" stroke-linecap="round"/>
        <line x1="648" y1="430" x2="801" y2="540" stroke="#34A853" stroke-width="128" stroke-linecap="round"/>
      </svg>
    </span>
    <span class="brand-logo-text">
      <span class="brand-name-full">Google Developer Group</span>
      <span class="brand-name-short">GDG SRU</span>
      <small>Member Pass Studio</small>
    </span>
  </a>

  <div class="nav-actions">
    <a href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener" class="btn-nav primary">
      <span class="btn-text-full">Join Chapter ↗</span>
      <span class="btn-text-mobile">Join ↗</span>
    </a>
    <a href="/join/" class="btn-nav outline">
      <span class="btn-text-full">← Back to Site</span>
      <span class="btn-text-mobile">← Back</span>
    </a>
  </div>
</header>"""

# Normalize CRLF
text_norm = text.replace('\r\n', '\n')
old_css_norm = old_css.replace('\r\n', '\n')
new_css_norm = new_css.replace('\r\n', '\n')
old_html_norm = old_html.replace('\r\n', '\n')
new_html_norm = new_html.replace('\r\n', '\n')

assert old_css_norm in text_norm, "old_css not found!"
assert old_html_norm in text_norm, "old_html not found!"

text_norm = text_norm.replace(old_css_norm, new_css_norm)
text_norm = text_norm.replace(old_html_norm, new_html_norm)

# Write back preserving CRLF
with open(path, 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(text_norm)

print("Successfully replaced nav CSS and HTML!")
