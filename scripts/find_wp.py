import glob
import os

for f in sorted(glob.glob('cloudflare-pages-site/**/*.html', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    if 'id="wp"' in c:
        print(os.path.relpath(f, 'cloudflare-pages-site'))
