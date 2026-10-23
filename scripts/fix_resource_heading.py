for path in ['cloudflare-pages-site/assets/js/config-loader.js', 'deployment/website/assets/js/config-loader.js']:
    with open(path, 'r', encoding='utf-8') as f:
        t = f.read()
    old_snip = '<div class="resource-section-head"><h3>Free Resources</h3>'
    new_snip = '<div class="resource-section-head"><h2 class="resource-section-title">Free Resources</h2>'
    assert old_snip in t, f'old_snip not found in {path}'
    t = t.replace(old_snip, new_snip)
    
    old_snip2 = '<div class="resource-section-head"><h3>GDG SRU Library</h3>'
    new_snip2 = '<div class="resource-section-head"><h2 class="resource-section-title">GDG SRU Library</h2>'
    assert old_snip2 in t, f'old_snip2 not found in {path}'
    t = t.replace(old_snip2, new_snip2)
    
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(t)
    print(f'Updated {path}')
