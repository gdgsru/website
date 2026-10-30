import re

def get_tags(path):
    with open(path, 'r', encoding='utf-8') as f:
        c = f.read()
    links = re.findall(r'<link[^>]+>', c)
    scripts = re.findall(r'<script[^>]*src=[^>]+>', c)
    return links, scripts

for path in ['cloudflare-pages-site/index.html', 'cloudflare-pages-site/team/index.html', 'cloudflare-pages-site/blog/index.html', 'cloudflare-pages-site/events/index.html']:
    links, scripts = get_tags(path)
    print(f"\n=== {path} ===")
    print("LINKS:")
    for l in links: print(" ", l)
    print("SCRIPTS:")
    for s in scripts: print(" ", s)
