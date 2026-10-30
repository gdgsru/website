with open('cloudflare-pages-site/team/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

import re
m = re.search(r'<script>try\{var q=sessionStorage\.getItem\("gdg-pt"\).*?</script>', text, re.DOTALL)
if m:
    print(m.group(0))
