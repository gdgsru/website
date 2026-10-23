for path in ['cloudflare-pages-site/assets/js/polish.js', 'deployment/website/assets/js/polish.js']:
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the artificial click delay with instant navigation (no preventDefault or 820ms freeze)
    old_code = '''document.addEventListener("click",e=>{
  if(still||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest&&e.target.closest("a");
  if(!internal(a))return;
  e.preventDefault();
  const href=a.href,u=new URL(href);
  const title=titleFor(u,a);
  const span=document.querySelector("#pt .t span");if(span)span.textContent=title;
  try{sessionStorage.setItem(KEY,title)}catch (_) { console.warn('[App] Operation notice:', _); }
  root.classList.add("pt-out");
  setTimeout(()=>{location.href=href},820);
  setTimeout(clear,3000);                       // if navigation is cancelled, uncover the page
});'''

    new_code = '''// Instant page navigation: removed artificial 820ms click block & transition curtain delay
// Allows instant browser navigation and caching across all pages.'''

    assert old_code in content, f"old_code not found in {path}"
    content = content.replace(old_code, new_code)
    
    # Also ensure reveal() cleans up immediately if any lingering pt-in exists
    content = content.replace('setTimeout(()=>{clear();delete root.dataset.pt},1350);', 'clear();delete root.dataset.pt;')

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print(f'Successfully sped up {path}!')
