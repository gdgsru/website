#!/usr/bin/env python3
"""Pre-flight verification and deployment checklist for GDG SRU.
Runs all integrity checks and outputs exact deployment commands.
"""
import glob, os, re, subprocess, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = os.path.join(ROOT, 'site')

def step(title):
    print(f"\n\033[1;34m[*] {title}\033[0m")

def success(msg):
    print(f"  \033[1;32m[PASS]\033[0m {msg}")

def fail(msg):
    print(f"  \033[1;31m[FAIL]\033[0m {msg}")
    sys.exit(1)

def main():
    print("=" * 60)
    print(" GDG on Campus SR University · Pre-Flight Deployment Audit")
    print("=" * 60)

    # 1. Check pages sync
    step("1. Verifying Shared Header/Menu/Footer Partials")
    res = subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build-pages.py'), '--check'], capture_output=True, text=True)
    if res.returncode == 0:
        success("All pages are synchronized with partials.")
    else:
        fail(f"build-pages check failed: {res.stdout.strip()}")

    # 2. Check CSS compiler
    step("2. Verifying CSS Compilation")
    res = subprocess.run([sys.executable, os.path.join(ROOT, 'scripts', 'build-css.py')], capture_output=True, text=True)
    if res.returncode == 0:
        success("All 10 CSS route bundles compiled cleanly.")
    else:
        fail(f"build-css failed: {res.stderr.strip()}")

    # 3. Check JavaScript syntax
    step("3. Verifying JavaScript Syntax (node --check)")
    js_files = glob.glob(os.path.join(SITE, '**', '*.js'), recursive=True)
    for jf in js_files:
        r = subprocess.run(['node', '--check', jf], capture_output=True, text=True)
        if r.returncode != 0:
            fail(f"JS syntax error in {os.path.relpath(jf, ROOT)}: {r.stderr.strip()}")
    success(f"All {len(js_files)} JavaScript files verified with zero errors.")

    # 4. Check HTML tag balance
    step("4. Verifying HTML Structural Tag Balance")
    html_files = glob.glob(os.path.join(SITE, '**', '*.html'), recursive=True)
    for hf in html_files:
        with open(hf, 'r', encoding='utf-8') as f:
            html = f.read()
        for tag in ['div', 'main', 'header', 'footer', 'section', 'nav', 'script']:
            opens = len(re.findall(r'<' + tag + r'[\s>]', html))
            closes = len(re.findall(r'</' + tag + r'>', html))
            if opens != closes:
                fail(f"Tag mismatch in {os.path.relpath(hf, ROOT)} for <{tag}>: {opens} open vs {closes} close")
    success(f"All {len(html_files)} HTML pages parsed with balanced tags.")

    # 5. Check PWA & Offline manifest
    step("5. Verifying PWA & Offline Assets")
    if os.path.exists(os.path.join(SITE, 'manifest.webmanifest')) and os.path.exists(os.path.join(SITE, 'sw.js')):
        success("manifest.webmanifest and sw.js are present.")
    else:
        fail("PWA assets missing in site/ directory.")

    print("\n" + "=" * 60)
    print(" ALL PRE-FLIGHT INTEGRITY CHECKS PASSED (100% READY)")
    print("=" * 60)
    print("""
Next Deployment Operations:

1. Deploy Supabase Edge Functions:
   ---------------------------------
   cd supabase
   supabase secrets set ALLOWED_ORIGIN="https://gdgsru.com,https://gdg-sru.pages.dev"
   supabase functions deploy claim-certificate
   supabase functions deploy fetch-blog-metadata

2. Cloudflare Pages Production Settings:
   ---------------------------------
   Build command:           python3 scripts/build-pages.py && python3 scripts/build-css.py
   Build output directory:  site
   Root directory:          /
""")

if __name__ == '__main__':
    main()
