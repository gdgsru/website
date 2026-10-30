import glob

for f in sorted(glob.glob('cloudflare-pages-site/assets/css/*.css')):
    with open(f, 'r', encoding='utf-8') as fp:
        c = fp.read()
    if '#wp' in c:
        print(f, 'contains #wp')
