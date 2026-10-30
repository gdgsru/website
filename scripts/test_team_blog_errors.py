import subprocess
import time
import os
import json
import base64
import urllib.request
import socket

def send_cdp(ws_url, method, params=None, id=1):
    parts = ws_url.replace("ws://", "").split("/", 1)
    host, port = parts[0].split(":")
    path = "/" + parts[1]
    
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((host, int(port)))
    
    key = base64.b64encode(os.urandom(16)).decode()
    handshake = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        f"Upgrade: websocket\r\n"
        f"Connection: Upgrade\r\n"
        f"Sec-WebSocket-Key: {key}\r\n"
        f"Sec-WebSocket-Version: 13\r\n\r\n"
    )
    s.sendall(handshake.encode())
    resp = s.recv(4096)
    
    def send_frame(msg):
        data = msg.encode()
        frame = bytearray([0x81])
        length = len(data)
        mask = os.urandom(4)
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.extend([0x80 | 126, (length >> 8) & 0xff, length & 0xff])
        else:
            frame.extend([0x80 | 127] + list(length.to_bytes(8, 'big')))
        frame.extend(mask)
        masked_data = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
        frame.extend(masked_data)
        s.sendall(frame)

    def recv_msg():
        header = s.recv(2)
        if not header: return ""
        b2 = header[1]
        length = b2 & 0x7f
        if length == 126:
            length = int.from_bytes(s.recv(2), 'big')
        elif length == 127:
            length = int.from_bytes(s.recv(8), 'big')
        payload = b""
        while len(payload) < length:
            payload += s.recv(length - len(payload))
        return payload.decode('utf-8', errors='ignore')

    req = json.dumps({"id": id, "method": method, "params": params or {}})
    send_frame(req)
    t0 = time.time()
    events = []
    response = None
    while time.time() - t0 < 5:
        msg = recv_msg()
        if msg:
            try:
                data = json.loads(msg)
                if data.get("id") == id:
                    response = data
                    break
                else:
                    events.append(data)
            except:
                pass
    s.close()
    return response, events

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

    # Simple helper with persistent socket for collecting logs
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

    for route in ["/team/", "/blog/"]:
        print(f"\n================ TESTING ROUTE: {route} ================")
        send("Page.navigate", {"url": f"http://localhost:8899{route}"}, 10)
        msgs = read_messages(2.5)
        for m in msgs:
            if m.get("method") == "Runtime.exceptionThrown":
                print("EXCEPTION:", json.dumps(m["params"]["exceptionDetails"], indent=2))
            elif m.get("method") == "Runtime.consoleAPICalled":
                p = m["params"]
                t = p.get("type")
                args = [a.get("value") or a.get("description") for a in p.get("args", [])]
                if t in ["error", "warn"]:
                    print(f"CONSOLE {t.upper()}:", *args)
            elif m.get("method") == "Log.entryAdded":
                e = m["params"]["entry"]
                if e.get("level") in ["error", "warning"]:
                    print(f"LOG {e.get('level').upper()}:", e.get("text"))

        # Check DOM state
        send("Runtime.evaluate", {
            "expression": """(() => {
                const app = document.getElementById("app");
                return {
                    pathname: location.pathname,
                    title: document.title,
                    appText: app ? app.innerText.slice(0, 150) : null,
                    cardCount: document.querySelectorAll('.card, .team-card, .editorial-card').length,
                    hasLot: !!document.getElementById('gdg-lotus'),
                    hasPt: !!document.getElementById('pt'),
                    hasWp: !!document.getElementById('wp'),
                    ptTitle: document.querySelector('#pt .t span') ? document.querySelector('#pt .t span').innerText : null,
                    htmlClass: document.documentElement.className,
                    bodyClass: document.body.className
                };
            })()""",
            "returnByValue": True
        }, 20)
        eval_msgs = read_messages(1.0)
        for em in eval_msgs:
            if em.get("id") == 20:
                print("DOM STATE:", json.dumps(em.get("result", {}).get("result", {}).get("value", {}), indent=2))

    ws.close()

finally:
    chrome.terminate()
    server.terminate()
