with open('cloudflare-pages-site/assets/css/page-blogs.css', 'r', encoding='utf-8') as f:
    c = f.read()

idx = 0
while True:
    idx = c.find('body:before', idx)
    if idx == -1: break
    print("MATCH AT", idx)
    print(c[max(0, idx-50):min(len(c), idx+200)])
    idx += 1
