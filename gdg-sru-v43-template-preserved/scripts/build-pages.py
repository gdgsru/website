#!/usr/bin/env python3
"""Keeps the header, navigation, mobile menu and footer identical on every public page.

Source of truth: site/partials/*.html. Each page carries marker comments around the shared blocks:
  <!-- partial:header --> ... <!-- /partial:header -->
  <!-- partial:menu -->   ... <!-- /partial:menu -->
  <!-- partial:footer --> ... <!-- /partial:footer -->

Usage:
  python3 scripts/build-pages.py           rewrite every page from the partials
  python3 scripts/build-pages.py --check   fail (exit 1) if any page is out of date
  python3 scripts/build-pages.py --init    add marker comments around the current blocks (one-time)
"""
import glob, os, re, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site')
PARTIALS = os.path.join(ROOT, 'partials')
SKIP = {'mission-control.html', 'team-card-preview.html', 'member-badge.html', 'admin.html'}  # admin, preview, studio and standalone custom pass carry no public chrome
SKIP_DIRS = {'member-badge', 'admin'}

# Route key (from <body data-route>) -> nav link href. Keys match the nav and menu items.
NAV_HREF = {'home': '/', 'events': '/events/', 'team': '/team/', 'blogs': '/blog/',
            'perks': '/resources/', 'leaderboard': '/leaderboard/'}

def read(p):
    return open(p, encoding='utf8').read()

def write(p, s):
    open(p, 'w', encoding='utf8').write(s)

def apply_nav(items, route):
    active = NAV_HREF.get(route)
    def fix(m):
        href = m.group(1)
        return f'<a href="{href}" class="on">' if href == active else m.group(0)
    return re.sub(r'<a href="([^"]*)" class="">', fix, items)

def apply_menu(items, route):
    # Menu item whose data-menu-page matches the route gets aria-current and "YOU'RE HERE".
    def mark(m):
        tag = m.group(0)
        if route and f'data-menu-page="{route}"' in tag:
            return tag.replace('onclick="mo(0)" ', 'onclick="mo(0)" aria-current="page" ', 1)
        return tag
    items = re.sub(r'<a [^>]*data-menu-page="[^"]+"[^>]*>', mark, items)
    out = []
    for m in re.finditer(r'<a [^>]*aria-current="page"[^>]*>', items):
        end = items.find('</a>', m.end())
        seg = items[m.end():end].replace(
            '</span><span class="menu-desc">',
            '<span class="menu-current">YOU’RE HERE</span></span><span class="menu-desc">', 1)
        out.append((m.end(), end, seg))
    for s, e, new in sorted(out, reverse=True):
        items = items[:s] + new + items[e:]
    return items

def render(route):
    header = read(os.path.join(PARTIALS, 'header.html')).replace(
        '{{NAV}}', apply_nav(read(os.path.join(PARTIALS, 'nav-items.html')), route).rstrip())
    menu = read(os.path.join(PARTIALS, 'menu.html')).replace(
        '{{MENU}}', apply_menu(read(os.path.join(PARTIALS, 'menu-items.html')), route).rstrip())
    footer = read(os.path.join(PARTIALS, 'footer.html'))
    return {'header': header.rstrip() + '\n', 'menu': menu.rstrip() + '\n', 'footer': footer.rstrip() + '\n'}

def route_of(html):
    m = re.search(r'<body\b[^>]*\bdata-route="([^"]+)"', html)
    return m.group(1) if m else None

def find_block(html, kind):
    """Locate the current shared block on a page (used by --init)."""
    if kind == 'header':
        m = re.search(r'<header id="hd">.*?</header>', html, re.S)
        return (m.start(), m.end()) if m else None
    if kind == 'footer':
        m = re.search(r'<footer style="padding:40px 24px;.*?</footer>', html, re.S)
        return (m.start(), m.end()) if m else None
    if kind == 'menu':
        start = html.find('<div id="mo"')
        if start < 0:
            return None
        depth = 0
        for m in re.finditer(r'<(/?)div\b[^>]*>', html[start:]):
            depth += -1 if m.group(1) else 1
            if depth == 0:
                return (start, start + m.end())
    return None

def pages():
    """Public pages: root-level HTML pages and */index.html. 404.html stays a standalone page."""
    found = glob.glob(os.path.join(ROOT, '*.html')) + glob.glob(os.path.join(ROOT, '*', 'index.html'))
    return sorted(p for p in found if os.path.basename(p) not in SKIP | {'404.html'} and os.path.basename(os.path.dirname(p)) not in SKIP_DIRS)

def init():
    for p in pages():
        html = read(p)
        changed = False
        for kind in ('header', 'menu', 'footer'):
            if f'<!-- partial:{kind} -->' in html:
                continue
            span = find_block(html, kind)
            if not span:
                print(f'  no {kind} block found in {os.path.relpath(p, ROOT)}')
                continue
            s, e = span
            html = html[:s] + f'<!-- partial:{kind} -->' + html[s:e] + f'<!-- /partial:{kind} -->' + html[e:]
            changed = True
        if changed:
            write(p, html)
            print('marked', os.path.relpath(p, ROOT))

def rewrite(check):
    stale = []
    for p in pages():
        html = read(p)
        route = route_of(html)
        parts = render(route)
        new = html
        for kind in ('header', 'menu', 'footer'):
            pat = re.compile(rf'<!-- partial:{kind} -->.*?<!-- /partial:{kind} -->', re.S)
            if not pat.search(new):
                print(f'missing markers for {kind} in {os.path.relpath(p, ROOT)}; run with --init')
                sys.exit(2)
            new = pat.sub(lambda _m: f'<!-- partial:{kind} -->\n{parts[kind]}<!-- /partial:{kind} -->', new, count=1)
        if new != html:
            stale.append(os.path.relpath(p, ROOT))
            if not check:
                write(p, new)
    if check and stale:
        print('Out of date (run scripts/build-pages.py):'); [print('  ', s) for s in stale]
        sys.exit(1)
    print(('All pages up to date.' if check else f'Rebuilt {len(stale)} page(s).'))

if __name__ == '__main__':
    if '--init' in sys.argv:
        init()
    else:
        rewrite(check='--check' in sys.argv)
