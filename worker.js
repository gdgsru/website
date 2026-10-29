/**
 * GDG SRU · Cloudflare Worker Edge Handler
 * 
 * Provides:
 * 1. Dynamic Open Graph image generation (/api/og/profile & /api/og/cert)
 * 2. Server-side OG meta tag injection for social scrapers (LinkedIn, WhatsApp, X, Discord)
 * 3. Static asset delivery fallback via Cloudflare Pages ASSETS binding
 */

const GDG_LOGO_SVG = `<g>
  <line x1="279" y1="540" x2="432" y2="430" stroke="#ea4335" stroke-width="128" stroke-linecap="round"/>
  <line x1="279" y1="540" x2="432" y2="650" stroke="#4285f4" stroke-width="128" stroke-linecap="round"/>
  <line x1="648" y1="650" x2="801" y2="540" stroke="#fbbc04" stroke-width="128" stroke-linecap="round"/>
  <line x1="648" y1="430" x2="801" y2="540" stroke="#34a853" stroke-width="128" stroke-linecap="round"/>
</g>`;

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function generateProfileOgSvg({ name, handle, role, department, university = 'SR University', status = 'Active Member' }) {
  const safeName = esc(name || handle || 'Community Member');
  const safeRole = esc(role || 'Developer & Community Member');
  const safeDept = esc(department || 'Engineering');
  const safeUni = esc(university);
  const safeHandle = esc(handle ? `@${handle}` : '');

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0d13"/>
      <stop offset="50%" stop-color="#111625"/>
      <stop offset="100%" stop-color="#0b0d13"/>
    </linearGradient>
    <radialGradient id="glow-b" cx="15%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#4285f4" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="#4285f4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow-r" cx="85%" cy="80%" r="45%">
      <stop offset="0%" stop-color="#ea4335" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#ea4335" stop-opacity="0"/>
    </radialGradient>
    <style>
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Google Sans", sans-serif; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, "Roboto Mono", monospace; }
    </style>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow-b)"/>
  <rect width="1200" height="630" fill="url(#glow-r)"/>

  <!-- Border Card Frame -->
  <rect x="36" y="36" width="1128" height="558" rx="24" fill="none" stroke="#252b3d" stroke-width="2"/>
  <rect x="36" y="36" width="1128" height="558" rx="24" fill="#141926" fill-opacity="0.55"/>

  <!-- GDG Header Bar -->
  <g transform="translate(80, 80)">
    <svg viewBox="185 345 710 390" width="76" height="42">
      ${GDG_LOGO_SVG}
    </svg>
    <text x="96" y="24" class="font-sans" font-size="22" font-weight="700" fill="#ffffff" letter-spacing="-0.01em">Google Developer Groups</text>
    <text x="96" y="46" class="font-sans" font-size="15" font-weight="500" fill="#9aa0a6">On Campus · SR University</text>
  </g>

  <!-- Verified Badge -->
  <g transform="translate(900, 82)">
    <rect width="180" height="38" rx="19" fill="#1e3a2f" stroke="#34a853" stroke-width="1.5"/>
    <circle cx="24" cy="19" r="5" fill="#34a853"/>
    <text x="38" y="24" class="font-sans" font-size="13" font-weight="700" fill="#81c995" letter-spacing="0.05em">VERIFIED PASS</text>
  </g>

  <!-- Member Name & Details -->
  <g transform="translate(80, 240)">
    <text x="0" y="0" class="font-mono" font-size="16" font-weight="600" fill="#4285f4" letter-spacing="0.12em">MEMBER CREDENTIAL ${safeHandle}</text>
    <text x="0" y="68" class="font-sans" font-size="54" font-weight="800" fill="#ffffff" letter-spacing="-0.03em">${safeName}</text>
    <text x="0" y="116" class="font-sans" font-size="24" font-weight="500" fill="#bdc1c6">${safeRole}</text>
    <text x="0" y="154" class="font-sans" font-size="18" font-weight="400" fill="#80868b">${safeDept} · ${safeUni}</text>
  </g>

  <!-- Bottom Accent Stripes (Google Colors) -->
  <g transform="translate(36, 584)">
    <rect x="0" y="0" width="282" height="10" fill="#4285f4"/>
    <rect x="282" y="0" width="282" height="10" fill="#ea4335"/>
    <rect x="564" y="0" width="282" height="10" fill="#fbbc04"/>
    <rect x="846" y="0" width="282" height="10" rx="0" fill="#34a853"/>
  </g>

  <!-- Verification Link Text -->
  <text x="80" y="546" class="font-mono" font-size="14" fill="#5f6368">gdgsru.pages.dev · Verified Campus Tech Community</text>
