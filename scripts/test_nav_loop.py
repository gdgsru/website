import subprocess
import time
import os
import json
import base64
import urllib.request
import socket

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

    parts = ws_url.replace("ws://", "").split("/", 1)
    host, port = parts[0].split(":")
    path = "/" + parts[1]
    ws = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    ws.connect((host, int(port)))
    key = base64.b64encode(os.urandom(16)).decode()
    ws.sendall((
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    ).encode())
    ws.recv(4096)
    
    def send(method, params=None, id=1):
        data = json.dumps({"id": id, "method": method, "params": params or {}}).encode()
        frame = bytearray([0x81])
        mask = os.urandom(4)
        if len(data) <= 125:
            frame.append(0x80 | len(data))
        else:
            frame.extend([0x80 | 126, (len(data) >> 8) & 0xff, len(data) & 0xff])
        frame.extend(mask)
        frame.extend(bytearray(b ^ mask[i % 4] for i, b in enumerate(data)))
        ws.sendall(frame)
        
    def read_messages(timeout=2.0):
        ws.settimeout(timeout)
        msgs = []
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                hdr = ws.recv(2)
                if not hdr: break
                l = hdr[1] & 0x7f
                if l == 126:
                    l = int.from_bytes(ws.recv(2), 'big')
                elif l == 127:
                    l = int.from_bytes(ws.recv(8), 'big')
                payload = b""
                while len(payload) < l:
                    payload += ws.recv(l - len(payload))
                txt = payload.decode('utf-8', errors='ignore')
                msgs.append(json.loads(txt))
            except socket.timeout:
                break
            except Exception as e:
                break
        return msgs

    send("Runtime.enable", {}, 1)
    send("Log.enable", {}, 2)
    read_messages(0.5)

    # 1. Start at /
    send("Page.navigate", {"url": "http://localhost:8899/"}, 10)
    read_messages(2.5)

    # Sequence of navigations
    for step_num, (from_desc, link_sel, expected_dest) in enumerate([
        ("Home", 'header#hd nav.lk a[href="/team/"]', "/team/"),
        ("Team", 'header#hd nav.lk a[href="/blog/"]', "/blog/"),
        ("Blog", 'header#hd nav.lk a[href="/events/"]', "/events/"),
        ("Events", 'header#hd nav.lk a[href="/team/"]', "/team/"),
        ("Team", 'header#hd nav.lk a[href="/"]', "/")
    ]):
        print(f"\n[{step_num+1}] Navigating from {from_desc} via {link_sel} to {expected_dest}")
        
        # Click the link
        send("Runtime.evaluate", {
            "expression": f"""(() => {{
                const a = document.querySelector('{link_sel}');
                if (a) {{
                    a.click();
                    return true;
                }}
                return false;
            }})()""",
            "returnByValue": True
        }, 100 + step_num)
        
        # Sample state during transition: at 100ms, 250ms, 500ms
        for delay in [0.1, 0.2, 0.25]:
            time.sleep(delay)
            send("Runtime.evaluate", {
                "expression": """(() => {
                    const pt = document.getElementById("pt");
                    const span = document.querySelector("#pt .t span");
                    const b1 = document.querySelector("#pt .b1");
                    return {
                        htmlClass: document.documentElement.className,
                        ptVisible: pt ? getComputedStyle(pt).visibility : null,
                        ptTitle: span ? span.getAttribute("aria-label") : null,
                        spanText: span ? span.innerText : null,
                        b1_transform: b1 ? getComputedStyle(b1).transform : null
                    };
                })()""",
                "returnByValue": True
            }, 200 + step_num)
            eval_msgs = read_messages(0.15)
            for em in eval_msgs:
                if em.get("id") == 200 + step_num:
                    print(f"  t+{delay}s:", em.get("result", {}).get("result", {}).get("value"))

        # Wait for navigation to complete
        time.sleep(1.0)
        
        # Check arrived URL
        send("Runtime.evaluate", {"expression": "location.pathname"}, 300 + step_num)
        eval_msgs = read_messages(0.5)
        for em in eval_msgs:
            if em.get("id") == 300 + step_num:
                print(f"  Arrived at: {em.get('result', {}).get('result', {}).get('value')}")

    ws.close()
finally:
    chrome.terminate()
    server.terminate()
