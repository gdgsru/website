import glob, re, sys

sys.stdout.reconfigure(encoding='utf-8')

for f in sorted(glob.glob('cloudflare-pages-site/**/*.js', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        code = fp.read()
    if '#pt' in code or '.pt' in code:
        for i, l in enumerate(code.split('\n')):
            if '#pt' in l or 'pt-' in l or 'dataset.pt' in l:
                print(f"{f}:{i+1}: {l.strip()[:100]}")
