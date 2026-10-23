/**
 * GDG SRU Leaderboard Engine
 * 3D Perspective Podium, Track Lanes, Accordion Details, Pinned Me-Bar, Canvas Share Card
 * Classes preserved for build-css tree-shaker: s1 s2 s3 pod-step lb-empty lb-empty-flag lb-empty-flag-dots lb-empty-lead lb-empty-grid lb-empty-card lb-empty-badge lb-empty-cta roster-section roster-head roster-leagues roster-list roster-row roster-rk roster-av roster-main roster-name roster-chip dia gold silv bronze roster-pts roster-acts roster-btn roster-expand roster-toggle-btn
 */
(function(){
'use strict';

const esc = v => String(v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const COL = ["#4285f4", "#ea4335", "#f9ab00", "#34a853"];
const PODC = ["#f9ab00", "#4285f4", "#ea4335"];
const colOf = n => COL[[...String(n)].reduce((a,c) => a + c.charCodeAt(0), 0) % 4];
const ini = n => String(n).trim().split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();
const fmt = n => Number(n).toLocaleString("en-IN");
const first = n => String(n).trim().split(/\s+/)[0];
const reduce = matchMedia("(prefers-reduced-motion:reduce)").matches;
const TRACK_LIMIT = 10;

function leagueOf(pts) {
  if (pts >= 150) return { name: "Diamond", icon: "💎", cls: "dia" };
  if (pts >= 75) return { name: "Gold", icon: "🥇", cls: "gold" };
  if (pts >= 30) return { name: "Silver", icon: "🥈", cls: "silv" };
  return { name: "Bronze", icon: "🥉", cls: "bronze" };
}

/* ------------------------------------------------------------------
   DATA  ·  Live periods from Supabase (empty shell until events occur)
------------------------------------------------------------------ */
let PERIODS = [
  {
    id: "season-2026",
    title: "Season 2026",
    rows: []
  }
];
let curPeriodId = "season-2026";

/* ---------- helpers ---------- */
function tags(r, i, rows){
  const t = [], n = rows.length;
  if(i === 0) t.push("Leading the pack");
  else if(i < 3) t.push("On the podium");
  else if(rows[2] && rows[2].points - r.points <= 15) t.push(`${fmt(rows[2].points - r.points + 1)} pts from the podium`);
  else if(i <= Math.max(2, Math.ceil(n * 0.1))) t.push("Top 10%");
  if(i > 0 && rows[i - 1].points === r.points) t.push(`Tied with ${first(rows[i - 1].student_name)}`);
  return t;
}

function gapNote(rows, i){
  if(i === 0) return rows.length > 1 ? `${fmt(rows[0].points - rows[1].points)} pts clear of ${first(rows[1].student_name)}` : "";
  const d = rows[i - 1].points - rows[i].points;
  return d === 0 ? `Neck and neck with ${first(rows[i - 1].student_name)}` : `${fmt(d)} behind ${first(rows[i - 1].student_name)}`;
}

const mvOf = r => {
  if(r.prev_rank == null) return "";
  const d = r.prev_rank - r.rank;
  return d > 0 ? `<span class="mv u">▲${d}</span>` : d < 0 ? `<span class="mv d">▼${-d}</span>` : `<span class="mv z">–</span>`;
};

const ways = need => [
  [5, "workshops"],
  [10, "major events"],
  [20, "large task"]
].map(([v, t]) => `<span><b>${Math.ceil(need / v)}×</b> ${t}</span>`).join("");

function details(r, i, rows, lead, c){
  const pct = Math.round(r.points / lead * 100);
  const top = Math.max(1, Math.ceil((i + 1) / rows.length * 100));
  const next = rows[i + 1];
  const chase = i === 0
    ? `<h4>Defend the lead</h4><p>${rows.length > 1 ? fmt(rows[0].points - rows[1].points) + " pts ahead of " + esc(first(rows[1].student_name)) : "No one's close yet"}</p><div class="ways">${rows.length > 1 ? ways(Math.max(1, rows[0].points - rows[1].points)) : ""}</div>`
    : `<h4>To pass ${esc(first(rows[i - 1].student_name))}</h4><p>${fmt(rows[i - 1].points - r.points + 1)} pts</p><div class="ways">${ways(rows[i - 1].points - r.points + 1)}</div>`;
  const back = next
    ? `<h4>Cushion over ${esc(first(next.student_name))}</h4><p>${fmt(r.points - next.points)} pts</p>`
    : `<h4>Last place, for now</h4><p>Every point counts.</p>`;
  const extra = [
    r.streak ? `<span class="chip hot">🔥 ${r.streak}-week streak</span>` : "",
    r.note ? `<span class="chip">${esc(r.note)}</span>` : ""
  ].filter(Boolean).join(" ");

  return `<div class="more"><div><div class="mi" style="--c:${c}">
    <div><h4>Progress to #1</h4><p>${pct}% of the leader's points</p><div class="bar" style="--w:${pct}%"><i></i></div></div>
    <div>${chase}</div>
    <div>${back}<p style="margin-top:8px;font-weight:500;color:var(--mut);font-size:13.5px">Top ${top}% of ${rows.length}</p>${extra ? `<div class="ways" style="margin-top:6px">${extra}</div>` : ""}</div>
    <div class="acts"><button type="button" class="btn pri" data-act="me">This is me</button><button type="button" class="btn" data-act="share">Share card</button></div>
  </div></div></div>`;
}

function board(rows){
  const lead = Math.max(rows[0].points, 1);
  const w = r => (r.points / lead * 92).toFixed(1);
  const STEP_CLASSES = ["s1", "s2", "s3"]; // Static strings for build-css preservation: pod-step s1 s2 s3

  const pod = rows.slice(0, 3).map((r, i) => {
    const c = PODC[i];
    const sCls = STEP_CLASSES[i] || ("s" + (i + 1));
    return `<div class="pod-step ${sCls}" style="--c:${c};--cg:${c}66">
    <div class="who"><div class="av">${i === 0 ? '<svg class="crown" viewBox="0 0 40 28"><path d="M3 24 1 6l10 8L20 2l9 12 10-8-2 18z" fill="#f9ab00" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>' : ""}${esc(ini(r.student_name))}</div>
    <b>${esc(r.student_name)}</b><div class="pp"><strong data-n="${r.points}">${fmt(r.points)}</strong> pts</div>${r.streak ? `<span class="tag">🔥 ${r.streak}-week streak</span>` : ""}</div>
    <div class="block"><i>${r.rank}</i></div></div>`;
  }).join("");

  const trackRows = rows.slice(0, TRACK_LIMIT);
  const lanes = trackRows.map((r, i) => {
    const c = colOf(r.student_name);
    const tg = tags(r, i, rows);
    return `<div class="row${i === 0 ? " lead" : ""}${i < 3 ? " p" : ""}" data-i="${i}" data-name="${esc(r.student_name.toLowerCase())}" style="--c:${c};--cg:${c}55">
    <div class="card" tabindex="0" role="button" aria-expanded="false">
      <div class="top"><div class="rk">${r.rank}${mvOf(r)}</div><div class="mini">${esc(ini(r.student_name))}</div>
        <div class="nm"><b>${esc(r.student_name)}${tg.map(t => `<span class="chip">${esc(t)}</span>`).join("")}${r.streak >= 3 ? `<span class="chip hot">🔥 ${r.streak}w</span>` : ""}</b><small>${esc(gapNote(rows, i))}</small></div>
        <div class="pts">${fmt(r.points)}<small>points</small></div></div>
      <div class="track"><div class="trail" data-w="${w(r)}"></div><div class="orb" data-w="${w(r)}">${esc(ini(r.student_name))}</div><div class="flag"></div></div>
      ${details(r, i, rows, lead, c)}
    </div></div>`;
  }).join("");

  let rosterHtml = "";
  const rosterRows = rows.slice(TRACK_LIMIT);
  if(rosterRows.length > 0){
    const INITIAL_VISIBLE = 15;
    const rosterItems = rosterRows.map((r, index) => {
      const absIdx = TRACK_LIMIT + index;
      const c = colOf(r.student_name);
      const lg = leagueOf(r.points);
      const hiddenStyle = index >= INITIAL_VISIBLE ? ' style="display:none"' : '';
      return `<div class="roster-row" data-i="${absIdx}" data-name="${esc(r.student_name.toLowerCase())}" data-roster-item="${index}" style="--c:${c};--cg:${c}55"${hiddenStyle}>
        <div class="roster-rk">#${r.rank}</div>
        <div class="roster-av" style="--c:${c}">${esc(ini(r.student_name))}</div>
        <div class="roster-main">
          <span class="roster-name">${esc(r.student_name)}</span>
          <span class="roster-chip ${lg.cls}">${lg.icon} ${lg.name}</span>
        </div>
        <div class="roster-pts">${fmt(r.points)}<small>points</small></div>
        <div class="roster-acts">
          <button type="button" class="roster-btn" data-act="me">This is me</button>
          <button type="button" class="roster-btn" data-act="share">Share</button>
        </div>
      </div>`;
    }).join("");

    const expandBtn = rosterRows.length > INITIAL_VISIBLE
      ? `<div class="roster-expand"><button type="button" class="roster-toggle-btn" data-roster-toggle="1">Show all ${rosterRows.length} chapter builders ↓</button></div>`
      : "";

    rosterHtml = `<section class="roster-section">
      <div class="roster-head">
        <div>
          <h3>All Chapter Builders</h3>
          <p>Every student who has earned points this season.</p>
        </div>
        <div class="roster-leagues">
          <span>💎 Diamond (150+)</span>
          <span>🥇 Gold (75+)</span>
          <span>🥈 Silver (30+)</span>
          <span>🥉 Bronze (5+)</span>
        </div>
      </div>
      <div class="roster-list">${rosterItems}</div>
      ${expandBtn}
    </section>`;
  }

  return `<div class="stage"><div class="podium">${pod}</div></div>
   <div class="rh"><div><h2>${rows.length > TRACK_LIMIT ? "Fast lanes · Top 10" : "Everyone on the track"}</h2><p>Tap a lane to see how far they are from the next spot.</p></div><button class="rc" type="button">↻ Replay</button></div>
   <div class="lanes">${lanes}</div>
   ${rosterHtml}`;
}

/* ---------- behaviour ---------- */
function countUp(el, to, ms = 1100){
  if(reduce){ el.textContent = fmt(to); return; }
  const t0 = performance.now();
  (function f(t){
    const k = Math.min(1, (t - t0) / ms);
    el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if(k < 1) requestAnimationFrame(f);
  })(t0);
}

function run(root){
  const bits = [...root.querySelectorAll(".trail,.orb")];
  const set = (e, v) => {
    if(e.classList.contains("trail")) e.style.width = v + "%";
    else e.style.left = v + "%";
  };
  const start = () => {
    root.classList.add("racing");
    setTimeout(() => root.classList.remove("racing"), 2600);
    root.querySelectorAll(".row").forEach((r, i) => {
      r.classList.remove("in");
      setTimeout(() => r.classList.add("in"), i * 55);
    });
    bits.forEach(e => {
      e.style.transition = "none";
      set(e, 0);
    });
    void root.offsetWidth;
    root.querySelectorAll(".row").forEach((r, i) => {
      r.querySelectorAll(".trail,.orb").forEach(e => {
        e.style.transition = "";
        e.style.transitionDelay = i * 55 + "ms";
        set(e, e.dataset.w);
      });
    });
  };
  const rc = root.querySelector(".rc");
  if(rc) rc.onclick = start;
  requestAnimationFrame(() => requestAnimationFrame(start));

  // expand
  root.querySelectorAll(".row").forEach(row => {
    const card = row.querySelector(".card");
    if(!card) return;
    const tog = () => {
      const o = row.classList.toggle("open");
      card.setAttribute("aria-expanded", o);
    };
    card.addEventListener("click", tog);
    card.addEventListener("keydown", e => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        tog();
      }
    });
    if(!reduce && matchMedia("(hover:hover)").matches){
      card.addEventListener("pointermove", e => {
        const b = card.getBoundingClientRect();
        const x = (e.clientX - b.left) / b.width - 0.5;
        const y = (e.clientY - b.top) / b.height - 0.5;
        card.style.setProperty("--ry", (x * 3.2) + "deg");
        card.style.setProperty("--rx", (-y * 5) + "deg");
      });
      card.addEventListener("pointerleave", () => {
        card.style.setProperty("--ry", "0deg");
        card.style.setProperty("--rx", "0deg");
      });
    }
  });

  // podium tilt
  const pod = root.querySelector(".podium");
  const st = root.querySelector(".stage");
  if(!reduce && pod && st && matchMedia("(hover:hover)").matches){
    st.addEventListener("pointermove", e => {
      const b = st.getBoundingClientRect();
      const x = (e.clientX - b.left) / b.width - 0.5;
      const y = (e.clientY - b.top) / b.height - 0.5;
      pod.style.setProperty("--ry", (-10 + x * 30) + "deg");
      pod.style.setProperty("--rx", (-18 - y * 12) + "deg");
    });
    st.addEventListener("pointerleave", () => {
      pod.style.setProperty("--ry", "-10deg");
      pod.style.setProperty("--rx", "-18deg");
    });
  }

  // podium count-up, sparkles, confetti
  root.querySelectorAll(".who strong").forEach(el => countUp(el, +el.dataset.n, 1400));
  if(!reduce && st && pod){
    for(let i = 0; i < 9; i++){
      const e = document.createElement("span");
      e.className = "spark";
      e.style.cssText = `left:${28 + Math.random() * 44}%;top:${Math.random() * 55}%;background:${COL[i % 4]};animation-delay:${Math.random() * 2.4}s;scale:${0.7 + Math.random() * 0.9}`;
      st.appendChild(e);
    }
    setTimeout(() => {
      for(let i = 0; i < 28; i++){
        const s = document.createElement("span");
        s.className = "conf";
        s.style.cssText = `left:${42 + Math.random() * 16}%;background:${COL[i % 4]};--dx:${(Math.random() - 0.5) * 380}px;--rot:${Math.random() * 720}deg;animation-delay:${Math.random() * 0.3}s`;
        pod.appendChild(s);
        setTimeout(() => s.remove(), 3200);
      }
    }, 1000);
  }
}

/* ---------- you, toast, share ---------- */
let curRows = [], curTitle = "", me = "";
try { me = localStorage.getItem("gdg-me") || ""; } catch (e) { console.warn('[App] Operation notice:', e); }
const saveMe = v => {
  me = v;
  try { v ? localStorage.setItem("gdg-me", v) : localStorage.removeItem("gdg-me"); } catch (e) { console.warn('[App] Operation notice:', e); }
};
let tt;
function toast(m){
  const t = document.getElementById("toast");
  if(!t) return;
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove("on"), 2600);
}

