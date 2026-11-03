// ==========================================
// HERNÍ MÓD: STŘELBA NA TERČ (TARGET / PRAK)
// ==========================================

let targetQueue = [];
let targetRing = [];
let targetCurrent = null;
let targetTotal = 20;
let targetSolved = 0;
let targetStartTime = 0;
let targetPenaltySec = 0;
let targetTimerInt = null;
let targetLastSlotIdx = -1;
let targetBestTime = null;      // Rekord pro aktuální sadu slov
let targetLastFinalTime = null; // Výsledný čas právě dohrané hry
let targetIsNewRecord = false;
let targetSavedSet = [];        // Uložená sada unikátních slov z minulého kola

function stopTargetTimer() {
  if (targetTimerInt) { clearInterval(targetTimerInt); targetTimerInt = null; }
}

function getTargetRecordKey() {
  const u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name.toLowerCase().trim() : 'user';
  const s = (typeof selectedSubject !== 'undefined') ? selectedSubject : 'subj';
  const g = (typeof selectedGroupKey !== 'undefined') ? selectedGroupKey : 'grp';
  const mode = (typeof isCampaignMinigame !== 'undefined' && isCampaignMinigame) ? 'cmp12' : 'std20';
  return `best_target_${u}_${s}_${g}_${mode}`;
}

// keepSameSet = true zopakuje naprosto stejný výběr slov jako v minulém kole
function startTargetGame(keepSameSet = false) {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  stopTargetTimer();
  if (typeof isCampaignMinigame !== "undefined") isCampaignMinigame = false;

  const allEligible = getVocabItems().filter(it => {
    const clean = it.question.replace(/\s*\([^)]*\)/g, '').trim();
    return clean.split(/\s+/).length <= 3 && clean.length <= 18;
  });

  if (allEligible.length < 4) {
    alert("V této lekci je příliš málo krátkých slov pro Střelbu na terč (minimum jsou 4).");
    return;
  }

  if (keepSameSet && targetSavedSet.length >= 4) {
    // Opakujeme stejnou sadu slov -> porovnáváme se stejným rekordem
    initTargetSession(targetSavedSet, 20, false);
  } else {
    // Vybíráme novou sadu max 12 unikátních slov (aby se v kole 20 terčů některá zopakovala a zafixovala)
    targetSavedSet = [...allEligible].sort(() => Math.random() - 0.5).slice(0, 12);
    // Pokud má lekce víc než 12 slov a losujeme novou sadu, vymažeme starý čas z jiné sady
    const resetBest = allEligible.length > 12;
    initTargetSession(targetSavedSet, 20, resetBest);
  }
}

function startCampaignTarget() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  stopTargetTimer();
  isCampaignMinigame = true;

  const vItems = (typeof campaignMinigamePool !== "undefined" ? campaignMinigamePool : []).filter(it => {
    const clean = it.question.replace(/\s*\([^)]*\)/g, '').trim();
    return clean.split(/\s+/).length <= 3 && clean.length <= 18;
  });

  if (vItems.length < 4) {
    if (typeof startCampaignPexeso === "function") startCampaignPexeso();
    return;
  }

  targetSavedSet = [...vItems].sort(() => Math.random() - 0.5).slice(0, 10);
  initTargetSession(targetSavedSet, 12, false);
}

function initTargetSession(vItems, count, resetBest = false) {
  targetTotal = count;
  targetSolved = 0;
  targetPenaltySec = 0;
  targetLastSlotIdx = -1;
  targetIsNewRecord = false;

  if (resetBest) {
    targetBestTime = null;
    localStorage.removeItem(getTargetRecordKey());
  } else {
    const savedBest = localStorage.getItem(getTargetRecordKey());
    targetBestTime = savedBest ? parseFloat(savedBest) : null;
  }

  // Sestavíme balíček 20 terčů PŘESNĚ z naší sady vItems (zamíchané pořadí)
  let pool = [];
  while (pool.length < targetTotal) {
    let shuffled = [...vItems].sort(() => Math.random() - 0.5);
    if (pool.length > 0 && shuffled[0].question === pool[pool.length - 1].question && shuffled.length > 1) {
      shuffled.push(shuffled.shift());
    }
    for (let it of shuffled) {
      if (pool.length < targetTotal) pool.push(it);
    }
  }

  targetRing = new Array(8).fill(null);
  targetQueue = [...pool];

  // Nasadíme prvních až 8 unikátních slov na obvod
  let usedQuestions = new Set();
  let slot = 0;
  for (let i = 0; i < targetQueue.length && slot < 8; i++) {
    if (!usedQuestions.has(targetQueue[i].question)) {
      usedQuestions.add(targetQueue[i].question);
      targetRing[slot++] = targetQueue.splice(i, 1)[0];
      i--;
    }
  }

  pickNextTargetCenter();
  selectedGame = "TARGET";
  setScreen("PLAYING");

  targetStartTime = Date.now();
  targetTimerInt = setInterval(updateTargetTimerUI, 100);
}

