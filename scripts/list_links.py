import re
import sys

sys.stdout.reconfigure(encoding='utf-8')
for filename in ['team/index.html', 'blog/index.html']:
    print(f"\n=== {filename} ===")
    with open('cloudflare-pages-site/' + filename, 'r', encoding='utf-8') as f:
        c = f.read()
    for h, t in re.findall(r'<a\s+[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>', c, re.DOTALL):
        clean_t = re.sub(r'<[^>]+>', ' ', t).strip()[:35]
        print(f"  {h:<30} -> {clean_t}")
