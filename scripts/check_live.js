const fs = require('fs');

const cfg = fs.readFileSync('cloudflare-pages-site/config.js', 'utf8');
const url = cfg.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1];
const key = cfg.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1];

async function check() {
  const headers = { 'apikey': key, 'Authorization': 'Bearer ' + key };
  const r1 = await fetch(url + '/rest/v1/site_settings?select=*', { headers });
  console.log('direct site_settings status:', r1.status);
  const data1 = await r1.json();
  console.log('direct site_settings data:', data1);

  const resSettings = await fetch(url + '/rest/v1/public_site_settings?select=*', { headers });
  const settings = await resSettings.json();
  console.log('public_site_settings keys:', settings.map ? settings.map(x => x.key) : settings);
}
check();
