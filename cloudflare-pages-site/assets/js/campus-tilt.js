/* v27 · campus 3D: pointer tilt for the building picture.
   Sets --rx / --ry (-1..1) on the nearest .pk-bld while the pointer is over
   the stage. Skipped on touch screens and when reduced motion is requested. */
(()=>{
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||matchMedia("(pointer: coarse)").matches)return;
  let cur=null;
  const reset=el=>{if(!el)return;el.style.setProperty("--rx",0);el.style.setProperty("--ry",0)};
  let r=null, raf=0, lastE=null;
  const clearState=el=>{reset(el);r=null;cur=null;};
  document.addEventListener("pointermove",e=>{
    const stage=e.target.closest&&e.target.closest(".pk-stage");
    const bld=stage&&stage.querySelector(".pk-bld");
    if(cur&&cur!==bld)clearState(cur);
    if(!bld)return;
    if(cur!==bld){cur=bld;r=bld.getBoundingClientRect();}
    lastE=e;
    if(!raf){
      raf=requestAnimationFrame(()=>{
        raf=0;
        if(!cur||!r)return;
        const x=((lastE.clientX-r.left)/r.width)*2-1, y=((lastE.clientY-r.top)/r.height)*2-1;
        cur.style.setProperty("--rx",x.toFixed(3));
        cur.style.setProperty("--ry",y.toFixed(3));
      });
    }
  },{passive:true});
  document.addEventListener("pointerleave",()=>clearState(cur),true);
  document.addEventListener("mouseleave",()=>clearState(cur));
})();
