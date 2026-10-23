/* v19 · page transition: split the title into letters so it rises in,
   character by character, and keep screen readers on the full word. */
(()=>{
  const textOf=el=>el.children.length?[...el.children].map(c=>c.textContent).join(""):el.textContent;
  function sync(el){
    const t=textOf(el).replace(/\u00a0/g," ");
    if(el.children.length&&el.dataset.split===t)return;
    el.dataset.split=t;
    el.setAttribute("aria-label",t);
    el.textContent="";
    [...t].forEach((ch,i)=>{
      const s=document.createElement("i");
      s.setAttribute("aria-hidden","true");
      s.style.setProperty("--i",i);
      s.textContent=ch===" "?"\u00a0":ch;
      el.appendChild(s);
    });
  }
  const init=()=>{
    const el=document.querySelector("#pt .t span");
    if(!el)return;
    sync(el);
    new MutationObserver(()=>sync(el)).observe(el,{childList:true,characterData:true,subtree:true});
  };
  document.readyState==="loading"?document.addEventListener("DOMContentLoaded",init):init();
})();