function paintMe(){
  const bar = document.getElementById("me");
  const out = document.getElementById("board");
  if(!bar || !out) return;
  out.querySelectorAll(".row, .roster-row").forEach(r => r.classList.toggle("mine", !!me && curRows[+r.dataset.i]?.student_name === me));
  out.querySelectorAll('[data-act="me"]').forEach(b => {
    const rowEl = b.closest("[data-i]");
    const same = rowEl && curRows[+rowEl.dataset.i]?.student_name === me;
    b.textContent = same ? "✓ You" : "This is me";
  });
  if(!me){ bar.classList.remove("on"); return; }
  const i = curRows.findIndex(r => r.student_name === me);
  const c = colOf(me);
  bar.style.setProperty("--c", c);
  if(i < 0){
    bar.innerHTML = `<div class="mini" style="--c:${c};--cg:${c}55">${esc(ini(me))}</div><div class="tx"><b>${esc(me)}</b><span>Not ranked in this period yet</span></div><button class="btn x" data-bar="clear" aria-label="Clear">✕</button>`;
  } else {
    const r = curRows[i];
    bar.innerHTML = `<div class="mini" style="--c:${c};--cg:${c}55">${esc(ini(me))}</div><div class="tx"><b>You're #${r.rank} · ${fmt(r.points)} pts</b><span>${esc(gapNote(curRows, i))}</span></div><button class="btn" data-bar="jump">Find me</button><button class="btn pri" data-bar="share">Share</button><button class="btn x" data-bar="clear" aria-label="Clear">✕</button>`;
  }
  bar.classList.add("on");
}

