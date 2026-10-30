import glob
import os

for f in sorted(glob.glob('cloudflare-pages-site/assets/css/*.css')):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    count = c.count('#pt')
    if count > 0:
        print(f"{os.path.basename(f):<30} : {count} occurrences of #pt")
