import re

def extract_pt_rules(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find selectors involving #pt or pt-
    # or just split by } and find segments with pt
    blocks = content.split('}')
    pt_blocks = []
    for b in blocks:
        if '#pt' in b or '.pt-' in b or 'ptIn' in b or 'ptOut' in b or 'ptChar' in b or 'ptTitle' in b:
            pt_blocks.append(b.strip() + '}')
    return pt_blocks

print("=== site-nav.css ===")
for rule in extract_pt_rules('cloudflare-pages-site/assets/css/site-nav.css'):
    print(rule)

print("\n=== page-team.css ===")
for rule in extract_pt_rules('cloudflare-pages-site/assets/css/page-team.css'):
    print(rule)

print("\n=== page-blogs.css ===")
for rule in extract_pt_rules('cloudflare-pages-site/assets/css/page-blogs.css'):
    print(rule)
