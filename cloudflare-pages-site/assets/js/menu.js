(()=>{
const root=document.documentElement;

/* ---------- menu: one controller, capture-phase, no layered wrappers ---------- */
function setMenu(open){
  const mo=document.getElementById("mo");if(!mo)return;
  open=!!open;
  mo.classList.toggle("on",open);
  mo.classList.remove("v29-closing");
  mo.setAttribute("aria-hidden",open?"false":"true");
  mo.setAttribute("role","dialog");mo.setAttribute("aria-modal",open?"true":"false");
  root.classList.toggle("menu-open",open);
  document.body.classList.toggle("menu-open",open);
  document.body.style.overflow=open?"hidden":"";
  const trigBtn = document.querySelector("header#hd .mn");
  if (trigBtn) trigBtn.setAttribute("aria-expanded", open ? "true" : "false");
  if(open){
    mo.querySelectorAll(".menu-links>a").forEach((a,i)=>a.style.setProperty("--i",i));
    const c=mo.querySelector(".menu-close");if(c)setTimeout(()=>c.focus({preventScroll:true}),30);
  }else{
    const t=document.querySelector("header#hd .mn");if(t&&document.activeElement&&mo.contains(document.activeElement))t.focus({preventScroll:true});
  }
}
window.mo=setMenu;
document.addEventListener("click",e=>{
  const t=e.target;if(!t||!t.closest)return;
  const trig=t.closest("header#hd .mn");
  if(trig){e.preventDefault();e.stopImmediatePropagation();const mo=document.getElementById("mo");setMenu(!(mo&&mo.classList.contains("on")));return}
  if(t.closest("#mo .menu-close")){e.preventDefault();e.stopImmediatePropagation();setMenu(0);return}
  if(t.closest("#mo a[href]")){setMenu(0)}   /* let navigation proceed */
},true);
document.addEventListener("keydown",e=>{
  const mo=document.getElementById("mo");
  if(!mo||!mo.classList.contains("on"))return;
  if(e.key==="Escape"){setMenu(0);return}
  if(e.key==="Tab"){
    const focusables=[...mo.querySelectorAll("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])")].filter(el=>el.offsetParent!==null||el.offsetWidth>0||el.offsetHeight>0);
    if(!focusables.length)return;
    const first=focusables[0], last=focusables[focusables.length-1];
    if(e.shiftKey){
      if(document.activeElement===first){e.preventDefault();last.focus()}
    }else{
      if(document.activeElement===last){e.preventDefault();first.focus()}
    }
  }
});
/* clicking the empty backdrop also closes */
document.addEventListener("click",e=>{
  const mo=document.getElementById("mo");
  if(mo&&mo.classList.contains("on")&&e.target===mo)setMenu(0);
});
/* never boot with a stuck-open menu (bfcache / back button) */
addEventListener("pageshow",()=>{const mo=document.getElementById("mo");if(mo&&mo.classList.contains("on"))setMenu(0)});

/* ---------- event card: turn the empty state into a ticket ---------- */
function ticket(){
  const f=document.querySelector(".event-feature");
  if(!f||f.dataset.v5)return;
  const main=f.querySelector(".event-feature-main"),acts=main&&main.querySelector(".event-feature-actions");
  if(!main||!acts)return;
  f.dataset.v5="1";
  const stub=document.createElement("span");stub.className="ef-stub";stub.textContent="Admit one";
  main.prepend(stub);
  const grid=document.createElement("div");grid.className="ef-fields";
  grid.innerHTML=[["Date & time","#4285f4"],["Venue","#ea4335"],["Speaker","#fbbc04"],["Registration","#34a853"]]
    .map(([k,c])=>`<div><small><i style="background:${c}"></i>${k}</small><b>Announced soon</b></div>`).join("");
  acts.before(grid);if(window.__gdgFillFeature)window.__gdgFillFeature();
  const side=f.querySelector(".event-feature-side");
  const set=()=>{if(side)f.style.setProperty("--side-h",side.offsetHeight+"px")};
  set();addEventListener("resize",set);
}
const app=document.getElementById("app");
const run=()=>{ticket()};
if(app)new MutationObserver(run).observe(app,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",run);run();
})();
