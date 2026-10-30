import re, sys

sys.stdout.reconfigure(encoding='utf-8')

with open('cloudflare-pages-site/assets/css/page-blogs.css', 'r', encoding='utf-8') as f:
    text = f.read()

# find all occurrences of #pt
for m in re.finditer(r'#pt[^{}]*\{[^}]*\}', text):
    print("MATCH:", m.group(0))

for m in re.finditer(r'@keyframes\s+pt[^{}]*\{[^}]*\}', text):
    print("KEYFRAME:", m.group(0))
