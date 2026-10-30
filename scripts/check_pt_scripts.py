import glob
import re
import os

for f in sorted(glob.glob('cloudflare-pages-site/**/*.html', recursive=True)):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    head_m = re.search(r'<script>(.*?gdg-pt.*?)</script>', c, re.DOTALL)
    body_m = re.search(r'<div id="pt".*?</div></div>\s*<script>(.*?)</script>', c, re.DOTALL)
    head_txt = head_m.group(1).strip() if head_m else "NONE"
    body_txt = body_m.group(1).strip() if body_m else "NONE"
    rel = os.path.relpath(f, 'cloudflare-pages-site')
    print(f"{rel:<30} | HEAD: {head_txt[:40]:<40} | BODY: {body_txt[:40]}")
