/* gdg-fixes.js: small robustness fixes, loaded last */
(function(){
  'use strict';
  /* Footer: drop dangling "·" separators at the start or end of a row */
  function tidyFooter(){
    document.querySelectorAll('footer div').forEach(function(row){
      var kids=[].slice.call(row.children);
      if(kids.length<2)return;
      var isSep=function(n){return n.tagName==='SPAN'&&n.textContent.trim()==='·'};
      while(kids.length&&isSep(kids[kids.length-1])){kids.pop().remove()}
      while(kids.length&&isSep(kids[0])){kids.shift().remove()}
    });
  }
  /* Scroll-reveal failsafe: anything left hidden above the viewport is shown */
  function reveal(){
    var vh=innerHeight;
    document.querySelectorAll('.rv:not(.in),[data-v29]:not(.v29-in)').forEach(function(el){
      var r=el.getBoundingClientRect();
      if(r.bottom<0||r.top<vh&&r.bottom>0&&getComputedStyle(el).opacity==='0'&&performance.now()>6000){
        el.classList.add(el.classList.contains('rv')?'in':'v29-in');
      }
    });
  }
  var t;addEventListener('scroll',function(){clearTimeout(t);t=setTimeout(reveal,200)},{passive:true});
  setTimeout(tidyFooter,300);setTimeout(tidyFooter,2500);
  setTimeout(reveal,7000);
})();
