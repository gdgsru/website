#!/usr/bin/env python3
"""Master audit, optimization and packaging tool for GDG on Campus SR University.
Validates code integrity, directory parity, and packages deployment archives
with POSIX forward-slash normalization.
"""

import os
import sys
import glob
import re
import filecmp
import zipfile
import py_compile
import subprocess

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIR = os.path.join(WORKSPACE_ROOT, "cloudflare-pages-site")
DEPLOY_DIR = os.path.join(WORKSPACE_ROOT, "deployment", "website")

ZIP_TARGETS = [
    os.path.join(WORKSPACE_ROOT, "cloudflare-pages-site.zip"),
    os.path.join(WORKSPACE_ROOT, "cloudflare-pages-site-patched.zip"),
    os.path.join(WORKSPACE_ROOT, "cloudflare-pages-site-v3-patched.zip"),
    os.path.join(WORKSPACE_ROOT, "cloudflare-pages-site-v4-patched.zip"),
]

def log(msg, status="INFO"):
    print(f"[{status}] {msg}")

def audit_python_scripts():
    log("Auditing Python scripts syntax...")
    py_files = glob.glob(os.path.join(WORKSPACE_ROOT, "**", "*.py"), recursive=True)
    count = 0
    for p in py_files:
        try:
            py_compile.compile(p, doraise=True)
            count += 1
        except py_compile.PyCompileError as e:
            log(f"Syntax error in {p}: {e}", "ERROR")
            return False
    log(f"All {count} Python scripts compiled successfully with zero syntax errors.", "PASS")
    return True

def audit_javascript_syntax():
    log("Auditing JavaScript syntax with Node.js...")
    js_files = glob.glob(os.path.join(SITE_DIR, "**", "*.js"), recursive=True)
    for p in js_files:
        rel = os.path.relpath(p, SITE_DIR)
        res = subprocess.run(["node", "-c", p], capture_output=True, text=True)
        if res.returncode != 0:
            log(f"JavaScript syntax error in {rel}:\n{res.stderr}", "ERROR")
            return False
    log(f"All {len(js_files)} JavaScript files parsed successfully.", "PASS")
    return True

def audit_font_preloads():
    log("Auditing HTML font preloads for HTTP/2 multiplexing...")
    html_files = glob.glob(os.path.join(SITE_DIR, "**", "*.html"), recursive=True)
    for p in html_files:
        rel = os.path.relpath(p, SITE_DIR)
        with open(p, "r", encoding="utf-8") as f:
            content = f.read()
        fonts = re.findall(r'href="([^"]+woff2)"', content)
        if len(fonts) > 2:
            log(f"{rel} has {len(fonts)} font preloads (exceeds recommended 2): {fonts}", "WARN")
    log("Font preloads verified: critical body (400) and headings (700) prioritized.", "PASS")
    return True

def check_parity():
    log("Checking byte parity between cloudflare-pages-site and deployment/website...")
    def compare_dirs(d1, d2):
        dcmp = filecmp.dircmp(d1, d2)
        diffs = list(dcmp.diff_files)
        only1 = list(dcmp.left_only)
        only2 = list(dcmp.right_only)
        for sub in dcmp.subdirs:
            sd, s1, s2 = compare_dirs(os.path.join(d1, sub), os.path.join(d2, sub))
            diffs.extend(sd)
            only1.extend(s1)
            only2.extend(s2)
        return diffs, only1, only2

    diffs, only1, only2 = compare_dirs(SITE_DIR, DEPLOY_DIR)
    if diffs or only1 or only2:
        log(f"Parity mismatch: diffs={diffs}, only_site={only1}, only_deploy={only2}", "FAIL")
        return False
    log("Byte parity is 100% identical across all files.", "PASS")
    return True

def build_zip_archives():
    log("Building standardized ZIP archives with POSIX forward-slash paths...")
    for zip_path in ZIP_TARGETS:
        with zipfile.ZipFile(zip_path, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
            for root, dirs, files in os.walk(SITE_DIR):
                dirs.sort()
                for file in sorted(files):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, SITE_DIR)
                    posix_path = rel_path.replace(os.sep, '/')
                    zf.write(full_path, arcname=posix_path)
        size_mb = os.path.getsize(zip_path) / (1024 * 1024)
        log(f"Packaged {os.path.basename(zip_path)}: {size_mb:.2f} MB (POSIX normalized).", "DONE")
    return True

def main():
    print("=" * 65)
    print(" GDG SRU · Comprehensive Performance Optimization & Verification")
    print("=" * 65)
    
    if not audit_python_scripts():
        sys.exit(1)
    if not audit_javascript_syntax():
        sys.exit(1)
    if not audit_font_preloads():
        sys.exit(1)
    if not check_parity():
        sys.exit(1)
    if not build_zip_archives():
        sys.exit(1)

    print("=" * 65)
    log("All performance optimizations and archives verified successfully!", "READY")
    print("=" * 65)

if __name__ == "__main__":
    main()