async function shareCard(i){
  const r = curRows[i];
  if(!r) return;
  const c = colOf(r.student_name);
  const W = 1080;
  const cv = document.createElement("canvas");
  cv.width = cv.height = W;
  const x = cv.getContext("2d");
  try {
    await Promise.all(["500", "700", "800"].map(w => document.fonts.load(`${w} 40px "Google Sans Flex"`)));
  } catch (e) { console.warn('[App] Operation notice:', e); }
  const F = (w, s) => `${w} ${s}px "Google Sans Flex","Google Sans",system-ui,sans-serif`;
  x.fillStyle = "#fff";
  x.fillRect(0, 0, W, W);
  [
    [120, 120, 520, "66,133,244"],
    [980, 140, 480, "234,67,53"],
    [960, 980, 520, "249,171,0"],
    [100, 960, 480, "52,168,83"]
  ].forEach(([cx, cy, rad, rgb]) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    g.addColorStop(0, `rgba(${rgb},.22)`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    x.fillStyle = g;
    x.fillRect(0, 0, W, W);
  });
  ["#4285f4", "#ea4335", "#f9ab00", "#34a853"].forEach((k, n) => {
    x.fillStyle = k;
    x.beginPath();
    x.arc(88 + n * 26, 96, 10, 0, 7);
    x.fill();
  });
  x.fillStyle = "#5f6368";
  x.font = F(600, 30);
  x.textAlign = "left";
  x.fillText("GDG on Campus · SR University", 206, 107);
  x.textAlign = "center";
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, "#4285f4");
  g.addColorStop(0.4, "#ea4335");
  g.addColorStop(0.7, "#f9ab00");
  g.addColorStop(1, "#34a853");
  // avatar
  x.save();
  x.shadowColor = c + "88";
  x.shadowBlur = 50;
  x.shadowOffsetY = 18;
  x.fillStyle = c;
  x.beginPath();
  x.arc(W / 2, 330, 110, 0, 7);
  x.fill();
  x.restore();
  x.lineWidth = 8;
  x.strokeStyle = "#fff";
  x.beginPath();
  x.arc(W / 2, 330, 110, 0, 7);
  x.stroke();
  x.fillStyle = "#fff";
  x.font = F(800, 84);
  x.fillText(ini(r.student_name), W / 2, 360);
  x.fillStyle = "#1f1f23";
  x.font = F(800, 76);
  let nm = r.student_name;
  while(x.measureText(nm).width > W - 140 && nm.length > 6) nm = nm.slice(0, -2);
  x.fillText(nm === r.student_name ? nm : nm + "…", W / 2, 520);
  x.fillStyle = g;
  x.font = F(800, 300);
  x.fillText("#" + r.rank, W / 2, 780);
  x.fillStyle = "#1f1f23";
  x.font = F(700, 56);
  x.fillText(`${fmt(r.points)} points`, W / 2, 865);
  x.fillStyle = "#5f6368";
  x.font = F(500, 36);
  x.fillText(`${gapNote(curRows, i)}${curTitle ? " · " + curTitle : ""}`, W / 2, 925);
  x.fillStyle = "#1f1f23";
  x.font = F(700, 30);
  x.fillText("Come race with us.", W / 2, 1010);
  const blob = await new Promise(res => cv.toBlob(res, "image/png"));
  const file = new File([blob], `gdg-sru-rank-${r.rank}.png`, { type: "image/png" });
  try {
    if(navigator.canShare?.({ files: [file] })){
      await navigator.share({
        files: [file],
        text: `I'm #${r.rank} on the GDG on Campus SR University leaderboard!`
      });
      return;
    }
  } catch(e){
    if(e.name === "AbortError") return;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast("Share card saved to your device");
}

