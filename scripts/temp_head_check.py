import sys

sys.stdout.reconfigure(encoding='utf-8')

for p in ['cloudflare-pages-site/team/index.html', 'cloudflare-pages-site/blog/index.html']:
    with open(p, 'r', encoding='utf-8') as f:
        content = f.read()
    print(f"=== {p} ===")
    head = content[:content.find('</head>')]
    for line in head.split('\n'):
        if 'gdg-pt' in line or 'pt' in line or 'polish' in line or 'title-transition' in line:
            print("  ", line.strip()[:140])
