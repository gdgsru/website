with open('cloudflare-pages-site/assets/css/page-blogs.css', 'r', encoding='utf-8') as f:
    c = f.read()

idx = c.find('#pt')
while idx != -1:
    print("--- MATCH AT", idx, "---")
    print(c[max(0, idx-50):min(len(c), idx+150)])
    idx = c.find('#pt', idx+1)
