import glob, os, re

def update_polish(base_dir):
    path = os.path.join(base_dir, 'assets', 'js', 'polish.js')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Replace reveal() with proper hold timing and clear timing
    old_reveal = '''function reveal(){
  if(!root.classList.contains("pt-in"))return;
  let done=false;
  const go=()=>{
    if(done)return;done=true;
    root.classList.add("pt-reveal");
    root.classList.remove("pt-in","pt-intro");
    setTimeout(()=>{clear();delete root.dataset.pt},900);
  };
  const app=document.getElementById("app");
  const ready=()=>!app||app.children.length>0;
  const t0=performance.now();
  const wait=()=>{
    if(ready()&&performance.now()-t0>120)return go();
    if(performance.now()-t0>800)return go();
    requestAnimationFrame(wait);
  };
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(wait,wait);
  setTimeout(go,900);
}'''

    new_reveal = '''function reveal(){
  if(!root.classList.contains("pt-in"))return;
  let done=false;
  const go=()=>{
    if(done)return;done=true;
    root.classList.add("pt-reveal");
    root.classList.remove("pt-in","pt-intro");
    setTimeout(()=>{clear();delete root.dataset.pt},1250);
  };
  const app=document.getElementById("app");
  const ready=()=>!app||app.children.length>0;
  const t0=performance.now(),hold=root.classList.contains("pt-intro")?1700:320;
  const wait=()=>{
    if(ready()&&performance.now()-t0>hold)return go();
    if(performance.now()-t0>hold+1200)return go();
    requestAnimationFrame(wait);
  };
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(wait,wait);
  setTimeout(go,hold+2500);
}'''
    assert old_reveal in content, f"old_reveal not found in {path}"
    content = content.replace(old_reveal, new_reveal)

    # Replace click handler to letter-split title and allow ribbons to cover screen completely before navigation
    old_click = '''  const title=titleFor(u,a);
  const span=document.querySelector("#pt .t span");if(span)span.textContent=title;
  try{sessionStorage.setItem(KEY,title)}catch(_){}
  root.classList.add("pt-out");
  setTimeout(()=>{location.href=href},560);
  setTimeout(clear,2500);'''

    new_click = '''  const title=titleFor(u,a);
  const span=document.querySelector("#pt .t span");
  if(span){
    span.setAttribute("aria-label",title);
    span.innerHTML=[...title].map((c,i)=>`<i aria-hidden="true" style="--i:${i}">${c===" "?"&nbsp;":c}</i>`).join("");
  }
  try{sessionStorage.setItem(KEY,title)}catch(_){}
  root.classList.add("pt-out");
  setTimeout(()=>{location.href=href},780);
  setTimeout(clear,3200);'''

    assert old_click in content, f"old_click not found in {path}"
    content = content.replace(old_click, new_click)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated polish.js in', base_dir)

def update_html_files(base_dir):
    old_snippet = 'try{var t=document.documentElement.dataset.pt;if(t)document.querySelector("#pt .t span").textContent=t}catch(e){}'
    new_snippet = 'try{var t=document.documentElement.dataset.pt;if(t){var sp=document.querySelector("#pt .t span");if(sp){sp.setAttribute("aria-label",t);sp.innerHTML=[...t].map(function(c,i){return\'<i aria-hidden="true" style="--i:\'+i+\'">\'+(c===" "?"&nbsp;":c)+\'</i>\'}).join("")}}}catch(e){}'

    count = 0
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith('.html'):
                full_path = os.path.join(root, file)
                with open(full_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                if old_snippet in content:
                    content = content.replace(old_snippet, new_snippet)
                    with open(full_path, 'w', encoding='utf-8', newline='\n') as f:
                        f.write(content)
                    count += 1
    print(f'Updated {count} HTML files in {base_dir}')

for d in ['cloudflare-pages-site', 'deployment/website']:
    update_polish(d)
    update_html_files(d)

print('Transition timing and letter animation successfully fixed!')
