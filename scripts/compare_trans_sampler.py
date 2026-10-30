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
    read_messages(0.5)

    def test_transition(start_url, click_sel, dest_name):
        print(f"\n================ TRANSITION TO {dest_name} (from {start_url}) ================")
        send("Page.navigate", {"url": f"http://localhost:8899{start_url}"}, 10)
        read_messages(2.0)
        
        # Injected sampler that logs every 50ms inside the page into window.__samples
        send("Runtime.evaluate", {
            "expression": f"""(() => {{
                window.__samples = [];
                const link = document.querySelector('{click_sel}');
                if (!link) return 'NO_LINK';
                
                const t0 = performance.now();
                const interval = setInterval(() => {{
                    const now = performance.now() - t0;
                    const pt = document.getElementById('pt');
                    const b1 = document.querySelector('#pt .b1');
                    const b4 = document.querySelector('#pt .b4');
                    const span = document.querySelector('#pt .t span');
                    const firstI = span ? span.querySelector('i') : null;
                    const lastI = span ? span.querySelector('i:last-child') : null;
                    
                    window.__samples.push({{
                        t: Math.round(now),
                        htmlClass: document.documentElement.className,
                        b1_tr: b1 ? getComputedStyle(b1).transform : null,
                        b4_tr: b4 ? getComputedStyle(b4).transform : null,
                        titleText: span ? span.innerText : null,
                        firstI_op: firstI ? getComputedStyle(firstI).opacity : null,
                        firstI_tr: firstI ? getComputedStyle(firstI).transform : null,
                        lastI_op: lastI ? getComputedStyle(lastI).opacity : null
                    }});
                    if (now > 750) clearInterval(interval);
                }}, 40);
                
                link.click();
                return 'CLICKED';
            }})()"""
        }, 20)
        
        time.sleep(0.7)
        # Read samples right before page unload
        send("Runtime.evaluate", {"expression": "window.__samples", "returnByValue": True}, 30)
        msgs = read_messages(0.5)
        samples = []
        for m in msgs:
            if m.get("id") == 30:
                samples = m.get("result", {}).get("result", {}).get("value", [])
        
        for s in samples:
            print(f"t={s['t']}ms: b1={s['b1_tr']} | b4={s['b4_tr']} | title={s['titleText']} | firstI_op={s['firstI_op']}")

    test_transition("/", "header#hd nav.lk a[href='/events/']", "Events")
    test_transition("/", "header#hd nav.lk a[href='/team/']", "Team")
    test_transition("/", "header#hd nav.lk a[href='/blog/']", "Blog")
    test_transition("/team/", "header#hd nav.lk a[href='/blog/']", "Blog from Team")
    test_transition("/blog/", "header#hd nav.lk a[href='/team/']", "Team from Blog")

    ws.close()
finally:
    chrome.terminate()
    server.terminate()
