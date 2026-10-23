import os, re
from html.parser import HTMLParser

base_dir = 'cloudflare-pages-site'

class RefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ['src', 'href'] and v:
                self.refs.append(v)

missing = []
total_refs = 0

# 1. Check HTML files
for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.html'):
            hp = os.path.join(root, f)
            with open(hp, 'r', encoding='utf-8', errors='ignore') as fl:
                content = fl.read()
            parser = RefParser()
            try:
                parser.feed(content)
            except Exception:
                pass
            for r in parser.refs:
                if r.startswith(('http://', 'https://', '#', 'mailto:', 'tel:', 'data:', 'javascript:')):
                    continue
                clean_r = r.split('?')[0].split('#')[0]
                if not clean_r or clean_r == '/':
                    continue
                total_refs += 1
                if clean_r.startswith('/'):
                    target = os.path.join(base_dir, clean_r.lstrip('/'))
                else:
                    target = os.path.join(root, clean_r)
                if not os.path.exists(target) and not os.path.exists(os.path.join(target, 'index.html')):
                    missing.append((hp, r, target))

# 2. Check sw.js CORE_SHELLS
with open(os.path.join(base_dir, 'sw.js'), 'r', encoding='utf-8') as f:
    sw_text = f.read()

core_shells_match = re.search(r'CORE_SHELLS\s*=\s*\[(.*?)\];', sw_text, re.DOTALL)
if core_shells_match:
    for item in re.findall(r"['\"](.*?)['\"]", core_shells_match.group(1)):
        clean = item.split('?')[0].split('#')[0]
        if clean in ['', '/']:
            continue
        total_refs += 1
        target = os.path.join(base_dir, clean.lstrip('/'))
        if not os.path.exists(target) and not os.path.exists(os.path.join(target, 'index.html')):
            missing.append(('sw.js', item, target))

# 3. Check manifest icons
with open(os.path.join(base_dir, 'manifest.webmanifest'), 'r', encoding='utf-8') as f:
    manifest_text = f.read()
for icon in re.findall(r'"src":\s*"(.*?)"', manifest_text):
    total_refs += 1
    clean = icon.lstrip('/')
    target = os.path.join(base_dir, clean)
    if not os.path.exists(target):
        missing.append(('manifest.webmanifest', icon, target))

# 4. Check CSS font and image url references
for root, dirs, files in os.walk(os.path.join(base_dir, 'assets', 'css')):
    for f in files:
        if f.endswith('.css'):
            cp = os.path.join(root, f)
            with open(cp, 'r', encoding='utf-8', errors='ignore') as fl:
                css_text = fl.read()
            for url in re.findall(r'url\([\'"]?(.*?)[\'"]?\)', css_text):
                if url.startswith(('http://', 'https://', 'data:')) or url.startswith('#'):
                    continue
                clean = url.split('?')[0].split('#')[0]
                total_refs += 1
                if clean.startswith('/'):
                    target = os.path.join(base_dir, clean.lstrip('/'))
                else:
                    target = os.path.join(root, clean)
                if not os.path.exists(target):
                    missing.append((cp, url, target))

print(f'Audited {total_refs} resource references.')
if missing:
    print(f'MISSING {len(missing)} files:')
    for src, ref, tgt in missing:
        print(f'  From {src}: {ref} -> {tgt}')
else:
    print('100% of referenced files exist on disk! 0 missing assets.')
