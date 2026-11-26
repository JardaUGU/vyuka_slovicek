/**
 * MODUL PRO UI KOMPONENTY, MODÁLY, IKONY A VIZUÁLNÍ EFEKTY
 */

function coinIcon(size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" style="display:inline-block;vertical-align:-0.18em;flex-shrink:0;" aria-hidden="true">` +
    `<circle cx="12" cy="12" r="10.5" fill="#facc15" stroke="#b45309" stroke-width="1.8"/>` +
    `<circle cx="12" cy="12" r="7.5" fill="none" stroke="#fef08a" stroke-width="1.2"/>` +
    `<polygon points="12,6.2 13.7,9.8 17.6,10.3 14.8,13 15.5,16.9 12,15 8.5,16.9 9.2,13 6.4,10.3 10.3,9.8" fill="#b45309" opacity="0.85"/>` +
    `</svg>`;
}

function hideSystemKeyboard() {
  try {
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    if (navigator.virtualKeyboard && typeof navigator.virtualKeyboard.hide === "function") {
      navigator.virtualKeyboard.hide();
    }
  } catch (e) {}
}

function openPinModal({ title, subtitle, placeholder, maskInput, onSubmit }) {
  const prev = document.getElementById("pin-modal-overlay");
  if (prev) prev.remove();

  const overlay = document.createElement("div");
  overlay.id = "pin-modal-overlay";
  overlay.className = "streak-modal-backdrop";

  overlay.innerHTML = `
    <div class="streak-modal-card" onclick="event.stopPropagation()">
      <h3 style="text-align:center;color:var(--col-yellow);margin-bottom:6px;">${title}</h3>
      <p style="text-align:center;font-size:13px;color:var(--col-text-muted);margin-bottom:12px;">${subtitle}</p>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <input id="pin-modal-input" type="${maskInput ? 'password' : 'text'}"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               placeholder="${placeholder || ''}"
               style="flex:1;min-width:0;padding:11px 12px;font-size:18px;border-radius:8px;border:2px solid var(--col-active-tab);background:var(--col-card);color:var(--col-text);user-select:text;-webkit-user-select:text;" />
        <button id="pin-modal-eye" type="button" class="toggle-btn" style="padding:11px 12px;font-size:18px;" title="Zobrazit/skrýt">👁️</button>
      </div>
      <div id="pin-modal-error" style="color:var(--col-red);font-size:13px;font-weight:bold;text-align:center;min-height:18px;margin-bottom:8px;"></div>
      <div class="grid-2">
        <button id="pin-modal-cancel" type="button" class="action-btn" style="margin-top:0;background:var(--col-card-alt);">Zrušit</button>
        <button id="pin-modal-ok" type="button" class="action-btn green" style="margin-top:0;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const inp = document.getElementById("pin-modal-input");
  const errEl = document.getElementById("pin-modal-error");
  const eyeBtn = document.getElementById("pin-modal-eye");

  const closeModal = () => {
    if (inp) {
      inp.readOnly = true;
      inp.disabled = true;
      inp.blur();
    }
    hideSystemKeyboard();
    setTimeout(hideSystemKeyboard, 100);
    if (overlay.parentNode) overlay.remove();
  };

  overlay.onclick = closeModal;
  document.getElementById("pin-modal-cancel").onclick = closeModal;

  eyeBtn.onclick = () => {
    inp.type = (inp.type === "password") ? "text" : "password";
  };

  const handleConfirm = () => {
    const res = onSubmit(inp.value);
    if (res === true) {
      closeModal();
    } else {
      errEl.innerText = res || "Neplatné heslo!";
      inp.select();
    }
  };

  document.getElementById("pin-modal-ok").onclick = handleConfirm;
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleConfirm(); }
  });

  setTimeout(() => { try { inp.focus(); } catch(e) {} }, 60);
}

window.openStreakModal = function(userName, e) {
  if (e) e.stopPropagation();
  const existing = document.getElementById("streak-modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "streak-modal-overlay";
  overlay.className = "streak-modal-backdrop";
  overlay.onclick = () => overlay.remove();

  overlay.innerHTML = `
    <div class="streak-modal-card" onclick="event.stopPropagation()">
      <h3 style="text-align:center; color:var(--col-yellow); margin-bottom:10px;">Přehled série: ${userName}</h3>
      ${typeof renderStreakHistoryBox === 'function' ? renderStreakHistoryBox(userName) : ''}
      <div class="action-btn" style="margin-top:4px; padding:10px;" onclick="document.getElementById('streak-modal-overlay').remove()">Zavřít</div>
    </div>
  `;
  document.body.appendChild(overlay);
};

window.lastClickX = window.innerWidth / 2;
window.lastClickY = window.innerHeight / 2;
window.addEventListener('pointerdown', (e) => {
  window.lastClickX = e.clientX;
  window.lastClickY = e.clientY;
}, true);

function showFloatingPoint(text = "+1 ★") {
  if (selectedGame === "PEXESO" || selectedGame === "STORY" || selectedGame === "SNAKE") return;

  const el = document.createElement("div");
  el.className = "floating-point";
  el.innerText = text;
  el.style.left = window.lastClickX + "px";
  el.style.top = window.lastClickY + "px";
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 850);
}

function triggerConfetti() {
  let canvas = document.getElementById('confetti-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.id = 'confetti-canvas';
    document.body.appendChild(canvas);
  }
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');

  const particles = [];
  const colors = ['#22c55e', '#3b82f6', '#facc15', '#ef4444', '#a855f7'];

  for (let i = 0; i < 80; i++) {
    particles.push({
      x: canvas.width / 2,
      y: canvas.height / 2 + 50,
      r: Math.random() * 6 + 4,
      dx: Math.random() * 10 - 5,
      dy: Math.random() * -10 - 5,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let active = false;
    particles.forEach(p => {
      p.x += p.dx;
      p.y += p.dy;
      p.dy += 0.4;
      if (p.y < canvas.height) active = true;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    frame++;
    if (active && frame < 150) requestAnimationFrame(animate);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  animate();
}
