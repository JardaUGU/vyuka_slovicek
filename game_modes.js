// ==========================================
// HERNÍ MÓDY: KARTY, ZKOUŠENÍ, SKLÁDÁNÍ, KVÍZ, ŘADA NA ČAS
// ==========================================

let vCardIdx = 0;
let vMastery = {}, vActivePool = 3, vCurrentWord = 0, vLastWord = -1, vQuizRevealed = false;
let adaptiveBatchIndices = [];
let isAdaptiveBatchMode = false;

let scrambleDeck = [], scramblePlaced = [], scrambleTiles = [], scrambleIsWordMode = false, scrambleHadMistake = false, scrambleDone = false, scrambleSolvedCount = 0;
let qCurStep = 0, qAnswered = false, qChosenOpt = null, qActiveList = [];

let seqTargetIdx = 0, seqHighestDeployed = 0, seqSlots = [], seqStartTime = 0, seqTimerInterval = null, seqHintActive = false, seqInactivityTimer = null;

function formatPromptText(text) {
  if (!text) return "";
  // 1. Podpora žlutého zvýraznění přes hvězdičky *text*
  let t = text.replace(/\*([^*]+)\*/g, '<b style="color:var(--col-yellow);text-decoration:underline;">$1</b>');
  
  // 2. Podpora svislých zlomků: zápis [a/b] převede na krásný vertikální zlomek
  t = t.replace(/\[([^/\]]+)\/([^/\]]+)\]/g, (match, n, d) => {
     return `<span style="display:inline-flex; flex-direction:column; text-align:center; vertical-align:middle; line-height:1.1; font-size:0.75em; margin: 0 4px;">
               <span style="border-bottom:2px solid currentColor; padding:0 3px;">${n.trim()}</span>
               <span style="padding:0 3px;">${d.trim()}</span>
             </span>`;
  });
  return t;
}

