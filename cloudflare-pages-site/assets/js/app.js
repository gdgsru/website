const $ = (e) => document.querySelector(e),
  K = { b: "#4285F4", g: "#34A853", y: "#F9AB00", r: "#EA4335" },
  TN = { b: "tb", g: "tg", y: "ty", r: "tr" },
  KS = "bgyr";
function sh(e, t = 28) {
  let a = "";
  if (
    ("b" == e &&
      (a =
        '<circle cx="12" cy="12" r="12" fill="#4285F4"/><path d="M12 4c.6 4.7 3.3 7.4 8 8-4.700.6-7.400 3.300-8 8-.6-4.700-3.300-7.400-8-8 4.700-.6 7.400-3.300 8-8z" fill="#fff"/>'),
    "g" == e &&
      (a =
        '<circle cx="12" cy="12" r="12" fill="#34A853"/><path d="M5.500 11a6.500 6.500 0 0113 0z" fill="#fff"/>'),
    "y" == e)
  ) {
    for (let e = 0; e < 8; e++)
      a += `<circle cx="${12 + 7.2 * Math.cos((e * Math.PI) / 4)}" cy="${12 + 7.2 * Math.sin((e * Math.PI) / 4)}" r="3.600" fill="#F9AB00"/>`;
    a +=
      '<circle cx="12" cy="12" r="7" fill="#F9AB00"/><circle cx="12" cy="12" r="2.800" fill="#fff"/>';
  }
  return (
    "r" == e &&
      (a = [0, 60, 120]
        .map(
          (e) =>
            `<path d="M12 2.500v19" stroke="#EA4335" stroke-width="4" stroke-linecap="round" transform="rotate(${e} 12 12)"/>`,
        )
        .join("")),
    `<svg width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true">${a}</svg>`
  );
}
const N = [
  ["home", "Home", 1],
  ["events", "Events", 1],
  ["team", "Team", 1],
  ["blogs", "Blog", 1],
  ["join", "Join", 1],
  ["certificates", "Certificates", 2],
  ["verify", "Verify", 2],
  ["leaderboard", "Leaderboard", 2],
  ["perks", "Resource Hub", 2],
  ["privacy", "Privacy", 2],
];
function gdgMultiPageRouteValue() {
  if (!window.GDG_MULTIPAGE) return location.hash.slice(1) || "home";
  const e = document.body.dataset.route || "home";
  if ("event-detail" === e) {
    let e = new URL(location.href).searchParams.get("slug") || "";
    const t = location.pathname.match(/^\/events\/([^/]+)\/?$/);
    return (
      !e && t && (e = decodeURIComponent(t[1])),
      (window.__GDG_EVENT_SLUG = e),
      e ? "events/" + e : "events"
    );
  }
  if ("verify" === e) {
    let e = new URL(location.href).searchParams.get("code") || "";
    const t = location.pathname.match(/^\/verify\/([^/]+)\/?$/);
    return (
      !e && t && (e = decodeURIComponent(t[1])),
      (window.__GDG_VERIFICATION_CODE = e),
      e ? "verify/" + e : "verify"
    );
  }
  return "home" === e && "#home-blogs" === location.hash ? "home-blogs" : e;
}
function rewriteGdgMultiPageLinks(e = document) {
  if (!window.GDG_MULTIPAGE) return;
  const t = [];
  (e?.matches?.('a[href^="#"]') && t.push(e),
    e?.querySelectorAll?.('a[href^="#"]').forEach((e) => t.push(e)));
  for (const e of t) {
    const t = (e.getAttribute("href") || "").slice(1);
    if (!t) continue;
    const a = t.split("/")[0];
    if (
      !Object.prototype.hasOwnProperty.call(window.GDG_ROUTE_PATHS, a) &&
      !["home-blogs"].includes(a)
    )
      continue;
    const s = window.GDG_ROUTE_HREF(t);
    s && e.setAttribute("href", s);
  }
}
((window.N = N),
  (window.GDG_MULTIPAGE = "true" === document.body.dataset.multipage),
  (window.GDG_ROUTE_PATHS = {
    home: "/",
    events: "/events/",
    team: "/team/",
    blogs: "/blog/",
    blog: "/blog/",
    join: "/join/",
    contact: "/join/",
    certificates: "/certificates/",
    verify: "/verify/",
    leaderboard: "/leaderboard/",
    perks: "/resources/",
    resources: "/resources/",
    privacy: "/privacy/",
    "easter-eggs": "/easter-eggs/",
    wheel: "/wheel/",
    about: "/",
    gallery: "/events/",
    404: "/404.html",
  }),
  (window.GDG_ROUTE_HREF = function (e) {
    const t = String(e || "").replace(/^#/, "");
    if ("home-blogs" === t) return "/#home-blogs";
    const a = t.split("/"),
      s = a.shift(),
      i = a.join("/");
    return "events" === s && i
      ? "/event.html?slug=" + encodeURIComponent(i)
      : "verify" === s && i
        ? "/verify/?code=" + encodeURIComponent(i)
        : window.GDG_ROUTE_PATHS[s] || "";
  }),
  (window.GDG_CURRENT_ROUTE = function () {
    return (gdgMultiPageRouteValue() || "home").split("/")[0];
  }),
  document.addEventListener(
    "click",
    (e) => {
      if (!window.GDG_MULTIPAGE) return;
      const t = e.target?.closest?.("a[href]");
      if (!t) return;
      const a = t.getAttribute("href") || "";
      if (!a.startsWith("#")) return;
      const s = window.GDG_ROUTE_HREF(a);
      s && (e.preventDefault(), window.location.assign(s));
    },
    !0,
  ));
const pc = { 1: "b", 2: "r", 3: "g" },
  RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
RM || document.documentElement.classList.add("fx");
const esc = (e) =>
    String(e).replace(
      /[&<>"']/g,
      (e) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[e],
    ),
  wd = (e, t = 0) =>
    e
      .split(" ")
      .map((e, a) => `<span class="hw" style="--i:${t + a}">${e}</span>`)
      .join(" "),
  bt = (e, t) => `<button class="btn${t ? " o" : ""}">${e}</button>`,
  ph = (e, t, a, s, i) =>
    `<section class="page-intro page-phase-${e}"><div class="page-intro-meta"><span class="bd"><i style="background:var(--${"b" == pc[e] ? "b" : "r" == pc[e] ? "r" : "g"})"></i>Phase ${e}</span><span class="cap">${t}</span></div><h1>${wd(a)}<em>${wd(s, a.split(" ").length)}</em></h1><p class="lead">${i}</p><span class="page-intro-index" aria-hidden="true">SRU / ${String(e).padStart(2, "0")}</span></section>`,
  sec = (e, t, a, s) =>
    `<div class="sc"><span>${sh(e, 34)}</span><h2>${t}<sup>${a}</sup></h2><p>${s}</p></div>`,
  gd = (e) => `<div class="grid">${e.join("")}</div>`,
  sty = (e) => `style="--tc:var(--${TN[e]});--cc:${K[e]}"`,
  mq = (e, t) => {
    let a = "";
    for (let s = 0; s < 4; s++)
      e.forEach(
        (e, s) => (a += `<span>${e}</span>${sh(KS[s % 4], t ? 26 : 44)}`),
      );
    return a;
  },
  lookup = async (e) => {
    const t = (e || "").toUpperCase().trim();
    if (!/^GDGSRU-(?:\d{2}-)?[A-F0-9]{12,16}$/.test(t))
      return { status: "not_found", record: null };
    let a = null;
    try {
      if (window.supabaseClient) a = window.supabaseClient;
      else {
        const e = localStorage.getItem("gdg_supabase_url"),
          t = localStorage.getItem("gdg_supabase_anon_key");
        e &&
          t &&
          window.supabase &&
          "function" == typeof window.supabase.createClient &&
          ((window.supabaseClient = window.supabase.createClient(e, t)),
          (a = window.supabaseClient));
      }
    } catch (err) {
      console.warn("[App] Operation notice:", err);
    }
    if (a)
      try {
        const { data: e, error: s } = await a.rpc("verify_certificate", {
          p_code: t,
        });
        if (!s && Array.isArray(e) && e.length > 0) {
          const a = e[0];
          return {
            status: "revoked" === a.status ? "revoked" : "valid",
            record: {
              id: a.certificate_code || t,
              name: a.recipient_name,
              ev: a.event_title,
              date: a.issue_date || "",
            },
          };
        }
        if (!s && Array.isArray(e) && 0 === e.length)
          return { status: "not_found", record: null };
        if (s)
          return (
            console.warn("[GDG Cert] Verification endpoint error:", s),
            { status: "error", record: null }
          );
      } catch (e) {
        return (
          console.error(
            "[GDG Cert] Network connectivity error during verification:",
            e,
          ),
          { status: "error", record: null }
        );
      }
    return { status: "error", record: null };
  },
  vurl = (e) =>
    window.GDG_MULTIPAGE
      ? `${location.origin}/verify/?code=${encodeURIComponent(e)}`
      : location.href.split("#")[0] + "#verify/" + e,
  fb = (e, t, a) =>
    `<div class="fb" data-k="${e}" role="group" aria-label="${t}">${a.map((e, t) => `<button type="button" class="btn${t ? " o" : ""}" data-v="${e[0]}" aria-pressed="${!t}">${e[1]}</button>`).join("")}</div>`,
  fg = (e, t) =>
    `<div class="gw"><div class="grid">${e.join("")}</div><div class="em" hidden><p>${t}</p><button type="button" class="btn o" data-reset>Show all</button></div></div>`,
  fs = (e, t) =>
    `<div data-fs data-noun="${e}">${t}<p class="cap" data-ct aria-live="polite"></p></div>`,
  vcard = (e) => {
    let t = e || "";
    try {
      t = decodeURIComponent(t);
    } catch (err) {
      console.warn("[App] Operation notice:", err);
    }
    const a = String(t).toUpperCase().trim();
    return (
      Promise.resolve()
        .then(async () => {
          const e = document.getElementById("vcard-async-box");
          if (!e) return;
          if (!/^GDGSRU-(?:\d{2}-)?[A-F0-9]{12,16}$/.test(a))
            return void (e.innerHTML =
              '<span class="tag t4">Certificate ID required</span><h2>No verification performed</h2><p>Use the exact certificate ID printed on the certificate.</p>');
          const t = await lookup(a),
            s = document.getElementById("vcard-async-box");
          s &&
            ("valid" === t.status && t.record
              ? (s.outerHTML = foundCard(t.record))
              : "revoked" === t.status
                ? (s.innerHTML = `<span class="tag t2">Revoked Certificate</span><h2>Certificate revoked</h2><p>Certificate ID <b>${esc(a)}</b> has been revoked. Contact the chapter team if you believe this is an error.</p>`)
                : "not_found" === t.status
                  ? (s.innerHTML = `<span class="tag t4">Record not found</span><h2>No verified certificate found</h2><p>No issued certificate matches ID <b>${esc(a)}</b>.</p>`)
                  : (s.innerHTML =
                      '<span class="tag t4">Verification unavailable</span><h2>Could not verify certificate</h2><p>The verification service could not be reached. This does not establish that the certificate is invalid.</p>'));
        })
        .catch(() => {
          const e = document.getElementById("vcard-async-box");
          e && (e.textContent = "Verification is temporarily unavailable.");
        }),
      '<div class="card" id="vcard-async-box" style="max-width:620px;text-align:center"><span class="tag t4">Certificate verification</span><h2>Checking certificate…</h2><p>Checking the official registry. This page does not trust locally stored certificate records.</p></div>'
    );
  },
  PKM = [
    {
      k: "b",
      n: "01",
      tag: "LEARN",
      t: "Learn together",
      d: "Join workshops, study jams, and peer-led sessions.",
      ico: '<path d="M25 44c-1-4-2-6-5-9a15 15 0 1 1 24 0c-3 3-4 5-5 9z"/><path d="M26 49h12M28 54h8"/><path d="M50 8c.4 3.200 2 4.800 5.200 5.200-3.200.4-4.800 2-5.200 5.200-.4-3.200-2-4.800-5.200-5.200C48 12.800 49.600 11.200 50 8z"/>',
    },
    {
      k: "r",
      n: "02",
      tag: "BUILD",
      t: "Build something",
      d: "Turn an idea into a project with fellow students.",
      ico: '<path d="M22 14L5 32l17 18M42 14l17 18-17 18"/><path d="M36 8l-8 48"/>',
    },
    {
      k: "y",
      n: "03",
      tag: "EXPLORE",
      t: "Explore technology",
      d: "Try Google technologies, tools, and new ideas hands-on.",
      ico: '<path d="M53 8c-14 1-25 9-30 23l10 10c14-5 21-16 20-33z"/><path d="M23 31l-9-2 4-8 9-1M33 41l2 9 8-4 1-9"/><circle cx="41" cy="23" r="4"/><path d="M4 54c8 2 15-1 19-9" stroke-dasharray="3 4"/>',
    },
    {
      k: "g",
      n: "04",
      tag: "CONNECT",
      t: "Grow together",
      d: "Meet collaborators, share what you learn, and help others.",
      ico: '<circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="52" r="4.500"/><path d="M12 16.500v31"/><path d="M12 34l18-14M12 34l22 14"/><circle cx="30" cy="20" r="0.1"/><circle cx="52" cy="26" r="2.600" fill="currentColor"/><circle cx="52" cy="44" r="2.600" fill="currentColor"/>',
    },
  ],
  PK_START = 0,
  pkSection = () =>
    `<section class="pk" id="playground"><div class="pk-h"><span class="cap">Find your way into tech</span><h2>Learn together.<br>Build boldly.<br><em>Grow here.</em></h2><p>At GDG on Campus SR University, you can start with a question, a project, or a person you meet. Choose a path below to see how to get involved.</p></div>\n<div class="pk-stage"><div class="pk-glyph pk-m-${PKM[0].k}" aria-hidden="true"><div class="pk-bld"><i class="pk-bld-glow"></i><i class="pk-bld-grid"></i><img class="pk-bld-img" src="/assets/images/hero-building.webp" alt="SR University Campus Building" width="1280" height="640" loading="lazy" decoding="async"><i class="pk-bld-d d1"></i><i class="pk-bld-d d2"></i><i class="pk-bld-d d3"></i><i class="pk-bld-d d4"></i><i class="pk-bld-beam"></i><i class="pk-bld-floor"></i><span class="pk-chip c-b"><b>01</b>Learn</span><span class="pk-chip c-r"><b>02</b>Build</span><span class="pk-chip c-y"><b>03</b>Explore</span><span class="pk-chip c-g"><b>04</b>Connect</span><span class="pk-bld-tag"><b></b>SR University &middot; where it happens</span></div><i class="pk-spark a">✦</i><i class="pk-spark b">✦</i><i class="pk-spark c">✦</i></div>\n</div>\n<div class="pk-deck">${PKM.map((e, t) => GDG16.info({ el: "button", cls: "g16-pkcard" + (0 === t ? " on" : ""), attrs: `data-i="${t}" aria-pressed="${0 === t}"`, key: e.k, icon: ["book", "code", "spark", "users"][t], num: e.tag, title: e.t, text: e.d })).join("")}</div></section>`,
  P = {
    home: () =>
      `<section class="hero hero-copy home-hero hero-reference">\n  <div class="hero-reference-copy">\n    <div class="hero-eyebrow"><span class="hero-code">&lt;/&gt;</span><span>GDG ON CAMPUS <i>·</i> SR UNIVERSITY</span></div>\n    <h1 class="home-hero-title"><span>Build.</span><span>Learn.</span><span class="hero-blue-word">Connect.</span></h1>\n    <p class="lead hero-reference-lead">A community of curious minds, passionate builders and future problem solvers. Learn new technologies, create things that matter, and grow together at SR University.</p>\n    <div class="home-hero-actions"><a class="btn" id="hero-discord-btn" href="#join">Join the Community <span aria-hidden="true">↗</span></a><a class="btn o" href="#events">Explore events <span aria-hidden="true">→</span></a></div>\n    <div class="hero-social-proof"><div class="avatar-stack"><i>✦</i><i>⌘</i><i>◉</i></div><div><strong>Curious minds. Shared momentum.</strong><small>Students · Builders · Community</small></div><span class="hero-proof-spark">✳</span></div>\n  </div>\n  <div class="hero-reference-art">\n    <div class="hero-art-sun"></div><div class="hero-art-cloud"></div>\n    <div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div>\n    <div class="hero-art-label label-learn"><span class="art-glyph blue-glyph">✧</span><span><b>Learn</b><small>Workshops · Study Jams · Talks</small></span></div>\n    <div class="hero-art-label label-build"><span class="art-glyph green-glyph">&lt;/&gt;</span><span><b>Build</b><small>Projects · Hackathons · Demos</small></span></div>\n    <div class="hero-art-label label-explore"><span class="art-glyph yellow-glyph">✦</span><span><b>Explore</b><small>New Tech · Career Guidance</small></span></div>\n    <div class="hero-art-label label-connect"><span class="art-glyph red-glyph">♧</span><span><b>Connect</b><small>Community · Mentorship · Friends</small></span></div>\n    \n    <div class="hero-art-caption"><span class="caption-dot"></span> IDEAS IN MOTION <span>SRU / INDIA</span></div>\n  </div>\n</section>\n<div class="info info-coming-soon" aria-label="Chapter updates">\n  <div><span class="cap">Next session</span><br><b id="next-event-label">Coming soon</b></div>\n  <div><span class="cap">Updates</span><br><b id="event-venue-label">Official chapter page</b></div>\n  <div id="countdown-cell" hidden><span class="cap">Countdown</span><br><b id="cd" aria-live="off"></b></div>\n</div>\n<section class="discord-first-promo card" aria-labelledby="discord-first-title">\n  <div class="discord-promo-mark" aria-hidden="true"><svg viewBox="0 0 64 48" role="img"><path fill="currentColor" d="M51 7A48 48 0 0 0 39 3l-1.5 3a43 43 0 0 0-11 0L25 3a48 48 0 0 0-12 4C5 18 3 29 4 40a48 48 0 0 0 15 7l3-5-5-2 1.3-1a33 33 0 0 0 27.4 0l1.3 1-5 2 3 5a48 48 0 0 0 15-7C61 27 58 16 51 7ZM23 32c-3 0-5-3-5-6s2-5 5-5 5 3 5 5-2 6-5 6Zm18 0c-3 0-5-3-5-6s2-5 5-5 5 3 5 5-2 6-5 6Z"/></svg></div>\n  <div class="discord-promo-copy"><span class="cap">THE COMMUNITY HAPPENS HERE</span><h2 id="discord-first-title">Your next idea starts on <em>Discord.</em></h2><p>We’re making Discord our go-to space for chapter announcements, event updates, questions, study groups, project teams, and finding people to build with. Join in, say hello, and be part of what happens next.</p>\n  <div class="discord-promo-tags"><span># announcements</span><span>study & help</span><span>project teams</span><span>event updates</span></div></div>\n  <a class="discord-promo-cta" href="https://discord.gg/htSJMNcdZs" target="_blank" rel="noopener">Join the Discord <span aria-hidden="true">↗</span></a>\n</section>\n\n<div class="rb"><div>${mq(["Learn it", "Build it", "Ship it", "Grow it"])}</div></div><div class="rb2"><div>${mq(["Gemini", "AI agents", "Google Cloud", "Firebase", "Open source", "Android"], 1)}</div></div>\n<div class="st">${[
        ["Learn", "with your peers"],
        ["Build", "real projects"],
        ["Connect", "on campus"],
      ]
        .map((e) => `<div><b>${e[0]}</b><span>${e[1]}</span></div>`)
        .join(
          "",
        )}</div>\n${pkSection()}\n<section class="home-about-merged" id="about-the-chapter" style="margin:clamp(56px,8vw,104px) 0 36px">\n  <div class="editorial-collections-head"><div><span class="cap">ABOUT THE CHAPTER</span><h2>Curiosity becomes <em>community.</em></h2></div><p>GDG on Campus at SR University brings students together to learn technologies, build projects, and grow through a welcoming developer community.</p></div>\n  <section class="card pp reference-card pk-b" style="margin-top:22px;padding:clamp(22px,3.4vw,38px);border:1px solid var(--ln);border-radius:26px;background:var(--cd)">\n    <h3 style="font-size:clamp(25px,3vw,38px);letter-spacing:-.05em;margin:0 0 22px">What we do</h3>\n    <div class="grid g16-row">${GDG16.infoItems(
        [
          {
            key: "b",
            icon: "book",
            title: "Learn",
            text: "Workshops, technical sessions, study jams, and practical learning experiences.",
          },
          {
            key: "r",
            icon: "code",
            title: "Build",
            text: "Projects, coding challenges, and collaborative experiments that turn ideas into working things.",
          },
          {
            key: "g",
            icon: "users",
            title: "Connect",
            text: "Meet fellow students, learn from speakers, and find collaborators across the campus.",
          },
        ],
      )}</div>\n    <p style="max-width:70ch;margin:22px 0 0;color:var(--mut)">Our goal is to make developer learning approachable and community-led. You do not need to be an expert to get started.</p>\n    <a class="btn" href="#join">Join the community →</a>\n  </section>\n</section>\n<section class="blog-home" id="home-blogs">\n  <div class="blog-home-head">\n    <div><span class="cap">FROM THE COMMUNITY</span><h2>Build. Write. <em>Share.</em></h2><p>Notes, guides and build stories from developers at SR University.</p></div>\n    <a class="btn o" href="/blog/">View all blogs →</a>\n  </div>\n  <div class="blog-home-grid g16-row">\n    <div class="blog-latest-empty"><b>The first stories are on their way.</b><p>Have a build log, a tutorial or a lesson worth sharing? Pitch it to the team and it could be the first one featured here.</p><a class="btn" href="mailto:gdg@sru.edu.in?subject=GDG%20SRU%20blog%20idea">Pitch a story ↗</a></div>\n  </div>\n</section>\n${sec("b", "Pick your track", "04", "Four ways to get started.")}<div id="home-tracks"></div>\n\n${sec("g", "How it works", "03", "Join, attend, get recognized.")}<div class="grid g16-row">${GDG16.infoItems(
        [
          {
            key: "b",
            icon: "users",
            num: "01",
            title: "Join",
            text: "Register on the community page and join Discord.",
          },
          {
            key: "y",
            icon: "cal",
            num: "02",
            title: "Attend",
            text: "Scan your QR at the door and earn points.",
          },
          {
            key: "g",
            icon: "star",
            num: "03",
            title: "Get recognized",
            text: "Download your certificate and climb the leaderboard.",
          },
        ],
      )}</div>`,
    404: () =>
      ph(
        1,
        "Page not found",
        "This page",
        "isn't here.",
        "The link may be outdated or the page may have moved.",
      ) +
      '<section class="card pp" style="margin-top:24px"><p>Head back to the homepage or browse the chapter\'s current pages.</p><a class="btn" href="#home">Back to home →</a> <a class="btn o" href="#events">Explore events</a></section>',
    about: () =>
      ph(
        1,
        "Inside the community",
        "A campus full of",
        "possibility.",
        "GDG on Campus at SR University is a student-led space to explore technology, learn by doing, and find people who make ambitious ideas feel possible.",
      ) +
      `<section class="card pp about-feature-grid"><div class="about-feature about-blue"><span class="feature-symbol">${sh("b", 54)}</span><span class="cap">01 / LEARN</span><h2>Curiosity comes first.</h2><p>Workshops, study jams, talks and hands-on sessions that make new technology easier to explore.</p></div><div class="about-feature about-green"><span class="feature-symbol">${sh("g", 54)}</span><span class="cap">02 / BUILD</span><h2>Make ideas real.</h2><p>Collaborate on projects, experiment with tools, and learn from the things you ship.</p></div><div class="about-feature about-yellow"><span class="feature-symbol">${sh("y", 54)}</span><span class="cap">03 / CONNECT</span><h2>Grow together.</h2><p>Meet peers, find collaborators, and make your campus experience more connected.</p></div></section><section class="card pp about-manifesto"><span class="cap">OUR POINT OF VIEW</span><h2>Not just learning about technology.<br><em>Learning by making things.</em></h2><a class="btn" href="#events">Find your next session ↗</a></section>`,
    gallery: () =>
      ph(
        1,
        "Community in moments",
        "A little of what",
        "we make together.",
        "Workshops, project nights, talks, demos and the small moments that turn a campus into a community.",
      ) +
      '<section class="gallery-toolbar"><span class="cap">FIELD NOTES / SRU</span><span class="gallery-hint">Hover a frame · tap to expand</span></section><section class="gallery-mosaic"><button class="gallery-tile gallery-tall gallery-blue" data-gallery="Workshop days"><span class="gallery-tile-top">01 / LEARN</span><span class="gallery-visual"><span class="gallery-orbit"></span><b>Workshop<br>days.</b><i>✳</i></span><span class="gallery-tile-bottom">Learn something new <b>↗</b></span></button><button class="gallery-tile gallery-green" data-gallery="Build nights"><span class="gallery-tile-top">02 / BUILD</span><span class="gallery-visual"><b>Build<br>nights.</b><i>&lt;/&gt;</i></span><span class="gallery-tile-bottom">Ideas take shape <b>↗</b></span></button><button class="gallery-tile gallery-yellow" data-gallery="People and ideas"><span class="gallery-tile-top">03 / CONNECT</span><span class="gallery-visual"><b>People &<br>ideas.</b><i>◉</i></span><span class="gallery-tile-bottom">Better together <b>↗</b></span></button><button class="gallery-tile gallery-red" data-gallery="Demo day"><span class="gallery-tile-top">04 / SHARE</span><span class="gallery-visual"><b>Demo<br>day.</b><i>↗</i></span><span class="gallery-tile-bottom">Show what you made <b>↗</b></span></button><button class="gallery-tile gallery-wide" data-gallery="The community"><span class="gallery-tile-top">05 / COMMUNITY ARCHIVE</span><span class="gallery-visual"><i>✦</i><b>Made by curious people,<br>one moment at a time.</b></span><span class="gallery-tile-bottom">More memories coming soon <b>↗</b></span></button></section><div class="gallery-modal" id="gallery-modal" aria-hidden="true"><button class="gallery-modal-close" aria-label="Close gallery preview">×</button><div class="gallery-modal-art"></div><h2></h2><p>Community moments from GDG on Campus · SR University.</p></div>',
    join: () =>
      ph(
        1,
        "Join & contact",
        "Your next",
        "build starts here.",
        "Join the GDG SRU community, find upcoming sessions, or reach the chapter team about collaborations, speakers, and questions.",
      ) +
      `<section class="card pp reference-card pk-b" style="margin-top:28px"><h2>Choose how to connect</h2><div class="grid g16-row">${GDG16.infoItems(
        [
          {
            key: "b",
            icon: "chat",
            title: "Developer community",
            text: "Join our community space for announcements, discussions, collaboration, and event updates.",
            actions: [
              {
                label: "Join Discord",
                href: "https://discord.gg/htSJMNcdZs",
                ext: 1,
                cls: "gdg-discord-link",
              },
            ],
          },
          {
            key: "g",
            icon: "link",
            title: "Official chapter page",
            text: "Follow the official Google Developer community chapter page for events and registration opportunities.",
            actions: [
              {
                label: "Open chapter page",
                href: "https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/",
                ext: 1,
              },
            ],
          },
        ],
      )}</div><p>Students at every experience level are welcome. Start by joining the community and attending a session.</p></section>\n<section class="card pp gdg-pass-teaser" id="gdg-pass-teaser" style="margin-top:24px"><div class="gdg-pass-grid"><div class="gdg-pass-info"><div class="gdg-pass-pill"><span class="gdg-pass-dots" aria-hidden="true"><i style="background:#4285F4"></i><i style="background:#EA4335"></i><i style="background:#FBBC04"></i><i style="background:#34A853"></i></span>OFFICIAL MEMBER CREDENTIAL · 2026</div><h2 class="gdg-pass-title">I’m officially a member<br>of <span class="c-b">Google </span><span class="c-w">Developer</span><br><span class="c-y">Group </span><span class="c-r">on Campus</span></h2><div class="gdg-pass-univ">SR UNIVERSITY</div><div class="gdg-pass-chips"><span>AI &amp; Machine Learning</span><span>#BuildWithGoogle</span></div><p class="gdg-pass-desc">Claim your customized 3D holographic conference pass and generate your ready-to-share 1200×627 LinkedIn credential card in 1 click.</p><div class="gdg-pass-actions"><a class="btn gdg-btn-launch" href="/member-badge/">Launch Member Pass Studio <span aria-hidden="true">↗</span></a><a class="btn o gdg-btn-gateway" href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener">Join Official Chapter ↗</a></div></div><div class="gdg-pass-visual"><a href="/member-badge/" class="gdg-mini-card-link" title="Open Full 3D Member Pass Studio"><div class="gdg-mini-pass"><div class="gdg-mini-slot"></div><div class="gdg-mini-bar"><i></i><i></i><i></i><i></i></div><div class="gdg-mini-top"><span class="gdg-mini-dots"><b></b><b></b><b></b><b></b></span><div class="gdg-mini-brandtxt"><b>Google Developer Group</b><span><u>on Campus</u>SR UNIVERSITY</span></div></div><div class="gdg-mini-hero"><div class="gdg-mini-ring"><div class="gdg-mini-av">&lt;/&gt;</div></div><div class="gdg-mini-name">SRU Developer</div><div class="gdg-mini-roll">26-SRU-MEMBER</div><div class="gdg-mini-track">AI &amp; Machine Learning</div></div><div class="gdg-mini-perf"><hr></div><div class="gdg-mini-foot"><div><small>GOOGLE DEVELOPER GROUP ON CAMPUS</small><strong>SR University · 2026</strong><span class="gdg-mini-pass-tag">MEMBER PASS</span></div><div class="gdg-mini-qr"><svg viewBox="0 0 21 21" shape-rendering="crispEdges"><rect x="0" y="0" width="7" height="7" fill="#070a18"/><rect x="1" y="1" width="5" height="5" fill="#fff"/><rect x="2" y="2" width="3" height="3" fill="#070a18"/><rect x="14" y="0" width="7" height="7" fill="#070a18"/><rect x="15" y="1" width="5" height="5" fill="#fff"/><rect x="16" y="2" width="3" height="3" fill="#070a18"/><rect x="0" y="14" width="7" height="7" fill="#070a18"/><rect x="1" y="15" width="5" height="5" fill="#fff"/><rect x="2" y="16" width="3" height="3" fill="#070a18"/><rect x="9" y="3" width="2" height="3" fill="#070a18"/><rect x="9" y="9" width="3" height="3" fill="#070a18"/><rect x="3" y="9" width="3" height="2" fill="#070a18"/><rect x="15" y="9" width="3" height="3" fill="#070a18"/><rect x="9" y="15" width="3" height="2" fill="#070a18"/></svg></div></div><div class="gdg-mini-overlay-badge">Customize ↗</div></div></a></div></div></section>\n          <section class="card pp join-contact-section" id="contact-the-chapter" style="margin-top:22px;max-width:none"><span class="cap">NEED TO ASK SOMETHING?</span><h2 style="margin:8px 0 12px;font-size:clamp(30px,4vw,44px);letter-spacing:-.06em">Let's talk tech.</h2><p>For general questions, collaborations, speaker proposals, and community support, email the chapter team.</p><p><a class="btn" href="mailto:gdg@sru.edu.in?subject=GDG%20on%20Campus%20enquiry">Email gdg@sru.edu.in ↗</a></p><p style="color:var(--mut)">For event registration and updates, use the official chapter page. Please do not send passwords or sensitive personal information by email.</p><p class="join-contact-links"><a class="btn o" href="https://www.instagram.com/gdg_sru/" target="_blank" rel="noopener">Instagram ↗</a> <a class="btn o" href="https://www.linkedin.com/company/gdg-sru/home/" target="_blank" rel="noopener">LinkedIn ↗</a></p></section>`,
    wheel: () =>
      ph(
        1,
        "Launch-day draw",
        "The prize",
        "wheel.",
        "Watch the number reel and the wheel. The winning number and prize appear here as soon as the team stops the spin.",
      ) +
      '<section class="card egg-panel wheel-panel" id="wheel-root" aria-live="polite"><span class="cap" id="wheel-status">Waiting for the spin</span><p class="wheel-reel" id="wheel-reel" aria-hidden="true">---</p><div class="wheel-stage"><svg id="wheel-svg" viewBox="-100 -100 200 200" role="img" aria-label="Prize wheel"></svg><span class="wheel-pointer" aria-hidden="true"></span></div><p class="wheel-result" id="wheel-result" hidden></p><p class="wheel-meta" id="wheel-meta"></p></section>',
    "easter-eggs": () =>
      ph(
        1,
        "Launch-day hunt",
        "Find the eggs",
        "across the site.",
        "Read the rules, follow the countdown, and track the eggs you find. Your team verifies each find and adds your points.",
      ) +
      '<section class="card egg-panel" id="egg-countdown" style="display:none"><span class="cap" id="egg-countdown-title">Hunt ends in</span><p class="egg-count" id="egg-countdown-value"></p></section>' +
      '<section class="card egg-panel"><span class="cap">Rules</span><p class="egg-rules" id="egg-rules">Loading rules…</p></section>' +
      '<section class="card egg-panel"><span class="cap" id="egg-summary">0 of 12 eggs found</span><ol class="egg-grid" id="egg-grid" aria-label="Easter eggs"></ol></section>',
    privacy: () =>
      ph(
        2,
        "Privacy policy",
        "Your data,",
        "handled carefully.",
        "This summary explains the intended privacy practices for the GDG on Campus SR University website.",
      ) +
      '<section class="card pp" style="margin-top:28px;max-width:850px"><h2>Information this website may process</h2><p>Depending on the features you use, the website may process information you submit for event registration, certificate issuance or verification, community participation, and messages sent to the chapter.</p><h3>Certificates</h3><p>A minimal certificate record supports issuing, claiming, re-downloading, and public verification. Public verification shows only the recipient name, event, and verification status, and never shows email addresses or roll numbers. Attendance records (name, roll number, and email where given) are kept for one year after the event ends, then deleted automatically. Certificates are created in your browser and are not stored on our servers.</p><h3>Administration and security</h3><p>Administrative features may process account details and security/audit records to protect the website and manage chapter content. Public visitors must not have access to private administrative records.</p><h3>Storage and third-party services</h3><p>Some features may rely on services such as Supabase or official community platforms. Those services process information according to their own terms and privacy policies. Do not submit sensitive personal information unless a feature explicitly requires it.</p><h3>Your questions</h3><p>For privacy questions or requests concerning information handled by the chapter, contact <a href="mailto:gdg@sru.edu.in">gdg@sru.edu.in</a>.</p><p style="color:var(--mut);font-size:13px">Before launch, the chapter should review this policy against the actual production data flows, retention practices, and applicable university requirements.</p></section>',
    blogs: () =>
      ph(
        1,
        "Stories from the community",
        "Ideas worth",
        "sharing.",
        "A space for practical notes, project journeys, and lessons picked up while learning in public.",
      ) +
      `<section class="editorial-feature"><div class="editorial-feature-index">01 / THE CHAPTER JOURNAL</div><div class="editorial-feature-copy"><span class="tag t3">EDITORIAL SERIES</span><h2>Document the work.<br><em>Share the learning.</em></h2><p>Not every story needs a perfect ending. The useful bits are the experiments, the fixes, the questions, and what the team learned along the way.</p><a class="btn" href="mailto:gdg@sru.edu.in?subject=GDG%20SRU%20blog%20idea">Pitch a story ↗</a></div><div class="editorial-feature-art" aria-hidden="true"><span class="editorial-art-word">WRITE</span><span class="editorial-art-mark">G<span>D</span>G</span><span class="editorial-art-foot">BUILD IN PUBLIC · SRU</span></div></section><section class="blog-latest" id="blog-latest"><div class="editorial-collections-head"><div><span class="cap">LATEST FROM THE CHAPTER</span><h2>Latest stories.</h2></div><p>Articles published by the chapter team appear here as soon as they go live.</p></div><div class="editorial-grid g16-row" data-blog-latest><div class="blog-latest-empty"><b>The first stories are on their way.</b><p>Have a build log, a tutorial or a lesson worth sharing? Pitch it to the team and it could be the first one here.</p><a class="btn" href="mailto:gdg@sru.edu.in?subject=GDG%20SRU%20blog%20idea">Pitch a story ↗</a></div></div></section><section class="editorial-collections"><div class="editorial-collections-head"><div><span class="cap">SERIES</span><h2>Blog series.</h2></div><p>Ongoing series from the chapter. Each one is open for stories from the community.</p></div><div class="editorial-grid g16-row" id="blog-series"><p class="muted">Series will be listed here soon.</p></div><div class="editorial-bottom"><p>Have something worth sharing? A short tutorial, a project post-mortem, or a lesson from your first bug is a good start.</p><a href="mailto:gdg@sru.edu.in?subject=GDG%20SRU%20blog%20idea">Send the team your idea ↗</a></div></section>`,
    events: () =>
      ph(
        1,
        "Events and sessions",
        "Learn live,",
        "build together.",
        "Workshops, talks, and study jams are where the community turns curiosity into practice. Dates will appear here once confirmed.",
      ) +
      `<section class="event-feature"><div class="event-feature-main"><div class="event-feature-meta"><span class="event-live-dot"></span> <span id="ef-meta-label">NEXT SESSION</span> <span class="event-meta-divider">/</span> <span id="ef-meta-sub">UPCOMING EVENT</span></div><h2 id="ef-title">Coming soon</h2><p id="ef-summary">The next session details will be announced here once confirmed. Follow the official chapter page for the latest updates.</p><div class="event-feature-actions" id="ef-actions"><a class="btn" href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener">View on Chapter Page ↗</a></div></div><div class="event-feature-side"><span class="event-side-index">SEASON 2026</span><div class="event-orbit" aria-hidden="true"><span class="event-orbit-core">G</span><i></i><i></i><i></i><i></i></div><b id="ef-side-title"></b><p id="ef-side-body"></p></div></section><section class="event-formats"><div class="event-section-head"><div><span class="cap">WAYS TO TAKE PART</span><h2>Learn by doing.</h2></div><p>Different formats, same idea: leave with something you understand better—or something you made.</p></div><div class="event-format-grid g16-row">${[
        [
          "b",
          "01",
          "Workshops",
          "Hands-on sessions that walk through a tool or concept, one practical step at a time.",
        ],
        [
          "r",
          "02",
          "Tech talks",
          "Fresh perspectives from builders, researchers, alumni, and people working in tech.",
        ],
        [
          "y",
          "03",
          "Study jams",
          "Focused group learning with small goals, shared notes, and time to ask questions.",
        ],
        [
          "g",
          "04",
          "Build sessions",
          "Bring an idea, find collaborators, and turn a rough prototype into a working demo.",
        ],
      ]
        .map(([e, t, a, s], i) =>
          GDG16.info({
            key: e,
            icon: ["code", "mic", "chat", "bolt"][i],
            num: t,
            title: a,
            text: s,
          }),
        )
        .join(
          "",
        )}</div></section><section class="event-vault"><div><span class="cap">AFTER THE EVENT</span><h2>Slides, code, recaps.</h2><p>Session materials will be added after each event where resources are available. The archive will avoid sample dates and unverified attendance numbers.</p></div><div class="event-vault-empty"><span class="event-vault-icon">↳</span><b>The resource vault is getting ready.</b><p>Check the official chapter page for the latest announcements.</p><a href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener">Open chapter page ↗</a></div></section>`,
    team: () =>
      '<div class="team-root" data-team-root aria-busy="true"><section class="hero team-hero team-portal-hero" data-team-design="team-portal"><div class="team-portal-copy"><h1 class="visually-hidden">Community Team &amp; Student Leadership</h1><p class="lead">Loading the team…</p></div></section></div>',
    certificates: () =>
      ph(
        1,
        "Certificates",
        "Get recognized,",
        "instantly.",
        "Find and download your certificate in three steps.",
      ) +
      '<div class="grid g16-row">' +
      GDG16.infoItems([
        {
          key: "b",
          icon: "check",
          num: "01",
          title: "Choose event and enter your name",
          text: "Use the name you registered with.",
        },
        {
          key: "y",
          icon: "book",
          num: "02",
          title: "We check the attendance list",
          text: "If you attended, your certificate is created instantly.",
        },
        {
          key: "g",
          icon: "star",
          num: "03",
          title: "Download it",
          text: "Save a PDF or image; anyone can verify its ID.",
        },
      ]) +
      '</div><form class="card" id="cf" style="max-width:580px;margin:26px 0" novalidate><h2>Get your certificate</h2><p>Choose the event you attended, then type your name and your roll number (or the email you registered with). If you are on that event&#39;s attendance list, your certificate is created right here.</p><label for="gdg-cert-event"><b>Event</b></label><select id="gdg-cert-event" required disabled><option value="">Connecting to certificate registry…</option></select><label for="gdg-cert-name"><b>Your name</b></label><input id="gdg-cert-name" type="text" autocomplete="name" required minlength="3" maxlength="120" placeholder="Full name as registered" disabled><label for="gdg-cert-id"><b>Roll number or email</b> <span class="muted small" style="font-weight:normal">(optional for name-only sessions)</span></label><input id="gdg-cert-id" type="text" autocomplete="off" maxlength="80" placeholder="Roll number or email (optional if name only)" disabled><button class="btn" type="submit" disabled>Create my certificate →</button><p class="muted small" style="margin:10px 0 0">Looking to verify an issued certificate? Check the <a href="/verify/">verification page</a>.</p></form><div id="res" aria-live="polite"></div>',
    verify: (e) =>
      ph(
        1,
        "Verify",
        "Real,",
        "verified.",
        "Opened by scanning the QR code on a certificate.",
      ) + vcard(e),
    leaderboard: () => {
      setTimeout(() => {
        window.initLeaderboard && window.initLeaderboard();
      }, 0);
      return `<div class="page page-leaderboard"><span class="eyebrow"><span class="dots" aria-hidden="true"><i></i><i></i><i></i><i></i></span>GDG on Campus · SR University</span><h1 class="lb-page-title">Leader<em>board</em></h1><p class="lede">Every workshop attended, task finished and project demoed moves you up. Here&#39;s how the chapter is doing.</p><div class="stats" id="stats"></div><div class="ctl"><div class="seg" id="seg"></div><label class="find"><svg viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="q" type="search" placeholder="Find yourself" aria-label="Find a student"></label></div><div id="board"></div></div>`;
    },
    perks: () =>
      ph(
        2,
        "Resource Hub",
        "Tools to",
        "explore.",
        "Useful discoveries from across technology, alongside materials shared at GDG SRU events.",
      ) +
      fs(
        "perks",
        '<div class="event-vault-empty"><b>Resource Hub is loading.</b><p>Published free resources and GDG SRU event materials will appear here.</p></div>',
      ),
  };
const foundCard = (e) =>
  `<div class="cert pp"><span class="tag t3">✓ Verified Credential</span><p style="margin:16px 0 0;color:var(--mut)">This certifies that</p><h2 style="margin:6px 0">${esc(e.name)}</h2><p style="margin:0">attended <b>${esc(e.ev)}</b> on ${esc(e.date)}</p><div style="display:flex;justify-content:center;gap:16px;align-items:center;margin-top:18px"><div class="qr"></div><div style="text-align:left;font-size:13px;color:var(--mut)">ID: ${esc(e.id)}<br>Scan to verify</div></div><div class="sig"><i>Chapter lead</i><i>Faculty advisor</i></div></div><div class="act"><button type="button" class="btn" data-print>Download PDF ↓</button><button type="button" class="btn o" data-copy="${esc(vurl(e.id))}">Copy verify link</button><a class="btn o" target="_blank" rel="noopener" href="https://www.linkedin.com/profile/add?startTask=CERTIFICATION_NAME&name=${encodeURIComponent(e.ev + " Certificate")}&organizationName=Google%20Developer%20Groups&certUrl=${encodeURIComponent(vurl(e.id))}&certId=${encodeURIComponent(e.id)}">+ Add to LinkedIn Profile</a><a class="btn o" target="_blank" rel="noopener" href="https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent("🎓 Proud to earn my Certificate of Participation for " + e.ev + " from Google Developer Group on Campus SR University! Credential ID: " + e.id + " Verify: " + vurl(e.id) + " #GDGSRU #GoogleDeveloperGroups")}">Share on LinkedIn ↗</a></div><input readonly aria-label="Verify link" value="${esc(vurl(e.id))}" style="max-width:660px;font-size:14px" onclick="this.select()">`;
async function cert(e) {
  const t = $("#rn"),
    a = $("#rne"),
    s = $("#res"),
    i = e.querySelector("[type=submit]"),
    o = t.value.trim();
  if (!/^GDGSRU-(?:\d{2}-)?[A-F0-9]{12,16}$/i.test(o))
    return (
      (a.textContent = o
        ? "Enter the certificate ID printed on the certificate (for example GDGSRU-26-A1B2C3D4E5F60718)."
        : "Enter your certificate ID to verify it."),
      (a.hidden = !1),
      t.setAttribute("aria-invalid", "true"),
      t.focus(),
      void (s.innerHTML = "")
    );
  let n;
  ((a.hidden = !0),
    t.removeAttribute("aria-invalid"),
    (i.disabled = !0),
    (i.textContent = "Searching…"),
    (s.innerHTML = `<div class="card pp" role="status" style="max-width:580px;display:flex;gap:14px;align-items:center"><i class="sp"></i><span>Looking up <b>${esc(o)}</b>…</span></div>`));
  try {
    n = await lookup(o);
  } catch {
    n = { status: "error", record: null };
  }
  ((i.disabled = !1),
    (i.textContent = "Find my certificate →"),
    n && "error" !== n.status
      ? "revoked" === n.status
        ? (s.innerHTML = `<div class="card pp" style="max-width:580px" ${sty("r")}><span class="tag t2">Revoked Certificate</span><h3 style="margin:10px 0 6px">Certificate Invalidation Notice</h3><p style="color:var(--mut)">Certificate ID <b>${esc(o)}</b> was previously registered but has been revoked or invalidated by GDG on Campus administration. If you believe this is in error, please contact the Chapter Lead.</p></div>`)
        : "not_found" !== n.status && n.record
          ? (s.innerHTML = foundCard(n.record))
          : (s.innerHTML = `<div class="card pp" style="max-width:580px" ${sty("r")}><span class="tag t2">Record Not Found</span><h3 style="margin:10px 0 6px">No certificate for ${esc(o)}</h3><p style="color:var(--mut)">Check that the certificate ID is correct. If this certificate was recently issued, contact the chapter team for assistance.</p><button type="button" class="btn o sm" data-retry>Try another certificate ID</button></div>`)
      : (s.innerHTML = `<div class="card pp" style="max-width:580px" ${sty("y")}><span class="tag t4">Service Interruption</span><h3 style="margin:10px 0 6px">Unable to reach registry</h3><p style="color:var(--mut)">We could not reach the certification server due to a network interruption. <b>Important:</b> This does not mean your certificate is invalid. Please verify your connection and try again in a moment.</p><button type="button" class="btn o sm" data-retry>Try again</button></div>`));
}
async function cp(e) {
  const t = e.dataset.copy;
  let a = !1;
  try {
    (await navigator.clipboard.writeText(t), (a = !0));
  } catch {
    const e = document.createElement("textarea");
    ((e.value = t),
      (e.style.cssText = "position:fixed;opacity:0"),
      document.body.append(e),
      e.select());
    try {
      a = document.execCommand("copy");
    } catch (err) {
      console.warn("[App] Operation notice:", err);
    }
    e.remove();
  }
  ((e.textContent = a ? "Link copied ✓" : "Copy failed: select the link below"),
    clearTimeout(e._t),
    (e._t = setTimeout(() => (e.textContent = "Copy verify link"), 2200)));
}
function applyGdgLogo(e) {
  const t = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(e || "")
      ? e
      : "",
    a = $("#lgs");
  if (a)
    if ((a.replaceChildren(), t)) {
      const e = document.createElement("img");
      ((e.className = "gdg-logo-image"),
        (e.alt = "GDG logo"),
        (e.src = t),
        a.appendChild(e));
    } else {
      a.innerHTML =
        '<svg viewBox="185 345 710 390" width="34" height="19" role="img" aria-label="Google Developer Group logo"><line x1="279" y1="540" x2="432" y2="430" stroke="#ea4335" stroke-width="128" stroke-linecap="round"/><line x1="279" y1="540" x2="432" y2="650" stroke="#4285f4" stroke-width="128" stroke-linecap="round"/><line x1="648" y1="650" x2="801" y2="540" stroke="#fbbc04" stroke-width="128" stroke-linecap="round"/><line x1="648" y1="430" x2="801" y2="540" stroke="#34a853" stroke-width="128" stroke-linecap="round"/></svg>';
    }
  const s = $("#solar-gdg-logo"),
    i = $("#solar-gdg-fallback");
  s &&
    i &&
    (t
      ? (s.setAttribute("href", t),
        (s.style.display = "block"),
        (i.style.display = "none"))
      : (s.removeAttribute("href"),
        (s.style.display = "none"),
        (i.style.display = "block")));
}
function initGdgLogo() {
  let e = "";
  try {
    e = localStorage.getItem("gdg-chapter-logo") || "";
  } catch (err) {
    console.warn("[App] Operation notice:", err);
  }
  applyGdgLogo(e);
}
function initTheme() {
  const e = document.documentElement;
  let t = "dark";
  try {
    t = "light" === localStorage.getItem("gdg-theme") ? "light" : "dark";
  } catch (err) {
    console.warn("[App] Operation notice:", err);
  }
  e.dataset.theme = t;
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.content = t === "light" ? "#f6f5f1" : "#0b0b0d";
}
function mo(e) {
  const t = $("#mo");
  (t.classList.toggle("on", !!e),
    t.setAttribute("aria-hidden", e ? "false" : "true"),
    document.body.classList.toggle("menu-open", !!e),
    e && t.querySelector(".menu-close")?.focus({ preventScroll: !0 }));
}
function tick() {
  const e = $("#clk");
  e &&
    (e.textContent = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }));
}
document.addEventListener("keydown", (e) => {
  "Escape" === e.key && $("#mo").classList.contains("on") && mo(0);
});
let io,
  cur = null,
  ox = innerWidth / 2,
  oy = innerHeight / 2,
  wiping = !1;
