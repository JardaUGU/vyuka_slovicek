// ==========================================
// HERNÍ MÓD: STŘELBA NA TERČ (TARGET / PRAK)
// ==========================================

let targetQueue = [];      // Zásobník zbývajících slov k nasazení
let targetRing = [];       // 8 slotů po obvodu (buď objekt slova, nebo null)
let targetCurrent = null;  // Aktuální hledané slovo uprostřed
let targetTotal = 20;      // Celkový počet slov v kole
let targetSolved = 0;      // Počet trefených slov
let targetStartTime = 0;   // Čas startu
let targetPenaltySec = 0;  // Trestné sekundy za chyby
let targetTimerInt = null;
let targetHoveredIdx = -1; // Který terč je právě zaměřen při tažení

function stopTargetTimer() {
  if (targetTimerInt) { clearInterval(targetTimerInt); targetTimerInt = null; }
}

function startTargetGame() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  stopTargetTimer();

  const vItems = getVocabItems().filter(it => {
    const clean = it.question.replace(/\s*\([^)]*\)/g, '').trim();
    return clean.split(/\s+/).length <= 3 && clean.length <= 18;
  });

  if (vItems.length < 4) {
    alert("V této lekci je příliš málo krátkých slov pro Střelbu na terč (minimum jsou 4).");
    return;
  }

  // Sestavíme balíček 20 slov (pokud má lekce méně než 20 slov, zrecyklujeme je)
  let pool = [];
  while (pool.length < 20) {
    let shuffled = [...vItems].sort(() => Math.random() - 0.5);
    for (let it of shuffled) {
      if (pool.length < 20) pool.push(it);
    }
  }

  targetTotal = pool.length;
  targetSolved = 0;
  targetPenaltySec = 0;
  
  // Prvních až 8 unikátních slov dáme do kruhu po obvodu
  const ringCount = Math.min(8, vItems.length);
  targetRing = new Array(8).fill(null);
  targetQueue = [...pool];

  for (let i = 0; i < ringCount; i++) {
    targetRing[i] = targetQueue.shift();
  }

  pickNextTargetCenter();
  selectedGame = "TARGET";
  setScreen("PLAYING");

  targetStartTime = Date.now();
  targetTimerInt = setInterval(() => {
    const el = document.getElementById("target-timer-ui");
    if (el && targetSolved < targetTotal) {
      const elapsed = ((Date.now() - targetStartTime) / 1000) + targetPenaltySec;
      el.innerText = elapsed.toFixed(1) + " s";
    }
  }, 100);
}

function pickNextTargetCenter() {
  const activeTargets = targetRing.filter(Boolean);
  if (activeTargets.length === 0) {
    targetCurrent = null;
    stopTargetTimer();
    return;
  }
  // Vylosujeme jedno ze slov, která jsou aktuálně na obvodu
  targetCurrent = activeTargets[Math.floor(Math.random() * activeTargets.length)];
}

function checkTargetHit(slotIdx) {
  if (!targetCurrent || targetRing[slotIdx] === null) return;
  const hitWord = targetRing[slotIdx];

  if (hitWord.question === targetCurrent.question) {
    // ZÁSAH!
    sndOk();
    if (typeof isAutoTTS !== "undefined" && isAutoTTS && typeof speakWord === "function") {
      speakWord(hitWord.question, selectedSubject);
    }
    targetSolved++;

    // Doplníme na uvolněné místo další slovo ze zásobníku (pokud ještě nějaké zbývá)
    if (targetQueue.length > 0) {
      targetRing[slotIdx] = targetQueue.shift();
    } else {
      targetRing[slotIdx] = null; // Zásobník došel, terče už jen mizí!
    }

    if (targetSolved >= targetTotal) {
      stopTargetTimer();
      sndFanfare();
      addReward(2, "Střelba: " + selectedGroupKey);
      targetCurrent = null;
    } else {
      pickNextTargetCenter();
    }
    renderActiveGame();
  } else {
    // VEDLE! (+2s penalizace)
    sndErr();
    targetPenaltySec += 2;
    const nodeEl = document.getElementById(`target-slot-${slotIdx}`);
    if (nodeEl) {
      nodeEl.classList.add("wrong");
      setTimeout(() => { if (nodeEl) nodeEl.classList.remove("wrong"); }, 400);
    }
  }
}

// Obsluha přetahování s okamžitou detekcí dotyku (Kolize kruhu s terčem)
function attachTargetDragHandlers() {
  const puck = document.getElementById("target-center-puck");
  if (!puck) return;

  let isDragging = false;
  let startX = 0, startY = 0;

  puck.onpointerdown = (e) => {
    e.preventDefault();
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    puck.setPointerCapture(e.pointerId);
    puck.style.transition = "none";
    puck.style.zIndex = "100";
  };

  puck.onpointermove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    puck.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.05)`;

    // Skutečné souřadnice středu a poloměr taženého kruhu
    const puckRect = puck.getBoundingClientRect();
    const puckCenterX = puckRect.left + puckRect.width / 2;
    const puckCenterY = puckRect.top + puckRect.height / 2;
    // Poloměr zmenšíme o pár pixelů (0.38), aby stačil lehký překryv s terčem
    const hitRadius = puckRect.width * 0.38; 

    for (let i = 0; i < 8; i++) {
      const slotEl = document.getElementById(`target-slot-${i}`);
      if (!slotEl) continue;
      const rect = slotEl.getBoundingClientRect();

      // Najdeme nejbližší bod na obdélníku terče vůči středu našeho kruhu
      const closestX = Math.max(rect.left, Math.min(puckCenterX, rect.right));
      const closestY = Math.max(rect.top, Math.min(puckCenterY, rect.bottom));
      const dist = Math.hypot(puckCenterX - closestX, puckCenterY - closestY);

      // OKAMŽITÝ DOTYK! Nečekáme na puštění prstu/myši
      if (dist <= hitRadius) {
        isDragging = false; // Ukončíme aktuální tah
        try { puck.releasePointerCapture(e.pointerId); } catch(err) {}
        
        // Pokud trefil špatně, vrátíme kruh plynule doprostřed (při správné trefě se překreslí celá hra)
        puck.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        puck.style.transform = "translate(-50%, -50%) scale(1)";
        puck.style.zIndex = "20";

        checkTargetHit(i);
        return;
      }
    }
  };

  const endDrag = (e) => {
    if (!isDragging) return;
    isDragging = false;
    puck.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    puck.style.transform = "translate(-50%, -50%) scale(1)";
    puck.style.zIndex = "20";
  };

  puck.onpointerup = endDrag;
  puck.onpointercancel = endDrag;
}
