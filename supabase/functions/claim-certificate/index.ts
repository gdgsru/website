import { createClient } from 'npm:@supabase/supabase-js@2';

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') ?? '';
  const allowed = [
    'https://gdgsru.pages.dev',
    /^https:\/\/[a-z0-9-]+\.gdgsru\.pages\.dev$/,
    /^http:\/\/localhost(:\d+)?$/,
    /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  ];
  const isAllowed = allowed.some((pat) => typeof pat === 'string' ? pat === origin : pat.test(origin));
  const corsOrigin = isAllowed ? origin : (Deno.env.get('SITE_ORIGIN') ?? 'https://gdgsru.pages.dev');

  return {
    'access-control-allow-origin': corsOrigin,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
  };
}

const json = (req: Request, body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(req), 'content-type': 'application/json', 'cache-control': 'no-store', ...extra },
  });

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const enc = new TextEncoder();
// 32 symbols: no I, O, 0, 1. Makes 256 % 32 = 0, so the output is unbiased.
const CRED_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;
const MAX_LOGO_BYTES = 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 3 * 1024 * 1024;
const CANVAS = { w: 1123, h: 794 };

type Box = { x?: number; y?: number; scale?: number; w?: number };

const sha256Hex = async (text: string) => {
  const d = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

const normName = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ');

// Returns null if invalid. "none" means no roll number or email was given.
function normIdentifier(s: unknown): { kind: 'none' | 'roll' | 'email'; value: string } | null {
  const raw = String(s ?? '').trim().slice(0, 120);
  if (!raw) return { kind: 'none', value: '' };
  if (raw.includes('@')) {
    const v = raw.toLowerCase();
    return /^[^\s@,()"]+@[^\s@,()"]+\.[^\s@,()"]+$/.test(v) ? { kind: 'email', value: v } : null;
  }
  const v = raw.replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9-]{1,40}$/.test(v) ? { kind: 'roll', value: v } : null;
}

async function credentialId(eventId: string, identity: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`${eventId}|${identity}`)));
  let code = '';
  for (let i = 0; i < 8; i++) code += CRED_ALPHABET[mac[i] % 32];
  return `GDGSRU-${code}`;
}

