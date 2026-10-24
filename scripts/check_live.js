const fs = require('fs');

const cfg = fs.readFileSync('cloudflare-pages-site/config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1];

async function check() {
  const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key };

  // Check if announcement_bar exists in site_settings
  const r = await fetch(url + '/rest/v1/site_settings?key=eq.announcement_bar', { headers });
  const data = await r.json();
  console.log('announcement_bar in site_settings:', data);

  // Check current public_site_settings view (what anon sees)
  const r2 = await fetch(url + '/rest/v1/public_site_settings?select=*', { headers });
  const pub = await r2.json();
  console.log('public_site_settings keys:', Array.isArray(pub) ? pub.map(x => x.key) : pub);

  // Check events
  const r3 = await fetch(url + '/rest/v1/public_event_list?select=id,title,start_at,end_at,event_tier,pinned_next_session', { headers });
  const events = await r3.json();
  console.log('events:', Array.isArray(events) ? events : 'Error: ' + JSON.stringify(events));

  // Check if new event columns exist
  const r4 = await fetch(url + '/rest/v1/events?select=id,event_tier,accent_color,banner_url,rsvp_url&limit=1', { headers });
  console.log('events new cols status:', r4.status);
  const e4 = await r4.json();
  console.log('events new cols:', e4);
}
check();
