import glob, re, sys

sys.stdout.reconfigure(encoding='utf-8')

for f in sorted(glob.glob('cloudflare-pages-site/**/*.html', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        html = fp.read()
    m = re.search(r'<div id="pt"[^>]*>.*?</div>\s*</div>', html, re.DOTALL)
    if m:
        # print snippet
        t_span = re.search(r'<div class="t">.*?</div>', m.group(0), re.DOTALL)
        span_content = t_span.group(0) if t_span else "NO .t"
        print(f"{f}: {span_content.replace(chr(10), ' ')}")
