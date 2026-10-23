/* Renders one team card inside Mission Control's live preview, using the same code as the public site. */
(() => {
  const stage = document.getElementById('stage');
  document.body.insertAdjacentHTML('afterbegin', window.GDGTeam.DEFS);
  const setFlip = (c, on) => {
    c.classList.toggle('is-flipped', on); c.setAttribute('aria-expanded', String(on));
    const f = c.querySelector('.tm-face-front'), b = c.querySelector('.tm-face-back');
    if (f && b) { f.toggleAttribute('inert', on); b.toggleAttribute('inert', !on); f.setAttribute('aria-hidden', String(on)); b.setAttribute('aria-hidden', String(!on)); }
  };
  const card = () => stage.querySelector('.tm-card');
  const resize = () => parent.postMessage({ type: 'card-preview-height', h: document.documentElement.scrollHeight }, location.origin);
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin) return;
    const d = e.data || {};
    if (d.type === 'card') {
      const flipped = card()?.classList.contains('is-flipped');
      stage.innerHTML = window.GDGTeam.cardHTML(d.member, { kind: d.kind, index: d.index || 0 });
      if (flipped && card()) setFlip(card(), true);
      resize();
    } else if (d.type === 'flip' && card()) setFlip(card(), !card().classList.contains('is-flipped'));
  });
  document.addEventListener('click', (e) => {
    const c = e.target.closest('.tm-card'); if (!c || e.target.closest('a')) return;
    if (e.target.closest('[data-card-return]')) return setFlip(c, false);
    setFlip(c, !c.classList.contains('is-flipped'));
  });
  parent.postMessage('card-preview-ready', location.origin);
})();
