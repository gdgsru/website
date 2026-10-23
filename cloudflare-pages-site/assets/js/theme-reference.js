(()=>{
const still=matchMedia("(prefers-reduced-motion:reduce)").matches;
const building='<svg viewBox="0 0 64 64"><g fill="#fdd663"><path d="M32 5 5 20.5V26h54v-5.5z"/><rect x="10" y="30" width="7.5" height="22" rx="1.5"/><rect x="21.5" y="30" width="7.5" height="22" rx="1.5"/><rect x="35" y="30" width="7.5" height="22" rx="1.5"/><rect x="46.5" y="30" width="7.5" height="22" rx="1.5"/><rect x="5" y="55" width="54" height="5.5" rx="2"/></g><circle cx="32" cy="17.5" r="3.2" fill="#0e0f11"/></svg>';
const SH={
 half:'<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="26" fill="none" stroke="#81c995" stroke-width="6"/><path d="M6 32a26 26 0 0 0 52 0z" fill="#81c995"/></svg>',
 building,
 star:'<svg viewBox="0 0 64 64" fill="none" stroke="#f28b82" stroke-width="7" stroke-linecap="round"><path d="M32 8v48M11 20l42 24M53 20L11 44"/></svg>',
 spark:'<svg viewBox="0 0 64 64"><path fill="#8ab4f8" d="M32 4C34 22 42 30 60 32 42 34 34 42 32 60 30 42 22 34 4 32 22 30 30 22 32 4Z"/></svg>'
};

function navLine(){
 const h=document.getElementById("hd");
 if(!h||h.querySelector(".gdg-nav-line"))return;
 const l=document.createElement("i");l.className="gdg-nav-line";h.appendChild(l);
 const f=()=>{const m=document.documentElement.scrollHeight-innerHeight;l.style.setProperty("--p",m>0?Math.min(1,scrollY/m):0)};
 addEventListener("scroll",f,{passive:true});f();
}

function dots(cv){
 const W=980,H=250,S=6,dpr=Math.min(devicePixelRatio||1,2);
 const off=document.createElement("canvas");off.width=W;off.height=H;
 const o=off.getContext("2d",{willReadFrequently:true});
 let pts=[];
 const build=()=>{
  o.clearRect(0,0,W,H);
  o.lineWidth=38;o.lineCap="round";o.lineJoin="round";
  const arm=(x1,y1,x2,y2,c)=>{o.strokeStyle=c;o.beginPath();o.moveTo(x1,y1);o.lineTo(x2,y2);o.stroke()};
  const L=document.documentElement.dataset.theme==="light";
  arm(95,45,30,125,L?"#1558c0":"#8ab4f8");arm(30,125,95,205,L?"#c5221f":"#f28b82");
  arm(885,45,950,125,L?"#0d652d":"#81c995");arm(950,125,885,205,L?"#d98a00":"#fdd663");
  let fs=150;const t="GDG SRU";
  o.font=`${L?900:800} ${fs}px "Google Sans Flex",Outfit,system-ui,sans-serif`;
  const w=o.measureText(t).width;
  if(w>640){fs=Math.floor(fs*640/w);o.font=`${L?900:800} ${fs}px "Google Sans Flex",Outfit,system-ui,sans-serif`}
  o.textAlign="center";o.textBaseline="middle";o.fillStyle=L?"#0a0b0d":"#fff";o.fillText(t,W/2,H/2+6);
  const d=o.getImageData(0,0,W,H).data;pts=[];
  for(let y=S/2;y<H;y+=S)for(let x=S/2;x<W;x+=S){
   const i=(~~y*W+~~x)*4;
   if(d[i+3]>140)pts.push([x,y,`rgb(${d[i]},${d[i+1]},${d[i+2]})`]);
  }
 };
 cv.width=W*dpr;cv.height=H*dpr;
 const g=cv.getContext("2d");
 let mx=-999,my=-999,raf=0;
 const draw=()=>{
  g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,W,H);
  const L=document.documentElement.dataset.theme==="light",R0=L?2.45:1.9;
  if(L){g.globalAlpha=.16;for(const[p,q,c]of pts){g.fillStyle=c;g.beginPath();g.arc(p+1.5,q+2,R0,0,6.283);g.fill()}g.globalAlpha=1}
  for(const[p,q,c]of pts){
   const dx=p-mx,dy=q-my,r=Math.hypot(dx,dy),f=Math.max(0,1-r/95);
   const k=f?f*14/(r||1):0;
   g.fillStyle=c;g.beginPath();g.arc(p+dx*k,q+dy*k,R0+f*1.7,0,6.283);g.fill();
  }
  raf=0;
 };
 const go=()=>{if(!raf)raf=requestAnimationFrame(draw)};
 cv.addEventListener("pointermove",e=>{
  if(still)return;
  const b=cv.getBoundingClientRect();mx=(e.clientX-b.left)/b.width*W;my=(e.clientY-b.top)/b.height*H;go();
 });
 cv.addEventListener("pointerleave",()=>{mx=my=-999;go()});
 const start=()=>{build();draw()};
 new MutationObserver(()=>{if(done){build();draw()}}).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});
 let done=false;const once=()=>{if(!done){done=true;start()}};
 if(document.fonts&&document.fonts.load){document.fonts.load('800 150px "Google Sans Flex"').then(once,once);setTimeout(once,1500)}else once();
}

function hero(){
 const h=document.querySelector(".hero-reference");
 if(!h||h.dataset.gdg)return;
 h.dataset.gdg="1";
 const copy=h.querySelector(".hero-reference-copy"),eb=copy&&copy.querySelector(".hero-eyebrow");
 if(!eb)return;
 const cv=document.createElement("canvas");cv.className="gdg-dots";cv.setAttribute("role","img");cv.setAttribute("aria-label","GDG SRU");
 eb.after(cv);dots(cv);
 const sh=document.createElement("div");sh.className="gdg-shapes";sh.setAttribute("aria-hidden","true");
 sh.innerHTML=["half","building","star","spark"].map((k,i)=>`<span class="s${i}">${SH[k]}</span>`).join("");
 h.appendChild(sh);
 const items=[["Think it","half"],["Build it","building"],["Ship it","star"],["Share it","spark"]];
 const row=items.map(([t,k])=>`<span>${t}</span>${SH[k]}`).join("");
 const tk=document.createElement("div");tk.className="gdg-ticker";tk.setAttribute("aria-hidden","true");
 tk.innerHTML=`<div>${row}${row}${row}${row}</div>`;
 h.after(tk);
}

function run(){navLine();hero()}
const app=document.getElementById("app");
if(app)new MutationObserver(run).observe(app,{childList:true});
document.addEventListener("DOMContentLoaded",run);
run();
})();
