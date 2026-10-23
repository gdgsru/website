/* GDG SRU · v18 — behaviour for the Aurora layer:
   mega footer, campus-scene parallax + chip switching, scroll reveals. */
(function () {
  "use strict";
  var root = document.documentElement;
  var still = matchMedia("(prefers-reduced-motion:reduce)").matches;
  var fine = matchMedia("(hover:hover) and (pointer:fine)").matches;
  root.classList.add("v18-js");

  /* ---------- footer ---------- */
  function footer() {
    var f = document.querySelector("body > footer");
    if (!f || f.classList.contains("v18-foot")) return;
    f.classList.add("v18-foot");
    f.removeAttribute("style");
    f.innerHTML =
      '<div class="v18-foot-in">' +
      '<div class="v18-cta v18-rv"><div><span class="k">Warangal</span>' +
      '<h3>Build something <em>worth sharing.</em></h3></div>' +
      '<a class="go" href="/join/">Join the community <i aria-hidden="true">→</i></a></div>' +
      '<div class="v18-cols">' +
      '<div class="v18-brand"><div class="row"><span class="v18-dots" aria-hidden="true"><svg viewBox="185 345 710 390" width="34" height="19" role="img" aria-label="Google Developer Group logo"><line x1="279" y1="540" x2="432" y2="430" stroke="#ea4335" stroke-width="128" stroke-linecap="round"/><line x1="279" y1="540" x2="432" y2="650" stroke="#4285f4" stroke-width="128" stroke-linecap="round"/><line x1="648" y1="650" x2="801" y2="540" stroke="#fbbc04" stroke-width="128" stroke-linecap="round"/><line x1="648" y1="430" x2="801" y2="540" stroke="#34a853" stroke-width="128" stroke-linecap="round"/></svg></span>Google Developer Group · SR University</div>' +
      "<p>A student-led community for curious minds, builders and future problem solvers. Learn, build and grow together on campus.</p></div>" +
      '<div><h4>Explore</h4><a href="/">Home</a><a href="/events/">Events</a><a href="/team/">Team</a><a href="/blog/">Blog</a><a href="/resources/">Resource Hub</a><a href="/leaderboard/">Leaderboard</a></div>' +
      '<div><h4>Community</h4>' +
      '<a class="gdg-discord-link gdg-social-discord" href="https://discord.gg/htSJMNcdZs" target="_blank" rel="noopener">Discord ↗</a>' +
      '<a class="gdg-social-github" href="https://github.com/gdgsru" target="_blank" rel="noopener">GitHub ↗</a>' +
      '<a class="gdg-social-linkedin" href="https://www.linkedin.com/company/gdg-sru/home/" target="_blank" rel="noopener">LinkedIn ↗</a>' +
      '<a class="gdg-social-instagram" href="https://www.instagram.com/gdg_sru/" target="_blank" rel="noopener">Instagram ↗</a>' +
      '<a class="gdg-social-x" href="https://x.com/gdgsru" target="_blank" rel="noopener">X ↗</a></div>' +
      '<div><h4>Get in touch</h4><a class="gdg-contact-email" href="mailto:gdg@sru.edu.in">gdg@sru.edu.in</a><a href="/join/">Join</a><a href="/certificates/">Certificates</a>' +
      '<a href="https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/" target="_blank" rel="noopener">Official GDG chapter ↗</a></div>' +
      "</div></div>" +
      '<div class="v18-mega" aria-hidden="true">GDG SRU</div>' +
      '<div class="v18-base"><span>© Warangal, Telangana</span><span><a href="/privacy/" class="v18-tap-target">Privacy</a></span></div>';
  }

  /* ---------- campus scene ---------- */
  function scene() {
    document.querySelectorAll(".pk").forEach(function (pk) {
      if (pk.dataset.v18) return;
      pk.dataset.v18 = "1";
      var g = pk.querySelector(".pk-glyph");
      if (!g) return;
      var m = (g.className.match(/pk-m-([a-z])/) || [])[1];
      if (m) pk.dataset.pk = m;

      /* chips switch the path */
      g.querySelectorAll(".pk-chip").forEach(function (chip, i) {
        chip.setAttribute("role", "button");
        chip.tabIndex = -1;
        chip.addEventListener("click", function () {
          var card = pk.querySelectorAll(".g16-pkcard")[i];
          if (card) card.click();
        });
      });

      /* mouse parallax */
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
      });
    });
  }

  /* ---------- reveals ---------- */
  var io = null;
  function reveal() {
    var sel = ".sc,.pk-h,.pk-deck,.pk-stage,.home-about-merged,.discord-first-promo,.v18-rv";
    var els = document.querySelectorAll(sel);
    if (!els.length) return;
    if (!("IntersectionObserver" in window) || still) {
      els.forEach(function (el) { el.classList.add("v18-in"); }); return;
    }
    if (!io) io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("v18-in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    els.forEach(function (el) {
      if (el.dataset.v18rv) return;
      el.dataset.v18rv = "1";
      el.classList.add("v18-rv");
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 0.92) { el.classList.add("v18-in"); return; }
      io.observe(el);
    });
    /* safety net: never leave content hidden */
    setTimeout(function () {
      document.querySelectorAll(".v18-rv:not(.v18-in)").forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < innerHeight * 1.2) el.classList.add("v18-in");
      });
    }, 2500);
  }

  function run() { footer(); scene(); reveal(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run); else run();
  /* the app renders pages client-side — re-scan as content arrives */
  var t = 0;
  new MutationObserver(function () { clearTimeout(t); t = setTimeout(run, 120); })
    .observe(document.getElementById("app") || document.body, { childList: true, subtree: true });
})();