function vCardNext() {
  const vItems = getVocabItems(); if (vItems.length === 0) return;
  vCardIdx = (vCardIdx + 1) % vItems.length;
  if(typeof renderActiveGame === 'function') renderActiveGame();
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && vItems.length > 0) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function vCardPrev() {
  const vItems = getVocabItems(); if (vItems.length === 0) return;
  vCardIdx = (vCardIdx + vItems.length - 1) % vItems.length;
  if(typeof renderActiveGame === 'function') renderActiveGame();
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && vItems.length > 0) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function speakCurrentCard() {
  const vItems = getVocabItems();
  if (vItems[vCardIdx]) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function initGameState() {
  const vItems = getVocabItems(); const qItems = getQuizItems(); const sItems = getSeqItems();
  if (vItems.length > 0) {
    vMastery = {};
    vItems.forEach((w, i) => { vMastery[i] = getSavedMastery(w.question, testingDirection); });
    
    let unmastered = [];
    vItems.forEach((_, i) => { if ((vMastery[i] || 0) < 2) unmastered.push(i); });

    if (unmastered.length === 0) {
      // VŠECHNA SLOVA UŽ MAJÍ 2 ★ -> Vybereme max 15 náhodných slov k přezkoušení
      isAdaptiveBatchMode = vItems.length > 15;
      adaptiveBatchIndices = vItems.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, 15);
      // Nastavíme jim lokálně v relaci 1 ★, aby se z nich zkoušelo (při chybě v answerAdaptive spadnou v cloudu na 0 ★)
      adaptiveBatchIndices.forEach(i => { vMastery[i] = 1; });
    } else if (vItems.length > 15) {
      isAdaptiveBatchMode = true;
      let m0 = unmastered.filter(i => (vMastery[i] || 0) === 0).sort(() => Math.random() - 0.5);
      let m1 = unmastered.filter(i => (vMastery[i] || 0) === 1).sort(() => Math.random() - 0.5);
      let candidates = [...m0, ...m1];
      let batchSize = Math.min(15, candidates.length);
      adaptiveBatchIndices = candidates.slice(0, batchSize);
    } else {
      isAdaptiveBatchMode = false; 
      adaptiveBatchIndices = vItems.map((_, i) => i);
    }

    let masteredInBatch = 0;
    adaptiveBatchIndices.forEach(i => { if ((vMastery[i] || 0) >= 2) masteredInBatch++; });
    vActivePool = Math.min(adaptiveBatchIndices.length, Math.max(getAdaptiveWindowSize(currentUser ? currentUser.grade : 2), masteredInBatch + 3));
    vLastWord = -1; vCardIdx = 0;
    if (selectedGame === "CARDS" && typeof isAutoTTS !== "undefined" && isAutoTTS) speakWord(vItems[0].question, selectedSubject);
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
  const vItems = getVocabItems(); if (vItems.length === 0) return { current: 0, total: 1, masteredCount: 0, totalWords: 1 };
  const pool = isAdaptiveBatchMode ? adaptiveBatchIndices : vItems.map((_, i) => i);
  let current = 0, masteredCount = 0;
  pool.forEach(i => { const m = vMastery[i] || 0; current += m; if (m >= 2) masteredCount++; });
  return { current, total: pool.length * 2, masteredCount, totalWords: pool.length };
}

function pickNextAdaptiveWord() {
  const vItems = getVocabItems(); vQuizRevealed = false; const stats = getMasteryStats();
  if (stats.masteredCount >= stats.totalWords) { vCurrentWord = -1; return; }
  const pool = isAdaptiveBatchMode ? adaptiveBatchIndices : vItems.map((_, i) => i);
  let available = pool.filter(i => (vMastery[i] || 0) < 2);
  let candidates = (available.length > 1 && vLastWord !== -1) ? available.filter(i => i !== vLastWord) : available;
  const mistakes = candidates.filter(i => (vMastery[i] || 0) === 0);
  vCurrentWord = (mistakes.length > 0 && Math.random() < 0.75) ? mistakes[Math.floor(Math.random() * mistakes.length)] : candidates[Math.floor(Math.random() * candidates.length)];
  vLastWord = vCurrentWord;
  if (typeof testingDirection !== 'undefined' && testingDirection === "DIR_IN" && typeof isAutoTTS !== "undefined" && isAutoTTS && vCurrentWord !== -1) speakWord(vItems[vCurrentWord].question, selectedSubject);
}

function revealAdaptiveQuiz() { vQuizRevealed = true; if(typeof renderActiveGame === 'function') renderActiveGame(); if (typeof isAutoTTS !== "undefined" && isAutoTTS && vCurrentWord !== -1) speakWord(getVocabItems()[vCurrentWord].question, selectedSubject); }
function speakAdaptiveCurrent() { const vItems = getVocabItems(); if (vItems[vCurrentWord]) speakWord(vItems[vCurrentWord].question, selectedSubject); }

function answerAdaptive(known) {
  const vItems = getVocabItems(); const w = vItems[vCurrentWord];
  if (known) { sndOk(); addReward(1, typeof selectedGroupKey !== 'undefined' ? selectedGroupKey : ""); vMastery[vCurrentWord] = Math.min(2, (vMastery[vCurrentWord] || 0) + 1); saveWordMasteryToGoogle(w.question, vMastery[vCurrentWord], testingDirection); } 
  else { sndErr(); vMastery[vCurrentWord] = 0; saveWordMasteryToGoogle(w.question, 0, testingDirection); }
  pickNextAdaptiveWord(); if(typeof renderActiveGame === 'function') renderActiveGame();
}

function startScrambleFromAdaptiveBatch() {
  selectedGame = "SCRAMBLE"; scrambleDeck = [...adaptiveBatchIndices].sort(() => Math.random() - 0.5); scrambleSolvedCount = 0;
  initScramble(); setScreen("PLAYING");
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
  
  // OPRAVA: Odřízne závorky z textu před rozpadem na kostičky
  const raw = w.question.replace(/\s*\([^)]*\)/g, '').trim();
  
  if (raw.split(/\s+/).length >= 3 || raw.length > 15) {
    scrambleIsWordMode = true;
    const tokens = raw.includes('-') ? raw.split('-').map(s => s.trim()) : raw.split(/\s+/);
    scrambleTiles = tokens.map(chunk => ({ text: chunk, used: false })).sort(() => Math.random() - 0.5);
  } else {
    scrambleIsWordMode = false;
    scrambleTiles = getGraphemes(raw).map(ch => ({ text: ch, used: false })).sort(() => Math.random() - 0.5);
  }
}

