import glob, re, sys

sys.stdout.reconfigure(encoding='utf-8')

for f in sorted(glob.glob('cloudflare-pages-site/**/*.js', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        code = fp.read()
    if 'dataset.pt' in code or 'data-pt' in code or 'dataset["pt"]' in code:
        print(f"Found in {f}")
        for line in code.split('\n'):
            if 'pt' in line:
                print("  ", line.strip()[:100])
