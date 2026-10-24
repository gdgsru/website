import os
import subprocess
import time
import requests

artifact_dir = r"C:\Users\Narayan Bora\.gemini\antigravity\brain\88b431b3-07a3-41f7-bed6-96a805f27d93"
chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
base_url = "https://gdgsru.pages.dev"

routes = [
    ("/", "Home"),
    ("/certificates/", "Certificates Claim"),
    ("/verify/", "Certificate Verification"),
    ("/events/", "Events Directory"),
    ("/team/", "Team Roster"),
    ("/leaderboard/", "Leaderboard"),
    ("/resources/", "Resource Hub"),
    ("/blog/", "Blog"),
    ("/admin/", "Mission Control"),
    ("/assets/admin/certificates-admin.js", "Certificates Admin JS"),
    ("/assets/js/cert-engine.js", "Cert Engine JS")
]

print("=== 1. Live Endpoint HTTP Health Checks ===")
all_passed = True
for path, label in routes:
    url = base_url + path
    try:
        r = requests.get(url, timeout=10)
        status = r.status_code
        size = len(r.content)
        ok = status in (200, 304)
        if not ok:
            all_passed = False
        print(f"  [{'PASS' if ok else 'FAIL'}] {label} ({path}) -> HTTP {status} ({size} bytes)")
    except Exception as e:
        print(f"  [ERROR] {label} ({path}) -> {e}")
        all_passed = False

print("\n=== 2. Capturing Headless Visual Snapshots ===")
shots = [
    ("/", "live_test_home.png", 1200, 1000),
    ("/certificates/", "live_test_certificates.png", 1200, 1000),
    ("/verify/", "live_test_verify.png", 1200, 900),
    ("/admin/", "live_test_admin.png", 1400, 1000),
]

for route, fname, w, h in shots:
    url = base_url + route
    dst = os.path.join(artifact_dir, fname)
    try:
        subprocess.run([
            chrome_path,
            "--headless=new",
            "--disable-gpu",
            "--force-prefers-reduced-motion",
            "--virtual-time-budget=4000",
            f"--screenshot={dst}",
            f"--window-size={w},{h}",
            url
        ], timeout=15)
        exists = os.path.exists(dst)
        sz = os.path.getsize(dst) if exists else 0
        print(f"  [{'CAPTURED' if exists else 'FAILED'}] {route} -> {fname} ({sz} bytes)")
    except Exception as e:
        print(f"  [ERROR] {route} -> {e}")

print("\n=== 3. Admin Certificates Workbench Script Verification ===")
admin_js_url = f"{base_url}/assets/admin/certificates-admin.js"
r = requests.get(admin_js_url)
has_logo_studio = "// GDG Chapter Logo & Studio" in r.text or "GDG Chapter Logo" in r.text
has_zoom_125 = 'data-zoom="125"' in r.text
has_drag = "enableLogoDrag" in r.text
print(f"  Live admin JS size: {len(r.text)} bytes")
print(f"  Has GDG Chapter Logo Studio: {has_logo_studio}")
print(f"  Has 125% Zoom Preset: {has_zoom_125}")
print(f"  Has Direct Canvas Logo Pointer Drag: {has_drag}")

print("\n=== Test Suite Finished ===")
