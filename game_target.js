// ==========================================
// HERNÍ MÓD: STŘELBA NA TERČ (TARGET / PRAK)
// ==========================================

let targetQueue = [];
let targetRing = [];
let targetCurrent = null;
let targetTotal = 15;
let targetSolved = 0;
let targetStartTime = 0;
let targetPenaltySec = 0;
let targetTimerInt = null;
let targetLastSlotIdx = -1;
let targetBestTime = null;
let targetPrevBestTime = null;
let targetLastFinalTime = null;
let targetIsNewRecord = false;
let targetSavedSet = [];
let targetLastSplitDiff = 0;

function stopTargetTimer() {
  if (targetTimerInt) { clearInterval(targetTimerInt); targetTimerInt = null; }
}

function getTargetRecordKey() {
  const u = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.name.toLowerCase().trim() : 'user';
  const s = (typeof selectedSubject !== 'undefined') ? selectedSubject : 'subj';
  const g = (typeof selectedGroupKey !== 'undefined') ? selectedGroupKey : 'grp';
  const mode = (typeof isCampaignMinigame !== 'undefined' && isCampaignMinigame) ? 'cmp' : 'std';
  return `best_target_${u}_${s}_${g}_${mode}_${targetTotal}`;
}

// Spuštění Střelby přímo s 15 slovy z právě dokončeného bloku Zkoušení (Bod 3)
function startTargetFromAdaptiveBatch() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  stopTargetTimer();
  if (typeof isCampaignMinigame !== "undefined") isCampaignMinigame = false;

  const vItems = getVocabItems();
  let batchWords = (typeof isAdaptiveBatchMode !== 'undefined' && isAdaptiveBatchMode && adaptiveBatchIndices.length > 0)
    ? adaptiveBatchIndices.map(i => vItems[i]).filter(Boolean)
    : vItems;

  const eligible = batchWords.filter(it => it.question.replace(/\s*\([^)]*\)/g, '').trim().length <= 20);
  if (eligible.length < 3) {
    alert("V tomto bloku jsou příliš dlouhé věty pro Střelbu na terč.");
    return;
  }
  targetSavedSet = [...eligible];
  initTargetSession(targetSavedSet, false);
}

function startTargetGame(keepSameSet = false) {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  stopTargetTimer();
  if (typeof isCampaignMinigame !== "undefined") isCampaignMinigame = false;

  const allEligible = getVocabItems().filter(it => {
    const clean = it.question.replace(/\s*\([^)]*\)/g, '').trim();
    return clean.split(/\s+/).length <= 3 && clean.length <= 20;
  });

  if (allEligible.length < 3) {
    alert("V této lekci je příliš málo krátkých slov pro Střelbu na terč.");
    return;
  }

  if (keepSameSet && targetSavedSet.length >= 3) {
    initTargetSession(targetSavedSet, false);
  } else {
    // Vybereme max 15 UNIKÁTNÍCH slov (každé půjde v kole přesně 1x!)
    targetSavedSet = [...allEligible].sort(() => Math.random() - 0.5).slice(0, 15);
    const resetBest = allEligible.length > 15;
    initTargetSession(targetSavedSet, resetBest);
  }
}

function startCampaignTarget() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  stopTargetTimer();
  isCampaignMinigame = true;

  const vItems = (typeof campaignMinigamePool !== "undefined" ? campaignMinigamePool : []).filter(it => {
    const clean = it.question.replace(/\s*\([^)]*\)/g, '').trim();
    return clean.split(/\s+/).length <= 3 && clean.length <= 20;
  });

  // Odstraníme případné duplicity v campaignMinigamePool
  const uniqueItems = [];
  const seen = new Set();
  for (let it of vItems) {
    if (!seen.has(it.question)) {
      seen.add(it.question);
      uniqueItems.push(it);
    }
  }

  if (uniqueItems.length < 4) {
    if (typeof startCampaignPexeso === "function") startCampaignPexeso();
    return;
  }

  targetSavedSet = uniqueItems.sort(() => Math.random() - 0.5).slice(0, 12);
  initTargetSession(targetSavedSet, false);
}

