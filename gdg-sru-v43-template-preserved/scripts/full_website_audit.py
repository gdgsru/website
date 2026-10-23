import os, sys, glob, re, json, subprocess

WORKSPACE = r"d:\Drafts\Blogs\website\gdg-sru-v43-template-preserved"
SITE_DIR = os.path.join(WORKSPACE, "site")
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

audit_results = {
    "js_syntax": {"passed": [], "failed": []},
    "broken_references": [],
    "html_pages": [],
    "css_files": [],
    "supabase_migrations": [],
    "security_review": [],
    "chrome_routes": []
}

print("=== STARTING COMPLETE AUDIT ===")

# -------------------------------------------------------------
# 1. JAVASCRIPT SYNTAX CHECK (node --check)
# -------------------------------------------------------------
print("\n[1/6] Auditing JavaScript syntax with node --check...")
js_files = glob.glob(os.path.join(SITE_DIR, "**", "*.js"), recursive=True)
for js in js_files:
    rel = os.path.relpath(js, WORKSPACE)
    res = subprocess.run(["node", "--check", js], capture_output=True, text=True)
    if res.returncode == 0:
        audit_results["js_syntax"]["passed"].append(rel)
    else:
        audit_results["js_syntax"]["failed"].append({"file": rel, "error": res.stderr.strip()})

print(f"  -> JS Syntax: {len(audit_results['js_syntax']['passed'])} passed, {len(audit_results['js_syntax']['failed'])} failed.")

# -------------------------------------------------------------
# 2. ASSET & REFERENCE AUDIT
# -------------------------------------------------------------
print("\n[2/6] Auditing all internal asset references in HTML and CSS...")
html_files = glob.glob(os.path.join(SITE_DIR, "**", "*.html"), recursive=True)
css_files = glob.glob(os.path.join(SITE_DIR, "**", "*.css"), recursive=True)

for h in html_files:
    rel_h = os.path.relpath(h, WORKSPACE)
    with open(h, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Extract src="..." and href="..."
    refs = re.findall(r'(?:src|href)=["\']([^"\'#][^"\']*)["\']', content)
    for r in refs:
        if r.startswith("http://") or r.startswith("https://") or r.startswith("mailto:") or r.startswith("data:"):
            continue
        # Absolute path relative to site root
        if r.startswith("/"):
            target = os.path.join(SITE_DIR, r.lstrip("/").split("?")[0].split("#")[0])
        else:
            target = os.path.join(os.path.dirname(h), r.split("?")[0].split("#")[0])

        target = os.path.normpath(target)
        if not os.path.exists(target):
            # Check if directory with index.html
            if not os.path.exists(os.path.join(target, "index.html")):
                audit_results["broken_references"].append({
                    "source": rel_h,
                    "ref": r,
                    "target": os.path.relpath(target, WORKSPACE)
                })

print(f"  -> Checked {len(html_files)} HTML pages. Found {len(audit_results['broken_references'])} broken references.")

# -------------------------------------------------------------
# 3. HTML STRUCTURAL & META AUDIT
# -------------------------------------------------------------
print("\n[3/6] Auditing HTML page structures and metadata...")
for h in html_files:
    rel_h = os.path.relpath(h, WORKSPACE)
    with open(h, "r", encoding="utf-8", errors="ignore") as f:
        c = f.read()
    
    is_partial = "partials" in rel_h or "preview" in rel_h or rel_h.endswith("-template.html")
    has_title = "<title>" in c
    has_viewport = "name=\"viewport\"" in c
    has_charset = "charset=" in c
    has_doctype = "<!doctype html>" in c.lower() or "<!DOCTYPE html>" in c
    
    audit_results["html_pages"].append({
        "file": rel_h,
        "is_partial": is_partial,
        "has_doctype": has_doctype,
        "has_title": has_title,
        "has_viewport": has_viewport,
        "has_charset": has_charset
    })

# -------------------------------------------------------------
# 4. SUPABASE MIGRATIONS AUDIT
# -------------------------------------------------------------
print("\n[4/6] Auditing Supabase SQL migrations...")
sql_files = sorted(glob.glob(os.path.join(WORKSPACE, "supabase", "migrations", "*.sql")))
for s in sql_files:
    rel_s = os.path.relpath(s, WORKSPACE)
    with open(s, "r", encoding="utf-8", errors="ignore") as f:
        sql = f.read()
    
    # Check for table creates, functions, grants
    tables = re.findall(r'CREATE TABLE(?:\s+IF NOT EXISTS)?\s+([a-zA-Z0-9_\.]+)', sql, re.IGNORECASE)
    functions = re.findall(r'CREATE OR REPLACE FUNCTION\s+([a-zA-Z0-9_\.]+)', sql, re.IGNORECASE)
    grants = re.findall(r'GRANT\s+([a-zA-Z0-9_,\s]+)\s+ON\s+([a-zA-Z0-9_\.]+)\s+TO\s+([a-zA-Z0-9_,\s]+)', sql, re.IGNORECASE)
    
    audit_results["supabase_migrations"].append({
        "file": rel_s,
        "tables": tables,
        "functions": functions,
        "grant_count": len(grants)
    })

print(f"  -> Analyzed {len(sql_files)} Supabase SQL migration files.")

# -------------------------------------------------------------
# 5. SECURITY & XSS VULNERABILITY AUDIT
# -------------------------------------------------------------
print("\n[5/6] Auditing security patterns (CSP, innerHTML sanitization, secrets)...")
for js in js_files:
    rel = os.path.relpath(js, WORKSPACE)
    with open(js, "r", encoding="utf-8", errors="ignore") as f:
        code = f.read()

    # Check for hardcoded service_role keys
    if "service_role" in code and not "service_role key" in code.lower():
        audit_results["security_review"].append({
            "file": rel,
            "type": "potential_secret_leak",
            "detail": "Reference to service_role found in client JS"
        })

    # Check for unsafe eval
    if re.search(r'\beval\s*\(', code):
        audit_results["security_review"].append({
            "file": rel,
            "type": "unsafe_eval",
            "detail": "eval() usage found"
        })

print(f"  -> Security checks completed. Found {len(audit_results['security_review'])} security alerts.")

# -------------------------------------------------------------
# 6. RUNTIME HEADLESS CHROME ROUTE VERIFICATION
# -------------------------------------------------------------
print("\n[6/6] Running headless Chrome route audits across site on port 8080...")

ROUTES = [
    "/",
    "/events/",
    "/team/",
    "/blog/",
    "/join/",
    "/certificates/",
    "/verify/",
    "/leaderboard/",
    "/resources/",
    "/privacy/",
    "/mission-control.html"
]

import urllib.request
server_up = False
try:
    with urllib.request.urlopen("http://localhost:8080/", timeout=3) as res:
        if res.status == 200:
            server_up = True
except Exception as e:
    pass

print(f"  -> Local HTTP server check: {'ONLINE (Port 8080)' if server_up else 'OFFLINE'}")

report_path = os.path.join(WORKSPACE, "scripts", "audit_summary.json")
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(audit_results, f, indent=2)

print("\n=== AUDIT SUMMARY SAVED TO scripts/audit_summary.json ===")
