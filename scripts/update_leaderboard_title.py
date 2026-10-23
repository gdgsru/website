with open('cloudflare-pages-site/assets/js/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_str = 'return `<div class="page"><span class="eyebrow">'
new_str = 'return `<div class="page page-leaderboard"><span class="eyebrow">'
assert old_str in text, "old_str not found in app.js"
text = text.replace(old_str, new_str)

with open('cloudflare-pages-site/assets/js/app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

with open('deployment/website/assets/js/app.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(text)

print('Updated app.js successfully!')