function render() {
  const e = window.GDG_MULTIPAGE
      ? gdgMultiPageRouteValue()
      : location.hash.slice(1) || "home",
    [t, a] = e.split("/"),
    s =
      "home-blogs" === t
        ? "home"
        : "contact" === t
          ? "join"
          : "blog" === t
            ? "blogs"
            : "gallery" === t
              ? "events"
              : "about" === t
                ? "home"
                : t;
  cur = e;
  const i = Object.hasOwn(P, s) ? s : "404";
  (($("#app").innerHTML =
    `<div class="pg page-${i}${"team" === i ? " pg-team" : ""}">${(Object.hasOwn(P, s) ? P[s] : P[404])(a)}</div>`),
    mo(0),
    scrollTo(0, 0),
    "home-blogs" === t &&
      setTimeout(
        () =>
          document
            .querySelector("#home-blogs")
            ?.scrollIntoView({
              behavior: RM ? "auto" : "smooth",
              block: "start",
            }),
        60,
      ),
    window.GDG_MULTIPAGE &&
      "#about-the-chapter" === location.hash &&
      "home" === t &&
      setTimeout(
        () =>
          document
            .querySelector("#about-the-chapter")
            ?.scrollIntoView({
              behavior: RM ? "auto" : "smooth",
              block: "start",
            }),
        60,
      ),
    initGdgLogo(),
    window.__gdgMemberFlipBound ||
      ((window.__gdgMemberFlipBound = !0),
      document.addEventListener("click", (e) => {
        const t = e.target.closest && e.target.closest(".member-card");
        !t ||
          e.target.closest("a,button,input,select,textarea") ||
          (0 !== e.detail &&
            (t.classList.toggle("is-flipped"),
            t.setAttribute(
              "aria-pressed",
              t.classList.contains("is-flipped") ? "true" : "false",
            )));
      }),
      document.addEventListener("keydown", (e) => {
        const t = e.target.closest && e.target.closest(".member-card");
        !t ||
          ("Enter" !== e.key && " " !== e.key) ||
          e.target.closest("a,button,input,select,textarea") ||
          (e.preventDefault(),
          t.classList.toggle("is-flipped"),
          t.setAttribute(
            "aria-pressed",
            t.classList.contains("is-flipped") ? "true" : "false",
          ));
      })),
    tick());
  const o = $("#app [data-fs]");
  (o && applyF(o, 1), rewriteGdgMultiPageLinks(document));
}
function enter() {
  const e = $(".pg");
  !e || e.classList.contains("go") || (e.classList.add("go"), RM || reveal(e));
}
const RVS = ".sc,.card,.info,.st,.pod";
function reveal(e) {
  (io && io.disconnect(),
    "IntersectionObserver" in window &&
      ((io = new IntersectionObserver(
        (e) =>
          e.forEach((e) => {
            e.isIntersecting && (io.unobserve(e.target), shw(e.target));
          }),
        { threshold: 0.1, rootMargin: "0px 0px -5% 0px" },
      )),
      e.querySelectorAll(RVS).forEach((e) => {
        const t = [...e.parentNode.children].filter((e) => e.matches(RVS));
        (e.style.setProperty("--d", (t.indexOf(e) % 4) * 70 + "ms"),
          e.classList.add("rv"),
          e.matches(".st") &&
            e.querySelectorAll("b").forEach((e) => {
              ((e.dataset.f = e.textContent),
                (e.style.minWidth = e.offsetWidth + "px"),
                (e.textContent = e.textContent.replace(/\d[\d,]*/, "0")));
            }),
          io.observe(e));
      })));
}
function shw(e) {
  (e.classList.add("vis"),
    e.addEventListener("animationend", function t(a) {
      a.target === e &&
        (e.removeEventListener("animationend", t),
        e.classList.remove("rv", "vis"));
    }),
    e.matches(".st") &&
      setTimeout(
        () => e.querySelectorAll("b[data-f]").forEach(cu),
        (parseFloat(e.style.getPropertyValue("--d")) || 0) + 150,
      ));
}
function cu(e) {
  const t = e.dataset.f.match(/^(\d[\d,]*)(.*)$/);
  if (!t) return;
  const a = +t[1].replace(/,/g, ""),
    s = t[1].includes(","),
    i = performance.now();
  !(function o(n) {
    const r = Math.min(1, (n - i) / 600),
      l = Math.round(a * (1 - Math.pow(1 - r, 3)));
    ((e.textContent = (s ? l.toLocaleString("en-US") : "" + l) + t[2]),
      r < 1 ? requestAnimationFrame(o) : (e.style.minWidth = ""));
  })(i);
}
function applyF(e, t) {
  const a = {};
  e.querySelectorAll(".fb").forEach((e) => {
    const t = e.querySelector("[aria-pressed=true]");
    a[e.dataset.k] = t ? t.dataset.v : "all";
  });
  let s = 0,
    i = 0;
  e.querySelectorAll(".gw").forEach((e) => {
    let o = 0;
    (e.querySelectorAll("[data-fi]").forEach((e) => {
      i++;
      const n = Object.keys(a).every(
        (t) => "all" === a[t] || (e.dataset[t] || "").split(" ").includes(a[t]),
      );
      ((e.hidden = !n),
        n &&
          (o++,
          s++,
          !t &&
            !RM &&
            !e.classList.contains("rv") &&
            (e.classList.remove("pp"),
            e.offsetWidth,
            e.style.setProperty("--d", 45 * (o - 1) + "ms"),
            e.classList.add("pp"),
            e.addEventListener("animationend", () => e.classList.remove("pp"), {
              once: !0,
            }))));
    }),
      (e.querySelector(".em").hidden = o > 0));
    const n =
      e.previousElementSibling && e.previousElementSibling.querySelector("sup");
    n && (n.textContent = String(o).padStart(2, "0"));
  });
  const o = e.querySelector("[data-ct]");
  o && (o.textContent = `Showing ${s} of ${i} ${e.dataset.noun}`);
}
const WL = [...document.querySelectorAll("#wp i")],
  EZ = "cubic-bezier(.65,0,.35,1)",
  pageLabel = (e) => {
    const t = e.split("/")[0],
      a = N.find((e) => e[0] === t);
    return a
      ? a[1]
      : "home-blogs" === t || "about" === t
        ? "Home"
        : "contact" === t
          ? "Join & Contact"
          : "404" === t
            ? "Page not found"
            : t.replace(/-/g, " ");
  },
  wipe = (e) =>
    Promise.all(
      WL.map(
        (t) =>
          t.animate(
            e
              ? [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }]
              : [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }],
            { duration: e ? 420 : 360, delay: 0, easing: EZ, fill: "both" },
          ).finished,
      ),
    );
