import urllib.request

urls = [
    'https://gdgsru.pages.dev/',
    'https://gdgsru.pages.dev/leaderboard/',
    'https://gdgsru.pages.dev/assets/js/app.js',
    'https://gdgsru.pages.dev/sw.js'
]

for u in urls:
    try:
        req = urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            cc = resp.headers.get("Cache-Control")
            print(f'[LIVE OK] {u} -> Status {resp.status}, Size {len(data)}, Cache-Control: {cc}')
    except Exception as e:
        print(f'[FAIL] {u} -> {e}')
