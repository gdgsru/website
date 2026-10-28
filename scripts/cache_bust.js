// Cache-bust all script tags in HTML pages
const fs = require('fs');
const path = require('path');
const VER = '20261028-members1';
const MESH_VER = '20261025-bento3';

const root = path.join(__dirname, '..', 'cloudflare-pages-site');

// Find all HTML files
function findHtml(dir) {
  let results = [];
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, f.name);
    if (f.isDirectory() && !f.name.startsWith('.') && f.name !== 'node_modules' && f.name !== 'assets') {
      results = results.concat(findHtml(full));
    } else if (f.isFile() && f.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

const files = findHtml(root);
console.log(`Found ${files.length} HTML files`);

const scriptPattern = /src="(\/assets\/js\/[^"?]+?)(\?[^"]*)?"/g;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let changed = false;
  
  content = content.replace(scriptPattern, (match, scriptPath, existingQuery) => {
    const ver = scriptPath.includes('config-loader') ? MESH_VER : VER;
    const newSrc = `src="${scriptPath}?v=${ver}"`;
    if (match !== newSrc) changed = true;
    return newSrc;
  });
  
  if (changed) {
    fs.writeFileSync(file, content);
    console.log(`Updated: ${path.relative(root, file)}`);
  }
}
console.log('Done.');
