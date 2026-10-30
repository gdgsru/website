with open('cloudflare-pages-site/assets/css/page-home.css', 'r', encoding='utf-8') as f:
    c = f.read()

idx = c.find('scroll-progress')
while idx != -1:
    print(c[idx:idx+250])
    idx = c.find('scroll-progress', idx+1)
