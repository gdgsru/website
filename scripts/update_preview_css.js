const fs = require('fs');

let html = fs.readFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_perfect_preview.html', 'utf8');

// Replace body styling to width: 100% and overflow-x: hidden
html = html.replace('width: 375px;', 'width: 100%; max-width: 360px; overflow-x: hidden;');
fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/mobile_perfect_preview.html', html);
console.log('Updated width to 100% max-width: 360px');
