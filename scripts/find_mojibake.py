import os

mojibake_chars = ['\u0393', '\u252c', '\u2556']

results = []
for r, d, files in os.walk('cloudflare-pages-site'):
    for f in files:
        if f.endswith(('.js', '.html', '.css')):
            p = os.path.join(r, f)
            text = open(p, encoding='utf-8', errors='ignore').read()
            found = [m for m in mojibake_chars if m in text]
            if found:
                results.append((p.replace('\\', '/'), len(found)))

with open('scripts/mojibake_results.txt', 'w', encoding='utf-8') as out:
    for p, cnt in results:
        out.write(f"{p}: {cnt}\n")

print(f"Scanned complete. Found in {len(results)} files.")