function nav() {
  if (window.GDG_MULTIPAGE) return;
  const e = location.hash.slice(1) || "home";
  if (e === cur || wiping) return;
  if (RM) return (render(), void enter());
  ((wiping = !0),
    WL.forEach((e) => e.getAnimations().forEach((e) => e.cancel())));
  const t = $("#wp"),
    a = $("#wp-title");
  ((a.textContent = pageLabel(e)),
    t.classList.add("on"),
    a.animate(
      [
        { opacity: 0, transform: "translate(-50%,-155%) scale(.94)" },
        { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
      ],
      { duration: 520, easing: "cubic-bezier(.16,1,.3,1)", fill: "forwards" },
    ),
    wipe(!0)
      .then(() => new Promise((e) => setTimeout(e, 160)))
      .then(
        () => (
          render(),
          enter(),
          Promise.all([
            ...WL.map(
              (e) =>
                e.animate(
                  [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }],
                  { duration: 420, easing: EZ, fill: "forwards" },
                ).finished,
            ),
            a.animate(
              [
                { opacity: 1, transform: "translate(-50%,-50%) scale(1)" },
                { opacity: 0, transform: "translate(-50%,-138%) scale(1.025)" },
              ],
              {
                duration: 420,
                easing: "cubic-bezier(.4,0,1,1)",
                fill: "forwards",
              },
            ).finished,
          ])
        ),
      )
      .then(() => {
        (WL.forEach((e) => e.getAnimations().forEach((e) => e.cancel())),
          a.getAnimations().forEach((e) => e.cancel()),
          t.classList.remove("on"),
          (a.style.opacity = "0"),
          (a.style.transform = "translate(-50%,-150%) scale(.96)"),
          (wiping = !1),
          nav());
      })
      .catch(() => {
        (t.classList.remove("on"), (wiping = !1));
      }));
}
function goCard(e) {
  const t = $("#crew-" + e);
  t &&
    (t.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "center" }),
    t.focus({ preventScroll: !0 }),
    RM ||
      setTimeout(() => {
        (t.classList.add("hit"),
          setTimeout(() => t.classList.remove("hit"), 1200));
      }, 450));
}
function tp(e) {
  const t = $("#tp");
  if (!t) return;
  if (!e) return void (t.style.opacity = 0);
  const a = e.dataset.n,
    s = 7.4 * a.length + 26,
    i = +e.dataset.x,
    o = +e.dataset.y,
    n = Math.max(s / 2 - 208, Math.min(208 - s / 2, i)),
    r = o < 0 ? o + 38 : o - 38,
    l = $("#tpr"),
    c = $("#tpt");
  (l.setAttribute("x", n - s / 2),
    l.setAttribute("y", r - 13),
    l.setAttribute("width", s),
    c.setAttribute("x", n),
    c.setAttribute("y", r + 4),
    (c.textContent = a),
    (t.style.opacity = 1));
}
const app = $("#app");
(app.addEventListener("click", (e) => {
  const t = e.target.closest(".fb button");
  if (t)
    return (
      t.parentNode.querySelectorAll("button").forEach((e) => {
        const a = e === t;
        (e.classList.toggle("o", !a), e.setAttribute("aria-pressed", a));
      }),
      void applyF(t.closest("[data-fs]"))
    );
  const a = e.target.closest("[data-reset]");
  if (a) {
    const e = a.closest("[data-fs]");
    return (
      e.querySelectorAll(".fb").forEach((e) =>
        e.querySelectorAll("button").forEach((e, t) => {
          (e.classList.toggle("o", !!t), e.setAttribute("aria-pressed", !t));
        }),
      ),
      void applyF(e)
    );
  }
  const s = e.target.closest(".of");
  if (s) {
    if (s.dataset.dept) {
      const e = document.getElementById(s.dataset.dept);
      e &&
        e.scrollIntoView({ behavior: RM ? "auto" : "smooth", block: "start" });
    } else goCard(+s.dataset.i);
    return;
  }
  const i = e.target.closest("[data-copy]");
  if (i) cp(i);
  else if (e.target.closest("[data-print]")) print();
  else if (e.target.closest("[data-retry]")) {
    const e = $("#rn");
    (e.focus(),
      e.select(),
      e.scrollIntoView({ block: "center", behavior: RM ? "auto" : "smooth" }));
  }
}),
  app.addEventListener("submit", (e) => {
    !window.GDG_MULTIPAGE &&
      "cf" === e.target.id &&
      (e.preventDefault(), cert(e.target));
  }),
  app.addEventListener("keydown", (e) => {
    const t = e.target.closest && e.target.closest(".of");
    if (t && ("Enter" === e.key || " " === e.key))
      if ((e.preventDefault(), t.dataset.dept)) {
        const e = document.getElementById(t.dataset.dept);
        e &&
          e.scrollIntoView({
            behavior: RM ? "auto" : "smooth",
            block: "start",
          });
      } else goCard(+t.dataset.i);
  }),
  app.addEventListener("mouseover", (e) => {
    const t = e.target.closest(".of");
    t && tp(t);
  }),
  app.addEventListener("mouseout", (e) => {
    e.target.closest(".of") && tp(null);
  }),
  app.addEventListener("focusin", (e) => {
    const t = e.target.closest(".of");
    t && tp(t);
  }),
  app.addEventListener("focusout", (e) => {
    e.target.closest(".of") && tp(null);
  }),
  addEventListener(
    "click",
    (e) => {
      if (e.clientX || e.clientY) ((ox = e.clientX), (oy = e.clientY));
      else if (e.target.getBoundingClientRect) {
        const t = e.target.getBoundingClientRect();
        ((ox = t.left + t.width / 2), (oy = t.top + t.height / 2));
      }
    },
    !0,
  ),
  $("#lgs") && !$("#lgs").querySelector("svg") && applyGdgLogo(""));
