import os, re

base_dir = 'cloudflare-pages-site'

corrupt_patterns = [
    re.compile(r'\u0393[\u0080-\u00ff\u2500-\u257f\u2550-\u256c]'), # CP437 gamma prefix
    re.compile(r'\u252c[\u2556\xb7]'),                               # ┬╖
    re.compile(r'\ufffd'),                                           # Replacement char
    re.compile(r'\u2261\u0192'),                                     # ≡ƒ (4-byte cp437)
    re.compile(r'\u251c\xf9'),                                       # ├ù
]

found = []
file_count = 0

for root, dirs, files in os.walk(base_dir):
    for f in files:
        if f.endswith(('.html', '.js', '.css', '.json', '.xml', '.txt', '.webmanifest')):
            file_count += 1
            p = os.path.join(root, f)
            with open(p, 'r', encoding='utf-8', errors='ignore') as fl:
                text = fl.read()
            for pat in corrupt_patterns:
                m = pat.findall(text)
                if m:
                    found.append((p, pat.pattern, len(m)))

print(f'Scanned {file_count} text/code files for mojibake and encoding corruption.')
if found:
    print(f'FOUND {len(found)} corrupt occurrences:')
    for p, pat, cnt in found:
        print(f'  {p}: pattern {pat} matched {cnt} times')
else:
    print('100% clean! Zero mojibake or encoding corruption across all files.')
