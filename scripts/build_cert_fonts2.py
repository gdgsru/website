#!/usr/bin/env python3
"""
Build clean cert-fonts.css with woff2 files served from /assets/fonts/cert/
Uses absolute URLs so they work from srcdoc iframes.
Also renames woff2 files to clean names.
"""

import re
import os
import base64
import shutil

FONTS_DIR = r"d:\Drafts\Blogs\website\cloudflare-pages-site\assets\fonts\cert"
OUT_CSS_STATIC = r"d:\Drafts\Blogs\website\cloudflare-pages-site\assets\fonts\cert-fonts.css"
CLEAN_DIR = os.path.join(FONTS_DIR, "clean")
os.makedirs(CLEAN_DIR, exist_ok=True)

CSS_CACHE = os.path.join(FONTS_DIR, "google-fonts-response.css")

with open(CSS_CACHE, encoding="utf-8") as f:
    css = f.read()

blocks = re.findall(r'@font-face\s*\{([^}]+)\}', css, re.DOTALL)

def parse_block(block):
    family = re.search(r"font-family:\s*'?([^;']+)'?;", block)
    weight = re.search(r"font-weight:\s*(\d+)\s*;", block)
    style = re.search(r"font-style:\s*(\w+)\s*;", block)
    url = re.search(r"url\(([^)]+\.woff2)\)", block)
    unicode_range = re.search(r"unicode-range:\s*([^;]+);", block)
    return {
        "family": family.group(1).strip() if family else "",
        "weight": weight.group(1).strip() if weight else "400",
        "style": style.group(1).strip() if style else "normal",
        "url": url.group(1).strip() if url else "",
        "unicode_range": unicode_range.group(1).strip() if unicode_range else "",
    }

CERT_FONTS = {"Outfit", "Space Grotesk", "JetBrains Mono", "Kalam", "Inter"}
CERT_WEIGHTS = {
    "Outfit": {"400", "500", "600", "700", "800", "900"},
    "Space Grotesk": {"500", "700", "900"},
    "JetBrains Mono": {"400", "600", "700", "800"},
    "Kalam": {"400", "700"},
    "Inter": {"400", "500", "600", "700", "800"},
}
LATIN_MARKER = "U+0000-00FF"

def is_latin(unicode_range):
    return LATIN_MARKER in unicode_range

parsed = [parse_block(b) for b in blocks]

css_lines = [
    "/* Self-hosted certificate fonts — latin subset — woff2 files served from /assets/fonts/cert/clean/",
    " * This file is used in the certificate template to avoid cross-origin font blocking in html2canvas.",
    " */",
    ""
]

base64_blocks = []  # Will store (family, weight, style, b64_data_uri)

for p in parsed:
    if p["family"] not in CERT_FONTS:
        continue
    if p["weight"] not in CERT_WEIGHTS.get(p["family"], set()):
        continue
    if not p["url"]:
        continue
    if not is_latin(p["unicode_range"]):
        continue
    
    # Make a clean filename
    family_slug = p["family"].lower().replace(" ", "-")
    clean_name = f"{family_slug}-{p['weight']}.woff2"
    clean_path = os.path.join(CLEAN_DIR, clean_name)
    
    # Find the source file in FONTS_DIR
    # The downloaded files are named <gstatic_filename>_<Family>_<weight>.woff2
    src_url_file = p["url"].split("/")[-1]
    family_tag = p["family"].replace(" ", "_")
    src_name = f"{src_url_file}_{family_tag}_{p['weight']}.woff2"
    src_path = os.path.join(FONTS_DIR, src_name)
    
    if not os.path.exists(src_path):
        print(f"  MISSING: {src_path}")
        continue
    
    if not os.path.exists(clean_path):
        shutil.copy2(src_path, clean_path)
    
    # Read and base64 encode for inline embedding
    with open(src_path, "rb") as f:
        data = f.read()
    b64 = base64.b64encode(data).decode("ascii")
    data_uri = f"data:font/woff2;base64,{b64}"
    
    base64_blocks.append((p["family"], p["weight"], p["style"], data_uri))
    print(f"  {p['family']} {p['weight']} -> {clean_name} ({len(data)//1024}KB)")
    
    # Static URL version (for non-srcdoc use)
    static_url = f"/assets/fonts/cert/clean/{clean_name}"
    css_lines.append(f"@font-face {{")
    css_lines.append(f"  font-family: '{p['family']}';")
    css_lines.append(f"  font-style: {p['style']};")
    css_lines.append(f"  font-weight: {p['weight']};")
    css_lines.append(f"  font-display: swap;")
    css_lines.append(f"  src: url('{static_url}') format('woff2');")
    css_lines.append(f"}}")
    css_lines.append("")

# Write the static URL version (for use on the main page)
with open(OUT_CSS_STATIC, "w", encoding="utf-8") as f:
    f.write("\n".join(css_lines))
print(f"\nWrote static CSS: {OUT_CSS_STATIC} ({os.path.getsize(OUT_CSS_STATIC)//1024}KB)")

# Write a base64 embedded version for use in certificate template
INLINE_CSS = r"d:\Drafts\Blogs\website\cloudflare-pages-site\assets\fonts\cert-fonts-inline.css"
inline_lines = [
    "/* Self-hosted certificate fonts — base64 data URIs for use in srcdoc iframes",
    " * Allows html2canvas to capture fonts without cross-origin issues.",
    " */",
    ""
]
for family, weight, style, data_uri in base64_blocks:
    inline_lines.append(f"@font-face {{")
    inline_lines.append(f"  font-family: '{family}';")
    inline_lines.append(f"  font-style: {style};")
    inline_lines.append(f"  font-weight: {weight};")
    inline_lines.append(f"  font-display: block;")
    inline_lines.append(f"  src: url('{data_uri}') format('woff2');")
    inline_lines.append(f"}}")
    inline_lines.append("")

with open(INLINE_CSS, "w", encoding="utf-8") as f:
    f.write("\n".join(inline_lines))
size_kb = os.path.getsize(INLINE_CSS) // 1024
print(f"Wrote inline CSS: {INLINE_CSS} ({size_kb}KB)")
print("Done!")
