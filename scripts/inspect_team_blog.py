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
    while time.time() - t0 < 5:
        msg = recv_msg()
        if msg:
            try:
                data = json.loads(msg)
                if data.get("id") == id:
                    s.close()
                    return data
            except:
                pass
    s.close()
    return None

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
    
    send_cdp(ws_url, "Console.enable", {}, 1)
    send_cdp(ws_url, "Runtime.enable", {}, 2)
    
    for route in ["/team/", "/blog/"]:
        print(f"\n================ INSPECTING {route} ================")
        send_cdp(ws_url, "Page.navigate", {"url": f"http://localhost:8899{route}"}, 10)
        time.sleep(2.5)
        
        # Check errors in console or window
        diag = send_cdp(ws_url, "Runtime.evaluate", {
            "expression": """(() => {
                const app = document.getElementById("app");
                const pt = document.getElementById("pt");
                const htmlClasses = document.documentElement.className;
                const bodyClasses = document.body.className;
                const scripts = Array.from(document.scripts).map(s => s.src || s.textContent.slice(0, 40));
                
                return {
                    title: document.title,
                    htmlClasses,
                    bodyClasses,
                    hasApp: !!app,
                    appChildren: app ? app.children.length : 0,
                    hasPt: !!pt,
                    ptDisplay: pt ? getComputedStyle(pt).display : null,
                    ptVisibility: pt ? getComputedStyle(pt).visibility : null,
                    ptClasses: pt ? pt.className : null,
                    datasetPt: document.documentElement.dataset.pt,
                    scriptsCount: scripts.length
                };
            })()""",
            "returnByValue": True
        }, 11)
        
        print("Diagnostics:", json.dumps(diag.get("result", {}).get("result", {}).get("value", {}), indent=2))
        
        # Capture full screenshot
        shot = send_cdp(ws_url, "Page.captureScreenshot", {"format": "png"}, 12)
        if shot and "result" in shot and "data" in shot["result"]:
            img_data = base64.b64decode(shot["result"]["data"])
            artifact_dir = r"C:\Users\Narayan Bora\.gemini\antigravity\brain\88b431b3-07a3-41f7-bed6-96a805f27d93"
            filename = f"inspect_{route.strip('/')}.png"
            path = os.path.join(artifact_dir, filename)
            with open(path, "wb") as f:
                f.write(img_data)
            print(f"Saved screenshot: {filename}")

finally:
    chrome.terminate()
    server.terminate()