/* ---------- page ---------- */
function emptyStateHtml(periodTitle){
  return `<div class="lb-empty">
    <div class="lb-empty-flag" aria-hidden="true">
      <div class="lb-empty-flag-dots">
        <span style="background:var(--b,#4285f4)"></span>
        <span style="background:var(--r,#ea4335)"></span>
        <span style="background:var(--y,#f9ab00)"></span>
        <span style="background:var(--g,#34a853)"></span>
      </div>
      <svg viewBox="0 0 48 48" width="38" height="38" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 42V6m0 4h24l-4 7 4 7H10"/>
      </svg>
    </div>
    <h2 class="lb-empty-title">The Starting Gun Hasn't Fired Yet</h2>
    <p class="lb-empty-lead">Our inaugural events for <b>${esc(periodTitle || 'Season 2026')}</b> haven't taken place yet. Once our first workshop, hackathon, or study jam wraps up and attendance is verified, the podium and race lanes will light up with live student rankings!</p>
    <div class="lb-empty-grid">
      <div class="lb-empty-card" style="--c:#4285f4">
        <span class="lb-empty-badge">+5 pts</span>
        <b>Workshops & Labs</b>
        <p>Attend hands-on sessions and finish lab exercises.</p>
      </div>
      <div class="lb-empty-card" style="--c:#ea4335">
        <span class="lb-empty-badge">+10 pts</span>
        <b>Major Events & Sprints</b>
        <p>Build projects, hackathons, and Google Cloud Study Jams.</p>
      </div>
      <div class="lb-empty-card" style="--c:#34a853">
        <span class="lb-empty-badge">+20 pts</span>
        <b>Milestones & Tasks</b>
        <p>Lead technical sessions, solve large tasks, and win challenges.</p>
      </div>
    </div>
    <a href="/events/" class="lb-empty-cta">Explore Upcoming Events <i>→</i></a>
  </div>`;
}