function updateTargetTimerUI() {
  const el = document.getElementById("target-timer-ui");
  if (!el || targetSolved >= targetTotal) return;
  const elapsed = ((Date.now() - targetStartTime) / 1000) + targetPenaltySec;
  el.innerText = elapsed.toFixed(1) + " s";

  // Živé porovnávání s rekordem (Pacer)
  if (targetBestTime && targetSolved > 0) {
    const expectedTime = (targetBestTime / targetTotal) * targetSolved;
    const diff = elapsed - expectedTime; // záporné = jsme rychlejší (zelená), kladné = pomalejší (červená)
    const paceText = document.getElementById("target-pace-text");
    const paceBar = document.getElementById("target-pace-bar");

    if (paceText) {
      const sign = diff > 0 ? "+" : "";
      paceText.innerText = diff <= 0 ? `⚡ ${sign}${diff.toFixed(1)}s (Náskok!)` : `🐢 +${diff.toFixed(1)}s (Přidej!)`;
      paceText.style.color = diff <= 0 ? "var(--col-green)" : "var(--col-red)";
    }
    if (paceBar) {
      const maxScaleSec = 5; // Plný bargraf při náskoku/ztrátě 5 sekund
      const pct = Math.min(50, Math.abs(diff / maxScaleSec) * 50);
      if (diff <= 0) {
        paceBar.style.left = "50%";
        paceBar.style.width = pct + "%";
        paceBar.style.background = "var(--col-green)";
      } else {
        paceBar.style.left = (50 - pct) + "%";
        paceBar.style.width = pct + "%";
        paceBar.style.background = "var(--col-red)";
      }
    }
  }
}

function pickNextTargetCenter() {
  let availableIndices = [];
  targetRing.forEach((it, idx) => { if (it !== null) availableIndices.push(idx); });

  if (availableIndices.length === 0) {
    targetCurrent = null;
    stopTargetTimer();
    return;
  }

  // OCHRANA PROTI SEKVENCÍM: Nikdy nevybereme stejný slot, který hráč právě trefil (pokud je na výběr jiný)
  let candidates = availableIndices;
  if (availableIndices.length > 1 && targetLastSlotIdx !== -1) {
    candidates = availableIndices.filter(idx => idx !== targetLastSlotIdx);
  }
  // A pokud to jde, nevybereme ani stejné slovo jako minule
  if (candidates.length > 1 && targetCurrent) {
    const diffWords = candidates.filter(idx => targetRing[idx].question !== targetCurrent.question);
    if (diffWords.length > 0) candidates = diffWords;
  }

  const chosenIdx = candidates[Math.floor(Math.random() * candidates.length)];
  targetCurrent = targetRing[chosenIdx];
}

function checkTargetHit(slotIdx) {
  if (!targetCurrent || targetRing[slotIdx] === null) return;
  const hitWord = targetRing[slotIdx];

  if (hitWord.question === targetCurrent.question) {
    sndOk();
    if (typeof isAutoTTS !== "undefined" && isAutoTTS && typeof speakWord === "function") {
      speakWord(hitWord.question, selectedSubject);
    }
    targetSolved++;
    targetLastSlotIdx = slotIdx;

    // Doplníme na uvolněné místo slovo ze zásobníku (které ideálně ještě na obvodu neleží)
    if (targetQueue.length > 0) {
      const onRingSet = new Set(targetRing.filter(Boolean).map(x => x.question));
      let nextIdx = targetQueue.findIndex(x => !onRingSet.has(x.question));
      if (nextIdx === -1) nextIdx = 0;
      targetRing[slotIdx] = targetQueue.splice(nextIdx, 1)[0];
    } else {
      targetRing[slotIdx] = null;
    }

    if (targetSolved >= targetTotal) {
      stopTargetTimer();
      targetLastFinalTime = parseFloat((((Date.now() - targetStartTime) / 1000) + targetPenaltySec).toFixed(1));
      if (!targetBestTime || targetLastFinalTime < targetBestTime) {
        targetBestTime = targetLastFinalTime;
        targetIsNewRecord = true;
        localStorage.setItem(getTargetRecordKey(), String(targetBestTime));
      }
      sndFanfare();
      if (typeof isCampaignMinigame === "undefined" || !isCampaignMinigame) {
        addReward(2, "Střelba: " + selectedGroupKey);
      }
      targetCurrent = null;
    } else {
      pickNextTargetCenter();
    }
    renderActiveGame();
  } else {
    // VEDLE! (+2s penalizace)
    sndErr();
    targetPenaltySec += 2;
    updateTargetTimerUI();
    const nodeEl = document.getElementById(`target-slot-${slotIdx}`);
    if (nodeEl) {
      nodeEl.classList.add("wrong");
      setTimeout(() => { if (nodeEl) nodeEl.classList.remove("wrong"); }, 400);
    }
  }
}

// Přetahování s úzkým kolizním jádrem (nezavadí o okolní slova při průletu)
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
    puck.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.04)`;

    const puckRect = puck.getBoundingClientRect();
    const puckCenterX = puckRect.left + puckRect.width / 2;
    const puckCenterY = puckRect.top + puckRect.height / 2;
    
    // OPRAVA ZAVADĚNÍ: Pouze úzké jádro středu puku (14px) aktivuje terč!
    const coreHitRadius = 14; 

    for (let i = 0; i < 8; i++) {
      const slotEl = document.getElementById(`target-slot-${i}`);
      if (!slotEl) continue;
      const rect = slotEl.getBoundingClientRect();

      // Mírně zmenšíme i samotný hitbox terče o 4px z každé strany, aby šlo projet těsně kolem
      const closestX = Math.max(rect.left + 4, Math.min(puckCenterX, rect.right - 4));
      const closestY = Math.max(rect.top + 4, Math.min(puckCenterY, rect.bottom - 4));
      const dist = Math.hypot(puckCenterX - closestX, puckCenterY - closestY);

      if (dist <= coreHitRadius) {
        isDragging = false;
        try { puck.releasePointerCapture(e.pointerId); } catch(err) {}
        
        puck.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
        puck.style.transform = "translate(-50%, -50%) scale(1)";
        puck.style.zIndex = "20";

        checkTargetHit(i);
        return;
      }
    }
  };

  const endDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    puck.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    puck.style.transform = "translate(-50%, -50%) scale(1)";
    puck.style.zIndex = "20";
  };

  puck.onpointerup = endDrag;
  puck.onpointercancel = endDrag;
}
