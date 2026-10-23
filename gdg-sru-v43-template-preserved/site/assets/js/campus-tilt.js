/* v27 · campus 3D: pointer tilt for the building picture.
   Sets --rx / --ry (-1..1) on the nearest .pk-bld while the pointer is over
   the stage. Skipped on touch screens and when reduced motion is requested. */
(()=>{
  if(matchMedia("(prefers-reduced-motion: reduce)").matches||matchMedia("(pointer: coarse)").matches)return;
  let cur=null;
  const reset=el=>{if(!el)return;el.style.setProperty("--rx",0);el.style.setProperty("--ry",0)};
  document.addEventListener("pointermove",e=>{
    const stage=e.target.closest&&e.target.closest(".pk-stage");
    const bld=stage&&stage.querySelector(".pk-bld");
    if(cur&&cur!==bld)reset(cur);
    cur=bld||null;
    if(!bld)return;
    const r=bld.getBoundingClientRect();
    const x=((e.clientX-r.left)/r.width)*2-1, y=((e.clientY-r.top)/r.height)*2-1;
    bld.style.setProperty("--rx",x.toFixed(3));
    bld.style.setProperty("--ry",y.toFixed(3));
  },{passive:true});
  document.addEventListener("pointerleave",()=>reset(cur),true);
  document.addEventListener("mouseleave",()=>reset(cur));
})();
