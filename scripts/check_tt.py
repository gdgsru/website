import glob
import os

for f in sorted(glob.glob('cloudflare-pages-site/**/*.html', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    has_tt = 'title-transition.js' in c
    has_pt = 'id="pt"' in c
    rel = os.path.relpath(f, 'cloudflare-pages-site')
    if has_pt:
        print(f"{rel:<35} | has pt: {has_pt} | has title-transition.js: {has_tt}")
