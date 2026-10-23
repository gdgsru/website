css_block = """
.page-leaderboard h1,
.page-leaderboard .lb-page-title,
[data-route="leaderboard"] h1 {
  margin: 18px 0 10px !important;
  font: 800 clamp(44px, 8.5vw, 92px)/1.02 var(--f, Google Sans, sans-serif) !important;
  letter-spacing: -0.05em !important;
  color: var(--ink, #1f1f23) !important;
  white-space: nowrap !important;
}
:root[data-theme=dark] .page-leaderboard h1,
:root[data-theme=dark] .page-leaderboard .lb-page-title,
:root[data-theme=dark] [data-route="leaderboard"] h1,
[data-theme=dark] .page-leaderboard h1,
[data-theme=dark] .page-leaderboard .lb-page-title,
[data-theme=dark] [data-route="leaderboard"] h1 {
  color: #ffffff !important;
}
.page-leaderboard h1 em,
.page-leaderboard .lb-page-title em,
[data-route="leaderboard"] h1 em {
  display: inline !important;
  font-style: normal !important;
  background: linear-gradient(90deg, #4285f4 0%, #ea4335 35%, #fbbc04 65%, #34a853 100%) !important;
  -webkit-background-clip: text !important;
  background-clip: text !important;
  color: transparent !important;
  white-space: nowrap !important;
}
"""

for path in ['cloudflare-pages-site/assets/css/page-leaderboard.css', 'deployment/website/assets/css/page-leaderboard.css']:
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    target = '.page-leaderboard h1,\n.page-leaderboard .lb-page-title {'
    idx = c.rfind(target)
    if idx != -1:
        c = c[:idx] + css_block.strip() + '\n'
        with open(path, 'w', encoding='utf-8', newline='\n') as f:
            f.write(c)
        print(f'Updated {path}')
    else:
        print(f'Target not found in {path}')
