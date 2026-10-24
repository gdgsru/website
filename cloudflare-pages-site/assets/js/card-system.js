/* GDG SRU · card system v16
   Markup builders for the four card families (tracks, tickets, blog covers, perk stages)
   plus the shared pointer, countdown and reveal behaviour. Loaded before site-app.js so the
   page templates can call window.GDG16.* while they render. */
(function(){
  if(window.GDG16)return;
  var fine=matchMedia("(hover:hover) and (pointer:fine)").matches;
  var still=matchMedia("(prefers-reduced-motion:reduce)").matches;
  var $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var esc=function(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]})};
  var COL={b:"#4285f4",r:"#ea4335",y:"#fbbc04",g:"#34a853"},KEYS=["b","r","y","g"];
  var uid=0;

  // Inject live event styles and mobile bento grid styles
  if (!document.getElementById("g16-live-css")) {
    var st = document.createElement("style");
    st.id = "g16-live-css";
    st.textContent = ".g16-tk-badge.live{background:#ea4335!important;color:#fff!important;display:inline-flex;align-items:center;gap:5px;font-weight:700}.g16-live-dot{width:6px;height:6px;border-radius:50%;background:#fff;display:inline-block;animation:g16LivePulse 1.4s ease-in-out infinite}@keyframes g16LivePulse{0%,100%{transform:scale(0.85);opacity:1}50%{transform:scale(1.35);opacity:0.4}}.g16-tk-btn.g16-tk-live{background:#ea4335!important;color:#fff!important;border-color:#ea4335!important;animation:g16BtnPulse 2.5s infinite}@keyframes g16BtnPulse{0%,100%{box-shadow:0 0 0 0 rgba(234,67,53,0.4)}50%{box-shadow:0 0 0 6px rgba(234,67,53,0)}}.g16-tk-live-bar{display:flex;align-items:center;gap:8px;margin-top:6px;font-size:12px;font-weight:600;color:#ea4335}.g16-tk-live-bar small{font:700 9.5px/1 var(--f-mono,monospace);text-transform:uppercase;color:var(--mut)}@media(max-width:680px){.g16-row,.event-format-grid,.event-format-grid.g16-row,.grid.g16-row,#home-tracks .g16-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;justify-items:stretch!important;align-items:stretch!important;width:100%!important;max-width:100%!important;margin-top:14px!important}.g16-row.g16-tickets,[data-runtime-events],.editorial-grid.g16-row.g16-tickets,.editorial-grid.g16-row[data-runtime-events]{display:grid!important;grid-template-columns:1fr!important;gap:14px!important;width:100%!important}.g16-tl,.g16-tl.g16-tl-info,.grid>.g16-tl,.g16-row>.g16-tl{width:100%!important;max-width:100%!important;min-width:0!important;margin:0!important;display:flex!important}.g16-tl-card,.g16-tl-info .g16-tl-card,.g16-tl-info.g16-long .g16-tl-card,.g16-pkcard .g16-tl-card{min-height:135px!important;height:100%!important;border-radius:18px!important;padding:12px!important;overflow:hidden!important;box-shadow:0 4px 14px rgba(17,27,46,0.08)!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;position:relative!important}.g16-tl-glass{position:relative!important;inset:auto!important;height:100%!important;display:flex!important;flex-direction:column!important;justify-content:space-between!important;pointer-events:auto!important;min-width:0!important}.g16-tl-bottom{position:static!important;inset:auto!important;order:-1!important;margin-bottom:8px!important;display:flex!important;justify-content:flex-start!important;align-items:center!important;gap:6px!important}.g16-tl .g16-tl-acts,.g16-tl:not(.g16-tl-info) .g16-tl-more{display:none!important}.g16-tl-num{display:inline-flex!important;align-items:center!important;justify-content:center!important;min-width:24px!important;height:20px!important;font-size:9.5px!important;font-weight:800!important;padding:0 6px!important;border-radius:99px!important;box-shadow:none!important;line-height:20px!important;background:rgba(255,255,255,0.85)!important;color:#1f1f23!important}:root[data-theme=\"dark\"] .g16-tl-num{background:rgba(255,255,255,0.15)!important;color:#ffffff!important}.g16-tl-content{position:static!important;inset:auto!important;display:flex!important;flex-direction:column!important;min-width:0!important}.g16-tl-title{font-size:14.5px!important;line-height:1.2!important;font-weight:800!important;letter-spacing:-0.02em!important;color:#111b2e!important;word-break:break-word!important}:root[data-theme=\"dark\"] .g16-tl-title{color:#ffffff!important}.g16-tl-text{font-size:10.5px!important;line-height:1.35!important;margin-top:4px!important;color:#5f6368!important;display:-webkit-box!important;-webkit-line-clamp:2!important;-webkit-box-orient:vertical!important;overflow:hidden!important}:root[data-theme=\"dark\"] .g16-tl-text{color:rgba(255,255,255,0.68)!important}.g16-tl-logo{position:absolute!important;top:10px!important;right:10px!important;width:28px!important;height:28px!important;margin:0!important;transform:none!important}.g16-tl-c1,.g16-tl-c2,.g16-tl-c3,.g16-tl-c4{display:none!important}.g16-tl-c5{position:relative!important;inset:auto!important;width:28px!important;height:28px!important;margin:0!important;display:grid!important;place-content:center!important;border-radius:50%!important;box-shadow:0 0 10px color-mix(in srgb,var(--a) 60%,transparent)!important}.g16-tl-c5 svg{width:14px!important;height:14px!important}.g16-tl-more{font-size:10px!important;padding:3px 8px!important;margin-left:auto!important;border-radius:99px!important}.g16-row>.g16-tl:nth-child(3):last-child{grid-column:1/-1!important}.g16-tk,.g16-pgm-card{grid-column:1/-1!important;width:100%!important;max-width:100%!important;display:block!important;margin:0!important}.g16-tk-card{display:grid!important;grid-template-columns:minmax(0,1fr) 100px!important;border-radius:18px!important;min-height:145px!important;width:100%!important;overflow:hidden!important;box-shadow:0 4px 16px rgba(17,27,46,0.08)!important}.g16-tk-main{padding:13px 10px 13px 14px!important;gap:4px!important;min-width:0!important;border-radius:18px 0 0 18px!important}.g16-tk-main h3{font-size:16px!important;line-height:1.2!important;letter-spacing:-0.02em!important;white-space:normal!important;margin:2px 0!important}.g16-tk-main p{font-size:11px!important;line-height:1.3!important}.g16-tk-meta{margin-bottom:2px!important;gap:6px!important}.g16-tk-kind{font-size:9.5px!important;padding:2px 7px!important}.g16-tk-speaker{margin:2px 0!important;font-size:11px!important}.g16-tk-speaker small{font-size:8px!important}.g16-tk-live-bar{margin-top:2px!important;gap:5px!important}.g16-tk-live-bar small{font-size:8px!important}.g16-tk-cd{gap:2.5px!important}.g16-tk-cd span{padding:2px 4px!important;font-size:7.5px!important;border-radius:4px!important;max-width:none!important}.g16-tk-cd b{font-size:11.5px!important;line-height:1!important}.g16-tk-img{max-height:40px!important;width:auto!important;border-radius:6px!important}.g16-tk-stub{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;padding:10px 4px!important;border-radius:0 18px 18px 0!important;text-align:center!important}.g16-tk-d{font-size:30px!important;line-height:0.92!important}.g16-tk-m{font-size:10.5px!important;letter-spacing:0.1em!important}.g16-tk-btn{padding:5px 9px!important;font-size:10.5px!important;white-space:nowrap!important;margin-top:3px!important}.g16-tk-no{font-size:8.5px!important}}@media(min-width:681px){.g16-tl:not(.g16-tl-info) .g16-tl-num{display:none!important}}";
    document.head.appendChild(st);
  }

  /* ---------- icons (24px line icons / filled glyphs) ---------- */
  var SV=function(p){return '<svg viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>'};
  var CLOUD='<path d="M7 18a4.5 4.5 0 0 1-.5-9A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z"/>',
      SPARK='<path d="M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10z"/>',
      PHONE='<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
      GIT='<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="8" r="2.5"/><path d="M6 8.5v7M18 10.5c0 4-6 3-11 6.5"/>',
      CAL='<path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/>',
      BOOK='<path d="M12 6c-2-1.5-4.5-2-8-2v13c3.5 0 6 .5 8 2 2-1.5 4.5-2 8-2V4c-3.5 0-6 .5-8 2zM12 6v13"/>',
      USERS='<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M17 9.5a2.5 2.5 0 1 0 0-5M17 14c2.5 0 4.5 1.9 4.5 4.5"/>',
      FLAME='<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3 0-6 1-8z"/>',
      BOLT='<path d="M13 2L4 14h6l-1 8 9-12h-6z"/>';
  var CODE='<path d="M9 8l-5 4 5 4M15 8l5 4-5 4M13.5 5l-3 14"/>',
      MIC='<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
      CHAT='<path d="M4 5h16v11H9l-5 4z"/>',
      LINK='<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
      MAIL='<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
      STAR='<path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.7 6.7 19.6l1.1-6L3.4 9.4l6-.8z"/>',
      CHECK='<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>';
  var ICONS={cloud:CLOUD,spark:SPARK,phone:PHONE,git:GIT,cal:CAL,book:BOOK,users:USERS,flame:FLAME,bolt:BOLT,code:CODE,mic:MIC,chat:CHAT,link:LINK,mail:MAIL,star:STAR,check:CHECK};
  var ARR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var TRACK_ICON={b:CLOUD,r:SPARK,y:PHONE,g:GIT};

  /* ---------- 1. TRACK cards ---------- */
  var ACT=[["Events","/events/",CAL],["Resources","/resources/",BOOK],["Join","/join/",USERS]];
  function track(k,title,text,idx){
    k=COL[k]?k:"b";
    return '<div class="g16-tl g16-tl-'+k+'"><div class="g16-tl-card"><div class="g16-tl-glass">'+
      '<div class="g16-tl-content"><span class="g16-tl-title">'+esc(title)+'</span><span class="g16-tl-text">'+esc(text)+'</span></div>'+
      '<div class="g16-tl-bottom"><span class="g16-tl-num">0'+((idx||0)+1)+'</span><div class="g16-tl-acts">'+ACT.map(function(a){return '<a class="g16-tl-act" href="'+a[1]+'" aria-label="'+a[0]+'">'+SV(a[2])+'</a>'}).join("")+'</div>'+
      '<a class="g16-tl-more" href="/join/">Explore '+ARR+'</a></div></div>'+
      '<div class="g16-tl-logo" aria-hidden="true"><span class="g16-tl-c g16-tl-c1"></span><span class="g16-tl-c g16-tl-c2"></span><span class="g16-tl-c g16-tl-c3"></span><span class="g16-tl-c g16-tl-c4"></span><span class="g16-tl-c g16-tl-c5">'+SV(TRACK_ICON[k])+'</span></div></div></div>';
  }
  /* info card: same glass-and-orb card without the track shortcuts.
   o: {key,title,text,icon,num,actions:[{label,href,ext,cls}]} */
