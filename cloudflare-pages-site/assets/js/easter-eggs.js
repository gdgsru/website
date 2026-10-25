/* GDG SRU · Developer Easter Eggs & Interactive Surprises
   1. Konami Code (↑ ↑ ↓ ↓ ← → ← → B A)
   2. Developer Console Terminal greeting & gdg.* CLI tools
   3. Rapid 5-Click Header Logo Sparkle Trigger
   4. Interactive Lotus Water Ripples
*/
(() => {
  'use strict';
  const COLORS = ['#4285F4', '#EA4335', '#FBBC04', '#34A853'];

  /* ---------- 1. 8-Bit Retro Audio Synthesis (Zero audio files) ---------- */
  function play8BitVictory() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.09);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.09 + 0.18);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.09);
        osc.stop(ctx.currentTime + i * 0.09 + 0.2);
      });
    } catch (_) { console.warn('[App] Operation notice:', _); }
  }

  /* ---------- 2. Google Confetti Cannon ---------- */
  function fireConfetti() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483640';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const W = (canvas.width = window.innerWidth);
    const H = (canvas.height = window.innerHeight);

    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: W * 0.5 + (Math.random() - 0.5) * 200,
        y: H * 0.45 + (Math.random() - 0.5) * 100,
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 4,
        size: Math.random() * 9 + 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        rSpeed: (Math.random() - 0.5) * 10,
        shape: Math.random() > 0.4 ? 'rect' : 'circle',
        life: 1,
        decay: Math.random() * 0.008 + 0.008
      });
    }

    let raf = 0;
    function render() {
      ctx.clearRect(0, 0, W, H);
      let alive = false;
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.38;
        p.vx *= 0.985;
        p.rotation += p.rSpeed;
        p.life -= p.decay;
        if (p.life > 0) {
          alive = true;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.life);
          if (p.shape === 'rect') {
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.7);
          } else {
            ctx.beginPath();
            ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      });
      if (alive) {
        raf = requestAnimationFrame(render);
      } else {
        cancelAnimationFrame(raf);
        canvas.remove();
      }
    }
    render();
  }

  /* ---------- 3. Toast Badge Notification ---------- */
  function showEasterToast(message) {
    const old = document.getElementById('gdg-easter-toast');
    if (old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'gdg-easter-toast';
    toast.innerHTML = `<span style="font-size:18px;font-family:monospace;font-weight:bold">&lt;/&gt;</span> <div><b>CHEAT CODE UNLOCKED</b><p style="margin:2px 0 0;font-size:13px;opacity:0.85">${message}</p></div>`;
    toast.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(30px);background:rgba(18,19,22,0.92);color:#fff;padding:12px 22px;border-radius:999px;border:1px solid rgba(255,255,255,0.22);box-shadow:0 12px 36px rgba(0,0,0,0.45);font:500 14px Google Sans,var(--f-body),system-ui,sans-serif;z-index:2147483645;display:flex;align-items:center;gap:12px;opacity:0;transition:all 0.4s cubic-bezier(0.16,1,0.3,1);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);pointer-events:none';
    document.body.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
      setTimeout(() => toast.remove(), 400);
    }, 4500);
  }

  /* ---------- 4. Konami Code Listener ---------- */
  // Konami code dropped for launch: the listener is switched off.
  const KONAMI_ENABLED = false;
  const KONAMI = ['arrowup','arrowup','arrowdown','arrowdown','arrowleft','arrowright','arrowleft','arrowright','b','a'];
  let kIdx = 0;
  if (KONAMI_ENABLED) window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const expected = KONAMI[kIdx];
    if (key === expected) {
      kIdx++;
      if (kIdx === KONAMI.length) {
        kIdx = 0;
        play8BitVictory();
        fireConfetti();
        showEasterToast('Welcome to GDG on Campus SR University · Built by students, for students.');
      }
    } else {
      kIdx = (key === KONAMI[0]) ? 1 : 0;
    }
  });

  /* ---------- 5. Rapid 5-Click on Logo ---------- */
  let clicks = 0, lastClick = 0;
  document.addEventListener('click', (e) => {
    const logo = e.target.closest && e.target.closest('.lg, #lgs');
    if (!logo) return;
    const now = performance.now();
    if (now - lastClick < 450) {
      clicks++;
      if (clicks >= 5) {
        clicks = 0;
        play8BitVictory();
        fireConfetti();
        showEasterToast('✨ You discovered the secret core! Have some Google confetti.');
      }
    } else {
      clicks = 1;
    }
    lastClick = now;
  });

  /* ---------- 6. Developer Console Greeting & CLI Tools (F12) ---------- */
  const banner = `
%c  ____ ____   ____    ____  ____  _   _ 
 / ___|  _ \\ / ___|  / ___||  _ \\| | | |
| |  _| | | | |  _   \\___ \\| |_) | | | |
| |_| | |_| | |_| |   ___) |  _ <| |_| |
 \\____|____/ \\____|  |____/|_| \\_\\\\___/ 

 %cGoogle Developer Group on Campus · SR University
 %cCurious minds build the future. Interested in building with us?
 Type %cgdg.help()%c to see secret console commands.
`;
  console.log(
    banner,
    'color:#4285F4;font-weight:bold;font-family:monospace;font-size:12px',
    'color:#34A853;font-weight:bold;font-size:14px',
    'color:#5f6368;font-size:12px',
    'color:#EA4335;font-weight:bold;font-size:12px;background:#fce8e6;padding:2px 6px;border-radius:4px',
    'color:#5f6368;font-size:12px'
  );

  window.gdg = {
    help: () => {
      console.log('%cGDG SRU Console Commands:', 'font-weight:bold;color:#4285F4');
      console.log('  gdg.search()    - Open Developer Command Palette (Ctrl+K) ');
      console.log('  gdg.confetti()  - Fire the confetti cannon ');
      console.log('  gdg.matrix()    - Toggle secret Matrix hacker theme ️');
      console.log('  gdg.events()    - Show upcoming chapter events in console ');
      console.log('  gdg.join()      - Jump to the community join page ');
      console.log('  gdg.discord()   - Open the official Discord server ');
      return 'Happy hacking!';
    },
    search: () => {
      if (window.gdgCommandPalette) window.gdgCommandPalette.open();
      return ' Opened Command Palette (Ctrl+K).';
    },
    confetti: () => {
      play8BitVictory();
      fireConfetti();
      return ' Confetti launched!';
    },
    matrix: () => {
      const id = 'gdg-matrix-theme';
      const existing = document.getElementById(id);
      if (existing) {
        existing.remove();
        return 'Matrix theme deactivated.';
      }
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        html, body, #app { filter: invert(0.92) hue-rotate(95deg) contrast(1.2) !important; }
        body { font-family: monospace !important; }
      `;
      document.head.appendChild(style);
      return '️ Welcome to the Matrix. Run gdg.matrix() again to return to normal.';
    },
    events: () => {
      if (window.supabase) {
        window.supabase.from('public_event_list').select('title, category, start_at, venue').then(({data}) => {
          console.table(data);
        });
        return 'Fetching live events from database...';
      }
      return 'Check out /events/ for upcoming sessions!';
    },
    join: () => {
      window.location.assign('/join/');
      return 'Navigating to /join/...';
    },
    discord: () => {
      window.open('https://discord.gg/htSJMNcdZs', '_blank');
      return 'Opening Discord...';
    }
  };

  /* ---------- 7. Interactive Lotus Water Ripples ---------- */
  document.addEventListener('click', (e) => {
    const lotus = e.target.closest && e.target.closest('#gdg-lotus');
    if (!lotus) return;
    const stage = lotus.querySelector('.lt-stage');
    if (!stage) return;
    const rings = stage.querySelector('#lt-rings');
    if (!rings) return;
    const rect = stage.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 800;
    const clickY = ((e.clientY - rect.top) / rect.height) * 420;

    const ripple = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    ripple.setAttribute('cx', clickX.toFixed(1));
    ripple.setAttribute('cy', clickY.toFixed(1));
    ripple.setAttribute('rx', '8');
    ripple.setAttribute('ry', '3');
    ripple.setAttribute('fill', 'none');
    ripple.setAttribute('stroke', '#fff');
    ripple.setAttribute('stroke-width', '1.5');
    ripple.setAttribute('opacity', '0.7');
    rings.appendChild(ripple);

    let r = 8, op = 0.7;
    const anim = () => {
      r += 2.8;
      op -= 0.024;
      ripple.setAttribute('rx', r.toFixed(1));
      ripple.setAttribute('ry', (r * 0.32).toFixed(1));
      ripple.setAttribute('opacity', Math.max(0, op).toFixed(2));
      if (op > 0) requestAnimationFrame(anim);
      else ripple.remove();
    };
    requestAnimationFrame(anim);
  });
})();
