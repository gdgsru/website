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

    send("Network.enable", {}, 1)
    send("Runtime.enable", {}, 2)
    read_messages(0.5)

    print("\n--- NAVIGATING TO /blog/ ---")
    send("Page.navigate", {"url": "http://localhost:8899/blog/"}, 10)
    msgs = read_messages(3.0)
    for m in msgs:
        if m.get("method") == "Network.responseReceived":
            res = m["params"]["response"]
            if res["status"] >= 400:
                print(f"FAILED REQUEST: {res['status']} {res['url']}")
        elif m.get("method") == "Runtime.exceptionThrown":
            print("EXCEPTION:", m["params"]["exceptionDetails"])
        elif m.get("method") == "Runtime.consoleAPICalled":
            p = m["params"]
            if p.get("type") in ["error", "warn"]:
                args = [a.get("value") or a.get("description") for a in p.get("args", [])]
                print(f"CONSOLE {p.get('type')}:", *args)

    ws.close()
finally:
    chrome.terminate()
    server.terminate()