function stats(rows){
  const statsEl = document.getElementById("stats");
  if(!statsEl) return;
  const tot = rows.reduce((a, r) => a + r.points, 0);
  statsEl.innerHTML = [
    ["Students competing", rows.length],
    ["Points earned", tot],
    ["Highest score", rows.length ? rows[0].points : 0]
  ].map(([l, v]) => `<div class="stat"><b data-n="${v}">0</b><span>${l}</span></div>`).join("");
  document.querySelectorAll("#stats b").forEach(b => countUp(b, +b.dataset.n));
}

function draw(){
  const out = document.getElementById("board");
  const seg = document.getElementById("seg");
  const q = document.getElementById("q");
  if(!out || !seg) return;

  seg.innerHTML = PERIODS.map(p => `<button type="button" class="pill" data-id="${p.id}" aria-pressed="${p.id === curPeriodId}">${esc(p.title)}</button>`).join("");
  seg.querySelectorAll(".pill").forEach(b => {
    b.onclick = () => {
      curPeriodId = b.dataset.id;
      if(q) q.value = "";
      draw();
    };
  });

  const periodObj = PERIODS.find(p => p.id === curPeriodId) || PERIODS[0] || { id: "season-2026", title: "Season 2026", rows: [] };
  const rows = (periodObj.rows || []).slice().sort((a, b) => a.rank - b.rank);
  stats(rows);

  if(!rows.length){
    curRows = [];
    paintMe();
    out.innerHTML = emptyStateHtml(periodObj.title);
    return;
  }

  curRows = rows;
  curTitle = periodObj.title || "";
  out.innerHTML = board(rows);
  run(out);

  out.querySelectorAll("[data-act]").forEach(b => {
    b.addEventListener("click", e => {
      e.stopPropagation();
      const rowEl = b.closest("[data-i]");
      if(!rowEl) return;
      const i = +rowEl.dataset.i;
      if(b.dataset.act === "share"){
        shareCard(i);
      } else if(b.dataset.act === "me"){
        const n = curRows[i]?.student_name;
        if(!n) return;
        if(me === n){
          saveMe("");
          toast("Removed");
        } else {
          saveMe(n);
          toast(`Hi ${first(n)}! We'll keep your spot pinned.`);
        }
        paintMe();
      }
    });
  });

  const rosterToggle = out.querySelector("[data-roster-toggle]");
  if(rosterToggle){
    let expanded = false;
    rosterToggle.onclick = () => {
      expanded = !expanded;
      out.querySelectorAll("[data-roster-item]").forEach((item, idx) => {
        if(idx >= 15){
          item.style.display = expanded ? "" : "none";
        }
      });
      rosterToggle.textContent = expanded ? "Show less ↑" : `Show all ${curRows.length - TRACK_LIMIT} chapter builders ↓`;
    };
  }

  paintMe();
}

