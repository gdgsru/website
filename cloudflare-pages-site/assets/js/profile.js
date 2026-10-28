/* GDG SRU · Member profile & digital pass
   Hybrid model:
     1. static   /data/profiles/{handle}.json    (built offline by scripts/build_profiles.py, cache-busted)
     2. live     Supabase RPC get_member_stats   (public anon key only; read-only; returns points + credential IDs)
   The static pass renders first. Live stats are layered on top and never block it.

   Safety rules followed here:
     - no innerHTML with profile data: everything user-supplied goes through textContent / setAttribute
     - external links must parse as http: or https: (see safeHttpUrl)
     - no student photos: avatars are one of the 30 curated, face-free images in /assets/avatars/
     - no GitHub avatar requests: GitHub is only a static link-out
*/
(() => {
  "use strict";

  /* ------------------------------------------------------------------ config */
  const LEVELS = [
    { n: 1, name: "Explorer", min: 0, color: "#4285f4" },
    { n: 2, name: "Builder", min: 200, color: "#fbbc04" },
    { n: 3, name: "Innovator", min: 500, color: "#34a853" },
    { n: 4, name: "Vanguard", min: 1000, color: "#ea4335" },
  ];
  const FOIL_LEVEL = 4; // holographic finish for the top tier
  const SKINS = ["google-blue", "google-red", "google-yellow", "google-green", "terminal-dark"];
  const AVATAR_DIR = "/assets/avatars/";
  const AVATAR_COUNT = 30; // must match build_profiles.py and the files in assets/avatars/
  const QR_PATH = "/u/"; // QR opens the public pass. Change to "/verify?u=" once your verify page reads ?u=
  const HANDLE_RE = /^[a-z0-9_-]{2,32}$/;
  const CRED_RE = /^[A-Z0-9][A-Z0-9-]{8,38}[A-Z0-9]$/;
  const RPC_TIMEOUT_MS = 8000;

  const state = { handle: "", profile: null, stats: null, level: LEVELS[0] };

  /* ------------------------------------------------------------------ helpers */
  const $ = (sel, root = document) => root.querySelector(sel);
  const prefersReducedMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function text(sel, value) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (el) el.textContent = value == null ? "" : String(value);
  }
  /** http(s) only. Anything else (javascript:, data:, mailto:, relative) returns "". */
  function safeHttpUrl(raw) {
    try {
      const u = new URL(String(raw || "").trim());
      return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
    } catch (_) {
      return "";
    }
  }
  function displayUrl(href) {
    return href.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
  function fmtDate(iso, opts) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-GB", opts || { day: "numeric", month: "short", year: "numeric" });
  }
  function levelFor(points) {
    let lv = LEVELS[0];
    for (const l of LEVELS) if (points >= l.min) lv = l;
    return lv;
  }
  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { delete scriptCache[src]; reject(new Error("Failed to load " + src)); };
        document.head.appendChild(s);
      });
    }
    return scriptCache[src];
  }

  let toastTimer = 0;
  function toast(msg) {
    const el = $("#pf-toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2600);
  }
  function setBusy(btn, busy) {
    if (!btn) return;
    btn.disabled = !!busy;
    btn.setAttribute("aria-busy", busy ? "true" : "false");
  }
  function triggerDownload(href, filename) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ------------------------------------------------------------------ routing */
  function getHandle() {
    let raw = "";
    const m = location.pathname.match(/^\/u\/([^/?#]+)\/?$/i);
    try {
      raw = m ? decodeURIComponent(m[1]) : new URLSearchParams(location.search).get("u") || "";
    } catch (_) {
      raw = "";
    }
    raw = raw.trim().toLowerCase().replace(/^@/, "");
    return HANDLE_RE.test(raw) ? raw : "";
  }
  function show(which) {
    $("#pf-status").classList.toggle("is-hidden", which !== "loading");
    $("#pf-empty").hidden = which !== "empty";
    $("#pf-notfound").hidden = which !== "notfound";
    $("#pf-withdrawn").hidden = which !== "withdrawn";
    $("#pf-content").hidden = which !== "content";
  }

  /* ------------------------------------------------------------------ data: static profile */
  function sanitizeProfile(d, handle) {
    const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
    const gh = str(d.github, 39);
    return {
      handle,
      name: str(d.name, 80) || handle,
      roll: str(d.roll_display, 20),
      department: str(d.department, 60),
      cohort: str(d.cohort, 12),
      theme: SKINS.includes(d.theme) ? d.theme : "google-blue",
      avatar: avatarId(d.avatar),
      github: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(gh) ? gh : "",
      portfolio: safeHttpUrl(d.portfolio),
      linkedin: safeHttpUrl(d.linkedin),
      bio: str(d.bio, 240),
      skills: Array.isArray(d.skills) ? d.skills.map((s) => str(s, 24)).filter(Boolean).slice(0, 8) : [],
      joined: str(d.joined, 10),
    };
  }
  async function fetchProfile(handle) {
    let p = null;
    try {
      const res = await fetch(`/data/profiles/${encodeURIComponent(handle)}.json?v=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && typeof data === "object") p = sanitizeProfile(data, handle);
      }
    } catch (_) {}

    // Check Supabase site_settings overrides (enables instant profile updates from Mission Control)
    const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if (url && key) {
      try {
        const headers = { "Content-Type": "application/json", apikey: key };
        if (/^eyJ/.test(key)) headers.Authorization = "Bearer " + key;
        const res = await fetch(String(url).replace(/\/$/, "") + "/rest/v1/public_site_settings?key=eq.member_profile_overrides&select=value", {
          headers
        });
        if (res.ok) {
          const arr = await res.json();
          if (Array.isArray(arr) && arr[0] && arr[0].value && arr[0].value[handle]) {
            const ov = arr[0].value[handle];
            if (ov.hidden) return { handle, hidden: true };
            if (!p) {
              p = sanitizeProfile({
                name: ov.name || handle,
                roll_display: ov.roll || "",
                department: ov.dept || ov.department || "",
                cohort: ov.cohort || "",
                theme: ov.theme || "google-blue",
                avatar: ov.avatar || "avatar-01",
                bio: ov.bio || "",
                skills: Array.isArray(ov.skills) ? ov.skills : []
              }, handle);
            } else {
              if (ov.name) p.name = ov.name;
              if (ov.dept || ov.department) p.department = ov.dept || ov.department;
              if (ov.cohort) p.cohort = ov.cohort;
              if (ov.theme && SKINS.includes(ov.theme)) p.theme = ov.theme;
              if (ov.avatar) p.avatar = avatarId(ov.avatar);
              if (ov.bio) p.bio = ov.bio;
              if (Array.isArray(ov.skills)) p.skills = ov.skills;
            }
          }
        }
      } catch (_) {}
    }

    return p;
  }

  /* ------------------------------------------------------------------ data: live stats (Supabase, anon, read-only) */
  async function fetchStats(handle) {
    const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), RPC_TIMEOUT_MS);
    try {
      const headers = { "Content-Type": "application/json", apikey: key };
      if (/^eyJ/.test(key)) headers.Authorization = "Bearer " + key; // legacy JWT anon keys only
      const res = await fetch(String(url).replace(/\/$/, "") + "/rest/v1/rpc/get_member_stats", {
        method: "POST",
        headers,
        body: JSON.stringify({ p_handle: handle }),
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      const d = await res.json();
      if (!d || d.found !== true) return null;
      if (d.hidden === true) return { hidden: true }; // withdrawn by the member or the team (Mission Control)
      const points = Math.max(0, Math.min(1e6, Number(d.points) || 0));
      const workshops = (Array.isArray(d.workshops) ? d.workshops : [])
        .map((w) => ({
          title: String((w && w.title) || "Workshop").slice(0, 140),
          date: w && w.date ? String(w.date) : "",
          cred: String((w && w.credential_id) || "").toUpperCase(),
        }))
        .filter((w) => CRED_RE.test(w.cred));
      return {
        points,
        activities: Math.max(0, Number(d.activities) || 0),
        workshops,
        name: d.name,
        department: d.department,
        cohort: d.cohort,
        avatar: d.avatar,
        theme: d.theme,
        bio: d.bio,
        skills: d.skills
      };
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------ rendering */
  /** Only the curated set is ever loaded. Anything else maps to avatar-01. */
  function avatarId(raw) {
    const m = /^avatar-(\d{2})$/.exec(String(raw || ""));
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= AVATAR_COUNT ? `avatar-${m[1]}` : "avatar-01";
  }
  function avatarSrc(id) {
    return `${AVATAR_DIR}${avatarId(id)}.svg`;
  }

  /** Decorative barcode seeded by the handle (FNV-1a + LCG). Purely visual; the QR modal is the scannable code. */
  function drawBarcode(seedText) {
    const box = $("#pf-barcode");
    if (!box) return;
    let h = 2166136261;
    for (const ch of seedText) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h >>> 24; };
    let x = 0, rects = "";
    while (x < 150) {
      const w = 1 + (rnd() % 3), gap = 1 + (rnd() % 2);
      if (x + w > 150) break;
      rects += `<rect x="${x}" y="0" width="${w}" height="20"/>`;
      x += w + gap;
    }
    box.innerHTML = `<svg viewBox="0 0 150 20" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${rects}</svg>`; // numbers only
  }

  function renderProfile(p) {
    state.profile = p;
    const passUrl = `${location.origin}/u/${p.handle}`;
    document.title = `${p.name} · GDG SRU Member Pass`;
    const canon = $("#pf-canonical");
    if (canon) canon.href = passUrl;

    const card = $("#pf-card");
    card.dataset.skin = p.theme;
    card.setAttribute("aria-label", `Member pass for ${p.name}`);
    text("#pf-card-name", p.name);
    text("#pf-card-handle", "@" + p.handle);
    text("#pf-f-roll", p.roll || "—");
    text("#pf-f-cohort", p.cohort || "—");
    text("#pf-f-dept", p.department || "—");
    text("#pf-card-url", displayUrl(passUrl));
    text("#pf-f-since", p.joined ? fmtDate(p.joined, { month: "short", year: "numeric" }) || "—" : "—");
    drawBarcode(p.handle);

    // Avatar: one of the curated, face-free set. Never a student photo.
    const img = $("#pf-avatar");
    img.onerror = () => {
      img.onerror = null;
      img.src = avatarSrc("avatar-01");
    };
    img.src = avatarSrc(p.avatar);

    text("#pf-name", p.name);
    text("#pf-meta", [p.department, p.cohort ? `Cohort ${p.cohort}` : ""].filter(Boolean).join(" · "));
    if (p.bio) { text("#pf-bio", p.bio); $("#pf-bio").hidden = false; }

    const links = [];
    if (p.portfolio) links.push({ label: "Portfolio", href: p.portfolio });
    if (p.linkedin) links.push({ label: "LinkedIn", href: p.linkedin });
    if (p.github) links.push({ label: "GitHub", href: `https://github.com/${encodeURIComponent(p.github)}` });
    const ul = $("#pf-links");
    ul.replaceChildren();
    links.forEach((l) => {
      const href = safeHttpUrl(l.href);
      if (!href) return;
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = l.label;
      li.appendChild(a);
      ul.appendChild(li);
    });
    ul.hidden = !ul.children.length;

    const chips = $("#pf-skills");
    chips.replaceChildren();
    p.skills.forEach((s) => { const li = document.createElement("li"); li.textContent = s; chips.appendChild(li); });
    $("#pf-skills-section").hidden = !p.skills.length;

    renderLevels(0, false); // level ladder visible immediately; unlock state set once live data lands
    text("#pf-live span", "Checking live stats…");
  }

  const SHAPES = [
    "<svg viewBox='0 0 24 24' aria-hidden='true'><circle cx='12' cy='12' r='8' fill='currentColor'/></svg>",
    "<svg viewBox='0 0 24 24' aria-hidden='true'><rect x='4' y='4' width='16' height='16' rx='4' fill='currentColor'/></svg>",
    "<svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 3 22 20H2z' fill='currentColor' stroke='currentColor' stroke-width='2' stroke-linejoin='round'/></svg>",
    "<svg viewBox='0 0 64 64' aria-hidden='true'><path d='M32 4C34 22 42 30 60 32 42 34 34 42 32 60 30 42 22 34 4 32 22 30 30 22 32 4Z' fill='currentColor'/></svg>",
  ];
  function renderLevels(points, live) {
    const cur = levelFor(points);
    const ol = $("#pf-levels");
    ol.replaceChildren();
    LEVELS.forEach((l, i) => {
      const li = document.createElement("li");
      li.style.setProperty("--lv", l.color);
      // Level 1 is unlocked by verification itself; higher levels need live points.
      if (l.n === 1 || (live && points >= l.min)) li.classList.add("is-unlocked");
      if (live && l.n === cur.n) li.classList.add("is-current");
      li.insertAdjacentHTML("afterbegin", SHAPES[i]); // static strings above, no user data
      if (li.classList.contains("is-unlocked") && li.firstElementChild) li.firstElementChild.style.color = l.color;
      const b = document.createElement("b");
      b.textContent = l.name;
      const small = document.createElement("span");
      small.textContent = l.min ? `${l.min}+ XP` : "Verified";
      li.appendChild(b);
      li.appendChild(small);
      ol.appendChild(li);
    });
  }

  function countTo(el, to) {
    if (prefersReducedMotion() || to === 0) { el.textContent = to.toLocaleString("en-IN"); return; }
    const t0 = performance.now(), dur = 800;
    const tick = (t) => {
      const k = Math.min(1, (t - t0) / dur), eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(to * eased).toLocaleString("en-IN");
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function renderStats(stats) {
    state.stats = stats;
    if (stats && state.profile) {
      let updated = false;
      if (stats.name && stats.name !== state.profile.name) { state.profile.name = stats.name; updated = true; }
      if (stats.department && stats.department !== state.profile.department) { state.profile.department = stats.department; updated = true; }
      if (stats.cohort && stats.cohort !== state.profile.cohort) { state.profile.cohort = stats.cohort; updated = true; }
      if (stats.avatar && avatarId(stats.avatar) !== state.profile.avatar) { state.profile.avatar = avatarId(stats.avatar); updated = true; }
      if (stats.theme && SKINS.includes(stats.theme) && stats.theme !== state.profile.theme) { state.profile.theme = stats.theme; updated = true; }
      if (stats.bio && stats.bio !== state.profile.bio) { state.profile.bio = stats.bio; updated = true; }
      if (Array.isArray(stats.skills) && stats.skills.length) { state.profile.skills = stats.skills; updated = true; }
      if (updated) renderProfile(state.profile);
    }
    const live = $("#pf-live");
    const timeline = $("#pf-timeline");
    const empty = $("#pf-timeline-empty");
    timeline.replaceChildren();
    empty.hidden = true;

    if (!stats) {
      live.dataset.state = "off";
      text("#pf-live span", "Live stats unavailable right now");
      ["#pf-xp", "#pf-workshops", "#pf-activities"].forEach((s) => text(s, "—"));
      text("#pf-level-label", "Level 1 · Explorer");
      text("#pf-level-next", "Verified members start at Explorer. Live points couldn’t be loaded, so your higher level isn’t shown here yet.");
      text("#pf-timeline-empty", "Workshop badges couldn’t be loaded right now. Refresh to try again.");
      empty.hidden = false;
      return;
    }

    const lv = levelFor(stats.points);
    state.level = lv;
    const next = LEVELS.find((l) => l.min > stats.points);
    live.dataset.state = "live";
    text("#pf-live span", "Live from the community database");

    countTo($("#pf-xp"), stats.points);
    countTo($("#pf-workshops"), stats.workshops.length);
    countTo($("#pf-activities"), stats.activities);

    text("#pf-level-label", `Level ${lv.n} · ${lv.name}`);
    const bar = $("#pf-bar");
    let pct = 100;
    if (next) {
      pct = Math.round(((stats.points - lv.min) / (next.min - lv.min)) * 100);
      text("#pf-level-next", `${(next.min - stats.points).toLocaleString("en-IN")} XP to ${next.name}`);
    } else {
      text("#pf-level-next", "Top tier reached. Thank you for building with the community.");
    }
    bar.setAttribute("aria-valuenow", String(pct));
    requestAnimationFrame(() => { $("#pf-bar-fill").style.width = pct + "%"; });
    renderLevels(stats.points, true);

    // Card: level pill + foil for the top tier.
    const pill = $("#pf-card-level");
    pill.textContent = `Lvl ${lv.n} · ${lv.name}`;
    pill.hidden = false;
    $("#pf-card").dataset.foil = lv.n >= FOIL_LEVEL ? "on" : "off";

    // Certificate timeline
    if (!stats.workshops.length) {
      text("#pf-timeline-empty", "No verified workshop certificates yet. Attend a GDG SRU workshop and claim your certificate to see it here.");
      empty.hidden = false;
      return;
    }
    stats.workshops.forEach((w) => {
      const li = document.createElement("li");
      const body = document.createElement("div");
      const time = document.createElement("time");
      if (w.date) time.dateTime = w.date;
      time.textContent = fmtDate(w.date) || "Date not recorded";
      const h3 = document.createElement("h3");
      h3.textContent = w.title;
      const cred = document.createElement("p");
      cred.className = "pf-cred";
      cred.textContent = w.cred;
      body.append(time, h3, cred);
      const a = document.createElement("a");
      a.href = `/verify/${encodeURIComponent(w.cred)}`;
      a.textContent = "Verify";
      a.setAttribute("aria-label", `Verify credential ${w.cred} for ${w.title}`);
      li.append(body, a);
      timeline.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------ 3D tilt */
  function initTilt() {
    const card = $("#pf-card");
    if (!card || prefersReducedMotion()) return;
    const MAX = 14;
    let raf = 0, pending = null;
    const apply = () => {
      raf = 0;
      if (!pending) return;
      const { px, py } = pending;
      card.style.setProperty("--ry", ((px - 0.5) * 2 * MAX).toFixed(2) + "deg");
      card.style.setProperty("--rx", ((0.5 - py) * 2 * MAX).toFixed(2) + "deg");
      card.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      card.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    };
    const move = (e) => {
      const r = card.getBoundingClientRect();
      pending = {
        px: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
        py: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
      };
      card.classList.add("is-tilting");
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const reset = () => {
      pending = null;
      card.classList.remove("is-tilting");
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--mx", "50%");
      card.style.setProperty("--my", "20%");
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerleave", reset);
    card.addEventListener("pointercancel", reset);
    card.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") reset(); });
  }

  /* ------------------------------------------------------------------ export: PNG */
  function avatarDataUrl(img) {
    if (img.src.startsWith("data:")) return img.src;
    if (!img.complete || !img.naturalWidth) return null;
    try {
      const c = document.createElement("canvas");
      c.width = c.height = 320;
      c.getContext("2d").drawImage(img, 0, 0, 320, 320);
      return c.toDataURL("image/png");
    } catch (_) {
      return null; // tainted canvas (no CORS headers from the image host)
    }
  }

  async function exportCardPng() {
    const btn = $("#pf-png"), card = $("#pf-card"), img = $("#pf-avatar");
    if (!state.profile) return;
    setBusy(btn, true);
    const originalSrc = img.src;
    try {
      await loadScript("/assets/vendor/html-to-image.min.js");
      if (!window.htmlToImage) throw new Error("html-to-image unavailable");
      if (document.fonts && document.fonts.ready) await document.fonts.ready;
      card.classList.add("pf-exporting"); // freezes tilt/foil so the capture is deterministic
      // Inline the avatar so the exporter never has to fetch a cross-origin image (CSP/CORS safe).
      img.src = avatarDataUrl(img) || avatarSrc(state.profile.avatar);
      if (img.decode) await img.decode().catch(() => {});
      const dataUrl = await window.htmlToImage.toPng(card, { pixelRatio: 3, cacheBust: false, backgroundColor: null });
      triggerDownload(dataUrl, `gdg-sru-pass-${state.handle}.png`);
      toast("Card saved as PNG");
    } catch (err) {
      console.error("PNG export failed", err);
      toast("Couldn’t create the image. Try Print / lanyard instead.");
    } finally {
      img.src = originalSrc;
      card.classList.remove("pf-exporting");
      setBusy(btn, false);
    }
  }

  /* ------------------------------------------------------------------ export: 1-page ATS resume (PDF) */
  /** jsPDF's built-in Helvetica is WinAnsi only. Fold accents, replace anything else, so text stays real & selectable. */
  function pdfSafe(s) {
    return String(s == null ? "" : s)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201c\u201d]/g, '"')
      .replace(/[\u2013\u2014]/g, "-")
      .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
  }

  async function exportAtsPdf() {
    const btn = $("#pf-pdf");
    const p = state.profile, st = state.stats;
    if (!p) return;
    setBusy(btn, true);
    try {
      await loadScript("/assets/vendor/jspdf.umd.min.js");
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) throw new Error("jsPDF unavailable");

      const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
      doc.setLineHeightFactor(1.25);
      const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
      const M = 48, W = PW - M * 2, LIMIT = PH - M - 16; // keep room for the footer line
      const passUrl = `${location.origin}/u/${p.handle}`;
      const INK = [28, 28, 30], MUTED = [90, 94, 102];
      let y = M, dropped = 0;

      const write = (str, o = {}) => {
        const size = o.size || 10;
        doc.setFont("helvetica", o.bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...(o.color || INK));
        const lines = doc.splitTextToSize(pdfSafe(str), o.width || W);
        const h = lines.length * size * 1.25;
        if (y + h > LIMIT) { dropped++; return false; }
        doc.text(lines, o.x || M, y + size * 0.9);
        y += h + (o.gap == null ? 3 : o.gap);
        return true;
      };
      const heading = (label) => {
        if (y + 30 > LIMIT) { dropped++; return false; }
        y += 8;
        write(label.toUpperCase(), { size: 10.5, bold: true, gap: 2 });
        doc.setDrawColor(170, 170, 175);
        doc.setLineWidth(0.6);
        doc.line(M, y, PW - M, y);
        y += 6;
        return true;
      };

      // Header
      write(p.name, { size: 22, bold: true, gap: 2 });
      write(["Member, GDG on Campus SR University", p.department, p.cohort ? `Cohort ${p.cohort}` : ""].filter(Boolean).join("  |  "), { size: 10.5, color: MUTED, gap: 4 });

      // Contact / links (real, clickable URLs; plain text so ATS parsers can read them)
      const contacts = [{ label: "Verified pass", url: passUrl }];
      if (p.portfolio) contacts.push({ label: "Portfolio", url: p.portfolio });
      if (p.linkedin) contacts.push({ label: "LinkedIn", url: p.linkedin });
      if (p.github) contacts.push({ label: "GitHub", url: `https://github.com/${p.github}` });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(26, 83, 180);
      let x = M;
      contacts.forEach((c) => {
        const label = pdfSafe(`${c.label}: ${displayUrl(c.url)}`);
        const w = doc.getTextWidth(label);
        if (x + w > PW - M && x > M) { x = M; y += 13; }
        doc.textWithLink(label, x, y + 9, { url: c.url });
        x += w + 16;
      });
      y += 20;

      if (p.bio) { heading("Summary"); write(p.bio, { size: 10.5, gap: 4 }); }

      heading("Community involvement");
      write(
        `Verified member of GDG on Campus SR University (Google Developer Groups on Campus), a student-led technology community.`,
        { size: 10.5, gap: 4 }
      );
      if (st) {
        write(`Community level: ${state.level.name} (Level ${state.level.n}) - ${st.points.toLocaleString("en-IN")} XP from ${st.activities} verified activities.`, { size: 10.5, gap: 4 });
      }

      if (p.skills.length) { heading("Skills & interests"); write(p.skills.join(", "), { size: 10.5, gap: 4 }); }

      if (st && st.workshops.length) {
        heading("Verified workshops & certificates");
        let shown = 0;
        for (const w of st.workshops) {
          const when = fmtDate(w.date, { month: "short", year: "numeric" });
          const ok = write(`- ${w.title}${when ? ` (${when})` : ""}  |  Credential ID: ${w.cred}`, { size: 10, gap: 2, width: W - 8 });
          if (!ok) break;
          shown++;
        }
        const left = st.workshops.length - shown;
        if (left > 0) write(`+ ${left} more verified at ${displayUrl(passUrl)}`, { size: 9.5, color: MUTED });
      }

      // Footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...MUTED);
      doc.text(pdfSafe(`Credentials verifiable at ${location.origin}/verify  |  Generated ${fmtDate(new Date().toISOString())}`), M, PH - M + 6);

      doc.setProperties({ title: pdfSafe(`${p.name} - Member resume`), subject: "GDG on Campus SR University member resume", author: pdfSafe(p.name), creator: "GDG SRU member pass" });
      doc.save(`${p.handle}-ats-resume.pdf`);
      toast(dropped ? "Resume saved (trimmed to fit one page)" : "Resume saved");
    } catch (err) {
      console.error("PDF export failed", err);
      toast("Couldn’t create the PDF. Please try again.");
    } finally {
      setBusy(btn, false);
    }
  }

  /* ------------------------------------------------------------------ QR modal, copy, print, theme */
  function passLink() { return `${location.origin}${QR_PATH}${state.handle}`; }

  async function copyText(value) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (_) {
      const ta = document.createElement("textarea");
      ta.value = value;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;left:-9999px";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function openQr() {
    const dlg = $("#pf-qr-modal"), box = $("#pf-qr-box");
    const link = passLink();
    try {
      box.innerHTML = window.GDGQR.svg(link, { dark: "#111111", light: "#ffffff", border: 2 }); // generated locally; contains no user HTML
    } catch (err) {
      console.error("QR failed", err);
      box.textContent = "QR code unavailable";
    }
    text("#pf-qr-url", displayUrl(link));
    if (typeof dlg.showModal === "function") dlg.showModal();
    else toast(displayUrl(link));
  }

  function openPalette() {
    if (window.gdgCommandPalette && typeof window.gdgCommandPalette.open === "function") { window.gdgCommandPalette.open(); return; }
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", code: "KeyK", ctrlKey: true, bubbles: true }));
  }

  function bindChrome() {
    document.querySelectorAll("[data-open-palette]").forEach((b) => b.addEventListener("click", openPalette));
    $("#pf-search").addEventListener("click", openPalette);
    $("#pf-theme").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("gdg-theme", next); } catch (_) { /* private mode */ }
    });
    $("#pf-png").addEventListener("click", exportCardPng);
    $("#pf-pdf").addEventListener("click", exportAtsPdf);
    $("#pf-qr").addEventListener("click", openQr);
    $("#pf-print").addEventListener("click", () => window.print());
    $("#pf-copy").addEventListener("click", async () => toast((await copyText(passLink())) ? "Link copied" : "Couldn’t copy the link"));
    $("#pf-qr-copy").addEventListener("click", async () => toast((await copyText(passLink())) ? "Link copied" : "Couldn’t copy the link"));
    const dlg = $("#pf-qr-modal");
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // click on backdrop
  }

  function showWithdrawn() {
    state.profile = null; // exports become no-ops
    show("withdrawn");
    document.title = "Pass unavailable · GDG SRU";
  }

  /* ------------------------------------------------------------------ boot */
  async function main() {
    bindChrome();
    initTilt();
    const handle = getHandle();
    state.handle = handle;
    if (!handle) { show("empty"); return; }

    // Dual fetch: both start immediately, the static pass renders as soon as it lands.
    const statsPromise = fetchStats(handle);
    let profile;
    try {
      profile = await fetchProfile(handle);
    } catch (err) {
      console.error(err);
      text("#pf-status", "Couldn’t load this pass. Check your connection and refresh.");
      return;
    }
    if (!profile) {
      // Check if live stats provide the member profile
      const liveStats = await statsPromise;
      if (liveStats && (liveStats.name || liveStats.department || liveStats.avatar)) {
        profile = sanitizeProfile({
          name: liveStats.name,
          department: liveStats.department,
          cohort: liveStats.cohort,
          avatar: liveStats.avatar,
          theme: liveStats.theme,
          bio: liveStats.bio,
          skills: liveStats.skills
        }, handle);
      }
    }
    if (!profile) {
      text("#pf-nf-handle", "@" + handle);
      show("notfound");
      document.title = "Member not found · GDG SRU";
      return;
    }
    // Give the live check a brief head start so a withdrawn pass never flashes its details.
    const early = await Promise.race([statsPromise, new Promise((r) => setTimeout(() => r(undefined), 1500))]);
    if (early && early.hidden) return showWithdrawn();
    renderProfile(profile);
    show("content");
    const stats = early !== undefined ? early : await statsPromise;
    if (stats && stats.hidden) return showWithdrawn();
    renderStats(stats);
  }

  // Public hooks (also what the spec names): handy for testing from the console.
  window.exportCardPng = exportCardPng;
  window.exportAtsPdf = exportAtsPdf;

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", main);
  else main();
})();
