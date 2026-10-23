css_rule = """
.resource-section-title,
.resource-section-head h2 {
  font-size: 24px !important;
  font-weight: 700 !important;
  letter-spacing: -0.03em !important;
  margin: 0 !important;
  color: var(--ink, #1f1f23) !important;
}
:root[data-theme=dark] .resource-section-title,
:root[data-theme=dark] .resource-section-head h2 {
  color: #ffffff !important;
}
"""

for path in ['cloudflare-pages-site/assets/css/page-perks.css', 'deployment/website/assets/css/page-perks.css']:
    with open(path, 'a', encoding='utf-8') as f:
        f.write(css_rule)
    print(f'Appended CSS to {path}')
