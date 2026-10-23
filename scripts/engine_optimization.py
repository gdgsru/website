import re, os

def update_effects(base_dir):
    path = os.path.join(base_dir, 'assets', 'js', 'effects.js')
    if not os.path.exists(path):
        print('Skipping', path)
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Guard card decoration observer
    old1 = 'let r=0;t(),new MutationObserver(function(){r||(r=requestAnimationFrame(()=>{r=0,t()}))}).observe(document.body,{childList:!0,subtree:!0}),addEventListener("hashchange",()=>setTimeout(t,60))'
    new1 = 'let r=0,updating=!1;function s(){if(updating)return;updating=!0;t();updating=!1;}s();const appM=document.getElementById("app");appM&&new MutationObserver(function(){updating||r||(r=requestAnimationFrame(()=>{r=0,s()}))}).observe(appM,{childList:!0}),addEventListener("hashchange",()=>setTimeout(s,60))'
    assert old1 in content, "effects.js: old1 not found"
    content = content.replace(old1, new1)

    # 2. Guard team cards observer
    old2 = 'window.MutationObserver&&document.documentElement&&new MutationObserver(()=>{document.querySelector(".page-team")&&o()}).observe(document.getElementById("app")||document.documentElement,{subtree:!0,childList:!0})'
    new2 = 'window.MutationObserver&&new MutationObserver(()=>{document.querySelector(".page-team")&&o()}).observe(document.getElementById("app")||document.body,{childList:!0})'
    assert old2 in content, "effects.js: old2 not found"
    content = content.replace(old2, new2)

    # 3. Guard team portal visual observer
    old3 = 'new MutationObserver(e).observe(document.getElementById("app")||document.body,{childList:!0,subtree:!0})'
    new3 = 'new MutationObserver(e).observe(document.getElementById("app")||document.body,{childList:!0})'
    assert old3 in content, "effects.js: old3 not found"
    content = content.replace(old3, new3)

    # 4. Guard v29 observer
    old4 = 'let C=0;new MutationObserver(()=>{C||(C=requestAnimationFrame(()=>{C=0,P()}))}).observe(r,{childList:!0,subtree:!0}),P();'
    new4 = 'let C=0,pActive=!1;function runP(){if(pActive)return;pActive=!0;P();pActive=!1;}new MutationObserver(()=>{pActive||C||(C=requestAnimationFrame(()=>{C=0,runP()}))}).observe(r,{childList:!0}),runP();'
    assert old4 in content, "effects.js: old4 not found"
    content = content.replace(old4, new4)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated effects.js in', base_dir)

def update_nav_effects(base_dir):
    path = os.path.join(base_dir, 'assets', 'js', 'nav-effects.js')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Optimize MutationObserver on document.documentElement to #app childList
    old_obs = 'let t=0;new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,80)}).observe(document.documentElement,{childList:true,subtree:true});'
    new_obs = 'let t=0;const appEl=document.getElementById("app");if(appEl){new MutationObserver(()=>{clearTimeout(t);t=setTimeout(run,150)}).observe(appEl,{childList:true});}'
    assert old_obs in content, "nav-effects.js: old_obs not found"
    content = content.replace(old_obs, new_obs)

    # 2. Cache getBoundingClientRect on pointermove spotlight
    old_spot = '''if(fine&&!still){
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
}'''
    new_spot = '''if(fine&&!still){
  let raf=0,ev=null,lastC=null,r=null;
  const SEL=".card,.step,.blog-card,.resource-card,.perk-card,.editorial-card,.about-feature,.community-card,.project-card,.event-format-card,.event-card,.feature-event,.advisor-card,.path-card,.reference-card,.info-card,.project-tile,.stat-card,.faq-item,.join-card,.contact-card,.pk-card";
  addEventListener("pointermove",e=>{
    ev=e;if(raf)return;
    raf=requestAnimationFrame(()=>{
      raf=0;const c=ev.target.closest&&ev.target.closest(SEL);
      if(!c){lastC=null;r=null;return;}
      if(c!==lastC){lastC=c;r=c.getBoundingClientRect();}
      c.style.setProperty("--mx",(ev.clientX-r.left)+"px");c.style.setProperty("--my",(ev.clientY-r.top)+"px");
    });
  },{passive:true});
}'''
    assert old_spot in content, "nav-effects.js: old_spot not found"
    content = content.replace(old_spot, new_spot)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated nav-effects.js in', base_dir)

