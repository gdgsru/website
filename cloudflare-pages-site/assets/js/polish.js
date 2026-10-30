(()=>{
const root=document.documentElement;
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------- page transition ---------- */
const KEY="gdg-pt";
const clear=()=>root.classList.remove("pt-in","pt-out","pt-reveal","pt-intro");

// Arrived via an in-site link: smoothly unveil the destination page
function reveal(){
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
  const p=u.pathname.replace(/index\.html$/,"");
  if(NAMES[p])return NAMES[p];
  const t=(a.textContent||"").replace(/\s+/g," ").trim();
  return t&&t.length<28?t:"GDG SRU";
}

// Buttery smooth, balanced page transition: 560ms natural glide covering the screen completely
document.addEventListener("click",e=>{
  if(still||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
  const a=e.target.closest&&e.target.closest("a");
  if(!internal(a))return;
  e.preventDefault();
  const href=a.href,u=new URL(href);
  const title=titleFor(u,a);
  const span=document.querySelector("#pt .t span");
  if(span){
    span.setAttribute("aria-label",title);
    span.innerHTML=[...title].map((c,i)=>`<i aria-hidden="true" style="--i:${i}">${c===" "?"&nbsp;":c}</i>`).join("");
  }
  try{sessionStorage.setItem(KEY,title)}catch(_){}
  root.classList.add("pt-out");
  setTimeout(()=>{location.href=href},780);
  setTimeout(clear,3200);
});

/* ---------- scroll reveal ---------- */
if(!still&&"IntersectionObserver"in window){
  const SEL=[".page-intro",".editorial-collections-head",".blog-home-head",
    ".card",".pk-card",".track-card",".project-tile",".feature-event",".advisor-card",".blog-card",".project-card",
    ".step",".event-card",".resource-card",".stat-card",".faq-item",".community-card",".discord-card",".perk-card",
    ".cert-card",".leader-card",".editorial-card",".event-format-card",".about-feature",".join-card",".path-card",".contact-card"].join(",");
  const io=new IntersectionObserver(es=>{
    for(const en of es){
      if(!en.isIntersecting)continue;
      const el=en.target;io.unobserve(el);
      el.classList.add("in");
      const d=parseInt(el.style.getPropertyValue("--d"))||0;
      setTimeout(()=>el.classList.remove("rv","in"),750+d+200);
    }
  },{threshold:.12,rootMargin:"0px 0px -6% 0px"});
  const scan=()=>{
    const app=document.getElementById("app");
    if(!app||document.body.dataset.route==="team")return;     // team page has its own 3D card motion
    const seen=new Map();
    app.querySelectorAll(SEL).forEach(el=>{
      if(el.dataset.rv||el.closest(".hero-reference")||el.parentElement.closest(SEL))return; // outermost only
      el.dataset.rv="1";
      const p=el.parentElement,i=seen.get(p)||0;seen.set(p,i+1);
      el.style.setProperty("--d",Math.min(i,6)*70+"ms");
      el.classList.add("rv");io.observe(el);
    });
  };
  let t;
  const later=()=>{clearTimeout(t);t=setTimeout(scan,120)};
  const start=()=>{
    scan();
    const app=document.getElementById("app");
    if(app)new MutationObserver(later).observe(app,{childList:true,subtree:true}); // events/blog load after Supabase answers
  };
  document.readyState==="loading"?addEventListener("DOMContentLoaded",start):start();
}
})();
