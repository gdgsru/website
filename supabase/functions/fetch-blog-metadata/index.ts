import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const origin = Deno.env.get("ALLOWED_ORIGIN") || "*";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function readHtmlLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Article response has no readable body.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    total += part.value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error("Article page is too large to inspect.");
    }
    chunks.push(part.value);
  }
  const joined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(joined);
}

// Replace & last to prevent double-decoding entities (Issue 28)
const decode = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

const permittedHost = (host: string) =>
  host === "blogger.com" ||
  host.endsWith(".blogger.com") ||
  host === "blogspot.com" ||
  host.endsWith(".blogspot.com");

const validateHttpsUrl = (raw: string): string => {
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "https:" ? parsed.href : "";
  } catch {
    return "";
  }
};

const getMeta = (html: string, names: string[]) => {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexes = [
      new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
      new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name|itemprop)=["']${escaped}["'][^>]*>`, "i"),
    ];
    for (const regex of regexes) {
      const hit = html.match(regex);
      if (hit?.[1]) return decode(hit[1].trim());
    }
  }
  return "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const authorization = req.headers.get("authorization") || "";

  if (!supabaseUrl || !serviceKey || !anonKey || !/^Bearer\s+\S+/i.test(authorization)) {
    return json({ error: "Administrator authentication required." }, 401);
  }

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);

  if (!userResponse?.ok) return json({ error: "Administrator authentication required." }, 401);
  const user = await userResponse.json().catch(() => null);
  if (!user?.id) return json({ error: "Administrator authentication required." }, 401);

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: admin, error: adminError } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (adminError || !admin) {
    return json({ error: "This account is not authorised to fetch article metadata." }, 403);
  }

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  let currentUrl: URL;
  try {
    currentUrl = new URL(String(body.url || ""));
  } catch {
    return json({ error: "Enter a valid Blogger article URL." }, 400);
  }

  if (
    currentUrl.protocol !== "https:" ||
    currentUrl.username ||
    currentUrl.password ||
    !permittedHost(currentUrl.hostname.toLowerCase()) ||
    (currentUrl.port && currentUrl.port !== "443")
  ) {
    return json(
      { error: "Automatic metadata lookup supports HTTPS Blogger / Blogspot URLs only. You can still enter the metadata manually." },
      400
    );
  }

  try {
    let response: Response | null = null;
    let redirectsCount = 0;
    const maxRedirects = 3;

    while (redirectsCount <= maxRedirects) {
      response = await fetch(currentUrl.href, {
        headers: { "User-Agent": "GDG-SRU-MetadataFetcher/1.0 (+https://gdg.community.dev/)" },
        redirect: "manual",
        signal: AbortSignal.timeout(7000),
      });

      if (response.status >= 300 && response.status < 400) {
        redirectsCount++;
        const location = response.headers.get("location");
        if (!location) {
          return json({ error: "The article redirected without a valid target location." }, 422);
        }
        const redirected = new URL(location, currentUrl);
        if (
          redirected.protocol !== "https:" ||
          !permittedHost(redirected.hostname.toLowerCase()) ||
          (redirected.port && redirected.port !== "443")
        ) {
          return json({ error: "The article redirected outside Blogger / Blogspot. Enter details manually." }, 422);
        }
        currentUrl = redirected;
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      return json({ error: "The article could not be fetched. Enter details manually." }, 422);
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType && !/text\/(html|plain)/i.test(contentType)) {
      return json({ error: "The destination did not return an HTML article page. Enter details manually." }, 422);
    }

    let html: string;
    try {
      html = await readHtmlLimited(response, 2_000_000);
    } catch {
      return json({ error: "The article page is too large or unreadable. Enter details manually." }, 413);
    }

    const rawTitleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
    const title = getMeta(html, ["og:title", "twitter:title"]) || decode(rawTitleTag);
    const author = getMeta(html, ["author", "article:author", "og:article:author"]);
    const description = getMeta(html, ["og:description", "description", "twitter:description"]);
    const rawImage = getMeta(html, ["og:image", "twitter:image"]);
    const image_url = validateHttpsUrl(rawImage);
    const category = getMeta(html, ["article:section"]) || "Community";

    return json({ title, author, description, image_url, category });
  } catch {
    return json({ error: "The article could not be fetched right now. Enter details manually." }, 502);
  }
});
