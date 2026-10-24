import re

path = r'cloudflare-pages-site/member-badge/index.html'
with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Normalize to \n
crlf = '\r\n' in text
text = text.replace('\r\n', '\n')

# 1. Add html, body overflow-x: hidden
text = text.replace(
    'body {\n    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n    background: var(--bg-page);\n    min-height: 100vh;\n    padding: 0 0 60px;\n    color: #111;\n  }',
    'html, body {\n    overflow-x: hidden;\n    max-width: 100vw;\n  }\n  body {\n    font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif;\n    background: var(--bg-page);\n    min-height: 100vh;\n    padding: 0 0 60px;\n    color: #111;\n  }'
)

# 2. Add comprehensive mobile nav CSS
mobile_css = """
  /* ---- Mobile Header & Layout Polish ---- */
  @media (max-width: 680px) {
    .top-nav {
      margin-bottom: 16px !important;
      padding: 12px 14px !important;
      gap: 8px !important;
      width: 100% !important;
      box-sizing: border-box !important;
    }
    .brand-logo {
      gap: 8px !important;
      flex-shrink: 1 !important;
      min-width: 0 !important;
    }
    .brand-name-full {
      display: none !important;
    }
    .brand-name-short {
      display: block !important;
      font: 800 15px/1.1 Inter, sans-serif !important;
      letter-spacing: -0.02em !important;
      white-space: nowrap !important;
    }
    .brand-logo small {
      font-size: 10px !important;
      white-space: nowrap !important;
      letter-spacing: 0.2px !important;
    }
    .nav-actions {
      gap: 6px !important;
      flex-shrink: 0 !important;
    }
    .btn-nav {
      height: 32px !important;
      padding: 0 10px !important;
      font-size: 11.5px !important;
      font-weight: 600 !important;
      border-radius: 99px !important;
      white-space: nowrap !important;
      flex-shrink: 0 !important;
    }
    .btn-text-full { display: none !important; }
    .btn-text-mobile { display: inline !important; }
    .layout {
      padding: 0 14px !important;
      gap: 28px !important;
    }
    .form-card {
      padding: 20px 16px !important;
      border-radius: 20px !important;
    }
  }
"""

# Place it right before </style>
text = text.replace('</style>', mobile_css + '\n</style>')

# Also ensure header HTML order: Back to Site first, Join Chapter second
old_actions = """  <div class="nav-actions">
    <a href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener" class="btn-nav primary">
      <span class="btn-text-full">Join Chapter ↗</span>
      <span class="btn-text-mobile">Join ↗</span>
    </a>
    <a href="/join/" class="btn-nav outline">
      <span class="btn-text-full">← Back to Site</span>
      <span class="btn-text-mobile">← Back</span>
    </a>
  </div>"""

new_actions = """  <div class="nav-actions">
    <a href="/join/" class="btn-nav outline">
      <span class="btn-text-full">← Back to Site</span>
      <span class="btn-text-mobile">← Back</span>
    </a>
    <a href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener" class="btn-nav primary">
      <span class="btn-text-full">Join Chapter ↗</span>
      <span class="btn-text-mobile">Join ↗</span>
    </a>
  </div>"""

if old_actions in text:
    text = text.replace(old_actions, new_actions)

if crlf:
    text = text.replace('\n', '\r\n')

with open(path, 'w', encoding='utf-8') as f:
    f.write(text)

print('Updated member-badge/index.html with mobile navbar fix!')