</svg>`;
}

function generateCertOgSvg({ code = 'GDG-SRU-CERT', event = 'Workshop', recipient = 'Attendee' }) {
  const safeCode = esc(code);
  const safeEvent = esc(event);
  const safeName = esc(recipient);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b0d13"/>
      <stop offset="50%" stop-color="#141824"/>
      <stop offset="100%" stop-color="#0b0d13"/>
    </linearGradient>
    <radialGradient id="glow-g" cx="80%" cy="20%" r="50%">
      <stop offset="0%" stop-color="#34a853" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#34a853" stop-opacity="0"/>
    </radialGradient>
    <style>
      .font-sans { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Google Sans", sans-serif; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, "Roboto Mono", monospace; }
    </style>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow-g)"/>
  <rect x="36" y="36" width="1128" height="558" rx="24" fill="#141926" fill-opacity="0.6" stroke="#252b3d" stroke-width="2"/>

  <!-- GDG Header Bar -->
  <g transform="translate(80, 80)">
    <svg viewBox="185 345 710 390" width="76" height="42">
      ${GDG_LOGO_SVG}
    </svg>
    <text x="96" y="24" class="font-sans" font-size="22" font-weight="700" fill="#ffffff">Google Developer Groups</text>
    <text x="96" y="46" class="font-sans" font-size="15" font-weight="500" fill="#9aa0a6">On Campus · SR University</text>
  </g>

  <!-- Official Badge -->
  <g transform="translate(870, 82)">
    <rect width="210" height="38" rx="19" fill="#1a273e" stroke="#4285f4" stroke-width="1.5"/>
    <circle cx="24" cy="19" r="5" fill="#4285f4"/>
    <text x="38" y="24" class="font-sans" font-size="13" font-weight="700" fill="#8ab4f8" letter-spacing="0.05em">OFFICIAL CREDENTIAL</text>
  </g>

  <!-- Certificate Info -->
  <g transform="translate(80, 240)">
    <text x="0" y="0" class="font-mono" font-size="16" font-weight="600" fill="#34a853" letter-spacing="0.1em">CREDENTIAL ID: ${safeCode}</text>
    <text x="0" y="60" class="font-sans" font-size="50" font-weight="800" fill="#ffffff" letter-spacing="-0.02em">Certificate of Participation</text>
    <text x="0" y="112" class="font-sans" font-size="24" font-weight="500" fill="#bdc1c6">Awarded to <tspan font-weight="700" fill="#ffffff">${safeName}</tspan></text>
    <text x="0" y="152" class="font-sans" font-size="18" font-weight="400" fill="#80868b">Event: ${safeEvent} · GDG on Campus SR University</text>
  </g>

  <!-- Bottom Accent Stripes -->
  <g transform="translate(36, 584)">
    <rect x="0" y="0" width="282" height="10" fill="#4285f4"/>
    <rect x="282" y="0" width="282" height="10" fill="#ea4335"/>
    <rect x="564" y="0" width="282" height="10" fill="#fbbc04"/>
    <rect x="846" y="0" width="282" height="10" fill="#34a853"/>
  </g>

  <text x="80" y="546" class="font-mono" font-size="14" fill="#5f6368">Verify credential authenticity at gdgsru.pages.dev/verify/?code=${safeCode}</text>
</svg>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. Dynamic SVG Image Endpoints
    if (url.pathname === '/api/og/profile') {
      const handle = url.searchParams.get('u') || '';
      const name = url.searchParams.get('name') || '';
      const role = url.searchParams.get('role') || '';
      const dept = url.searchParams.get('dept') || '';

      const svg = generateProfileOgSvg({
        handle,
        name: name || (handle ? handle.charAt(0).toUpperCase() + handle.slice(1) : 'Member Pass'),
        role,
        department: dept
      });

      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        }
      });
    }

    if (url.pathname === '/api/og/cert') {
      const code = url.searchParams.get('code') || 'GDG-SRU-CERT';
      const event = url.searchParams.get('event') || 'Event';
      const recipient = url.searchParams.get('name') || 'Attendee';

      const svg = generateCertOgSvg({ code, event, recipient });
      return new Response(svg, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800'
        }
      });
    }

    // 2. Server-side OG Meta Tag Injection for Social Crawlers
    const isBot = /facebookexternalhit|LinkedInBot|Twitterbot|WhatsApp|TelegramBot|Discordbot|Slackbot|Googlebot/i.test(
      request.headers.get('User-Agent') || ''
    );

    const isProfileRoute = url.pathname.startsWith('/u/') || (url.pathname === '/profile.html' && url.searchParams.has('u'));
    const isVerifyRoute = url.pathname.startsWith('/verify') && url.searchParams.has('code');

    if (isBot && (isProfileRoute || isVerifyRoute)) {
      const response = await env.ASSETS.fetch(request);
      if (response.status === 200 && response.headers.get('content-type')?.includes('text/html')) {
        let html = await response.text();

        if (isProfileRoute) {
          const handle = (url.pathname.startsWith('/u/') ? url.pathname.slice(3) : url.searchParams.get('u') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
          const displayName = handle ? (handle.charAt(0).toUpperCase() + handle.slice(1)) : 'Member';
          const title = `${displayName} · GDG SRU Member Pass`;
          const desc = `View ${displayName}'s verified Google Developer Group on Campus SR University digital member credential.`;
          const ogImageUrl = `${url.origin}/api/og/profile?u=${encodeURIComponent(handle)}&name=${encodeURIComponent(displayName)}`;

          html = html
            .replace(/<title>.*?<\/title>/i, `<title>${esc(title)}</title>`)
            .replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["']/i, `<meta property="og:title" content="${esc(title)}"`)
            .replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["']/i, `<meta property="og:description" content="${esc(desc)}"`)
            .replace(/<meta\s+property=["']og:image["']\s+content=["'][^"']*["']/i, `<meta property="og:image" content="${esc(ogImageUrl)}"`)
            .replace(/<meta\s+name=["']twitter:title["']\s+content=["'][^"']*["']/i, `<meta name="twitter:title" content="${esc(title)}"`)
            .replace(/<meta\s+name=["']twitter:description["']\s+content=["'][^"']*["']/i, `<meta name="twitter:description" content="${esc(desc)}"`)
            .replace(/<meta\s+name=["']twitter:image["']\s+content=["'][^"']*["']/i, `<meta name="twitter:image" content="${esc(ogImageUrl)}"`);
        } else if (isVerifyRoute) {
          const code = url.searchParams.get('code') || 'GDG-SRU-CERT';
          const title = `Verify Credential: ${code} · GDG SRU`;
          const desc = `Official credential verification portal for Google Developer Groups on Campus SR University. Certificate ID: ${code}.`;
          const ogImageUrl = `${url.origin}/api/og/cert?code=${encodeURIComponent(code)}`;

          html = html
            .replace(/<title>.*?<\/title>/i, `<title>${esc(title)}</title>`)
            .replace(/<meta\s+property=["']og:title["']\s+content=["'][^"']*["']/i, `<meta property="og:title" content="${esc(title)}"`)
            .replace(/<meta\s+property=["']og:description["']\s+content=["'][^"']*["']/i, `<meta property="og:description" content="${esc(desc)}"`)
            .replace(/<meta\s+property=["']og:image["']\s+content=["'][^"']*["']/i, `<meta property="og:image" content="${esc(ogImageUrl)}"`)
            .replace(/<meta\s+name=["']twitter:image["']\s+content=["'][^"']*["']/i, `<meta name="twitter:image" content="${esc(ogImageUrl)}"`);
        }

        return new Response(html, {
          status: response.status,
          headers: response.headers
        });
      }
    }

    // 3. Default: pass directly to Cloudflare Pages static assets
    return env.ASSETS.fetch(request);
  }
};
