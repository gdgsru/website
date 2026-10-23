(()=>{
const root=document.documentElement;
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;
const fine=matchMedia("(hover:hover)").matches;

/* ---------- nav: gliding lens under the links ---------- */
function lens(){
  const lk=document.getElementById("lk");
  if(!lk||!lk.children.length)return;
  const getL=()=>{let l=lk.querySelector(".nav-lens");if(!l){l=document.createElement("i");l.className="nav-lens";l.setAttribute("aria-hidden","true");lk.prepend(l)}return l};
  const links=()=>[...lk.querySelectorAll("a")];
  const to=a=>{
    const l=getL();
    if(!a){l.classList.remove("ready");return}
    const r=a.getBoundingClientRect(),p=lk.getBoundingClientRect();
    l.style.setProperty("--lc",getComputedStyle(a).getPropertyValue("--lc")||"#4285f4");
    l.style.width=r.width+"px";l.style.height=r.height+"px";
    l.style.transform=`translate(${r.left-p.left}px,${r.top-p.top}px)`;
    l.classList.add("ready");
  };
  const home=()=>to(links().find(a=>a.classList.contains("on")||a.getAttribute("aria-current")==="page"));
  if(lk.dataset.lens){home();return}
  lk.dataset.lens=1;
  lk.addEventListener("pointerover",e=>{const a=e.target.closest&&e.target.closest("a");if(a&&lk.contains(a))to(a)});
  lk.addEventListener("focusin",e=>{const a=e.target.closest&&e.target.closest("a");if(a)to(a)});
  lk.addEventListener("pointerleave",home);
  lk.addEventListener("focusout",home);
  addEventListener("resize",home);
  if("ResizeObserver"in window)new ResizeObserver(()=>home()).observe(lk);
  const hd=document.getElementById("hd");if(hd)hd.addEventListener("transitionend",e=>{if(e.target===hd)home()});
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(home);
  home();
}

/* ---------- nav: condense on scroll, tuck away when reading down, light follows the cursor ---------- */
function bar(){
  const h=document.getElementById("hd");if(!h)return;
  let last=scrollY,tick=0;
  const on=()=>{
    const y=scrollY,d=y-last;
    root.classList.toggle("nav-min",y>36);
    if(y>420&&d>6&&!root.classList.contains("menu-open"))root.classList.add("nav-hide");
    else if(d<-4||y<=420)root.classList.remove("nav-hide");
    last=y;tick=0;
  };
  addEventListener("scroll",()=>{if(!tick)tick=requestAnimationFrame(on)},{passive:true});
  on();
  /* keyboard users: never leave focus inside a hidden bar */
  h.addEventListener("focusin",()=>root.classList.remove("nav-hide"));
  if(fine&&!still)h.addEventListener("pointermove",e=>{const r=h.getBoundingClientRect();h.style.setProperty("--hx",(e.clientX-r.left)+"px");h.style.setProperty("--hy",(e.clientY-r.top)+"px")},{passive:true});
}

/* ---------- menu: reveal grows out of the Menu button; links stagger in ---------- */
function menu(){
  const mo=document.getElementById("mo");if(!mo||mo.dataset.v4)return;mo.dataset.v4=1;
  const btn=document.querySelector("header#hd .mn");
  const stagger=()=>mo.querySelectorAll(".menu-links>a").forEach((a,i)=>a.style.setProperty("--i",i));
  const sync=()=>{
    const open=mo.classList.contains("on");
    root.classList.toggle("menu-open",open);
    if(open){
      stagger();
      const b=btn&&btn.getBoundingClientRect();
      if(b){mo.style.setProperty("--ox",(b.left+b.width/2)+"px");mo.style.setProperty("--oy",(b.top+b.height/2)+"px")}
      root.classList.remove("nav-hide");
    }
  };
  new MutationObserver(sync).observe(mo,{attributes:true,attributeFilter:["class"]});
  new MutationObserver(stagger).observe(mo,{childList:true,subtree:true});
  stagger();sync();
}

/* ---------- cards: spotlight follows the pointer ---------- */
if(fine&&!still){
  let raf=0,ev=null;
  const SEL=".card,.step,.blog-card,.resource-card,.perk-card,.editorial-card,.about-feature,.community-card,.project-card,.event-format-card,.event-card,.feature-event,.advisor-card,.path-card,.reference-card,.info-card,.project-tile,.stat-card,.faq-item,.join-card,.contact-card,.pk-card";
  addEventListener("pointermove",e=>{
    ev=e;if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;const c=ev.target.closest&&ev.target.closest(SEL);if(!c)return;
      const r=c.getBoundingClientRect();
      c.style.setProperty("--mx",(ev.clientX-r.left)+"px");c.style.setProperty("--my",(ev.clientY-r.top)+"px");
    });
  },{passive:true});
}

function run(){lens();bar();menu()}
run();
addEventListener("DOMContentLoaded",run);
addEventListener("load",()=>{run();setTimeout(lens,400)});
let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,80)}).observe(document.documentElement,{childList:true,subtree:true});
})();
