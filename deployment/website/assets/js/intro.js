/* Startup intro (home page, once per fresh visit).
   A mandala of Google-coloured shapes grows ring by ring, spins up and collapses
   into the centre; the GDG logo then lands, the tagline rises, and the four-colour
   stripes sweep the page in. Click, Esc, Enter or Space skips it.
   Timeline lives in T (ms). Styles: assets/css/startup-intro.css */
(()=>{
const root=document.documentElement;
if(!root.classList.contains("gi-on"))return;
const gi=document.getElementById("gi");root.classList.add("gi-run");
const cv=gi&&gi.querySelector("canvas");
if(!gi||!cv){root.classList.remove("gi-on");return}
const ctx=cv.getContext("2d");
const cnt=gi.querySelector(".gi-count b");
const COL={b:"#4285f4",r:"#ea4335",y:"#fbbc04",g:"#34a853"};
const TAU=Math.PI*2;
const ease=(t)=>t<0?0:t>1?1:1-Math.pow(1-t,3);
const inOut=(t)=>t<0?0:t>1?1:t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;

/* timeline (ms) */
const T={build:1500,collapse:[1500,2150],logo:1950,tag:2700,cover:4700};
let W=0,H=0,dpr=1,u=10,mx=0,my=0,tx=0,ty=0;
function size(){
  // phones get a lighter canvas for a smoother start
  dpr=Math.min(devicePixelRatio||1,innerWidth<700?1.5:2);
  W=innerWidth;H=innerHeight;
  cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+"px";cv.style.height=H+"px";
  u=Math.max(7,Math.min(W,H)*.052);
}
size();addEventListener("resize",size);
addEventListener("pointermove",e=>{tx=(e.clientX/W-.5)*2;ty=(e.clientY/H-.5)*2},{passive:true});

/* rings: [radius in u, count, kind, colour, spin speed, size in u] */
const RINGS=[
 [1.15,8, "spark",COL.b, .55,.34],
 [2.25,14,"half", COL.g,-.38,.46],
 [3.45,20,"petal",COL.y, .26,.52],
 [4.75,28,"tick", COL.r,-.2, .5],
 [5.7, 44,"dot",  COL.b, .12,.13],
];
function draw(kind,col,s,rot){
  ctx.save();ctx.rotate(rot);ctx.fillStyle=col;ctx.strokeStyle=col;
  if(kind==="dot"){ctx.beginPath();ctx.arc(0,0,s*u,0,TAU);ctx.fill()}
  else if(kind==="tick"){ctx.lineWidth=u*.17;ctx.lineCap="round";ctx.beginPath();ctx.moveTo(0,-s*u*.55);ctx.lineTo(0,s*u*.55);ctx.stroke()}
  else if(kind==="petal"){ctx.beginPath();ctx.ellipse(0,0,s*u*.3,s*u*.62,0,0,TAU);ctx.fill()}
  else if(kind==="half"){const r=s*u*.5;ctx.lineWidth=u*.13;ctx.beginPath();ctx.arc(0,0,r,0,TAU);ctx.stroke();ctx.beginPath();ctx.arc(0,0,r,0,Math.PI);ctx.closePath();ctx.fill()}
  else{const k=s*u*.9;ctx.beginPath();ctx.moveTo(0,-k);ctx.quadraticCurveTo(0,0,k,0);ctx.quadraticCurveTo(0,0,0,k);ctx.quadraticCurveTo(0,0,-k,0);ctx.quadraticCurveTo(0,0,0,-k);ctx.fill()}
  ctx.restore();
}
let t0=performance.now(),raf=0,state="run",flashT=-1;
function frame(now){
  const t=now-t0;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,W,H);
  mx+=(tx-mx)*.06;my+=(ty-my)*.06;
  const cx=W/2+mx*14,cy=H*.46+my*10;
  const col=(t-T.collapse[0])/(T.collapse[1]-T.collapse[0]);
  const c=inOut(col);                       // 0 → 1 while everything is pulled into the centre
  const fade=1-ease((t-T.collapse[1]+120)/260);
  if(fade>0){
    ctx.globalAlpha=fade;
    RINGS.forEach(([r,n,kind,colr,spin,s],ri)=>{
      const a=ease((t-ri*170)/760);          // each ring grows in, one after another
      if(a<=0)return;
      const spinBoost=1+c*5;
      const R=r*u*(.15+.85*a)*(1-c*.96);
      const sz=s*(.2+.8*a)*(1-c*.85);
      const base=t/1000*spin*spinBoost*(ri%2?-1:1)*1.0+ri*.4;
      for(let i=0;i<n;i++){
        const ang=base+i/n*TAU;
        ctx.save();ctx.translate(cx+Math.cos(ang)*R,cy+Math.sin(ang)*R);
        draw(kind,colr,sz,ang+Math.PI/2);ctx.restore();
      }
    });
    ctx.globalAlpha=1;
  }
  /* pulse ring when the shapes land in the centre */
  const pt=(t-T.collapse[1]+80)/520;
  if(pt>0&&pt<1){ctx.strokeStyle=(root.dataset.theme==="light"?"rgba(26,115,232,":"rgba(255,255,255,")+(.5*(1-pt))+")";ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy,u*(1+pt*9),0,TAU);ctx.stroke()}
  /* counter */
  const pct=Math.min(100,Math.round(ease(t/(T.collapse[1]))*100));
  if(cnt)cnt.textContent=String(pct).padStart(3,"0");
  if(t>T.logo&&!gi.classList.contains("logo")){gi.classList.add("logo")}
  if(t>T.tag&&!gi.classList.contains("tag")){gi.classList.add("tag")}
  if(t>T.cover&&state==="run"){return finish()}
  raf=requestAnimationFrame(frame);
}
raf=requestAnimationFrame(frame);

/* hand over to the four stripes, then reveal the page */
function finish(){
  if(state!=="run")return;state="done";cancelAnimationFrame(raf);
  gi.style.transition="opacity .6s cubic-bezier(.4, 0, .2, 1), transform .6s cubic-bezier(.4, 0, .2, 1)";
  gi.style.opacity="0";
  gi.style.transform="scale(1.03)";
  gi.style.pointerEvents="none";
  setTimeout(()=>{
    root.classList.remove("gi-on");
    gi.remove();
  },620);
}
function skip(){if(state==="run"){T.cover=0;}}
gi.addEventListener("click",skip);
addEventListener("keydown",e=>{if(e.key==="Escape"||e.key==="Enter"||e.key===" ")skip()});
})();
