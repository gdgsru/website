/* Rotating hero tagline: the last word of "Build. Learn. Connect." cycles through a few words.
 * Home page only. Users who ask for reduced motion keep "Connect." still. */
(() => {
  'use strict';
  if (window.__GDG_TAGLINE__) return;
  window.__GDG_TAGLINE__ = true;

  const WORDS = ['Connect.', 'Create.', 'Ship.', 'Grow.'];
  const HOLD_MS = 2600;
  const FADE_MS = 350;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let started = false;

  function start() {
    if (started) return true;
    const word = document.querySelector('.home-hero-title .hero-blue-word');
    if (!word) return false;
    started = true;
    if (reduceMotion) return true;

    const style = document.createElement('style');
    style.textContent = '.hero-blue-word{transition:opacity .35s ease,transform .35s ease}' +
      '.hero-blue-word.tag-out{opacity:0;transform:translateY(6px)}' +
      '@media (prefers-reduced-motion: reduce){.hero-blue-word{transition:none}}';
    document.head.appendChild(style);

    let i = 0;
    setInterval(() => {
      if (!word.isConnected) return;
      word.classList.add('tag-out');
      setTimeout(() => {
        i = (i + 1) % WORDS.length;
        word.textContent = WORDS[i];
        word.classList.remove('tag-out');
      }, FADE_MS);
    }, HOLD_MS);
    return true;
  }

  if (!start()) {
    const observer = new MutationObserver(() => { if (start()) observer.disconnect(); });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
