import re

with open('cloudflare-pages-site/assets/js/config-loader.js', 'r', encoding='utf-8') as f:
    text = f.read()

rpcs = re.findall(r"\.rpc\(['\"](.*?)['\"]", text)
print('RPCs in config-loader.js:', set(rpcs))

functions = re.findall(r"functions/v1/([a-zA-Z0-9_\-]+)", text)
print('Edge functions in config-loader.js:', set(functions))

with open('cloudflare-pages-site/assets/js/app.js', 'r', encoding='utf-8') as f:
    app_text = f.read()

rpcs_app = re.findall(r"\.rpc\(['\"](.*?)['\"]", app_text)
print('RPCs in app.js:', set(rpcs_app))

functions_app = re.findall(r"functions/v1/([a-zA-Z0-9_\-]+)", app_text)
print('Edge functions in app.js:', set(functions_app))
