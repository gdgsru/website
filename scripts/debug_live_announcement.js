const fs = require('fs');
const config = fs.readFileSync('cloudflare-pages-site/config.js', 'utf8');
const urlMatch = config.match(/SUPABASE_URL\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = config.match(/SUPABASE_ANON_KEY\s*=\s*['"]([^'"]+)['"]/);
const url = urlMatch[1];
const key = keyMatch[1];

async function check() {
  const res = await fetch(url + '/rest/v1/public_site_settings?key=eq.announcement_bar&select=*', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  console.log('public_site_settings announcement_bar:', res.status, await res.text());

  const res2 = await fetch(url + '/rest/v1/site_settings?key=eq.announcement_bar&select=*', {
    headers: { 'apikey': key, 'Authorization': 'Bearer ' + key }
  });
  console.log('site_settings announcement_bar:', res2.status, await res2.text());

  // Also fetch live config-loader.js from Cloudflare Pages!
  const liveRes = await fetch('https://gdgsru.pages.dev/assets/js/config-loader.js?_t=' + Date.now());
  const liveText = await liveRes.text();
  console.log('Live config-loader.js has gdgMeshFlow:', liveText.includes('gdgMeshFlow'));
  console.log('Live config-loader.js length:', liveText.length);

  // Also fetch live index.html from Cloudflare Pages!
  const liveHtml = await fetch('https://gdgsru.pages.dev/?_t=' + Date.now());
  console.log('Live index.html status:', liveHtml.status);
}
check();
