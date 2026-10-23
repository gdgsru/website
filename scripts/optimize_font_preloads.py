import os, re, glob

ROOTS = ['cloudflare-pages-site', 'deployment/website']

def optimize_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    orig = content
    # Remove preload for 600, 800, 500
    # Match lines like: <link rel="preload" as="font" type="font/woff2" href="/assets/fonts/google-sans-flex-latin-600-normal.woff2" crossorigin>
    content = re.sub(r'[ \t]*<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/google-sans-flex-latin-600-normal\.woff2"[^>]*>\r?\n?', '', content)
    content = re.sub(r'[ \t]*<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/google-sans-flex-latin-800-normal\.woff2"[^>]*>\r?\n?', '', content)
    content = re.sub(r'[ \t]*<link rel="preload" as="font" type="font/woff2" href="/assets/fonts/google-sans-flex-latin-500-normal\.woff2"[^>]*>\r?\n?', '', content)

    if orig != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Optimized font preloads in: {filepath}")
    else:
        print(f"No changes in: {filepath}")

for root in ROOTS:
    if os.path.exists(root):
        for p in glob.glob(os.path.join(root, '**', '*.html'), recursive=True):
            optimize_file(p)
