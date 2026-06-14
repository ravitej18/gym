window.GYM_CONFIG = {
  appName: "GymFlow",

  // ─── Color Theme ──────────────────────────────────────────────────────────
  // Choose one of the 10 available themes. This is the only place to change it.
  // The theme is applied before the page renders (no flash).
  //
  // Available themes:
  //   "neon-lime"      — Neon green + teal       (default, high-energy)
  //   "electric-blue"  — Azure blue + emerald    (modern, tech-forward)
  //   "fire-orange"    — Blaze orange + gold      (intense, bold)
  //   "crimson-force"  — Power red + amber        (aggressive, sport)
  //   "ultra-violet"   — Purple + indigo          (premium, futuristic)
  //   "arctic-cyan"    — Cyan + mint              (cool, clean)
  //   "solar-gold"     — Champion gold + orange   (achievement, prestige)
  //   "plasma-pink"    — Hot pink + purple        (vibrant, energetic)
  //   "matrix-green"   — Terminal green + teal    (hacker, tech)
  //   "midnight-teal"  — Deep teal + indigo       (calm, focused)
  //
  colorTheme: "neon-lime",

  firebase: {
    apiKey: "AIzaSyCo6eNYZUtbLxVSxWRSXMVdJDh34yfTEXc",
    authDomain: "cnp-automation-project.firebaseapp.com",
    projectId: "cnp-automation-project",
    storageBucket: "cnp-automation-project.firebasestorage.app",
    messagingSenderId: "1040731849321",
    appId: "1:1040731849321:web:028463d3f230d9a86758f8"
  }
};

// Apply color theme immediately — runs synchronously in <head> so the browser
// paints the correct theme on the very first frame (no FOUT/flash).
(function () {
  var t = window.GYM_CONFIG.colorTheme;
  if (t && t !== "neon-lime") {
    document.documentElement.setAttribute("data-color-theme", t);
  }
})();
