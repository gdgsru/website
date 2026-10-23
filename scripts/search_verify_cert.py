import os

matches = []
for root, dirs, files in os.walk('deployment/supabase'):
    for f in files:
        if f.endswith('.sql'):
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                text = fl.read()
                if 'verify_certificate' in text:
                    matches.append(p)

print('Files containing verify_certificate:')
for m in matches:
    print(' ', m)
