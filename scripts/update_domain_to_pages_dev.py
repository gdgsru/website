import os

target_dirs = ['cloudflare-pages-site', 'deployment/website']
count = 0

for base in target_dirs:
    for root, dirs, files in os.walk(base):
        for f in files:
            if f.endswith(('.html', '.xml', '.txt')):
                p = os.path.join(root, f)
                with open(p, 'r', encoding='utf-8') as fl:
                    c = fl.read()
                if 'gdgsru.org' in c or 'gdgsru.com' in c:
                    c = c.replace('https://gdgsru.org', 'https://gdgsru.pages.dev')
                    c = c.replace('http://gdgsru.org', 'https://gdgsru.pages.dev')
                    c = c.replace('https://gdgsru.com', 'https://gdgsru.pages.dev')
                    c = c.replace('http://gdgsru.com', 'https://gdgsru.pages.dev')
                    c = c.replace('gdgsru.org', 'gdgsru.pages.dev')
                    with open(p, 'w', encoding='utf-8', newline='\n') as fl:
                        fl.write(c)
                    count += 1
                    print(f'Updated domain in {p}')

print(f'Finished updating {count} files to https://gdgsru.pages.dev!')
