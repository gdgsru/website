import os, re

for f in os.listdir('cloudflare-pages-site/assets/admin'):
    if f.endswith('.js'):
        p = os.path.join('cloudflare-pages-site/assets/admin', f)
        with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
            t = fl.read()
        has_def = re.search(r'(?:const|let|var)\s+\$\s*=', t)
        dollar_calls = re.findall(r'(?<![a-zA-Z0-9_\$])\$\s*\(', t)
        print(f'{f}: {len(dollar_calls)} calls to $(...) | Has def: {bool(has_def)}')
        if dollar_calls and not has_def:
            for idx, line in enumerate(t.splitlines(), 1):
                if re.search(r'(?<![a-zA-Z0-9_\$])\$\s*\(', line):
                    print(f'   Line {idx}: {line.strip()[:100]}')