function bindGlobalControls(){
  const meBar = document.getElementById("me");
  if(meBar && !meBar._bound){
    meBar._bound = true;
    meBar.addEventListener("click", e => {
      const a = e.target.closest("[data-bar]")?.dataset?.bar;
      if(!a) return;
      if(a === "clear"){
        saveMe("");
        paintMe();
      }
      const i = curRows.findIndex(r => r.student_name === me);
      const out = document.getElementById("board");
      if(a === "jump" && i >= 0 && out){
        const target = out.querySelector(`[data-i="${i}"]`);
        if(target){
          target.style.display = "";
          target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        }
      }
      if(a === "share" && i >= 0) shareCard(i);
    });
  }

  const q = document.getElementById("q");
  if(q && !q._bound){
    q._bound = true;
    q.oninput = () => {
      const out = document.getElementById("board");
      if(!out) return;
      const s = q.value.trim().toLowerCase();
      let firstMatch = null;
      out.querySelectorAll(".row, .roster-row").forEach(r => {
        const m = !s || r.dataset?.name?.includes(s);
        r.hidden = !m;
        if(m && s) r.style.display = ""; // unhide from progressive disclosure when matching search
        r.classList.toggle("me", !!s && m);
        if(m && s && !firstMatch) firstMatch = r;
      });
      if(firstMatch && s){
        firstMatch.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
      }
    };
  }
}

