def extract_pt_dict(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    blocks = content.split('}')
    rules = {}
    for b in blocks:
        if '#pt' in b or '.pt-' in b or 'ptIn' in b or 'ptOut' in b or 'ptChar' in b or 'ptTitle' in b:
            parts = b.split('{')
            if len(parts) == 2:
                sel = parts[0].strip()
                body = parts[1].strip()
                rules[sel] = body
    return rules

nav = extract_pt_dict('cloudflare-pages-site/assets/css/site-nav.css')
team = extract_pt_dict('cloudflare-pages-site/assets/css/page-team.css')
blogs = extract_pt_dict('cloudflare-pages-site/assets/css/page-blogs.css')

print(f"site-nav.css has {len(nav)} pt rules")
print(f"page-team.css has {len(team)} pt rules")
print(f"page-blogs.css has {len(blogs)} pt rules")

print("\n--- Diff between page-team.css and page-blogs.css ---")
all_sels = set(team.keys()).union(blogs.keys())
diff_count = 0
for sel in sorted(all_sels):
    t_val = team.get(sel)
    b_val = blogs.get(sel)
    if t_val != b_val:
        print(f"DIFF SELECTOR: {sel}")
        print(f"  team:  {t_val}")
        print(f"  blogs: {b_val}")
        diff_count += 1
if diff_count == 0:
    print("page-team.css and page-blogs.css have IDENTICAL pt rules!")

print("\n--- Rules in page-team/blogs that differ from site-nav.css ---")
for sel in sorted(team.keys()):
    if sel in nav:
        if team[sel] != nav[sel]:
            print(f"OVERRIDE CONFLICT: {sel}")
            print(f"  page: {team[sel]}")
            print(f"  nav:  {nav[sel]}")
    else:
        print(f"EXTRA IN PAGE: {sel} -> {team[sel]}")

for sel in sorted(nav.keys()):
    if sel not in team:
        print(f"EXTRA IN NAV: {sel} -> {nav[sel]}")
