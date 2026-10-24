// Simulate what config-loader.js does for announcement bar
const fs = require('fs');

const configJs = fs.readFileSync('d:/Drafts/Blogs/website/cloudflare-pages-site/config.js', 'utf-8');
// Extract announcementBar
const match = configJs.match(/announcementBar:\s*(\{[\s\S]*?\}),\s*\n\s*socials/);
if (match) {
  console.log('announcementBar from config.js:');
  // Parse it manually
  const block = match[1];
  console.log(block);
} else {
  console.log('Could not find announcementBar block');
}

// Check config-loader.js applyAnnouncementBar flow
const loader = fs.readFileSync('d:/Drafts/Blogs/website/cloudflare-pages-site/assets/js/config-loader.js', 'utf-8');

// Check the getSetting call for announcement_bar
const settingsIdx = loader.indexOf('applyAnnouncementBar');
console.log('\napplyAnnouncementBar function (first 600 chars):');
console.log(loader.slice(settingsIdx, settingsIdx + 600));

// Also check how siteDefaults().announcementBar is used
console.log('\n--- renderAnnouncementBar first check ---');
const renderIdx = loader.indexOf('function renderAnnouncementBar');
console.log(loader.slice(renderIdx, renderIdx + 400));
