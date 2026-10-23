/* GDG SRU · 3D Perspective Tilt & Magnetic Micro-Interactions
   Subtle physics-based tilt with dynamic specular glare for team cards, event cards, and CTAs.
   Automatically disabled for touch devices and reduced-motion preferences.
*/
(() => {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || window.matchMedia('(pointer: coarse)').matches) {
    return;
  }

  // Inject subtle glare styles
  const style = document.createElement('style');
  style.id = 'gdg-tilt-styles';
  style.textContent = `
    .gdg-tiltable {
      transform-style: preserve-3d;
      will-change: transform;
    }
    .gdg-tilt-glare {
      position: absolute; inset: 0;
      border-radius: inherit;
      pointer-events: none;
      z-index: 5;
      opacity: 0;
      background: radial-gradient(circle at var(--gx, 50%) var(--gy, 50%), rgba(255, 255, 255, 0.16) 0%, transparent 65%);
      transition: opacity 0.35s ease;
      mix-blend-mode: overlay;
    }
    .gdg-tiltable:hover .gdg-tilt-glare {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  const SELECTOR = '.tm-card, .g16-tl-card, .reference-card, .v18-cta, .cert-card';

  let activeCard = null;
  let rafId = 0;
  let targetX = 0, targetY = 0;
  let rect = null;

  function ensureGlare(card) {
    if (!card.querySelector('.gdg-tilt-glare')) {
      const glare = document.createElement('div');
      glare.className = 'gdg-tilt-glare';
      card.appendChild(glare);
    }
  }

  function updateTransform() {
    if (!activeCard || !rect) return;
    const nx = (targetX - rect.left) / rect.width - 0.5;
    const ny = (targetY - rect.top) / rect.height - 0.5;

    // Check if card is currently flipped (team card back)
    if (activeCard.classList.contains('is-flipped') || activeCard.getAttribute('aria-expanded') === 'true') {
      resetCard(activeCard);
      return;
    }

    const maxTilt = 8.5; // subtle tilt angle
    const rotX = (-ny * maxTilt).toFixed(2);
    const rotY = (nx * maxTilt).toFixed(2);

    activeCard.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.018, 1.018, 1.018)`;
    activeCard.style.setProperty('--gx', `${((nx + 0.5) * 100).toFixed(1)}%`);
    activeCard.style.setProperty('--gy', `${((ny + 0.5) * 100).toFixed(1)}%`);
    rafId = 0;
  }

  function resetCard(card) {
    if (!card) return;
    card.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    card.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
    const glare = card.querySelector('.gdg-tilt-glare');
    if (glare) glare.style.opacity = '0';
  }

  document.addEventListener('pointerover', (e) => {
    const card = e.target.closest && e.target.closest(SELECTOR);
    if (!card) return;
    if (card.classList.contains('is-flipped') || card.getAttribute('aria-expanded') === 'true') return;

    if (activeCard && activeCard !== card) {
      resetCard(activeCard);
    }

    activeCard = card;
    card.classList.add('gdg-tiltable');
    ensureGlare(card);
    rect = card.getBoundingClientRect();
    card.style.transition = 'transform 0.08s ease-out';
  }, { passive: true });

  document.addEventListener('pointermove', (e) => {
    if (!activeCard) return;
    targetX = e.clientX;
    targetY = e.clientY;
    if (!rafId) {
      rafId = requestAnimationFrame(updateTransform);
    }
  }, { passive: true });

  document.addEventListener('pointerout', (e) => {
    if (!activeCard) return;
    const card = e.target.closest && e.target.closest(SELECTOR);
    if (card === activeCard && !card.contains(e.relatedTarget)) {
      resetCard(activeCard);
      activeCard = null;
      rect = null;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }
  }, { passive: true });
})();
