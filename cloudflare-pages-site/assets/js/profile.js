/* GDG SRU · Member Profile & Portfolio Dashboard
   Official Google Developer Groups on Campus Design System */
(() => {
  "use strict";

  const HANDLE_RE = /^[a-z0-9_-]{2,32}$/;
  const RPC_TIMEOUT_MS = 8000;
  const AVATAR_DIR = "/assets/avatars/";
  const AVATAR_COUNT = 30;

  const state = {
    handle: "",
    profile: null,
    stats: null
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function text(sel, value) {
    const el = typeof sel === "string" ? $(sel) : sel;
    if (el) el.textContent = value == null ? "" : String(value);
  }

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
    return d.toLocaleDateString("en-US", opts || { month: "short", day: "numeric", year: "numeric" });
  }

  const scriptCache = {};
  function loadScript(src) {
    if (!scriptCache[src]) {
      scriptCache[src] = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = resolve;
        s.onerror = () => {
          delete scriptCache[src];
          reject(new Error("Failed to load " + src));
        };
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

  function avatarId(raw) {
    const m = /^avatar-(\d{2})$/.exec(String(raw || ""));
    const n = m ? Number(m[1]) : 0;
    return n >= 1 && n <= AVATAR_COUNT ? `avatar-${m[1]}` : "avatar-01";
  }

  function avatarSrc(id) {
    return `${AVATAR_DIR}${avatarId(id)}.svg`;
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
    // Default to narayan if visiting /profile.html directly without handle parameter
    if (!raw && location.pathname.includes("profile")) {
      raw = "narayan";
    }
    return HANDLE_RE.test(raw) ? raw : "";
  }

  function show(which) {
    $("#pf-status").classList.toggle("is-hidden", which !== "loading");
    $("#pf-empty").hidden = which !== "empty";
    $("#pf-notfound").hidden = which !== "notfound";
    $("#pf-withdrawn").hidden = which !== "withdrawn";
    $("#pf-content").hidden = which !== "content";
  }

  /* ------------------------------------------------------------------ data */
  function sanitizeProfile(d, handle) {
    const str = (v, max) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
    const gh = str(d.github, 60);

    return {
      handle,
      name: str(d.name, 80) || handle,
      roll: str(d.roll_display || d.roll, 20),
      department: str(d.department, 60) || "CSE (AI & ML)",
      cohort: str(d.cohort, 12) || "2024",
      university: str(d.university, 60) || "SR University",
      status: str(d.status, 20) || "verified",
      active_status: str(d.active_status, 30) || "Active Member",
      theme: str(d.theme, 30) || "google-blue",
      avatar: avatarId(d.avatar),
      photo: str(d.photo, 200),
      github: gh,
      portfolio: safeHttpUrl(d.portfolio),
      linkedin: safeHttpUrl(d.linkedin),
      email: str(d.email, 80),
      bio: str(d.bio, 300),
      about_me: str(d.about_me, 600) || str(d.bio, 600),
      skills: Array.isArray(d.skills) ? d.skills.map((s) => str(s, 24)).filter(Boolean) : ["Web Dev", "Python", "React", "JavaScript", "UI/UX"],
      interests: Array.isArray(d.interests) ? d.interests.map((s) => str(s, 30)).filter(Boolean) : ["Open Source", "Community", "AI/ML", "Product Building"],
      coding_languages: str(d.coding_languages, 100) || "Python, JavaScript, C++",
      tools: str(d.tools, 100) || "VS Code, Git, Firebase, React",
      hobbies: str(d.hobbies, 100) || "Gaming, Photography, Music",
      workshops: Array.isArray(d.workshops) ? d.workshops : [],
      joined: str(d.joined, 10),
      // Toggles & Custom URLs
      hidden: d.hidden === true,
      allow_download_card: d.allow_download_card !== false,
      allow_download_resume: d.allow_download_resume !== false,
      resume_url: safeHttpUrl(d.resume_url),
      allow_print: d.allow_print !== false,
      allow_copy_link: d.allow_copy_link !== false,
      allow_checkin_qr: d.allow_checkin_qr !== false,
      show_about_me: d.show_about_me !== false,
      show_workshops: d.show_workshops !== false,
      show_skills_interests: d.show_skills_interests !== false,
      show_quick_links: d.show_quick_links !== false,
      show_more_about: d.show_more_about !== false,
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

    // Check for team member photo if not explicitly set
    if (p && !p.photo) {
      if (handle === "narayan") {
        p.photo = "/assets/team/26-EXE-01.webp";
      }
    }

    return p;
  }

  async function fetchOverrides(handle) {
    const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 2500);
    try {
      const headers = { "Content-Type": "application/json", apikey: key };
      if (/^eyJ/.test(key)) headers.Authorization = "Bearer " + key;
      const endpoint = `${String(url).replace(/\/$/, "")}/rest/v1/site_settings?key=eq.member_profile_overrides&select=value`;
      const res = await fetch(endpoint, {
        headers,
        signal: ctl.signal,
        cache: "no-store"
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0] && rows[0].value && typeof rows[0].value === "object") {
          return rows[0].value[handle] || null;
        }
      }
    } catch (_) {}
    finally {
      clearTimeout(timer);
    }
    return null;
  }

  async function fetchStats(handle) {
    const url = window.SUPABASE_URL, key = window.SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), RPC_TIMEOUT_MS);
    try {
      const headers = { "Content-Type": "application/json", apikey: key };
      if (/^eyJ/.test(key)) headers.Authorization = "Bearer " + key;
      const res = await fetch(String(url).replace(/\/$/, "") + "/rest/v1/rpc/get_member_stats", {
        method: "POST",
        headers,
        body: JSON.stringify({ p_handle: handle }),
        signal: ctl.signal,
      });
      if (!res.ok) return null;
      const d = await res.json();
      if (!d || d.found !== true) return null;
      if (d.hidden === true) return { hidden: true };
      return d;
    } catch (_) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ------------------------------------------------------------------ workshop icon helper */
  function getWorkshopIcon(ws) {
    const iconType = (ws.icon || "").toLowerCase();
    const title = (ws.title || "").toLowerCase();

    if (iconType.includes("firebase") || title.includes("firebase")) {
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="#FFA000" d="M4.1 14.5L7.2 2.3c.1-.5.7-.7 1-.3l2.8 5.2-7 7.3z"/>
        <path fill="#F57C00" d="M12.9 6.8l2.1-4c.3-.5 1-.4 1.2.1l3.7 11.6-7-7.7z"/>
        <path fill="#FFCA28" d="M11 7.2L4.1 14.5 12 22l7.9-7.5-3.7-11.6-5.2 4.3z"/>
      </svg>`;
    }
    if (iconType.includes("python") || title.includes("machine learning") || title.includes("python") || title.includes("ai")) {
      return `<svg viewBox="0 0 24 24" width="24" height="24">
        <path fill="#3776AB" d="M11.9 2c-3.1 0-2.9 1.3-2.9 1.3l.03 1.4h2.9v.4H6.1S4 4.8 4 8c0 3.1 1.8 3 1.8 3h1.1v-1.5c0-1.7 1.4-1.7 1.4-1.7h3.6s1.6.1 1.6-1.5V3.7S13.8 2 11.9 2zm-.9 1.2c.4 0 .7.3.7.7s-.3.7-.7.7-.7-.3-.7-.7.3-.7.7-.7z"/>
        <path fill="#FFD43B" d="M12.1 22c3.1 0 2.9-1.3 2.9-1.3l-.03-1.4h-2.9v-.4h5.8s2.1.3 2.1-2.9c0-3.1-1.8-3-1.8-3h-1.1v1.5c0 1.7-1.4 1.7-1.4 1.7h-3.6s-1.6-.1-1.6 1.5v2.6s-.3 1.7 1.6 1.7zm.9-1.2c-.4 0-.7-.3-.7-.7s.3-.7.7-.7.7.3.7.7-.3.7-.7.7z"/>
      </svg>`;
    }
    if (iconType.includes("github") || iconType.includes("git") || title.includes("github") || title.includes("git")) {
      return `<svg viewBox="0 0 24 24" width="22" height="22" fill="#24292e">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
      </svg>`;
    }
    // Default blue calendar icon
    return `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#1a73e8" stroke-width="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>`;
  }

  /* ------------------------------------------------------------------ barcode for card export */
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
    box.innerHTML = `<svg viewBox="0 0 150 20" preserveAspectRatio="none" fill="currentColor" aria-hidden="true">${rects}</svg>`;
  }

  /* ------------------------------------------------------------------ rendering */
  function renderProfile(p) {
    state.profile = p;
    const passUrl = `${location.origin}/u/${p.handle}`;
    document.title = `${p.name} · GDG SRU Member Profile`;

    const canon = $("#pf-canonical");
    if (canon) canon.href = passUrl;

    // Header User Avatar Initial (matches screenshot "A")
    text("#pf-user-avatar", "A");

    // Action button toggles
    const setBtnVis = (id, vis) => {
      const el = $(id);
      if (el) el.style.display = vis ? "" : "none";
    };
    setBtnVis("#pf-png", p.allow_download_card !== false);
    setBtnVis("#pf-pdf", p.allow_download_resume !== false);
    setBtnVis("#pf-print", p.allow_print !== false);
    setBtnVis("#pf-copy", p.allow_copy_link !== false);
    setBtnVis("#pf-qr", p.allow_checkin_qr !== false);

    // Section display toggles
    const setSecVis = (cls, vis) => {
      const el = $(cls);
      if (el) el.style.display = vis ? "" : "none";
    };
    setSecVis(".pf-card-about", p.show_about_me !== false);
    setSecVis(".pf-card-workshops", p.show_workshops !== false);
    setSecVis(".pf-card-skills", p.show_skills_interests !== false);
    setSecVis(".pf-card-links", p.show_quick_links !== false);
    setSecVis(".pf-card-more", p.show_more_about !== false);

    // Hero Section Details
    text("#pf-name", p.name);
    text("#pf-meta-dept", p.department || p.dept || "CSE (AI & ML)");
    text("#pf-meta-cohort", p.cohort ? `Cohort ${p.cohort}` : "Cohort 2024");
    text("#pf-location", p.university || "SR University");
    text("#pf-bio", p.bio);
    text("#pf-active-text", p.active_status || "Active Member");

    const verifiedPill = $("#pf-verified-pill");
    if (verifiedPill) {
      const statusLabels = {
        verified: "Verified Member",
        core: "Core Team",
        lead: "Chapter Lead",
        member: "Active Member"
      };
      verifiedPill.textContent = statusLabels[p.status] || p.status || "Verified Member";
    }

    // Avatar Image
    const avatarEl = $("#pf-avatar");
    if (avatarEl) {
      avatarEl.onerror = () => {
        avatarEl.onerror = null;
        avatarEl.src = avatarSrc(p.avatar || "avatar-03");
      };
      avatarEl.src = p.photo || (p.handle === "narayan" ? "/assets/images/narayan-portrait.png" : avatarSrc(p.avatar || "avatar-03"));
    }

    // Skill pills in hero row (show up to 4, then +N if more)
    const skillsWrap = $("#pf-skill-tags");
    if (skillsWrap) {
      skillsWrap.replaceChildren();
      const heroSkills = (p.skills || []).slice(0, 4);
      heroSkills.forEach((s) => {
        const pill = document.createElement("span");
        pill.className = "pf-skill-pill";
        pill.textContent = s;
        skillsWrap.appendChild(pill);
      });
      if ((p.skills || []).length > 4) {
        const morePill = document.createElement("span");
        morePill.className = "pf-skill-pill-more";
        morePill.textContent = `+${p.skills.length - 4}`;
        skillsWrap.appendChild(morePill);
      }
    }

    // Hero Quick Meta Card
    text("#pf-card-dept", p.department || p.dept || "CSE (AI & ML)");
    text("#pf-card-cohort", p.cohort || "2024");
    text("#pf-card-uni", p.university || "SR University");

    // Left Column Card 1: About Me
    text("#pf-about-full", p.about_me || p.bio);
    text("#pf-strip-dept", p.department || p.dept || "CSE (AI & ML)");
    text("#pf-strip-cohort", p.cohort || "2024");
    text("#pf-strip-uni", p.university || "SR University");

    // Left Column Card 2: Workshops Attended
    renderWorkshops(p.workshops);

    // Right Column Card 1: Skills & Interests
    renderSkillsAndInterests(p.skills, p.interests);

    // Right Column Card 2: Quick Links
    renderQuickLinks(p);

    // Right Column Card 3: More About Me
    text("#pf-val-langs", p.coding_languages || "Python, JavaScript, C++");
    text("#pf-val-tools", p.tools || "VS Code, Git, Firebase, React");
    text("#pf-val-hobbies", p.hobbies || "Gaming, Photography, Music");

    // Offscreen Export Badge Details
    text("#pf-eb-name", p.name);
    text("#pf-eb-handle", "@" + p.handle);
    text("#pf-eb-dept", p.department || p.dept || "CSE (AI & ML)");
    text("#pf-eb-cohort", p.cohort || "2024");
    text("#pf-eb-uni", p.university || "SR University");
    text("#pf-eb-roll", p.roll_display || p.roll || "2403••••01");
    text("#pf-eb-url", displayUrl(passUrl));
    const ebAvatar = $("#pf-eb-avatar");
    if (ebAvatar) ebAvatar.src = p.photo || avatarSrc(p.avatar || "avatar-03");
    drawBarcode(p.handle);
  }

  function renderWorkshops(workshops) {
    const list = $("#pf-workshop-list");
    const empty = $("#pf-workshop-empty");
    if (!list) return;
    list.replaceChildren();

    const items = Array.isArray(workshops) && workshops.length > 0 ? workshops : [
      {
        title: "Building Web Apps with Firebase",
        date: "2025-10-12",
        date_display: "Oct 12, 2025",
        location: "SR University",
        icon: "firebase",
        cred: "GDG-SRU-FB-2025-01"
      },
      {
        title: "Intro to Machine Learning",
        date: "2025-08-30",
        date_display: "Aug 30, 2025",
        location: "SR University",
        icon: "python",
        cred: "GDG-SRU-ML-2025-02"
      },
      {
        title: "Git & GitHub Basics",
        date: "2025-07-20",
        date_display: "Jul 20, 2025",
        location: "SR University",
        icon: "github",
        cred: "GDG-SRU-GIT-2025-03"
      }
    ];

    if (!items.length) {
      if (empty) empty.hidden = false;
      return;
    }
    if (empty) empty.hidden = true;

    items.forEach((ws) => {
      const li = document.createElement("li");
      li.className = "pf-workshop-item";

      const left = document.createElement("div");
      left.className = "pf-ws-left";

      const iconCircle = document.createElement("div");
      iconCircle.className = "pf-ws-icon-circle";
      iconCircle.innerHTML = getWorkshopIcon(ws);

      const info = document.createElement("div");
      info.className = "pf-ws-info";

      const title = document.createElement("div");
      title.className = "pf-ws-title";
      title.textContent = ws.title;

      const meta = document.createElement("div");
      meta.className = "pf-ws-meta";

      const dateItem = document.createElement("span");
      dateItem.className = "pf-ws-meta-item";
      dateItem.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> <span>${ws.date_display || fmtDate(ws.date) || "Recent"}</span>`;

      const locItem = document.createElement("span");
      locItem.className = "pf-ws-meta-item";
      locItem.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> <span>${ws.location || "SR University"}</span>`;

      meta.append(dateItem, locItem);
      info.append(title, meta);
      left.append(iconCircle, info);

      const link = document.createElement("a");
      link.className = "pf-ws-link";
      link.href = ws.cred ? `/verify/?code=${encodeURIComponent(ws.cred)}` : "/certificates/";
      link.innerHTML = `<span>View Certificate</span> <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;

      li.append(left, link);
      list.appendChild(li);
    });
  }

  function renderSkillsAndInterests(skills, interests) {
    const sWrap = $("#pf-pills-skills");
    const iWrap = $("#pf-pills-interests");

    if (sWrap) {
      sWrap.replaceChildren();
      const allSkills = Array.isArray(skills) && skills.length ? skills : ["Web Dev", "Python", "React", "JavaScript", "UI/UX"];
      allSkills.forEach((s) => {
        const pill = document.createElement("span");
        pill.className = "pf-pill";
        if (s.toLowerCase().includes("ui") || s.toLowerCase().includes("ux")) {
          pill.classList.add("pf-pill-purple");
        } else {
          pill.classList.add("pf-pill-blue");
        }
        pill.textContent = s;
        sWrap.appendChild(pill);
      });
    }

    if (iWrap) {
      iWrap.replaceChildren();
      const allInterests = Array.isArray(interests) && interests.length ? interests : ["Open Source", "Community", "AI/ML", "Product Building"];
      allInterests.forEach((item) => {
        const pill = document.createElement("span");
        pill.className = "pf-pill";
        const low = item.toLowerCase();
        if (low.includes("open source")) pill.classList.add("pf-pill-cyan");
        else if (low.includes("community")) pill.classList.add("pf-pill-green");
        else if (low.includes("product")) pill.classList.add("pf-pill-red");
        else pill.classList.add("pf-pill-blue");
        pill.textContent = item;
        iWrap.appendChild(pill);
      });
    }
  }

  function renderQuickLinks(p) {
    const grid = $("#pf-links-grid");
    if (!grid) return;
    grid.replaceChildren();

    const ghUser = p.github ? p.github.replace(/^https?:\/\/github\.com\//i, "").replace(/\/$/, "") : "gdgsru";
    const links = [
      {
        title: "GitHub",
        href: p.github ? (p.github.startsWith("http") ? p.github : `https://github.com/${ghUser}`) : "https://github.com/gdgsru",
        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/></svg>`
      },
      {
        title: "LinkedIn",
        href: p.linkedin || "https://linkedin.com/company/gdgsru",
        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="#0A66C2"><path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.07v8.37h2.78z"/></svg>`
      },
      {
        title: "Portfolio / Website",
        href: p.portfolio || "https://gdgsru.pages.dev",
        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`
      },
      {
        title: "Email",
        href: p.email ? `mailto:${p.email}` : "mailto:gdgoncampussru@gmail.com",
        icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>`
      }
    ];

    links.forEach((l) => {
      const a = document.createElement("a");
      a.className = "pf-link-card";
      a.href = l.href;
      a.target = "_blank";
      a.rel = "noopener noreferrer";

      a.innerHTML = `
        <div class="pf-link-card-left">
          <div class="pf-link-card-icon">${l.icon}</div>
          <span class="pf-link-card-title">${l.title}</span>
        </div>
        <svg class="pf-link-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      `;
      grid.appendChild(a);
    });
  }

  /* ------------------------------------------------------------------ export: PNG */
  async function exportCardPng() {
    const btn = $("#pf-png");
    const exportCard = $("#pf-card");
    if (!state.profile || !exportCard) return;
    setBusy(btn, true);

    try {
      await loadScript("/assets/vendor/html-to-image.min.js");
      if (!window.htmlToImage) throw new Error("html-to-image unavailable");
      if (document.fonts && document.fonts.ready) await document.fonts.ready;

      // Temporarily reveal export card for capture
      const wrapper = $("#pf-card-export-wrapper");
      wrapper.style.left = "0";
      wrapper.style.top = "0";
      wrapper.style.opacity = "1";
      wrapper.style.zIndex = "-10";

      const dataUrl = await window.htmlToImage.toPng(exportCard, {
        pixelRatio: 3,
        cacheBust: false,
        backgroundColor: "#ffffff"
      });

      wrapper.style.left = "-9999px";
      wrapper.style.top = "-9999px";
      wrapper.style.opacity = "0";

      triggerDownload(dataUrl, `gdg-sru-pass-${state.handle}.png`);
      toast("Member card downloaded as PNG!");
    } catch (err) {
      console.error("PNG export error", err);
      toast("Couldn’t download PNG. Try Print / Laminate.");
    } finally {
      setBusy(btn, false);
    }
  }

  /* ------------------------------------------------------------------ export: ATS Resume PDF */
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
    const p = state.profile;
    if (!p) return;
    if (p.resume_url) {
      window.open(p.resume_url, "_blank", "noopener,noreferrer");
      return;
    }
    const btn = $("#pf-pdf");
    setBusy(btn, true);

    try {
      await loadScript("/assets/vendor/jspdf.umd.min.js");
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF) throw new Error("jsPDF unavailable");

      const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
      doc.setLineHeightFactor(1.25);
      const PW = doc.internal.pageSize.getWidth(), PH = doc.internal.pageSize.getHeight();
      const M = 48, W = PW - M * 2;
      const passUrl = `${location.origin}/u/${p.handle}`;
      const INK = [31, 41, 55], MUTED = [107, 114, 128];
      let y = M;

      const write = (str, o = {}) => {
        const size = o.size || 10;
        doc.setFont("helvetica", o.bold ? "bold" : "normal");
        doc.setFontSize(size);
        doc.setTextColor(...(o.color || INK));
        const lines = doc.splitTextToSize(pdfSafe(str), o.width || W);
        const h = lines.length * size * 1.25;
        doc.text(lines, o.x || M, y + size * 0.9);
        y += h + (o.gap == null ? 3 : o.gap);
      };

      const heading = (label) => {
        y += 10;
        write(label.toUpperCase(), { size: 10, bold: true, gap: 2, color: [26, 115, 232] });
        doc.setDrawColor(218, 220, 224);
        doc.setLineWidth(0.8);
        doc.line(M, y, PW - M, y);
        y += 8;
      };

      // Header
      write(p.name, { size: 24, bold: true, gap: 2 });
      write([p.department, p.cohort ? `Cohort ${p.cohort}` : "", p.university || "SR University"].filter(Boolean).join("  •  "), { size: 11, color: MUTED, gap: 4 });
      write(`Member Profile: ${displayUrl(passUrl)}`, { size: 9.5, color: [26, 115, 232], gap: 8 });

      // Summary / About Me
      heading("About Me");
      write(p.about_me || p.bio, { size: 10, gap: 6 });

      // Technical Skills
      heading("Technical Skills");
      write(`Skills: ${p.skills.join(", ")}`, { size: 10, bold: true, gap: 4 });
      write(`Coding Languages: ${p.coding_languages}`, { size: 10, gap: 4 });
      write(`Tools & Technologies: ${p.tools}`, { size: 10, gap: 4 });

      // Verified Workshops
      if (p.workshops && p.workshops.length) {
        heading("Verified Workshops & Credentials");
        p.workshops.forEach((ws) => {
          write(`${ws.title} (${ws.date_display || ws.date || "Verified"})`, { size: 10.5, bold: true, gap: 2 });
          write(`Issued by GDG on Campus SR University  •  Credential ID: ${ws.cred || "VERIFIED"}`, { size: 9, color: MUTED, gap: 5 });
        });
      }

      triggerDownload(doc.output("bloburl"), `resume-${p.handle}.pdf`);
      toast("ATS Resume downloaded as PDF!");
    } catch (err) {
      console.error("PDF export error", err);
      toast("Couldn’t generate PDF.");
    } finally {
      setBusy(btn, false);
    }
  }

  /* ------------------------------------------------------------------ QR Modal */
  function openQrModal() {
    const p = state.profile;
    if (!p) return;
    const modal = $("#pf-qr-modal");
    const box = $("#pf-qr-box");
    const passUrl = `${location.origin}/u/${p.handle}`;
    text("#pf-qr-url", passUrl);

    if (box) {
      if (typeof window.qrSvg === "function") {
        box.innerHTML = window.qrSvg(passUrl, { margin: 1 });
      } else {
        box.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(passUrl)}" alt="QR code" width="220" height="220" style="margin:0 auto;display:block;" />`;
      }
    }

    if (modal && typeof modal.showModal === "function") {
      modal.showModal();
    }
  }

  /* ------------------------------------------------------------------ events */
  function bindEvents() {
    // PNG Download
    const pngBtn = $("#pf-png");
    if (pngBtn) pngBtn.addEventListener("click", exportCardPng);

    // PDF Resume Download
    const pdfBtn = $("#pf-pdf");
    if (pdfBtn) pdfBtn.addEventListener("click", exportAtsPdf);

    // Print
    const printBtn = $("#pf-print");
    if (printBtn) printBtn.addEventListener("click", () => window.print());

    // Copy Link
    const copyBtn = $("#pf-copy");
    if (copyBtn) {
      copyBtn.addEventListener("click", async () => {
        const passUrl = `${location.origin}/u/${state.handle}`;
        try {
          await navigator.clipboard.writeText(passUrl);
          toast("Profile link copied to clipboard!");
        } catch (_) {
          toast("Link: " + passUrl);
        }
      });
    }

    // QR Modal Open
    const qrBtn = $("#pf-qr");
    if (qrBtn) qrBtn.addEventListener("click", openQrModal);

    // QR Modal Copy
    const qrCopy = $("#pf-qr-copy");
    if (qrCopy) {
      qrCopy.addEventListener("click", async () => {
        const passUrl = `${location.origin}/u/${state.handle}`;
        try {
          await navigator.clipboard.writeText(passUrl);
          toast("Link copied to clipboard!");
        } catch (_) {
          toast("Link: " + passUrl);
        }
      });
    }

    // Search members button (Command palette)
    const searchBtn = $("#pf-search");
    if (searchBtn) {
      searchBtn.addEventListener("click", () => {
        if (typeof window.openPalette === "function") {
          window.openPalette();
        } else {
          location.href = "/members/";
        }
      });
    }

    // Theme toggle via user avatar
    const userAvatar = $("#pf-user-avatar");
    if (userAvatar) {
      userAvatar.addEventListener("click", () => {
        const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = cur;
        try { localStorage.setItem("gdg-theme", cur); } catch (_) {}
        toast(`Theme switched to ${cur}`);
      });
    }

    // Notifications button
    const notifBtn = $("#pf-notifications");
    if (notifBtn) {
      notifBtn.addEventListener("click", () => {
        toast("No unread announcements right now.");
      });
    }

    // More About Me Accordion Toggle
    const moreToggle = $("#pf-more-toggle");
    const moreContent = $("#pf-more-content");
    if (moreToggle && moreContent) {
      moreToggle.addEventListener("click", () => {
        const isExpanded = moreToggle.getAttribute("aria-expanded") === "true";
        moreToggle.setAttribute("aria-expanded", String(!isExpanded));
        moreContent.hidden = isExpanded;
      });
    }
  }

  /* ------------------------------------------------------------------ admin bridge */
  function isAdminLoggedIn() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.includes("auth-token") || k.includes("mc_admin") || k === "supabase.auth.token")) {
          const val = localStorage.getItem(k);
          if (val && (val.includes("access_token") || val.includes("user"))) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function renderAdminEditButton(handle) {
    if (!isAdminLoggedIn()) return;
    let pill = $("#pf-admin-edit-pill");
    if (!pill) {
      pill = document.createElement("a");
      pill.id = "pf-admin-edit-pill";
      pill.className = "pf-admin-edit-pill";
      pill.target = "_blank";
      pill.rel = "noopener";
      pill.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg><span>Edit Profile in Admin</span>`;
      document.body.appendChild(pill);
    }
    pill.href = `/admin/#/member-profiles?edit=${encodeURIComponent(handle)}`;
  }

  /* ------------------------------------------------------------------ init */
  async function init() {
    bindEvents();

    const handle = getHandle();
    state.handle = handle;

    if (!handle) {
      show("empty");
      return;
    }

    show("loading");

    const [staticProfile, overrides] = await Promise.all([
      fetchProfile(handle),
      fetchOverrides(handle)
    ]);

    if (!staticProfile && !overrides) {
      text("#pf-nf-handle", "@" + handle);
      show("notfound");
      return;
    }

    const profile = staticProfile || { handle };
    if (overrides) {
      Object.assign(profile, overrides);
    }

    if (profile.hidden) {
      show("withdrawn");
      return;
    }

    renderProfile(profile);
    show("content");
    renderAdminEditButton(handle);

    // Fetch live Supabase stats if available
    try {
      const stats = await fetchStats(handle);
      if (stats) {
        if (stats.hidden) {
          show("withdrawn");
          return;
        }
        state.stats = stats;
        if (Array.isArray(stats.workshops) && stats.workshops.length && !profile.workshops?.length) {
          profile.workshops = stats.workshops;
          renderWorkshops(stats.workshops);
        }
      }
    } catch (_) {}
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
