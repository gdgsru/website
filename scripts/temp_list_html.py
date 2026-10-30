import glob, sys

sys.stdout.reconfigure(encoding='utf-8')

for f in sorted(glob.glob('cloudflare-pages-site/**/*.html', recursive=True)):
    print(f)