// OPRAVA (Bod 5): Žádné opakování slov! Každé slovo ze sady vItems je použito přesně jednou.
function initTargetSession(vItems, resetBest = false) {
  let pool = [...vItems].sort(() => Math.random() - 0.5);
  targetTotal = pool.length;
  targetSolved = 0;
  targetPenaltySec = 0;
  targetLastSlotIdx = -1;
  targetIsNewRecord = false;
  targetLastSplitDiff = 0;

  if (resetBest) {
    targetBestTime = null;
    targetPrevBestTime = null;
    localStorage.removeItem(getTargetRecordKey());
  } else {
    const savedBest = localStorage.getItem(getTargetRecordKey());
    targetBestTime = savedBest ? parseFloat(savedBest) : null;
    targetPrevBestTime = targetBestTime;
  }

  targetRing = new Array(8).fill(null);
  targetQueue = [...pool];

  // Nasadíme prvních až 8 slov na obvod, zbytek čeká v targetQueue
  const initialRingCount = Math.min(8, targetQueue.length);
  for (let i = 0; i < initialRingCount; i++) {
    targetRing[i] = targetQueue.shift();
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
}

// Vykreslí stav mezičasu (volá se po každém zásahu nebo chybě)
function renderTargetSplitPace() {
  if (!targetPrevBestTime || targetSolved === 0) return;
  const paceText = document.getElementById("target-pace-text");
  const paceBar = document.getElementById("target-pace-bar");

  // targetLastSplitDiff > 0 znamená JSEM RYCHLEJŠÍ (v plusu!), < 0 znamená JSEM POMALEJŠÍ
  const diff = targetLastSplitDiff;
  if (paceText) {
    if (diff >= 0) {
      paceText.innerText = `⚡ +${diff.toFixed(1)}s v plusu`;
      paceText.style.color = "var(--col-green)";
    } else {
      paceText.innerText = `🐢 ${diff.toFixed(1)}s ztráta`;
      paceText.style.color = "var(--col-red)";
    }
  }
  if (paceBar) {
    // Plná šířka poloviny bargrafu (50 %) odpovídá 25 % celkového rekordu (např. 10s u 40s rekordu)
    const maxScaleSec = Math.max(3, targetPrevBestTime * 0.25);
    const pct = Math.min(50, (Math.abs(diff) / maxScaleSec) * 50);
    if (diff >= 0) {
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

function pickNextTargetCenter() {
  let availableIndices = [];
  targetRing.forEach((it, idx) => { if (it !== null) availableIndices.push(idx); });

  if (availableIndices.length === 0) {
    targetCurrent = null;
    stopTargetTimer();
    return;
  }

  let candidates = availableIndices;
  if (availableIndices.length > 1 && targetLastSlotIdx !== -1) {
    candidates = availableIndices.filter(idx => idx !== targetLastSlotIdx);
  }
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

    // VÝPOČET MEZIČASU PŘESNĚ V OKAMŽIKU ZÁSAHU!
    if (targetPrevBestTime) {
      const elapsedNow = ((Date.now() - targetStartTime) / 1000) + targetPenaltySec;
      const expectedTime = (targetPrevBestTime / targetTotal) * targetSolved;
      // Kladné číslo = kolik sekund jsme ušetřili oproti rekordu!
      targetLastSplitDiff = expectedTime - elapsedNow;
    }

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
      
      // Pokud překonal již existující rekord, dostane +1 zlaťák!
      if (targetPrevBestTime && targetLastFinalTime < targetPrevBestTime) {
        targetIsNewRecord = true;
        targetBestTime = targetLastFinalTime;
        localStorage.setItem(getTargetRecordKey(), String(targetBestTime));
        if (typeof currentUser !== "undefined" && currentUser && typeof addCoins === "function") {
          addCoins(currentUser.name, 1);
        }
      } else if (!targetPrevBestTime) {
        targetBestTime = targetLastFinalTime;
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
    targetLastSplitDiff -= 2; // Okamžitě zhorší i mezičas o 2s
    updateTargetTimerUI();
    renderTargetSplitPace();
    const nodeEl = document.getElementById(`target-slot-${slotIdx}`);
    if (nodeEl) {
      nodeEl.classList.add("wrong");
      setTimeout(() => { if (nodeEl) nodeEl.classList.remove("wrong"); }, 400);
    }
  }
}

// Přetahování s vykreslováním laserového paprsku (gumičky) ze středu
function attachTargetDragHandlers() {
  const puck = document.getElementById("target-center-puck");
  const laserLine = document.getElementById("target-laser-line");
  const arena = document.querySelector(".target-arena");
  if (!puck || !arena) return;

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
    if (laserLine) laserLine.style.display = "block";
  };

  puck.onpointermove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    puck.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.04)`;

    // Aktualizace laserové čáry ze středu arény do středu puku
    if (laserLine) {
      const arenaRect = arena.getBoundingClientRect();
      const cx = arenaRect.width / 2;
      const cy = arenaRect.height / 2;
      laserLine.setAttribute("x1", cx);
      laserLine.setAttribute("y1", cy);
      laserLine.setAttribute("x2", cx + dx);
      laserLine.setAttribute("y2", cy + dy);
    }

    const puckRect = puck.getBoundingClientRect();
    const puckCenterX = puckRect.left + puckRect.width / 2;
    const puckCenterY = puckRect.top + puckRect.height / 2;
    const coreHitRadius = 14; 

    for (let i = 0; i < 8; i++) {
      const slotEl = document.getElementById(`target-slot-${i}`);
      if (!slotEl) continue;
      const rect = slotEl.getBoundingClientRect();

      const closestX = Math.max(rect.left + 4, Math.min(puckCenterX, rect.right - 4));
      const closestY = Math.max(rect.top + 4, Math.min(puckCenterY, rect.bottom - 4));
      const dist = Math.hypot(puckCenterX - closestX, puckCenterY - closestY);

      if (dist <= coreHitRadius) {
        isDragging = false;
        try { puck.releasePointerCapture(e.pointerId); } catch(err) {}
        if (laserLine) laserLine.style.display = "none";
        
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
    if (laserLine) laserLine.style.display = "none";
    puck.style.transition = "transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)";
    puck.style.transform = "translate(-50%, -50%) scale(1)";
    puck.style.zIndex = "20";
  };

  puck.onpointerup = endDrag;
  puck.onpointercancel = endDrag;
}
