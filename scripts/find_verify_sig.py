import os, re

for root, dirs, files in os.walk('deployment/supabase'):
    for f in files:
        if f.endswith('.sql'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                t = fl.read()
            m = re.findall(r'function\s+public\.verify_certificate\s*\([^)]*\)', t, re.IGNORECASE)
            if m:
                print(f'{p}: {m}')
