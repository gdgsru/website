import glob, os, re, sys

sys.stdout.reconfigure(encoding='utf-8')

css_files = glob.glob('cloudflare-pages-site/assets/css/*.css')
for fpath in sorted(css_files):
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()
    if '#pt' in content and 'site-nav.css' not in fpath:
        # find lines with #pt
        lines = content.split('\n')
        pt_lines = [l.strip() for l in lines if '#pt' in l]
        print(f"{fpath}: {len(pt_lines)} lines with #pt")
        for l in pt_lines[:8]:
            print("  ", l[:100])