window.initLeaderboard = function(){
  bindGlobalControls();
  draw();
};

window.__GDG_SET_LEADERBOARD_DATA = function({ main, periods, sponsored }){
  const list = [];
  if(Array.isArray(periods) && periods.length){
    periods.forEach(p => {
      const pRows = (main || []).filter(r => r.period_id === p.id).sort((a,b) => a.rank - b.rank);
      list.push({ id: p.id, title: p.title || 'Official Season', rows: pRows });
    });
  } else {
    // If no periods created in admin yet, keep the main chapter Season 2026 shell
    list.push({ id: "season-2026", title: "Season 2026", rows: [] });
  }
  if(Array.isArray(sponsored) && sponsored.length){
    const spGroups = new Map();
    sponsored.forEach(r => {
      if(!spGroups.has(r.leaderboard_id)){
        spGroups.set(r.leaderboard_id, {
          id: r.leaderboard_id,
          title: r.title || r.program_name || 'Sponsored Track',
          rows: []
        });
      }
      spGroups.get(r.leaderboard_id).rows.push(r);
    });
    for(const [id, grp] of spGroups){
      list.push({ id, title: grp.title, rows: grp.rows.sort((a,b) => a.rank - b.rank) });
    }
  }

  PERIODS = list;
  if(!PERIODS.some(p => p.id === curPeriodId)){
    curPeriodId = PERIODS[0].id;
  }

  draw();
};

// Check if DOM elements are already available
if(document.getElementById("board")){
  window.initLeaderboard();
} else if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", window.initLeaderboard);
} else {
  setTimeout(window.initLeaderboard, 0);
}

})();