let ldi,
  ldv = 0;
const lt = [
  "Compiling ideas...",
  "Brewing chai...",
  "Deploying community...",
  "Almost live...",
];
function ldx() {
  (clearInterval(ldi),
    ($("#ldn").textContent = 100),
    ($("#ldb").style.width = "100%"));
  const e = $("#ld");
  if ("1" !== e.dataset.exitStarted)
    return (
      (e.dataset.exitStarted = "1"),
      e.classList.add("done"),
      void requestAnimationFrame(() => enter())
    );
}
$("#ld") && ldx();
const pkBubble = document.createElement("div");
((pkBubble.id = "pk-bubble"),
  (pkBubble.textContent = "Play"),
  pkBubble.setAttribute("aria-hidden", "true"),
  document.body.appendChild(pkBubble));
const pkFine = matchMedia("(pointer: fine)");
function pkPick(e) {
  const t = e.closest(".pk"),
    a = PKM[+e.dataset.i];
  (t.querySelectorAll(".g16-pkcard").forEach((t) => {
    const a = t === e;
    (t.classList.toggle("on", a), t.setAttribute("aria-pressed", a));
  }),
    (t.querySelector(".pk-glyph").className = "pk-glyph pk-m-" + a.k),
    (t.dataset.pk = a.k));
}
(document.addEventListener("click", (e) => {
  const t = e.target.closest(".g16-pkcard");
  t && pkPick(t);
}),
  document.addEventListener("pointermove", (e) => {
    const t = e.target.closest && e.target.closest(".g16-pkcard");
    if (!t || !pkFine.matches) return pkBubble.classList.remove("show");
    const a = t.getBoundingClientRect(),
      s = (e.clientX - a.left) / a.width - 0.5,
      i = (e.clientY - a.top) / a.height - 0.5;
    (t.style.setProperty("--rx", -10 * i + "deg"),
      t.style.setProperty("--ry", 12 * s + "deg"),
      t.style.setProperty("--mx", 100 * (s + 0.5) + "%"),
      t.style.setProperty("--my", 100 * (i + 0.5) + "%"),
      (pkBubble.style.transform = `translate(${e.clientX + 18}px, ${e.clientY + 18}px)`),
      pkBubble.classList.add("show"));
  }),
  document.addEventListener("pointerout", (e) => {
    const t = e.target.closest && e.target.closest(".g16-pkcard");
    !t ||
      t.contains(e.relatedTarget) ||
      (t.style.setProperty("--rx", "0deg"),
      t.style.setProperty("--ry", "0deg"),
      pkBubble.classList.remove("show"));
  }),
  addEventListener("hashchange", nav),
  setInterval(() => {
    document.hidden || tick();
  }, 1e3),
  initTheme(),
  render(),
  initGdgLogo(),
  window.GDG_MULTIPAGE &&
    !document.getElementById("ld") &&
    requestAnimationFrame(enter));
