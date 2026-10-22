// ==========================================
// HERNÍ MÓDY: KARTY, ZKOUŠENÍ, SKLÁDÁNÍ, KVÍZ, ŘADA NA ČAS
// ==========================================

// --- GLOBÁLNÍ STAVOVÉ PROMĚNNÉ ---
let vCardIdx = 0;
let vMastery = {}, vActivePool = 3, vCurrentWord = 0, vLastWord = -1, vQuizRevealed = false;
let adaptiveBatchIndices = [];
let isAdaptiveBatchMode = false;

let scrambleDeck = [], scramblePlaced = [], scrambleTiles = [], scrambleIsWordMode = false, scrambleHadMistake = false, scrambleDone = false, scrambleSolvedCount = 0;
let qCurStep = 0, qAnswered = false, qChosenOpt = null, qActiveList = [];
let seqTargetIdx = 0, seqSlots = [], seqStartTime = 0, seqTimerInterval = null, seqHintActive = false, seqInactivityTimer = null;


// --- POMOCNÉ FUNKCE ---
function formatPromptText(text) {
  if (!text) return "";
  return text.replace(/\*([^*]+)\*/g, '<b style="color:var(--col-yellow);text-decoration:underline;">$1</b>');
}


// ==========================================
// 1. KARTY (FLASHCARDS)
// ==========================================
function vCardNext() {
  const vItems = getVocabItems();
  if (vItems.length === 0) return;
  vCardIdx = (vCardIdx + 1) % vItems.length;
  renderActiveGame();
  if (isAutoTTS && vItems.length > 0) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function vCardPrev() {
  const vItems = getVocabItems();
  if (vItems.length === 0) return;
  vCardIdx = (vCardIdx + vItems.length - 1) % vItems.length;
  renderActiveGame();
  if (isAutoTTS && vItems.length > 0) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function speakCurrentCard() {
  const vItems = getVocabItems();
  if (vItems[vCardIdx]) speakWord(vItems[vCardIdx].question, selectedSubject);
}


// ==========================================
// 2. ZKOUŠENÍ Z HLAVY (ADAPTIVE) + INITIALIZACE HER
// ==========================================
function initGameState() {
  const vItems = getVocabItems();
  const qItems = getQuizItems();
  const sItems = getSeqItems();

  if (vItems.length > 0) {
    vMastery = {};
    vItems.forEach((w, i) => { vMastery[i] = getSavedMastery(w.question, testingDirection); });

    if (vItems.length > 15) {
      isAdaptiveBatchMode = true;
      let unmastered = [];
      vItems.forEach((_, i) => { if ((vMastery[i] || 0) < 2) unmastered.push(i); });

      let m0 = unmastered.filter(i => (vMastery[i] || 0) === 0).sort(() => Math.random() - 0.5);
      let m1 = unmastered.filter(i => (vMastery[i] || 0) === 1).sort(() => Math.random() - 0.5);
      let candidates = [...m0, ...m1];

      let batchSize = Math.min(15, unmastered.length > 0 ? unmastered.length : 15);
      adaptiveBatchIndices = candidates.slice(0, batchSize);

      if (adaptiveBatchIndices.length < batchSize) {
        let remaining = vItems.map((_, i) => i).filter(i => !adaptiveBatchIndices.includes(i)).sort(() => Math.random() - 0.5);
        adaptiveBatchIndices.push(...remaining.slice(0, batchSize - adaptiveBatchIndices.length));
      }
    } else {
      isAdaptiveBatchMode = false;
      adaptiveBatchIndices = vItems.map((_, i) => i);
    }

    let masteredInBatch = 0;
    adaptiveBatchIndices.forEach(i => { if ((vMastery[i] || 0) >= 2) masteredInBatch++; });

    vActivePool = Math.min(adaptiveBatchIndices.length, Math.max(getAdaptiveWindowSize(currentUser ? currentUser.grade : 2), masteredInBatch + 3));
    vLastWord = -1; 
    vCardIdx = 0;

    if (selectedGame === "CARDS" && isAutoTTS) speakWord(vItems[0].question, selectedSubject);
    if (selectedGame === "ADAPTIVE") pickNextAdaptiveWord();
    if (selectedGame === "SCRAMBLE") { scrambleDeck = []; scrambleSolvedCount = 0; initScramble(); }
  }

  if (selectedGame === "QUIZ" && qItems.length > 0) {
    qActiveList = [...qItems].sort(() => Math.random() - 0.5).slice(0, 10);
    qCurStep = 0; qAnswered = false; qChosenOpt = null;
  }

  if (selectedGame === "SEQ" && sItems.length > 0) initSequence();
}

function getMasteryStats() {
  const vItems = getVocabItems();
  if (vItems.length === 0) return { current: 0, total: 1, masteredCount: 0, totalWords: 1 };
  
  const pool = isAdaptiveBatchMode ? adaptiveBatchIndices : vItems.map((_, i) => i);
  let current = 0, masteredCount = 0;
  pool.forEach(i => {
    const m = vMastery[i] || 0;
    current += m;
    if (m >= 2) masteredCount++;
  });
  return { current, total: pool.length * 2, masteredCount, totalWords: pool.length };
}

function pickNextAdaptiveWord() {
  const vItems = getVocabItems();
  vQuizRevealed = false;
  const stats = getMasteryStats();
  if (stats.masteredCount >= stats.totalWords) { vCurrentWord = -1; return; }

  const pool = isAdaptiveBatchMode ? adaptiveBatchIndices : vItems.map((_, i) => i);
  let available = pool.filter(i => (vMastery[i] || 0) < 2);
  let candidates = (available.length > 1 && vLastWord !== -1) ? available.filter(i => i !== vLastWord) : available;

  const mistakes = candidates.filter(i => (vMastery[i] || 0) === 0);
  vCurrentWord = (mistakes.length > 0 && Math.random() < 0.75) 
    ? mistakes[Math.floor(Math.random() * mistakes.length)] 
    : candidates[Math.floor(Math.random() * candidates.length)];
    
  vLastWord = vCurrentWord;

  if (testingDirection === "DIR_IN" && isAutoTTS && vCurrentWord !== -1) {
    speakWord(vItems[vCurrentWord].question, selectedSubject);
  }
}

function revealAdaptiveQuiz() {
  vQuizRevealed = true;
  renderActiveGame();
  if (isAutoTTS && vCurrentWord !== -1) speakWord(getVocabItems()[vCurrentWord].question, selectedSubject);
}

function speakAdaptiveCurrent() {
  const vItems = getVocabItems();
  if (vItems[vCurrentWord]) speakWord(vItems[vCurrentWord].question, selectedSubject);
}

function answerAdaptive(known) {
  const vItems = getVocabItems();
  const w = vItems[vCurrentWord];
  if (known) {
    sndOk(); addReward(1, selectedGroupKey);
    vMastery[vCurrentWord] = Math.min(2, (vMastery[vCurrentWord] || 0) + 1);
    saveWordMasteryToGoogle(w.question, vMastery[vCurrentWord], testingDirection);
  } else {
    sndErr(); vMastery[vCurrentWord] = 0;
    saveWordMasteryToGoogle(w.question, 0, testingDirection);
  }
  pickNextAdaptiveWord();
  renderActiveGame();
}


// ==========================================
// 3. SKLÁDÁNÍ SLOV (SCRAMBLE)
// ==========================================
function startScrambleFromAdaptiveBatch() {
  selectedGame = "SCRAMBLE";
  scrambleDeck = [...adaptiveBatchIndices].sort(() => Math.random() - 0.5);
  scrambleSolvedCount = 0;
  initScramble();
  setScreen("PLAYING");
}

function initScramble() {
  const vItems = getVocabItems();
  if (isAdaptiveBatchMode && adaptiveBatchIndices && adaptiveBatchIndices.length > 0) {
    if (!scrambleDeck || scrambleDeck.length === 0) scrambleDeck = [...adaptiveBatchIndices].sort(() => Math.random() - 0.5);
  } else {
    if (!scrambleDeck || scrambleDeck.length === 0) scrambleDeck = vItems.map((_, i) => i).sort(() => Math.random() - 0.5);
  }

  vCurrentWord = scrambleDeck.pop();
  const w = vItems[vCurrentWord];
  scramblePlaced = []; scrambleHadMistake = false; scrambleDone = false;
  const raw = w.question.trim();
  if (raw.split(/\s+/).length >= 3 || raw.length > 15) {
    scrambleIsWordMode = true;
    const tokens = raw.includes('-') ? raw.split('-').map(s => s.trim()) : raw.split(/\s+/);
    scrambleTiles = tokens.map(chunk => ({ text: chunk, used: false })).sort(() => Math.random() - 0.5);
  } else {
    scrambleIsWordMode = false;
    scrambleTiles = getGraphemes(raw).map(ch => ({ text: ch, used: false })).sort(() => Math.random() - 0.5);
  }
}

function clickScrambleTile(idx) {
  if (scrambleDone) return;
  const item = scrambleTiles[idx];
  if (item.used) return;
  const w = getVocabItems()[vCurrentWord];
  const target = scrambleIsWordMode ? (w.question.includes('-') ? w.question.split('-').map(s=>s.trim()) : w.question.trim().split(/\s+/)) : getGraphemes(w.question.trim());

  if (item.text === target[scramblePlaced.length]) {
    sndOk(); item.used = true; scramblePlaced.push(item.text);
    if (scramblePlaced.length === target.length) {
      scrambleDone = true; scrambleSolvedCount++;
      if (!scrambleHadMistake) { addReward(1, selectedGroupKey); sndFanfare(); }
      if (isAutoTTS) speakWord(w.question, selectedSubject);
    }
  } else { sndErr(); scrambleHadMistake = true; }
  renderActiveGame();
}


// ==========================================
// 4. KVÍZ (QUIZ)
// ==========================================
function clickQuizOpt(optIdx) {
  if (qAnswered) return;
  const q = qActiveList[qCurStep];
  const chosen = q.options[optIdx];
  qAnswered = true; qChosenOpt = chosen;

  if (chosen === q.answer) { sndOk(); addReward(1, selectedGroupKey); } else sndErr();
  renderActiveGame();
}

function nextQuizStep() {
  qCurStep++; qAnswered = false; qChosenOpt = null; renderActiveGame();
}


// ==========================================
// 5. ŘADA NA ČAS (SEQUENCE)
// ==========================================
function resetInactivityTimer() {
  if (seqInactivityTimer) clearTimeout(seqInactivityTimer);
  seqInactivityTimer = setTimeout(() => { seqHintActive = true; renderActiveGame(); }, 3000);
}

function initSequence() {
  const sItems = getSeqItems();
  if (sItems.length === 0) return;
  const seqConfig = sItems[selectedSeqIndex] || sItems[0];
  const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);

  seqTargetIdx = 0; seqHintActive = false; seqSlots = [-1, -1, -1, -1];
  seqSlots[0] = 0; if (itemsList.length > 1) seqSlots[1] = 1;
  for (let s = 2; s < Math.min(4, itemsList.length); s++) seqSlots[s] = s;
  seqSlots.sort(() => Math.random() - 0.5);

  seqStartTime = Date.now();
  if (seqTimerInterval) clearInterval(seqTimerInterval);
  seqTimerInterval = setInterval(() => {
    const el = document.getElementById("seq-timer");
    if (el && seqTargetIdx < itemsList.length) el.innerText = ((Date.now() - seqStartTime) / 1000).toFixed(1) + " s";
  }, 100);
  resetInactivityTimer();
}

function clickSeqSlot(slot) {
  const sItems = getSeqItems();
  const seqConfig = sItems[selectedSeqIndex] || sItems[0];
  const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);
  const btnEl = document.getElementById(`seq-btn-${slot}`);

  if (seqSlots[slot] === seqTargetIdx) {
    sndOk(); seqTargetIdx++; seqHintActive = false;
    if (seqTargetIdx >= itemsList.length) {
      clearInterval(seqTimerInterval); if (seqInactivityTimer) clearTimeout(seqInactivityTimer);
      sndFanfare(); addReward(3, selectedGroupKey);
    } else {
      const next = seqTargetIdx + 1;
      seqSlots[slot] = next < itemsList.length ? next : -1;
      resetInactivityTimer();
    }
    renderActiveGame();
  } else {
    sndErr();
    if (btnEl) { btnEl.classList.add("wrong"); setTimeout(() => { if (btnEl) btnEl.classList.remove("wrong"); }, 250); }
    seqHintActive = true; resetInactivityTimer(); renderActiveGame();
  }
}
