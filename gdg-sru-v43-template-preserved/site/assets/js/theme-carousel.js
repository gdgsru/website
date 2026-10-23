(()=>{
const root=document.documentElement;
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;

/* ---------- theme ---------- */
const KEY="gdg-theme";
const SUN='<svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
const MOON='<svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
function setTheme(t,save){
  root.dataset.theme="light";
  const m=document.querySelector('meta[name=theme-color]');if(m)m.content="#f6f5f1";
  const c=document.querySelector('meta[name=color-scheme]');if(c)c.content="light";
  try{localStorage.setItem(KEY,"light")}catch (e) { console.warn('[App] Operation notice:', e); }
}
function toggle(){}
function themeBtn(){const b=document.createElement("span");b.style.display="none";return b}
function mountTheme(){
  setTheme("light",false);
}
setTheme("light",true);
mountTheme();
addEventListener("DOMContentLoaded",mountTheme);
addEventListener("storage",e=>{if(e.key===KEY&&e.newValue)setTheme(e.newValue==="light"?"light":"dark",false)});
const st=document.createElement("style");st.textContent="html.v3-theming *,html.v3-theming *:before,html.v3-theming *:after{transition:background-color .35s ease,color .35s ease,border-color .35s ease,fill .35s ease!important}";document.head.appendChild(st);

/* ---------- track carousel ----------
   Plain horizontal scroller. The "active" card is chosen by class only (no per-frame transforms),
   clicking a card (or the arrows / dots / ← →) glides it to the centre. When all cards fit
   they simply sit centred and nothing needs scrolling. */
function build(row){
  if(row.dataset.v3)return;row.dataset.v3=1;row.classList.add("v3-car");
  const cards=()=>[...row.querySelectorAll(":scope>.track-card")];
  const ui=document.createElement("div");ui.className="v3-car-ui";
  const prev=document.createElement("button");prev.type="button";prev.setAttribute("aria-label","Previous track");prev.textContent="←";
  const next=document.createElement("button");next.type="button";next.setAttribute("aria-label","Next track");next.textContent="→";
  const dots=document.createElement("div");dots.className="v3-dots";
  ui.append(prev,dots,next);row.after(ui);
  let idx=0,lock=0;
  const centre=(i,smooth=true)=>{
    const c=cards()[i];if(!c)return;
    const left=c.offsetLeft-(row.clientWidth-c.offsetWidth)/2;
    row.scrollTo({left:Math.max(0,left),behavior:smooth&&!still?"smooth":"auto"});
  };
  const mark=i=>{
    idx=i;const cs=cards();
    cs.forEach((c,k)=>c.classList.toggle("is-active",k===i));
    [...dots.children].forEach((d,k)=>d.classList.toggle("on",k===i));
    const over=row.scrollWidth-row.clientWidth>4;
    ui.hidden=!over&&true;
    prev.disabled=i<=0;next.disabled=i>=cs.length-1;
  };
  const go=(i,smooth)=>{i=Math.max(0,Math.min(cards().length-1,i));lock=performance.now()+(smooth?650:0);mark(i);centre(i,smooth)};
  cards().forEach((c,k)=>{const d=document.createElement("i");d.addEventListener("click",()=>go(k,true));dots.appendChild(d);c.tabIndex=0;c.setAttribute("role","button");
    c.addEventListener("click",()=>{if(moved>5)return;go(k,true)});
    c.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();go(k,true)}});
  });
  prev.addEventListener("click",()=>go(idx-1,true));
  next.addEventListener("click",()=>go(idx+1,true));
  row.addEventListener("keydown",e=>{if(e.key==="ArrowRight"){e.preventDefault();go(idx+1,true)}if(e.key==="ArrowLeft"){e.preventDefault();go(idx-1,true)}});
  /* manual scroll / swipe → update the active card once it settles (ignored while we are gliding) */
  let t=0;
  row.addEventListener("scroll",()=>{
    if(performance.now()<lock)return;
    clearTimeout(t);t=setTimeout(()=>{
      const mid=row.scrollLeft+row.clientWidth/2;let best=0,bd=1e9;
      cards().forEach((c,k)=>{const d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;best=k}});
      if(best!==idx)mark(best);
    },90);
  },{passive:true});
  /* mouse drag (touch uses native swipe) */
  let down=false,sx=0,sl=0,moved=0;
  row.addEventListener("pointerdown",e=>{if(e.pointerType!=="mouse"||e.button!==0)return;down=true;moved=0;sx=e.clientX;sl=row.scrollLeft});
  addEventListener("pointermove",e=>{if(!down)return;const dx=e.clientX-sx;moved=Math.max(moved,Math.abs(dx));if(moved>5)row.classList.add("drag");if(moved>5)row.scrollLeft=sl-dx});
  addEventListener("pointerup",()=>{if(!down)return;down=false;
    if(row.classList.contains("drag")){row.classList.remove("drag");
      const mid=row.scrollLeft+row.clientWidth/2;let best=0,bd=1e9;
      cards().forEach((c,k)=>{const d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;best=k}});
      go(best,true);}
    setTimeout(()=>{moved=0},0)});
  addEventListener("resize",()=>{mark(idx);centre(idx,false)});
  /* first paint: start on the first card — never force the visitor to scroll right to find anything */
  requestAnimationFrame(()=>{row.scrollLeft=0;mark(0)});
}
function scan(){
  const seen=new Set();
  document.querySelectorAll(".track-card").forEach(c=>{const p=c.parentElement;if(p&&!seen.has(p)&&p.children.length>=3){seen.add(p);build(p)}});
}
scan();addEventListener("load",()=>setTimeout(scan,600));
let mo=0;new MutationObserver(()=>{clearTimeout(mo);mo=setTimeout(()=>{scan();mountTheme()},120)}).observe(document.documentElement,{childList:true,subtree:true});
})();