let lastScrambleClickTime = 0;
function clickScrambleTile(idx) {
  if (scrambleDone) return;
  const now = Date.now();
  if (now - lastScrambleClickTime < 120) return; 
  lastScrambleClickTime = now;

  const item = scrambleTiles[idx];
  // Ignoruje kliknutí na použitá a blokovaná písmena
  if (item.used || item.isWrong) return; 
  
  const w = getVocabItems()[vCurrentWord];
  const cleanTarget = w.question.replace(/\s*\([^)]*\)/g, '').trim();
  const target = scrambleIsWordMode ? (cleanTarget.includes('-') ? cleanTarget.split('-').map(s=>s.trim()) : cleanTarget.split(/\s+/)) : getGraphemes(cleanTarget);

  if (item.text === target[scramblePlaced.length]) {
    sndOk(); 
    item.used = true; 
    scramblePlaced.push(item.text);
    
    // Uvolníme zablokovaná písmena
    scrambleTiles.forEach(t => t.isWrong = false);

    if (scramblePlaced.length === target.length) {
      scrambleDone = true; scrambleSolvedCount++;
      if (!scrambleHadMistake) { addReward(1, typeof selectedGroupKey !== 'undefined' ? selectedGroupKey : ""); sndFanfare(); }
      if (typeof isAutoTTS !== "undefined" && isAutoTTS) speakWord(w.question, selectedSubject);
    }
  } else { 
    sndErr(); 
    item.isWrong = true; // Zablokuje toto písmeno
    scrambleHadMistake = true; 
  }
  if(typeof renderActiveGame === 'function') renderActiveGame();
}

function clickQuizOpt(optIdx) {
  if (qAnswered) return;
  const q = qActiveList[qCurStep]; const chosen = q.options[optIdx];
  qAnswered = true; qChosenOpt = chosen;
  if (chosen === q.answer) { sndOk(); addReward(1, typeof selectedGroupKey !== 'undefined' ? selectedGroupKey : ""); } else sndErr();
  if(typeof renderActiveGame === 'function') renderActiveGame();
}
function nextQuizStep() { qCurStep++; qAnswered = false; qChosenOpt = null; if(typeof renderActiveGame === 'function') renderActiveGame(); }

function resetInactivityTimer() {
  if (seqInactivityTimer) clearTimeout(seqInactivityTimer);
  seqInactivityTimer = setTimeout(() => { seqHintActive = true; if(typeof renderActiveGame === 'function') renderActiveGame(); }, 3000);
}

function initSequence() {
  const sItems = getSeqItems(); if (sItems.length === 0) return;
  const seqConfig = sItems[typeof selectedSeqIndex !== 'undefined' ? selectedSeqIndex : 0] || sItems[0];
  const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);
  seqTargetIdx = 0; seqHintActive = false; seqSlots = [-1, -1, -1, -1];
  let initialCount = Math.min(4, itemsList.length);
  let pool = []; let poolSize = Math.min(itemsList.length - 1, 6);
  for (let i = 1; i <= poolSize; i++) pool.push(i);
  pool.sort(() => Math.random() - 0.5);
  let startItems = [0];
  for (let i = 0; i < initialCount - 1; i++) startItems.push(pool[i]);
  for (let i = 0; i < startItems.length; i++) seqSlots[i] = startItems[i];
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
  const sItems = getSeqItems(); const seqConfig = sItems[typeof selectedSeqIndex !== 'undefined' ? selectedSeqIndex : 0] || sItems[0];
  const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);
  const btnEl = document.getElementById(`seq-btn-${slot}`);
  if (seqSlots[slot] === seqTargetIdx) {
    sndOk();
    if (typeof isAutoTTS !== "undefined" && isAutoTTS && typeof speakWord === "function") speakWord(itemsList[seqTargetIdx], typeof selectedSubject !== "undefined" ? selectedSubject : "");
    seqTargetIdx++; seqHintActive = false;
    if (seqTargetIdx >= itemsList.length) {
      clearInterval(seqTimerInterval); if (seqInactivityTimer) clearTimeout(seqInactivityTimer);
      sndFanfare(); addReward(3, typeof selectedGroupKey !== 'undefined' ? selectedGroupKey : "Řada");
      seqSlots[slot] = -1;
    } else {
      let nextItem = -1;
      for (let i = seqTargetIdx; i < itemsList.length; i++) { if (!seqSlots.includes(i)) { nextItem = i; break; } }
      seqSlots[slot] = nextItem; resetInactivityTimer();
    }
    if(typeof renderActiveGame === 'function') renderActiveGame();
  } else {
    sndErr();
    if (btnEl) { btnEl.classList.add("wrong"); setTimeout(() => { if (btnEl) btnEl.classList.remove("wrong"); }, 250); }
    seqHintActive = true; resetInactivityTimer(); 
    if(typeof renderActiveGame === 'function') renderActiveGame();
  }
}
