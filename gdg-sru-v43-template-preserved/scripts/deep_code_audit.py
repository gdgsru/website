import os
import re
import subprocess
import glob
import json

BASE_DIR = os.path.abspath('gdg-sru-v43-template-preserved')
SITE_DIR = os.path.join(BASE_DIR, 'site')

report = {
    "total_lines": 0,
    "file_counts": {},
    "js_syntax_errors": [],
    "html_audit": [],
    "css_audit": [],
    "security_audit": [],
    "cert_engine_audit": []
}

# 1. Count lines and files
total_lines = 0
file_counts = {}
for root, dirs, files in os.walk(BASE_DIR):
    # skip node_modules or .git if any
    if 'node_modules' in dirs: dirs.remove('node_modules')
    if '.git' in dirs: dirs.remove('.git')
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        file_counts[ext] = file_counts.get(ext, 0) + 1
        path = os.path.join(root, f)
        try:
            with open(path, 'r', encoding='utf-8', errors='ignore') as fl:
                total_lines += sum(1 for _ in fl)
        except Exception:
            pass

report["total_lines"] = total_lines
report["file_counts"] = file_counts

# 2. Syntax check on all JS files
js_files = glob.glob(os.path.join(BASE_DIR, '**', '*.js'), recursive=True)
for js in js_files:
    rel = os.path.relpath(js, BASE_DIR)
    try:
        res = subprocess.run(['node', '--check', js], capture_output=True, text=True)
        if res.returncode != 0:
            report["js_syntax_errors"].append({"file": rel, "error": res.stderr.strip()})
    except Exception as e:
        report["js_syntax_errors"].append({"file": rel, "error": str(e)})

# 3. HTML Audit
html_files = glob.glob(os.path.join(SITE_DIR, '**', '*.html'), recursive=True)
for html in html_files:
    rel = os.path.relpath(html, BASE_DIR)
    with open(html, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    
    issues = []
    # Check meta tags
    if '<meta charset=' not in content and '<meta charset="' not in content and '<meta http-equiv="Content-Type"' not in content:
        issues.append("Missing charset meta tag")
    if 'name="viewport"' not in content and "<meta name='viewport'" not in content:
        issues.append("Missing viewport meta tag")
    if '<title>' not in content and '<title ' not in content:
        issues.append("Missing <title> tag")
    
    # Check target="_blank" without rel
    blank_links = re.findall(r'<a\s+[^>]*target=["\']_blank["\'][^>]*>', content, re.IGNORECASE)
    for bl in blank_links:
        if 'rel=' not in bl.lower():
            issues.append(f'target="_blank" link missing rel="noopener": {bl[:60]}...')
            break

    # Check broken local asset links (src="..." or href="...")
    asset_refs = re.findall(r'(?:src|href)=["\']([^"\'#?]+)["\']', content)
    for ref in asset_refs:
        if ref.startswith(('http://', 'https://', 'mailto:', 'tel:', 'data:', 'javascript:')):
            continue
        # Clean path
        clean = ref.lstrip('/')
        disk_path = os.path.join(SITE_DIR, clean)
        # also check if relative to html file
        rel_to_file = os.path.join(os.path.dirname(html), clean)
        # also check if directory with index.html
        if not (os.path.exists(disk_path) or os.path.exists(rel_to_file) or os.path.exists(os.path.join(disk_path, 'index.html')) or os.path.exists(os.path.join(rel_to_file, 'index.html'))):
            # check root of site
            if not os.path.exists(os.path.join(BASE_DIR, clean)):
                issues.append(f"Broken asset reference: {ref}")

    report["html_audit"].append({"file": rel, "issues": issues, "status": "PASS" if not issues else "WARN"})

# 4. CSS Audit (Brace and comment balance)
css_files = glob.glob(os.path.join(SITE_DIR, '**', '*.css'), recursive=True)
for css in css_files:
    rel = os.path.relpath(css, BASE_DIR)
    with open(css, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    issues = []
    # Count open vs close braces outside strings
    opens = content.count('{')
    closes = content.count('}')
    if opens != closes:
        issues.append(f"Unmatched braces: {opens} open vs {closes} close")
    c_open = content.count('/*')
    c_close = content.count('*/')
    if c_open != c_close:
        issues.append(f"Unmatched comment delimiters: {c_open} /* vs {c_close} */")
    report["css_audit"].append({"file": rel, "issues": issues, "status": "PASS" if not issues else "FAIL"})

# 5. Security & Injections Check in JS
for js in js_files:
    rel = os.path.relpath(js, BASE_DIR)
    with open(js, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    issues = []
    # Check for direct eval()
    if re.search(r'\beval\s*\(', content):
        issues.append("Direct eval() detected")
    # Check for http:// URLs (unencrypted)
    insecure_urls = re.findall(r'http://[a-zA-Z0-9.-]+(?::[0-9]+)?/[^"\'\s)]*', content)
    insecure_urls = [u for u in insecure_urls if not ('localhost' in u or '127.0.0.1' in u or 'w3.org' in u)]
    if insecure_urls:
        issues.append(f"Insecure http:// endpoints: {insecure_urls[:2]}")
    report["security_audit"].append({"file": rel, "issues": issues, "status": "PASS" if not issues else "WARN"})

# 6. Certificate Engine Verification
cert_engine_js = os.path.join(SITE_DIR, 'assets', 'js', 'cert-engine.js')
if os.path.exists(cert_engine_js):
    with open(cert_engine_js, 'r', encoding='utf-8') as f:
        cert_code = f.read()
    checks = {
        "has_renderUserDesignCertificate": "renderUserDesignCertificate" in cert_code,
        "has_renderMasterCertificateSvg": "renderMasterCertificateSvg" in cert_code,
        "has_exportPng": "exportPng" in cert_code,
        "has_exportSvg": "exportSvg" in cert_code,
        "has_curriculum_overview": "curriculum" in cert_code or "curriculum_overview" in cert_code,
        "has_tags_rendering": "tags" in cert_code,
        "has_dossier_cards": "dossier" in cert_code or "dossier_tag" in cert_code,
        "has_terminal_log": "terminal" in cert_code or "log_entries" in cert_code,
        "has_qr_verification_link": "verify" in cert_code
    }
    report["cert_engine_audit"] = checks

print(json.dumps(report, indent=2))
with open('gdg-sru-v43-template-preserved/scripts/deep_code_audit_results.json', 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2)
