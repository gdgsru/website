with open('files/claim-certificate-index.ts', 'r', encoding='utf-8') as f:
    text = f.read()

old_origin = """const isAllowedOrigin = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!origin) return true;
  if (configuredOrigins.length === 0) {
    // Permissive fallback for localhost and official preview deployments
    return /^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(origin) ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app') ||
      origin.includes('sru.edu.in') ||
      origin.includes('gdgsru');
  }
  return configuredOrigins.includes(origin);
};"""

new_origin = """const isAllowedOrigin = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!origin) return true;
  if (/^https?:\\/\\/(localhost|127\\.0\\.0\\.1)(:\\d+)?$/i.test(origin) ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app') ||
      origin.includes('sru.edu.in') ||
      origin.includes('gdgsru')) {
    return true;
  }
  return configuredOrigins.includes(origin);
};"""

assert old_origin in text, "old_origin not found"
text = text.replace(old_origin, new_origin)

with open('supabase/functions/claim-certificate/index.ts', 'w', encoding='utf-8') as f:
    f.write(text)
print("Updated supabase/functions/claim-certificate/index.ts successfully")
