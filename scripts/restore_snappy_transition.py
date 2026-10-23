code = '''(()=>{
const root=document.documentElement;
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------- page transition ---------- */
const KEY="gdg-pt";
const clear=()=>root.classList.remove("pt-in","pt-out","pt-reveal","pt-intro");

// Arrived via an in-site link: the head snippet already covered the page. Wait for content, then sweep up.
function reveal(){
  if(!root.classList.contains("pt-in"))return;
  let done=false;
  const go=()=>{
    if(done)return;done=true;
    root.classList.add("pt-reveal");
    root.classList.remove("pt-in","pt-intro");
    setTimeout(()=>{clear();delete root.dataset.pt},450);
  };
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",()=>setTimeout(go,60),{once:true});
  }else{
    setTimeout(go,60);
  }
  setTimeout(go,600); // safety fallback
}
reveal();

addEventListener("pageshow",e=>{
  if(e.persisted){clear();try{sessionStorage.removeItem(KEY)}catch(_){}}
});

function internal(a){
  if(!a||!a.href||a.target&&a.target!=="_self"||a.hasAttribute("download"))return false;
  const u=new URL(a.href,location.href);
  if(u.origin!==location.origin)return false;
  if(/mission-control|admin/.test(u.pathname))return false; // admin tool: no theatrics
  if(u.pathname===location.pathname&&u.search===location.search)return false; // same page / #hash
  return true;
}
const NAMES={"/":"Home","/events/":"Events","/team/":"Team","/blog/":"Blog","/join/":"Join us","/resources/":"Resource Hub","/leaderboard/":"Leaderboard","/certificates/":"Certificates","/verify/":"Verify","/privacy/":"Privacy","/event.html":"Event"};
function titleFor(u,a){
  const p=u.pathname.replace(/index\\.html$/,"");
  if(NAMES[p])return NAMES[p];
  const t=(a.textContent||"").replace(/\\s+/g," ").trim();
  return t&&t.length<28?t:"GDG SRU";
}

// Snappy, responsive page transition: swift 280ms swipe in, then instant uncurtain on arrival
document.addEventListener("click",e=>{
  if(still||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest&&e.target.closest("a");
  if(!internal(a))return;
  e.preventDefault();
  const href=a.href,u=new URL(href);
  const title=titleFor(u,a);
  const span=document.querySelector("#pt .t span");if(span)span.textContent=title;
  try{sessionStorage.setItem(KEY,title)}catch(_){}
  root.classList.add("pt-out");
  setTimeout(()=>{location.href=href},280);
  setTimeout(clear,2500);
});
'''

for path in ['cloudflare-pages-site/assets/js/polish.js', 'deployment/website/assets/js/polish.js']:
    with open(path, 'r', encoding='utf-8') as f:
        existing = f.read()
    
    # Locate /* ---------- scroll reveal ---------- */ which comes after page transition
    split_target = '/* ---------- scroll reveal ---------- */'
    idx = existing.find(split_target)
    assert idx != -1, f"split_target not found in {path}"
    
    new_full = code.strip() + '\n\n' + existing[idx:]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_full)
    print(f'Updated {path} with snappy transition screen!')
