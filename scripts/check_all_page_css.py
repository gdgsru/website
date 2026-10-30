import glob
import os

with open('cloudflare-pages-site/assets/css/site-nav.css', 'r', encoding='utf-8') as f:
    nav_css = f.read()

# Find the #pt section in site-nav.css
nav_pt_start = nav_css.find('/* Page Transition (#pt) Container & Animation */')
nav_pt_block = nav_css[nav_pt_start:] if nav_pt_start != -1 else ""

print(f"site-nav.css pt block length: {len(nav_pt_block)}")

for f in sorted(glob.glob('cloudflare-pages-site/assets/css/page-*.css')):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    
    # Check key animation delays and durations in each file
    has_pt = '#pt' in c
    ptin_match = [line for line in c.split(';') if 'animation:ptIn' in line or 'animation: ptIn' in line]
    ptchar_match = [line for line in c.split(';') if 'animation:ptCharIn' in line or 'animation: ptCharIn' in line]
    pttitle_match = [line for line in c.split(';') if 'ptTitleIn' in line]
    
    print(f"\n{os.path.basename(f)}:")
    print(f"  ptIn: {ptin_match[:1]}")
    print(f"  ptCharIn: {ptchar_match[:1]}")
    print(f"  ptTitleIn occurrences: {len(pttitle_match)}")
