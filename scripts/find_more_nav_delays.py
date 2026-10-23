import os, re

for root, dirs, files in os.walk('cloudflare-pages-site/assets/js'):
    for f in files:
        if f.endswith('.js') and f != 'polish.js':
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                t = fl.read()
            for m in re.finditer(r'location\.href\s*=', t):
                print(f'{f}: sets location.href')
            for m in re.finditer(r'sessionStorage\.setItem\([\'\"]gdg-pt[\'\"]', t):
                print(f'{f}: sets gdg-pt')
