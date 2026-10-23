import re, urllib.request, json

with open('deployment/supabase/FULL_SUPABASE_SETUP.sql', 'r', encoding='utf-8') as f:
    text = f.read()

tables = re.findall(r'CREATE TABLE (?:IF NOT EXISTS )?public\.([a-zA-Z0-9_]+)', text, re.IGNORECASE)
print('Tables found in SQL:', tables)

url = 'https://isfhqbytrbilceqddnll.supabase.co/rest/v1/'
anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZmhxYnl0cmJpbGNlcWRkbmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDk2MzcsImV4cCI6MjEwNzEyNTYzN30.KkOi9s-Mg91y6sXjPZlnJFwQJxngEX1hLWOxq_xgx6g'
headers = {'apikey': anon, 'Authorization': f'Bearer {anon}'}

for tbl in sorted(set(tables)):
    try:
        req = urllib.request.Request(f'{url}{tbl}?select=*&limit=1', headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            print(f'  [OK] Table {tbl}: accessible ({len(data)} rows)')
    except urllib.error.HTTPError as e:
        if e.code in [401, 403]:
            print(f'  [SECURED] Table {tbl}: RLS restricted (HTTP {e.code})')
        else:
            print(f'  [FAIL] Table {tbl}: HTTP {e.code}')
    except Exception as e:
        print(f'  [FAIL] Table {tbl}: {e}')
