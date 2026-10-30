import glob
import re
import os

pages = ['index.html', 'events/index.html', 'team/index.html', 'blog/index.html', 'members/index.html', 'join/index.html']

for p in pages:
    with open('cloudflare-pages-site/' + p, 'r', encoding='utf-8') as f:
        c = f.read()
    route = re.search(r'data-route=["\']([^"\']*)["\']', c)
    css = re.findall(r'<link[^>]*rel=["\']stylesheet["\'][^>]*>', c)
    pt = '<div id="pt"' in c
    wp = '<div id="wp"' in c
    print(f"\nPage: {p}")
    print(f"  route: {route.group(1) if route else 'None'}")
    print(f"  css:")
    for l in css:
        print(f"    {l}")
