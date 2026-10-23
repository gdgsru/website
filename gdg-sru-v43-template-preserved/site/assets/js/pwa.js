/* GDG SRU · Progressive Web App (PWA) Registration & Offline Indicator
   Registers service worker and displays clean status toast on network change.
*/
(() => {
  'use strict';

  // 1. Service Worker Registration
  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
    });
  }

  // 2. Offline / Online Status Indicator
  let toastEl = null;

  function showStatusToast(isOnline) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.id = 'gdg-pwa-toast';
      toastEl.style.cssText = `
        position: fixed; bottom: 24px; left: 24px; z-index: 2147483640;
        padding: 9px 16px; border-radius: 999px;
        font: 500 13px Google Sans, system-ui, sans-serif;
        display: flex; align-items: center; gap: 8px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
        transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        opacity: 0; transform: translateY(12px);
        pointer-events: none;
      `;
      document.body.appendChild(toastEl);
    }

    if (!isOnline) {
      toastEl.innerHTML = `<span>Offline Campus Mode · Browsing cached site</span>`;
      toastEl.style.background = 'rgba(234, 67, 53, 0.9)';
      toastEl.style.color = '#fff';
      toastEl.style.border = '1px solid rgba(255, 255, 255, 0.25)';
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';
    } else {
      toastEl.innerHTML = `<span>Connection restored · You are back online</span>`;
      toastEl.style.background = 'rgba(52, 168, 83, 0.9)';
      toastEl.style.color = '#fff';
      toastEl.style.border = '1px solid rgba(255, 255, 255, 0.25)';
      toastEl.style.opacity = '1';
      toastEl.style.transform = 'translateY(0)';

      setTimeout(() => {
        if (toastEl) {
          toastEl.style.opacity = '0';
          toastEl.style.transform = 'translateY(12px)';
        }
      }, 3200);
    }
  }

  window.addEventListener('offline', () => showStatusToast(false));
  window.addEventListener('online', () => showStatusToast(true));

  // Check initial state if already offline upon load
  if (typeof navigator.onLine === 'boolean' && !navigator.onLine) {
    window.addEventListener('DOMContentLoaded', () => showStatusToast(false));
  }
})();
