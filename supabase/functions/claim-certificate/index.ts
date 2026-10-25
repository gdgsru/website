import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const configuredOrigins = (Deno.env.get("ALLOWED_ORIGIN") || "")
  .split(",").map((value) => value.trim()).filter(Boolean);
const isAllowedOrigin = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  if (!origin) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
      origin.endsWith('.pages.dev') ||
      origin.endsWith('.vercel.app') ||
      origin.endsWith('.netlify.app') ||
      origin.includes('sru.edu.in') ||
      origin.includes('gdgsru')) {
    return true;
  }
  return configuredOrigins.includes(origin);
};
const corsHeaders = (req: Request): Record<string, string> => {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && isAllowedOrigin(req)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
};
const json = (req: Request, body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const normaliseName = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ");
async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function clientIp(req: Request): string {
  // Prefer headers injected by the edge network. If only X-Forwarded-For is present,
  // use the last hop rather than a caller-supplied first entry.
  const direct = req.headers.get("cf-connecting-ip") || req.headers.get("fly-client-ip") || req.headers.get("x-real-ip");
  if (direct?.trim()) return direct.trim().slice(0, 128);
  const forwarded = (req.headers.get("x-forwarded-for") || "").split(",").map((part) => part.trim()).filter(Boolean);
  if (forwarded.length > 0 && forwarded.at(-1)) return (forwarded.at(-1) as string).slice(0, 128);
  return "";
}

Deno.serve(async (req: Request) => {
  // This endpoint is intended for the public site, not arbitrary cross-origin callers.
  // Set ALLOWED_ORIGIN to the exact deployed origin(s); an empty list fails closed.
  if (!isAllowedOrigin(req)) return json(req, { error: "origin_not_allowed" }, 403);
  if (req.method === "OPTIONS") return json(req, { ok: true });
  if (req.method !== "POST") return json(req, { error: "method_not_allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const collectStringValues = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collectStringValues);
    return [];
  };
  let keyMap: unknown = {};
  try { keyMap = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") || "{}"); } catch { keyMap = {}; }
  const publicKeys = [Deno.env.get("SUPABASE_ANON_KEY"), Deno.env.get("SUPABASE_PUBLISHABLE_KEY"), ...collectStringValues(keyMap)].filter(Boolean) as string[];
  const authHeader = req.headers.get("authorization") || "";
  const suppliedKey = req.headers.get("apikey") || (authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "");
  const isAuthorized = publicKeys.length === 0 || (suppliedKey && publicKeys.includes(suppliedKey));
  if (!supabaseUrl || !serviceKey) {
    return json(req, { error: "not_authorized", reason: "server_config" }, 401);
  }
  if (!isAuthorized) {
    const reason = suppliedKey ? "key_mismatch" : "missing_key";
    return json(req, { error: "not_authorized", reason }, 401);
  }

  let body: { event_id?: unknown; name?: unknown; identifier?: unknown };
  try { body = await req.json(); } catch { return json(req, { error: "invalid_request" }, 400); }
  const eventId = String(body.event_id || "").trim();
  const name = normaliseName(body.name);
  const identifier = normaliseName(body.identifier || body.name);
  if (!isUuid(eventId) || name.length < 3 || name.length > 120 || identifier.length < 3 || identifier.length > 80) {
    return json(req, { error: "invalid_request" }, 400);
  }

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const rawIp = clientIp(req);
    if (!rawIp) {
      return json(req, { error: "unverifiable_network_origin", message: "Client IP could not be determined." }, 400);
    }

    // Salt with serviceKey and scope by eventId so students on campus NAT / shared Wi-Fi
    // claiming certificates across different events do not exhaust each other's quota.
    const ipHash = await sha256(`${serviceKey}:${rawIp}:${eventId}`);
    const configuredLimit = Number(Deno.env.get("CERTIFICATE_CLAIM_LIMIT") || "200");
    const maxAttempts = Number.isInteger(configuredLimit) && configuredLimit >= 10 && configuredLimit <= 2000
      ? configuredLimit : 200;
    const limited = await db.rpc("consume_certificate_claim_attempt", {
      p_ip_hash: ipHash,
      p_max_attempts: maxAttempts,
    });
    if (limited.error) return json(req, { error: "temporarily_unavailable" }, 503);
    const limitRow = Array.isArray(limited.data) ? limited.data[0] : limited.data;
    if (!limitRow?.allowed) {
      return json(req, {
        error: "rate_limited",
        message: "Too many checks from this network. Please wait a few minutes before trying again.",
        retry_after_seconds: Number(limitRow?.retry_after_seconds || 600),
      }, 429);
    }

    const claim = await db.rpc("claim_certificate", { p_event_id: eventId, p_name: name, p_identifier: identifier });
    if (claim.error) return json(req, { error: "temporarily_unavailable" }, 503);
    const payload = claim.data as Record<string, unknown> | null;
    if (!payload) return json(req, { found: false });
    if (payload.reason) return json(req, { found: false, reason: String(payload.reason) });
    return json(req, { found: true, certificate: payload });
  } catch {
    return json(req, { error: "temporarily_unavailable" }, 503);
  }
});