// Inline a private-bucket image as a data URI. The certificate iframe only allows data: images.
async function inlineImage(path: string | null): Promise<string> {
  if (!path) return '';
  const { data, error } = await db.storage.from('certificate-logos').download(path);
  if (error || !data || data.size > MAX_LOGO_BYTES) return '';
  const bytes = new Uint8Array(await data.arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!isPng && !isJpg) return '';
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${btoa(bin)}`;
}

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};

// Builds an inline CSS string from validated numbers only. Returns empty if not positioned.
function pos(layout: Record<string, Box>, key: string) {
  const b = layout[key];
  if (!b || (b.x == null && b.y == null && b.scale == null && b.w == null)) return '';
  const x = num(b.x, 0, 0, CANVAS.w);
  const y = num(b.y, 0, 0, CANVAS.h);
  const s = num(b.scale, 1, 0.3, 2);
  const w = b.w == null ? null : num(b.w, 300, 120, 1000);
  return `position:absolute;left:${x}px;top:${y}px;${w ? `width:${w}px;` : ''}transform:scale(${s});transform-origin:0 0`;
}

const longDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric' })
    .format(new Date(`${iso}T00:00:00+05:30`));
const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${iso}T00:00:00+05:30`));

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: getCorsHeaders(req) });
  if (req.method !== 'POST') return json(req, { error: 'method_not_allowed' }, 405);

  const signingSecret = Deno.env.get('CERT_SIGNING_SECRET');
  const ipSalt = Deno.env.get('IP_HASH_SALT');
  if (!signingSecret || !ipSalt) {
    console.error('[claim-certificate] Server error: CERT_SIGNING_SECRET or IP_HASH_SALT is missing.');
    return json(req, { error: 'server_misconfigured', message: 'Cryptographic secrets are not configured in environment.' }, 500);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(req, { error: 'bad_request' }, 400); }

  const eventId = String(body.event_id ?? '');
  const name = normName(body.name);
  const ident = normIdentifier(body.identifier);
  if (!/^[0-9a-f-]{36}$/i.test(eventId) || name.length < 3 || name.length > 120 || !ident) {
    return json(req, { error: 'bad_request' }, 400);
  }

  // 1. Rate limit. Only a salted, daily hash of the IP is stored.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const day = new Date().toISOString().slice(0, 10);
  const ipHash = await sha256Hex(`${ipSalt}|${day}|${ip}`);
  const { count } = await db.from('claim_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', new Date(Date.now() - RATE_WINDOW_MS).toISOString());
  if ((count ?? 0) >= RATE_MAX) return json(req, { error: 'rate_limited' }, 429, { 'retry-after': '900' });
  await db.from('claim_attempts').insert({ ip_hash: ipHash });

  // 2. Event must be open for claims and not past retention.
  const { data: ec } = await db.from('event_certificates').select('*').eq('event_id', eventId).maybeSingle();
  if (!ec || !ec.claims_enabled || !ec.purge_at || new Date(ec.purge_at) <= new Date()) {
    return json(req, { error: 'claims_closed' }, 403);
  }

  // 3. Match the attendance record. Names must match exactly after normalising.
  let q = db.from('attendance_records')
    .select('id, attendee_name, roll_norm, email_norm, name_norm')
    .eq('event_id', eventId)
    .eq('attendance_status', 'attended')
    .eq('name_norm', name.toLowerCase());
  if (ident.kind === 'roll') q = q.eq('roll_norm', ident.value);
  if (ident.kind === 'email') q = q.eq('email_norm', ident.value);
  const { data: matches, error: matchErr } = await q.limit(2);
  if (matchErr) return json(req, { error: 'server' }, 500);
  if (!matches?.length) return json(req, { error: 'not_found' }, 404);
  if (matches.length > 1) return json(req, { error: 'ambiguous' }, 409);

  const a = matches[0];
  const identity = a.roll_norm ? `R:${a.roll_norm}` : a.email_norm ? `E:${a.email_norm}` : `N:${a.name_norm}`;
  const credId = await credentialId(eventId, identity, signingSecret);
  const identityHash = await sha256Hex(`${eventId}|${identity}`);

  // 4. Receipt: created on first claim, kept stable afterwards. Revoked IDs stay revoked.
  const { data: prior } = await db.from('credential_receipts')
    .select('credential_id, status')
    .eq('event_id', eventId).eq('identity_hash', identityHash).maybeSingle();
  if (prior?.status === 'revoked') return json(req, { error: 'revoked' }, 403);

  const { error: upErr } = await db.from('credential_receipts').upsert({
    credential_id: prior?.credential_id ?? credId,
    event_id: eventId,
    identity_hash: identityHash,
    recipient_name: a.attendee_name,
    status: 'verified',
    purge_at: ec.purge_at,
  }, { onConflict: 'event_id,identity_hash' });
  if (upErr) return json(req, { error: 'server' }, 500);

  // 5. Load details, partners, and default layout.
  const [{ data: partners }, { data: global }, { data: ev }] = await Promise.all([
    db.from('event_partners').select('id, role, name, logo_path').eq('event_id', eventId).order('sort_order'),
    db.from('certificate_global_settings').select('default_layout').eq('id', 1).maybeSingle(),
    db.from('events').select('title').eq('id', eventId).single(),
  ]);
  // Event overrides replace the default for each element key.
  const layout: Record<string, Box> = { ...(global?.default_layout ?? {}), ...(ec.layout ?? {}) };

  // Image budget shared by partner logos and signatures.
  let budget = MAX_TOTAL_IMAGE_BYTES;
  const img = async (path: string | null) => {
    const data = await inlineImage(path);
    if (data.length > budget) return '';
    budget -= data.length;
    return data;
  };

  const cohosts: unknown[] = [];
  const sponsors: unknown[] = [];
  for (const p of partners ?? []) {
    const item = { name: p.name, logo: await img(p.logo_path), style: pos(layout, `partner_${p.id}`) };
    (p.role === 'cohost' ? cohosts : sponsors).push(item);
  }

  const signatories: unknown[] = [];
  for (const [i, s] of ((ec.signatories as any[]) ?? []).slice(0, 2).entries()) {
    signatories.push({
      name: String(s.name ?? ''),
      role: String(s.role ?? ''),
      img: await img(s.image_path ?? null),
      style: pos(layout, `sig_${i + 1}`),
    });
  }

  const lines = String(ec.curriculum_text).split(/\n+/).map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const longD = longDate(ec.event_date);

  // 6. Fields for the template. The template is a static file the browser already loads.
  const fields = {
    event_name: ev?.title ?? '',
    chapter: ec.host_chapter,
    host_chapter: ec.host_chapter,
    cert_tag: ec.cert_tag,
    cert_title: ec.cert_title,
    track: ec.track,
    skills: ec.skills.join(', '),
    dossier_tag: ec.dossier_tag,
    curriculum_status: ec.curriculum_status,
    curriculum_text: ec.curriculum_text,
    curriculum_bullets: ec.curriculum_bullets ? lines.map((text) => ({ text })) : [],
    date: longD,
    date_short: shortDate(ec.event_date),
    cohosts,
    sponsors,
    signatories,
    // Fixed positions for the named blocks.
    pos_gdg: pos(layout, 'gdg'),
    pos_cert_tag: pos(layout, 'cert_tag'),
    pos_title: pos(layout, 'title'),
    pos_name: pos(layout, 'name'),
    pos_event: pos(layout, 'event'),
    pos_host: pos(layout, 'host'),
    pos_curriculum: pos(layout, 'curriculum'),
    pos_dossier: pos(layout, 'dossier'),
    pos_credential: pos(layout, 'credential'),
  };

  return json(req, {
    found: true,
    certificate: {
      recipient_name: a.attendee_name,
      credential_id: prior?.credential_id ?? credId,
      event_title: ev?.title ?? '',
      event_start: `${ec.event_date}T00:00:00+05:30`,
      fields,
    },
  });
});
