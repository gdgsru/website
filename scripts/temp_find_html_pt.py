import glob, re, sys

sys.stdout.reconfigure(encoding='utf-8')

html_files = glob.glob('cloudflare-pages-site/**/*.html', recursive=True)
print(f"Total HTML files: {len(html_files)}")

for hf in html_files[:5]:
    with open(hf, 'r', encoding='utf-8') as f:
        content = f.read()
    # find inline scripts touching pt
    pt_scripts = re.findall(r'<script[^>]*>[^<]*pt[^<]*</script>', content, re.IGNORECASE)
    print(f"\n--- {hf} ({len(pt_scripts)} pt scripts) ---")
    for s in pt_scripts:
        print(s[:300])
