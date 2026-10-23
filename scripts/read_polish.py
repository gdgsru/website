with open('cloudflare-pages-site/assets/js/polish.js', 'r', encoding='utf-8') as f:
    text = f.read()

for idx, line in enumerate(text.splitlines(), 1):
    if any(k in line for k in ['pt', 'transition', 'click', 'delay', 'setTimeout', 'navigate']):
        print(f'{idx}: {line.strip()[:120]}')
