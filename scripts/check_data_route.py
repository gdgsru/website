import glob
import re
import os

for f in sorted(glob.glob('cloudflare-pages-site/**/*.html', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    m = re.search(r'<body[^>]*data-route=["\']([^"\']+)["\']', c)
    if m:
        print(f"{os.path.relpath(f, 'cloudflare-pages-site'):<35} | data-route: {m.group(1)}")
    else:
        print(f"{os.path.relpath(f, 'cloudflare-pages-site'):<35} | NO data-route")
