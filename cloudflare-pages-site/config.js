// Public client configuration for the GDG SRU Supabase project.
// Publishable keys are intended for browser use; never place service_role/secret keys here.
window.SUPABASE_URL = "https://isfhqbytrbilceqddnll.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzZmhxYnl0cmJpbGNlcWRkbmxsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDk2MzcsImV4cCI6MjEwNzEyNTYzN30.KkOi9s-Mg91y6sXjPZlnJFwQJxngEX1hLWOxq_xgx6g";

// Shared defaults. Read by the public site (config-loader.js) and Mission Control.
// Anything saved in the admin (site_settings) overrides these.
window.GDG_SITE_DEFAULTS = {
  // Leaderboard toggle: set to false to hide Leaderboard from the header & menu until events launch.
  leaderboardEnabled: false,
  contactEmail: "gdg@sru.edu.in",
  secondaryContactEmail: "gdgoncamps.sru@gmail.com",
  // Each category has a name and an active flag. Only active categories are offered when
  // setting an event's category; an event that already uses an inactive category keeps it.
  eventCategories: [
    { name: "Cloud", active: true }, { name: "AI/ML", active: true }, { name: "Web & Mobile", active: true },
    { name: "Open Source", active: true }, { name: "Other", active: true }
  ],
  // Home page track cards. Editable in Settings (home_tracks); color is b, r, y or g.
  homeTracks: [
    { label: "Cloud", description: "Google Cloud, Skills Boost and deployment.", color: "b" },
    { label: "AI / ML", description: "Gemini, AI Studio and applied ML.", color: "r" },
    { label: "Web / Mobile", description: "Frontend, Android and full stack.", color: "y" },
    { label: "Open Source", description: "Git, GitHub and collaborative development.", color: "g" }
  ],
  normalizeCategories: function (list) {
    const seen = new Set(), out = [];
    (Array.isArray(list) ? list : []).forEach(function (c) {
      const name = String(typeof c === "string" ? c : (c && c.name) || "").trim();
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      out.push({ name: name, active: typeof c === "string" ? true : c.active !== false });
    });
    return out;
  },
  announcementBar: {
    enabled: true,
    badge: "REGISTRATIONS OPEN",
    text: "Grand Chapter Launch & Orientation registrations are live on Google Community Platform.",
    button_label: "RSVP on Chapter Page ↗",
    button_url: "https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/",
    announcement_id: 2
  },
  socials: [
    { key: 'gdg', label: 'Google Developer Group SR University', url: 'https://gdg.community.dev/gdg-on-campus-sr-university-warangal-india/', description: 'The official chapter page for community updates and event registration.', icon: '✦', enabled: true, sort_order: 1 },
    { key: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/company/gdg-sru/home/', description: 'Follow chapter news, achievements, and announcements.', icon: 'in', enabled: true, sort_order: 2 },
    { key: 'discord', label: 'Discord', url: 'https://discord.gg/htSJMNcdZs', description: 'Join conversations, study groups, and project teams.', icon: '◉', enabled: true, sort_order: 3 },
    { key: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/gdg_sru/', description: 'See chapter moments, event photos, and announcements.', icon: '◎', enabled: true, sort_order: 4 },
    { key: 'x', label: 'X', url: 'https://x.com/gdgsru', description: 'Follow quick updates and technology conversations.', icon: '𝕏', enabled: true, sort_order: 5 },
    { key: 'github', label: 'GitHub', url: 'https://github.com/gdgsru', description: 'Explore shared projects and open-source work.', icon: '⌘', enabled: true, sort_order: 6 }
  ]
};
