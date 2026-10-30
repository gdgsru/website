import subprocess
import time
import json
import urllib.request
import os
try:
    from scripts.inspect_team_blog import send_cdp
except ModuleNotFoundError:
    from inspect_team_blog import send_cdp

server = subprocess.Popen(["python", "-m", "http.server", "8899", "--directory", "cloudflare-pages-site"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1)

chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
chrome = subprocess.Popen([
    chrome_path,
    "--headless=new",
    "--remote-debugging-port=9222",
    "--disable-gpu",
    "--window-size=1200,900"
], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(2)

try:
    resp = urllib.request.urlopen("http://localhost:9222/json")
    tabs = json.loads(resp.read().decode())
    target = [t for t in tabs if t.get("type") == "page"][0]
    ws_url = target["webSocketDebuggerUrl"]
    
    for route in ["/team/", "/blog/"]:
        send_cdp(ws_url, "Page.navigate", {"url": f"http://localhost:8899{route}"}, 1)
        time.sleep(2)
        
        res = send_cdp(ws_url, "Runtime.evaluate", {
            "expression": """(() => {
                const el = document.elementFromPoint(10, 5);
                const wp = document.getElementById("wp");
                const pt = document.getElementById("pt");
                const progress = document.getElementById("scroll-progress");
                return {
                    route: location.pathname,
                    element_at_10_5: el ? {
                        tag: el.tagName,
                        id: el.id,
                        class: el.className,
                        parent: el.parentElement ? el.parentElement.tagName + '#' + el.parentElement.id : null,
                        computedStyle: {
                            position: getComputedStyle(el).position,
                            zIndex: getComputedStyle(el).zIndex,
                            transform: getComputedStyle(el).transform,
                            display: getComputedStyle(el).display,
                            visibility: getComputedStyle(el).visibility,
                            opacity: getComputedStyle(el).opacity
                        }
                    } : null,
                    wp: wp ? {
                        display: getComputedStyle(wp).display,
                        visibility: getComputedStyle(wp).visibility,
                        opacity: getComputedStyle(wp).opacity,
                        innerHTML: wp.innerHTML.slice(0, 100)
                    } : null,
                    pt: pt ? {
                        display: getComputedStyle(pt).display,
                        visibility: getComputedStyle(pt).visibility,
                        opacity: getComputedStyle(pt).opacity,
                        b1_tr: getComputedStyle(pt.querySelector('.b1')).transform
                    } : null
                };
            })()""",
            "returnByValue": True
        }, 2)
        print(f"=== {route} ===")
        print(json.dumps(res.get("result", {}).get("result", {}).get("value", {}), indent=2))

finally:
    chrome.terminate()
    server.terminate()