def update_aurora(base_dir):
    path = os.path.join(base_dir, 'assets', 'js', 'aurora.js')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Throttle getBoundingClientRect on mouse parallax
    old_para = '''      /* mouse parallax */
      if (!fine || still) return;
      var raf = 0, tx = 0, ty = 0;
      pk.addEventListener("pointermove", function (e) {
        var r = g.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(function () {
          raf = 0;
          g.style.setProperty("--px", tx.toFixed(3));
          g.style.setProperty("--py", ty.toFixed(3));
        });
      }, { passive: true });
      pk.addEventListener("pointerleave", function () {
        g.style.setProperty("--px", 0); g.style.setProperty("--py", 0);
      });'''

    new_para = '''      /* mouse parallax (cached rect) */
      if (!fine || still) return;
      var raf = 0, tx = 0, ty = 0, rect = null;
      pk.addEventListener("pointerenter", function () { rect = g.getBoundingClientRect(); }, { passive: true });
      pk.addEventListener("pointermove", function (e) {
        if (!rect) rect = g.getBoundingClientRect();
        tx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        ty = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(function () {
          raf = 0;
          g.style.setProperty("--px", tx.toFixed(3));
          g.style.setProperty("--py", ty.toFixed(3));
        });
      }, { passive: true });
      pk.addEventListener("pointerleave", function () {
        rect = null;
        g.style.setProperty("--px", 0); g.style.setProperty("--py", 0);
      });'''
    assert old_para in content, "aurora.js: old_para not found"
    content = content.replace(old_para, new_para)

    # 2. Limit MutationObserver to #app childList
    old_obs = '''  var t = 0;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 120); })
    .observe(document.getElementById("app") || document.body, { childList: true, subtree: true });'''
    new_obs = '''  var t = 0;
  var appEl = document.getElementById("app");
  if (appEl) {
    new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 150); })
      .observe(appEl, { childList: true });
  }'''
    assert old_obs in content, "aurora.js: old_obs not found"
    content = content.replace(old_obs, new_obs)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated aurora.js in', base_dir)

def update_campus_tilt(base_dir):
    path = os.path.join(base_dir, 'assets', 'js', 'campus-tilt.js')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_code = '''  document.addEventListener("pointermove",e=>{
    const stage=e.target.closest&&e.target.closest(".pk-stage");
    const bld=stage&&stage.querySelector(".pk-bld");
    if(cur&&cur!==bld)reset(cur);
    cur=bld||null;
    if(!bld)return;
    const r=bld.getBoundingClientRect();
    const x=((e.clientX-r.left)/r.width)*2-1, y=((e.clientY-r.top)/r.height)*2-1;
    bld.style.setProperty("--rx",x.toFixed(3));
    bld.style.setProperty("--ry",y.toFixed(3));
  },{passive:true});'''

    new_code = '''  let r=null, raf=0, lastE=null;
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
  },{passive:true});'''
    assert old_code in content, "campus-tilt.js: old_code not found"
    content = content.replace(old_code, new_code)
    content = content.replace('document.addEventListener("pointerleave",()=>reset(cur),true);', 'document.addEventListener("pointerleave",()=>clearState(cur),true);')
    content = content.replace('document.addEventListener("mouseleave",()=>reset(cur));', 'document.addEventListener("mouseleave",()=>clearState(cur));')

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated campus-tilt.js in', base_dir)

def update_sw(base_dir):
    path = os.path.join(base_dir, 'sw.js')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Bump cache name and defer heavy certificate vendor libraries
    content = content.replace("const CACHE_NAME = 'gdg-sru-v16';", "const CACHE_NAME = 'gdg-sru-v17';")
    
    old_vendors = """  '/assets/vendor/html2canvas.min.js',
  '/assets/vendor/jspdf.umd.min.js',
  '/assets/js/vendor/supabase.js',
  '/assets/vendor/html-to-image.min.js',
  '/assets/vendor/jszip.min.js'"""

    new_vendors = """  '/assets/js/vendor/supabase.js'"""

    if old_vendors in content:
        content = content.replace(old_vendors, new_vendors)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated sw.js in', base_dir)

def update_headers(base_dir):
    path = os.path.join(base_dir, '_headers')
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    old_cache = """/assets/css/*
  Cache-Control: public, max-age=0, must-revalidate
/assets/js/*
  Cache-Control: public, max-age=0, must-revalidate"""

    new_cache = """/assets/css/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400
/assets/js/*
  Cache-Control: public, max-age=3600, stale-while-revalidate=86400"""

    assert old_cache in content, "_headers: old_cache not found"
    content = content.replace(old_cache, new_cache)

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)
    print('Updated _headers in', base_dir)

for d in ['cloudflare-pages-site', 'deployment/website']:
    update_effects(d)
    update_nav_effects(d)
    update_aurora(d)
    update_campus_tilt(d)
    update_sw(d)
    update_headers(d)

print('All optimizations applied successfully!')
