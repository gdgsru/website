const fs = require('fs');

let html = fs.readFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html', 'utf8');

html = html.replace('</body>', `
<div id="debug" style="padding: 10px; font-family: monospace; font-size: 11px;"></div>
<script>
  window.addEventListener('DOMContentLoaded', () => {
    const nav = document.querySelector('.top-nav');
    const actions = document.querySelector('.nav-actions');
    const logo = document.querySelector('.brand-logo');
    document.getElementById('debug').innerHTML = 
      'innerWidth: ' + window.innerWidth + 
      '<br>nav offsetWidth: ' + nav.offsetWidth + 
      '<br>logo offsetWidth: ' + logo.offsetWidth + 
      '<br>actions offsetWidth: ' + actions.offsetWidth +
      '<br>actions right: ' + actions.getBoundingClientRect().right;
  });
</script>
</body>`);

fs.writeFileSync('C:/Users/Narayan Bora/.gemini/antigravity/brain/88b431b3-07a3-41f7-bed6-96a805f27d93/nav_test.html', html);
console.log('Debug added to nav_test.html');
