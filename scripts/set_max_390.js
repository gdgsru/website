const fs = require('fs');

let html = fs.readFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html', 'utf8');

html = html.replace('.top-nav {', '.top-nav { max-width: 390px !important; margin: 0 !important;');

fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html', html);
console.log('Set max-width: 390px');
