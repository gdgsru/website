with open('cloudflare-pages-site/assets/css/page-home.css', 'r', encoding='utf-8') as f:
    c = f.read()

idx = c.find('#wp')
while idx != -1:
    print(c[idx:idx+200])
    idx = c.find('#wp', idx+1)