function info(o){
    var k=COL[o.key]?o.key:"b",ic=ICONS[o.icon]||ICONS.spark;
    var acts=(o.actions||[]).map(function(a){return '<a class="g16-tl-more '+esc(a.cls||"")+'" href="'+esc(a.href)+'"'+(a.ext?' target="_blank" rel="noopener noreferrer"':"")+'>'+esc(a.label)+' '+ARR+'</a>'}).join("");
    var num=o.num?'<span class="g16-tl-num">'+esc(o.num)+'</span>':"";
    var tag=o.el||"div",long=String(o.title||"").length>20?" g16-long":"";
    return '<'+tag+(o.el==="button"?' type="button"':"")+' class="g16-tl g16-tl-info g16-tl-'+k+long+(o.cls?" "+o.cls:"")+'" '+(o.attrs||"")+'><div class="g16-tl-card"><div class="g16-tl-glass">'+
      '<div class="g16-tl-content"><span class="g16-tl-title">'+esc(o.title)+'</span><span class="g16-tl-text">'+esc(o.text||"")+'</span></div>'+
      ((acts||num)?'<div class="g16-tl-bottom">'+num+acts+'</div>':"")+'</div>'+
      '<div class="g16-tl-logo" aria-hidden="true"><span class="g16-tl-c g16-tl-c1"></span><span class="g16-tl-c g16-tl-c2"></span><span class="g16-tl-c g16-tl-c3"></span><span class="g16-tl-c g16-tl-c4"></span><span class="g16-tl-c g16-tl-c5">'+SV(ic)+'</span></div></div></'+tag+'>';
  }
  function infoItems(list){return list.map(info).join("")}
  function trackRow(list){return '<div class="g16-row">'+list.map(function(t,i){return track(t[0],t[1],t[2],i)}).join("")+'</div>'}

  /* ---------- 2. EVENT tickets ---------- */
  var MON=["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  var CATCOL={"cloud":"b","ai/ml":"r","ai":"r","web & mobile":"y","web":"y","open source":"g"};
  function parts(iso,tz){
    var d=new Date(iso);if(isNaN(d))return null;
    try{
      var f=new Intl.DateTimeFormat("en-GB",{timeZone:tz||"Asia/Kolkata",day:"2-digit",month:"numeric",hour:"numeric",minute:"2-digit",hour12:true}).formatToParts(d),o={};
      f.forEach(function(p){o[p.type]=p.value});
      return{dd:o.day,mm:MON[(+o.month||1)-1],time:(o.hour||"")+":"+(o.minute||"00")+" "+String(o.dayPeriod||"").toLowerCase()};
    }catch(e){return{dd:("0"+d.getDate()).slice(-2),mm:MON[d.getMonth()],time:""}}
  }
  /* e: {title,slug,category,summary,start_at,end_at,timezone,venue,join_link,online_url,registration_url,rsvp_url,speakers,speaker,event_mode,event_tier,certificates_ready,resource_url,calendar_enabled,left,total} */
  function ticket(e,i){
    i=i||0;
    var cat=String(e.category||"Community"),ck=CATCOL[cat.toLowerCase()]||KEYS[i%4];
    var p=e.start_at?parts(e.start_at,e.timezone):null,t0=e.start_at?new Date(e.start_at).getTime():NaN;
    var endT=e.end_at?new Date(e.end_at).getTime():t0;
    var nowMs=Date.now();
    var past=!isNaN(endT)&&endT<nowMs;
    var isLiveNow=!isNaN(t0)&&!isNaN(endT)&&t0<=nowMs&&endT>=nowMs;
    var speakerName=e.speakers||e.speaker||"";
    var modeName=e.event_mode==='virtual'?'Online Session':(e.event_mode==='hybrid'?'Hybrid':'In-Person');
    var where=[p&&p.time,e.venue||(e.join_link||e.online_url?"Online":modeName)].filter(Boolean).join(", ")||"Details announced soon";
    var rsvpLink=e.rsvp_url||e.registration_url||"https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/";
    var isFallback=!e.rsvp_url&&!e.registration_url;
    var seat="";
    if(e.total&&e.left!=null)seat='<div class="g16-tk-seat">'+esc(e.left)+' of '+esc(e.total)+' seats left<i><b style="--p:'+(100-e.left/e.total*100).toFixed(0)+'%"></b></i></div>';

    var cd="";
    if(past){
      cd='<div class="g16-tk-over">Session completed</div>';
    }else if(isLiveNow){
      cd='<div class="g16-tk-live-bar"><small>Ends in</small><div class="g16-tk-cd" data-at="'+endT+'"></div></div>';
    }else if(isNaN(t0)){
      cd='<div class="g16-tk-over">Date announced soon</div>';
    }else{
      cd='<div class="g16-tk-cd" data-at="'+t0+'"></div>';
    }

    var img=(e.banner_url||e.image_url)?'<img class="g16-tk-img" src="'+esc(e.banner_url||e.image_url)+'" alt="" loading="lazy">':"";
    var no=e.no!=null?"No. "+("0000"+e.no).slice(-4):"GDG SRU"+(p?" \u00b7 "+new Date(e.start_at).getFullYear():"");

    var actionBtn="";
    if(past){
      if(e.certificates_ready){
        actionBtn='<a class="g16-tk-btn" href="/certificates/" style="background:#34a853;color:#fff">Claim Certificate ↗</a>';
      }else if(e.resource_url){
        actionBtn='<a class="g16-tk-btn" href="'+esc(e.resource_url)+'" target="_blank" rel="noopener noreferrer">Slides / Code ↗</a>';
      }else{
        actionBtn='<span class="g16-tk-btn g16-tk-off">Completed</span>';
      }
    }else if(isLiveNow){
      actionBtn='<a class="g16-tk-btn g16-tk-live" href="'+esc(rsvpLink)+'" target="_blank" rel="noopener noreferrer">Join Live ↗</a>';
    }else{
      if(isFallback){
        actionBtn='<a class="g16-tk-btn g16-tk-fallback" href="'+esc(rsvpLink)+'" target="_blank" rel="noopener noreferrer" title="Official RSVP link coming soon. View chapter landing page.">Chapter RSVP ↗</a>';
      }else{
        actionBtn='<a class="g16-tk-btn" href="'+esc(rsvpLink)+'" target="_blank" rel="noopener noreferrer" data-g16-reg>RSVP on GDG ↗</a>';
      }
    }

    var modeBadge=isLiveNow?'<span class="g16-tk-badge live"><span class="g16-live-dot"></span> LIVE NOW</span>':'<span class="g16-tk-badge '+esc(e.event_mode||'in_person')+'">'+esc(modeName)+'</span>';
    var speakerHTML=speakerName?'<div class="g16-tk-speaker"><small>Speaker</small><b>'+esc(speakerName)+'</b></div>':"";

    return '<article class="g16-tk" style="--a:'+COL[ck]+'"><div class="g16-tk-card"><div class="g16-tk-main">'+
      '<div class="g16-tk-meta"><span class="g16-tk-kind">'+esc(cat)+(past?" · Past":(isLiveNow?" · Live Now":""))+'</span>'+modeBadge+'</div>'+
      '<h3><a href="'+esc(rsvpLink)+'" target="_blank" rel="noopener noreferrer">'+esc(e.title)+'</a></h3><p>'+esc(where)+'</p>'+
      speakerHTML+
      (e.summary?'<p class="g16-tk-sum">'+esc(e.summary)+'</p>':"")+img+cd+seat+'</div>'+
      '<div class="g16-tk-stub"><span class="g16-tk-d">'+(p?esc(p.dd):"--")+'</span><span class="g16-tk-m">'+(p?p.mm:"TBA")+'</span>'+actionBtn+'<span class="g16-tk-no">'+esc(no)+'</span></div></div></article>';
  }

  /* Program card for Tier 2 month-long study jams & cohorts */
  function program(e,i){
    i=i||0;
    var cat=String(e.category||"Program"),ck=CATCOL[cat.toLowerCase()]||KEYS[(i+1)%4];
    var pStart=e.start_at?parts(e.start_at,e.timezone):null,pEnd=e.end_at?parts(e.end_at,e.timezone):null;
    var nowMs=Date.now();
    var past=e.end_at&&new Date(e.end_at).getTime()<nowMs;
    var isLiveNow=pStart&&pEnd&&new Date(e.start_at).getTime()<=nowMs&&new Date(e.end_at).getTime()>=nowMs;
    var dateRange=(pStart&&pEnd)?(pStart.dd+" "+pStart.mm+" — "+pEnd.dd+" "+pEnd.mm+(new Date(e.end_at).getFullYear()!==new Date(e.start_at).getFullYear()?" "+new Date(e.end_at).getFullYear():"")):(pStart?("Starts "+pStart.dd+" "+pStart.mm):"Cohort dates TBA");
    var rsvpLink=e.rsvp_url||e.registration_url||"https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/";
    var milestones=Array.isArray(e.program_milestones)?e.program_milestones:[];

    var timelineHTML=milestones.length?'<div class="g16-pgm-timeline"><h4>Weekly Milestones</h4><ol class="g16-pgm-steps">'+
      milestones.map(function(m,idx){return '<li><b>W'+(m.week||idx+1)+'</b><span>'+esc(m.title||m)+'</span></li>'}).join("")+'</ol></div>':"";

    var actionsHTML='<div class="g16-pgm-actions">'+
      (e.rsvp_url?'<a class="btn" href="'+esc(rsvpLink)+'" target="_blank" rel="noopener noreferrer">Enroll on GDG Portal ↗</a>':'<a class="btn o" href="'+esc(rsvpLink)+'" target="_blank" rel="noopener noreferrer">Chapter Page ↗</a>')+
      (e.discord_channel_url?'<a class="btn o" href="'+esc(e.discord_channel_url)+'" target="_blank" rel="noopener noreferrer">Join Discord Track ↗</a>':'')+
      (e.syllabus_url?'<a class="btn o" href="'+esc(e.syllabus_url)+'" target="_blank" rel="noopener noreferrer">View Syllabus ↗</a>':'')+
      '</div>';

    var statusBadge=past?'<span class="status s-archived">Cohort Finished</span>':(isLiveNow?'<span class="status s-published" style="background:#ea4335;color:#fff"><span class="g16-live-dot"></span> Live Cohort</span>':'<span class="status s-published">Active Program</span>');

    return '<article class="g16-pgm-card" style="--a:'+COL[ck]+'"><div class="g16-pgm-head"><span class="cap">'+esc(cat)+' · MONTH-LONG COHORT</span>'+
      statusBadge+'</div>'+
      '<h3>'+esc(e.title)+'</h3>'+
      '<p class="g16-pgm-dates">🗓 '+esc(dateRange)+' · Mentorship & Hands-on Projects</p>'+
      (e.summary?'<p class="g16-pgm-desc">'+esc(e.summary)+'</p>':"")+
      timelineHTML+actionsHTML+'</article>';
  }

  function ticketItems(list){return list.map(ticket).join("")}
  function programItems(list){return list.map(program).join("")}
  function tick(){
    if(document.hidden)return;
    var now=Date.now(),p=function(n){return("0"+n).slice(-2)};
    $$(".g16-tk-cd").forEach(function(el){
      var s=Math.max(0,((+el.dataset.at-now)/1000)|0);
      el.innerHTML='<span><b>'+((s/86400)|0)+'</b>days</span><span><b>'+p((s%86400/3600)|0)+'</b>hrs</span><span><b>'+p((s%3600/60)|0)+'</b>min</span><span><b>'+p(s%60)+'</b>sec</span>';
    });
  }

  /* ---------- 3. BLOG covers ---------- */
  var ART=[
    '<rect width="300" height="400" fill="#4285f4"/><circle class="g16-s1" cx="212" cy="124" r="72" fill="#fbbc04"/><path class="g16-s2" d="M0 90A96 96 0 0 1 96 186H0Z" fill="#ea4335"/><rect class="g16-s3" x="64" y="214" width="132" height="40" rx="20" fill="#fff"/><rect class="g16-s2" x="40" y="26" width="54" height="54" rx="14" fill="#34a853" transform="rotate(15 67 53)"/>',
    '<rect width="300" height="400" fill="#34a853"/><g class="g16-s1" fill="#fbbc04"><circle cx="206" cy="76" r="30"/><circle cx="236" cy="106" r="30"/><circle cx="206" cy="136" r="30"/><circle cx="176" cy="106" r="30"/><circle cx="206" cy="106" r="34"/></g><path class="g16-s2" d="M0 260A110 110 0 0 1 110 150V260Z" fill="#4285f4"/><rect class="g16-s3" x="96" y="212" width="124" height="34" rx="17" fill="#fff"/>',
    '<rect width="300" height="400" fill="#fbbc04"/><circle class="g16-s1" cx="100" cy="140" r="72" fill="#34a853"/><path class="g16-s2" d="M160 260a70 70 0 0 1 140 0Z" fill="#4285f4"/><rect class="g16-s3" x="150" y="44" width="122" height="38" rx="19" fill="#ea4335"/><circle class="g16-s3" cx="44" cy="46" r="11" fill="#111b2e"/>',
    '<rect width="300" height="400" fill="#ea4335"/><rect class="g16-s1" x="184" y="40" width="92" height="92" rx="26" fill="#4285f4"/><path class="g16-s2" d="M40 260L100 150L160 260Z" fill="#fbbc04" stroke="#fbbc04" stroke-width="10" stroke-linejoin="round"/><circle class="g16-s3" cx="70" cy="84" r="26" fill="none" stroke="#fff" stroke-width="10"/><circle class="g16-s3" cx="232" cy="228" r="16" fill="#34a853"/>'];
  var ARTKEY={b:0,g:1,y:2,r:3};
  /* b: {tag,title,text,author,meta,key,href,image,external} */
  function blog(b,i){
    var k=COL[b.key]?b.key:["b","g","y","r"][(i||0)%4],art=ARTKEY[k];
    var ext=b.external?' target="_blank" rel="noopener noreferrer"':"";
    var cover=b.image?'<img src="'+esc(b.image)+'" alt="" loading="lazy">':'<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">'+ART[art]+'</svg>';
    var who=b.author||"GDG SRU";
    return '<a class="g16-bp g16-bp-k-'+k+'" href="'+esc(b.href||"#")+'"'+ext+' style="--a:'+COL[k]+'"><i class="g16-bp-sh"></i>'+
      '<div class="g16-bp-art">'+cover+'</div><span class="g16-bp-tag">'+esc(b.tag||"Story")+'</span>'+
      '<div class="g16-bp-b"><h3>'+esc(b.title)+'</h3>'+(b.text?'<div class="g16-bp-x"><div><p>'+esc(b.text)+'</p></div></div>':"")+
      '<div class="g16-bp-m"><span class="g16-bp-who"><span class="g16-bp-av">'+esc(who.charAt(0).toUpperCase())+'</span><b>'+esc(who)+'</b></span><span>'+esc(b.meta||"Read story ↗")+'</span></div></div></a>';
  }
  function blogItems(list){return list.map(blog).join("")}

  /* ---------- 4. PERK / resource stages ---------- */
  var PICON=[CLOUD,SPARK,FLAME,BOLT],PCOL=["g16-pk-b","","g16-pk-r",""];
  /* r: {kind,title,text,tags[],chip,live,url,cta,steps[],image} */
  function perk(r,i){
    i=i||0;var n=uid++,g="g16g"+n,h="g16h"+n,c="g16c"+n,icon=PICON[i%PICON.length];
    var glyph=r.image
      ? '<clipPath id="'+c+'"><rect x="114" y="54" width="72" height="72" rx="18"/></clipPath><image href="'+esc(r.image)+'" x="114" y="54" width="72" height="72" preserveAspectRatio="xMidYMid slice" clip-path="url(#'+c+')"/><rect x="114" y="54" width="72" height="72" rx="18" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="1.5"/>'
      : '<g transform="translate(114 62) scale(3)"><g fill="url(#'+h+')" stroke="#fff" stroke-width=".5" stroke-linejoin="round">'+icon+'</g></g>';
    var steps=(r.steps&&r.steps.length?r.steps:["Open the resource with the button above.","Explore it at your own pace.","Share what you learn with the chapter."]);
    return '<article class="g16-pk '+PCOL[i%4]+'"><div class="g16-pk-stage"><svg class="g16-pk-svg" viewBox="0 0 300 216" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="'+g+'" x1="0" y1="0" x2="0" y2="1"><stop class="g16-s0" offset="0"/><stop class="g16-umb" offset="1"/></linearGradient><linearGradient id="'+h+'" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop class="g16-sa" offset="1"/></linearGradient></defs>'+
      '<path d="M150 0v10" stroke="#6a6b70" stroke-width="2"/><g class="g16-pk-beam"><rect x="124" y="10" width="52" height="18" rx="9" fill="#6a6b70"/><rect x="136" y="26" width="28" height="7" rx="3.5" class="g16-fa"/><path d="M138 33h24l80 160H58z" fill="url(#'+g+')"/><path d="M146 33h8l34 160h-76z" fill="#fff" opacity=".07"/></g>'+
      '<ellipse cx="150" cy="196" rx="92" ry="10" class="g16-fa" opacity=".4"/><ellipse cx="150" cy="196" rx="52" ry="5" fill="#fff" opacity=".35"/>'+
      '<g class="g16-pt"><circle cx="92" cy="100" r="2" class="g16-fa"/><circle cx="214" cy="88" r="2.4" fill="#fff" opacity=".8"/><circle cx="84" cy="146" r="1.8" fill="#fff" opacity=".6"/><circle cx="220" cy="140" r="2" class="g16-fa"/><circle cx="150" cy="168" r="1.6" fill="#fff" opacity=".7"/><circle cx="118" cy="58" r="1.6" fill="#fff" opacity=".6"/></g>'+
      '<g class="g16-pk-par"><g class="g16-bn">'+glyph+'</g><rect class="g16-bn2 g16-fa" x="218" y="118" width="14" height="14" rx="3" transform="rotate(45 225 125)"/></g></svg>'+
      '<span class="g16-pk-chip">'+esc(r.chip||"Free for members")+'</span>'+(r.live?'<span class="g16-pk-live"><i></i>'+esc(r.live)+'</span>':"")+'</div>'+
      '<div class="g16-pk-in"><span class="g16-pk-kind">'+esc(r.kind||"Resource")+'</span><h3>'+esc(r.title)+'</h3><p>'+esc(r.text||"Explore this resource.")+'</p>'+
      ((r.tags&&r.tags.length)?'<div class="g16-pk-tags">'+r.tags.filter(Boolean).map(function(t){return '<span>'+esc(t)+'</span>'}).join("")+'</div>':"")+
      '<div class="g16-pk-act">'+(r.url?'<a class="g16-pk-go" href="'+esc(r.url)+'" target="_blank" rel="noopener noreferrer">'+esc(r.cta||"Open resource")+' ↗</a>':'<span class="g16-pk-go g16-pk-off">Link coming soon</span>')+
      '<button class="g16-pk-tg" type="button" aria-expanded="false">Details <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg></button></div>'+
      '<div class="g16-pk-more"><div><ol>'+steps.map(function(s,j){return '<li><b>'+(j+1)+'</b><span>'+esc(s)+'</span></li>'}).join("")+'</ol></div></div>'+
      (r.note?'<span class="g16-pk-note">'+esc(r.note)+'</span>':"")+'</div></article>';
  }
  function perkItems(list){return list.map(perk).join("")}

  /* ---------- shared behaviour ---------- */
  function confetti(stage){
    var cols=["#4285f4","#ea4335","#fbbc04","#34a853"];
    for(var i=0;i<18;i++){
      var s=document.createElement("i"),a=Math.random()*Math.PI*2,d=70+Math.random()*80;
      s.className="g16-cf";
      s.style.cssText="background:"+cols[i%4]+";--dx:"+((Math.cos(a)*d)|0)+"px;--dy:"+((Math.sin(a)*d-20)|0)+"px;--rot:"+((Math.random()*540)|0)+"deg";
      stage.appendChild(s);setTimeout(function(x){x.remove()},1000,s);
    }
  }
  document.addEventListener("click",function(e){
    var t=e.target.closest&&e.target.closest(".g16-pk-tg");
    if(t){
      var c=t.closest(".g16-pk"),o=c.classList.toggle("open");t.setAttribute("aria-expanded",o);
      if(o&&!still)confetti(c.querySelector(".g16-pk-stage"));return;
    }
    var b=e.target.closest&&e.target.closest("[data-g16-reg]");
    if(b){var tk=b.closest(".g16-tk");tk.classList.add("torn");setTimeout(function(){tk.classList.remove("torn")},3600)}
  });

  /* pointer: card-local custom properties, one rAF per frame */
  if(fine){
    var raf=0,ev=null,cur={};
    var reset=function(el,names){names.forEach(function(n){el.style.removeProperty(n)})};
    var frame=function(){
      raf=0;var e=ev;if(!e)return;
      $$(".g16-tl-card,.g16-pk").forEach(function(el){
        var r=el.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
        if(x<-300||y<-300||x>r.width+300||y>r.height+300){if(el.dataset.gl){el.dataset.gl="";reset(el,["--gx","--gy"])}return}
        el.dataset.gl="1";el.style.setProperty("--gx",x+"px");el.style.setProperty("--gy",y+"px");
        if(el.classList.contains("g16-tl-card")){
          el.style.setProperty("--ox",Math.max(-1,Math.min(1,x/r.width*2-1)).toFixed(2));
          el.style.setProperty("--oy",Math.max(-1,Math.min(1,y/r.height*2-1)).toFixed(2));
        }
      });
      var t=e.target.closest&&e.target.closest(".g16-tk,.g16-bp,.g16-pk");
      ["tk","bp","pk"].forEach(function(k){
        var p=cur[k];if(p&&p!==t){p.style.setProperty("--px","0");p.style.setProperty("--py","0");reset(p,["--rx","--ry"]);cur[k]=null}
      });
      if(!t)return;
      var r2=t.getBoundingClientRect(),x2=(e.clientX-r2.left)/r2.width-.5,y2=(e.clientY-r2.top)/r2.height-.5;
      if(t.classList.contains("g16-tk")){
        cur.tk=t;t.style.setProperty("--ry",(x2*14).toFixed(1)+"deg");t.style.setProperty("--rx",(-y2*10).toFixed(1)+"deg");t.style.setProperty("--sx",(100-(x2+.5)*100).toFixed(0)+"%");
      }else if(t.classList.contains("g16-bp")){
        cur.bp=t;t.style.setProperty("--px",(x2*2).toFixed(2));t.style.setProperty("--py",(y2*2).toFixed(2));
      }else{
        var st=t.querySelector(".g16-pk-stage"),sr=st.getBoundingClientRect();
        if(e.clientY>=sr.top&&e.clientY<=sr.bottom){cur.pk=t;t.style.setProperty("--px",((e.clientX-sr.left)/sr.width*2-1).toFixed(2));t.style.setProperty("--py",((e.clientY-sr.top)/sr.height*2-1).toFixed(2))}
        else{t.style.setProperty("--px","0");t.style.setProperty("--py","0")}
      }
    };
    addEventListener("pointermove",function(e){ev=e;if(!raf)raf=requestAnimationFrame(frame)},{passive:true});
  }

  /* reveal on scroll, for cards that are injected late as well */
  var io=null;
  if("IntersectionObserver" in window&&!still){
    io=new IntersectionObserver(function(es){es.forEach(function(x){if(x.isIntersecting){x.target.classList.add("in");io.unobserve(x.target)}})},{threshold:.12});
  }
  var SEL=".g16-tl,.g16-tk,.g16-bp,.g16-pk";
  function scan(){
    var n=0;
    $$(SEL).forEach(function(el){
      if(el.dataset.g16)return;el.dataset.g16="1";
      if(!io){return}
      el.classList.add("g16-rv");el.style.setProperty("--i",n++%4);io.observe(el);
    });
    if(document.querySelector(".g16-tk-cd"))tick();
  }
  var mo=0;
  function boot(){
    scan();
    var root=document.getElementById("app")||document.querySelector("main")||document.body;
    new MutationObserver(function(){clearTimeout(mo);mo=setTimeout(scan,60)}).observe(root,{childList:true,subtree:true});
    setInterval(tick,1000);document.addEventListener("visibilitychange",tick);
    /* safety net: never leave a card hidden if the observer never fires */
    setTimeout(function(){$$(".g16-rv:not(.in)").forEach(function(el){el.classList.add("in")})},4000);
  }
  if(document.body)boot();else document.addEventListener("DOMContentLoaded",boot);

  window.GDG16={info:info,infoItems:infoItems,track:track,trackRow:trackRow,ticket:ticket,ticketItems:ticketItems,program:program,programItems:programItems,blog:blog,blogItems:blogItems,perk:perk,perkItems:perkItems,esc:esc};
})();