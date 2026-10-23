import os, re

for root, dirs, files in os.walk('cloudflare-pages-site/assets/js'):
    for f in files:
        if f.endswith('.js'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                t = fl.read()
            # Search for transitions, pt, click interception, preventDefault
            if 'gdg-pt' in t or 'pt-in' in t or 'page-transition' in t:
                print(f'{f}: contains page transition code')
            for m in re.finditer(r'addEventListener\(["\']click["\']', t):
                print(f'{f}: has click listener')
