/**
 * HERNÍ REŽIMY: KARTY, ZKOUŠENÍ (DÁVKY 15 SLOV), SKLÁDÁNÍ, ARKÁDA, PEXESO, KVÍZ, ŘADA NA ČAS, HAD, KAMPAŇ
 */

// --- GLOBÁLNÍ STAVOVÉ PROMĚNNÉ HER ---
let vCardIdx = 0;
let vMastery = {}, vActivePool = 3, vCurrentWord = 0, vLastWord = -1, vQuizRevealed = false;
let adaptiveBatchIndices = [];
let isAdaptiveBatchMode = false;

let scrambleDeck = [], scramblePlaced = [], scrambleTiles = [], scrambleIsWordMode = false, scrambleHadMistake = false, scrambleDone = false, scrambleSolvedCount = 0;
let pexesoPairCount = 4, pexesoCards = [], pexesoFlipped = [], pexesoMatched = [], pexesoLocked = false, pexesoAttempts = 0;
let qCurStep = 0, qAnswered = false, qChosenOpt = null, qActiveList = [];
let seqTargetIdx = 0, seqSlots = [], seqStartTime = 0, seqTimerInterval = null, seqHintActive = false, seqInactivityTimer = null;

// Arkáda a Minihry
let isCampaignMinigame = false;
let campaignMinigameCoins = 0;
let campaignMinigamePool = [];
let arcadeMode = "";
let arcadeCurrentOptions = [];
let arcadeDeck = [], arcadeCurrent = null, arcadeLives = 3, arcadeScore = 0, arcadeLevel = 1, arcadeY = 0, arcadeX = 50, arcadeSpeed = 0.8, arcadeAnimId = null, arcadeState = "PLAYING";

// Had (Snake)
let snakeInterval = null;
let snakeCountdownInterval = null;
let snakeCountdown = 5;
let snakeGridSize = 17;
let snakeCellSize = 20;
let snakeBody = [];
let snakeDir = { x: 1, y: 0 };
let snakeNextDir = { x: 1, y: 0 };
let snakeLives = 3;
let snakeScore = 0;
let snakeLevel = 1;
let snakeSpeed = 220;
let snakeDeck = [];
let snakeCurrentWord = null;
let snakeTargetLetters = [];
let snakeCurrentIdx = 0;
let snakeFoods = [];
let snakeState = "PLAYING";
let snakeStatusMsg = "";
let snakeShieldLetters = 0;
let snakeTouchStartX = 0, snakeTouchStartY = 0;

// Kampaň (Spirála)
let cmpQueue = [];
let cmpIdx = 0;
let cmpHearts = 5;
let cmpState = 'PLAYING';
let cmpChosenOpt = null;

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
// 2. ZKOUŠENÍ Z HLAVY (DÁVKY PO 15 POLOŽKÁCH)
// ==========================================
function initGameState() {
  const vItems = getVocabItems();
  const qItems = getQuizItems();
  const sItems = getSeqItems();

  if (vItems.length > 0) {
    vMastery = {};
    vItems.forEach((w, i) => {
      vMastery[i] = getSavedMastery(w.question, testingDirection);
    });

    if (vItems.length > 15) {
      isAdaptiveBatchMode = true;
      let unmastered = [];
      vItems.forEach((_, i) => {
        if ((vMastery[i] || 0) < 2) unmastered.push(i);
      });

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
    adaptiveBatchIndices.forEach(i => {
      if ((vMastery[i] || 0) >= 2) masteredInBatch++;
    });

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

function startScrambleFromAdaptiveBatch() {
  const vItems = getVocabItems();
  selectedGame = "SCRAMBLE";
  scrambleDeck = [...adaptiveBatchIndices].sort(() => Math.random() - 0.5);
  scrambleSolvedCount = 0;
  initScramble();
  setScreen("PLAYING");
}

// ==========================================
// 3. SKLÁDÁNÍ SLOV A FRÁZÍ (SCRAMBLE)
// ==========================================
function initScramble() {
  const vItems = getVocabItems();
  if (isAdaptiveBatchMode && adaptiveBatchIndices && adaptiveBatchIndices.length > 0) {
    if (!scrambleDeck || scrambleDeck.length === 0) {
      scrambleDeck = [...adaptiveBatchIndices].sort(() => Math.random() - 0.5);
    }
  } else {
    if (!scrambleDeck || scrambleDeck.length === 0) {
      scrambleDeck = vItems.map((_, i) => i).sort(() => Math.random() - 0.5);
    }
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
// 4. ARKÁDA PADAJÍCÍ SLOVA
// ==========================================
function stopArcadeLoop() {
  if (arcadeAnimId) { cancelAnimationFrame(arcadeAnimId); arcadeAnimId = null; }
}

function startArcadeGame() {
  stopArcadeLoop();
  isCampaignMinigame = false;
  const vItems = getVocabItems();
  const mode = getQuickChoiceMode();
  arcadeMode = "CLASSIC_" + mode;
  
  arcadeDeck = vItems.filter(it => {
    if (mode === "DER_DIE_DAS") return /^(der|die|das)\s/i.test(it.question);
    if (mode === "A_AN") return /^(a|an)\s/i.test(it.question);
    if (mode === "I_Y") return it.question.includes('_');
    return false;
  }).sort(() => Math.random() - 0.5);

  if (arcadeDeck.length === 0) { alert("Málo vhodných slov v této lekci."); return; }
  arcadeLives = 3; arcadeScore = 0; arcadeLevel = 1; arcadeSpeed = 0.8; arcadeState = "PLAYING";
  selectedGame = "ARCADE";
  setScreen("PLAYING");
  spawnArcadeWord();
}

function startCampaignArcade(mode) {
  stopArcadeLoop();
  arcadeMode = mode;
  
  if (mode === "ARTICLES") {
      arcadeDeck = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question));
  } else {
      arcadeDeck = [...campaignMinigamePool];
  }
  arcadeDeck.sort(() => Math.random() - 0.5);
  
  arcadeLives = 3; arcadeScore = 0; arcadeLevel = 1; arcadeSpeed = 0.8; arcadeState = "PLAYING";
  selectedGame = "ARCADE";
  setScreen("PLAYING");
  spawnArcadeWord();
}

function spawnArcadeWord() {
  if (arcadeLives <= 0) { arcadeState = "GAMEOVER"; stopArcadeLoop(); renderActiveGame(); return; }
  if (arcadeDeck.length === 0) {
      if (isCampaignMinigame) {
          arcadeDeck = [...campaignMinigamePool].sort(() => Math.random() - 0.5);
          if (arcadeMode === "ARTICLES") arcadeDeck = arcadeDeck.filter(it => /^(der|die|das)\s/i.test(it.question));
      } else {
          arcadeDeck = [...getVocabItems()].sort(() => Math.random() - 0.5);
      }
  }
  arcadeCurrent = arcadeDeck.pop();
  arcadeY = 5;
  arcadeX = Math.floor(Math.random() * 64) + 18;
  arcadeState = "PLAYING";

  if (arcadeMode === "TRANSLATE") {
      let others = campaignMinigamePool.filter(it => it.question !== arcadeCurrent.question && cleanCzechTranslation(it.answer) !== cleanCzechTranslation(arcadeCurrent.answer)).sort(()=>Math.random()-0.5).slice(0,2);
      arcadeCurrentOptions = [arcadeCurrent.question, ...others.map(o=>o.question)].sort(()=>Math.random()-0.5);
  }

  renderActiveGame();
  runArcadeLoop();
}

function runArcadeLoop() {
  stopArcadeLoop();
  function step() {
    if (currentScreen !== "PLAYING" || selectedGame !== "ARCADE" || arcadeState !== "PLAYING") return;
    if (!isTimerPaused) {
      arcadeY += arcadeSpeed;
      const el = document.getElementById("arcade-falling-elem");
      const playfield = document.getElementById("arcade-field");
      if (el && playfield && arcadeY >= playfield.clientHeight - el.clientHeight - 8) {
        handleArcadeMiss();
        return;
      }
      if (el) el.style.top = arcadeY + "px";
    }
    arcadeAnimId = requestAnimationFrame(step);
  }
  arcadeAnimId = requestAnimationFrame(step);
}

function clickArcadeChoice(choice) {
  if (arcadeState !== "PLAYING" || !arcadeCurrent) return;
  
  let isCorrect = false;
  if (arcadeMode === "TRANSLATE") {
      isCorrect = (choice === arcadeCurrent.question);
  } else if (arcadeMode === "ARTICLES" || arcadeMode.includes("DER_DIE_DAS") || arcadeMode.includes("A_AN")) {
      isCorrect = arcadeCurrent.question.toLowerCase().startsWith(choice.toLowerCase() + " ");
  } else if (arcadeMode.includes("I_Y")) {
      isCorrect = arcadeCurrent.answer.trim().toLowerCase() === choice.toLowerCase();
  }

  if (isCorrect) {
    arcadeState = "HIT"; stopArcadeLoop(); sndOk(); arcadeScore++; 
    if (!isCampaignMinigame) addReward(1, "Padající slova");
    if (arcadeScore % 7 === 0) { arcadeLevel++; arcadeSpeed += 0.35; sndFanfare(); }
    const el = document.getElementById("arcade-falling-elem");
    if (el) el.classList.add("hit");
    setTimeout(spawnArcadeWord, 350);
  } else {
    handleArcadeMiss();
  }
}

function handleArcadeMiss() {
  arcadeState = "MISS"; stopArcadeLoop(); sndErr(); arcadeLives--;
  const el = document.getElementById("arcade-falling-elem");
  if (el) {
    el.classList.add("miss");
    const m = el.querySelector(".falling-main-word");
    if (m) m.innerText = arcadeCurrent.question;
  }
  if (isAutoTTS) speakWord(arcadeCurrent.question, selectedSubject);
  setTimeout(spawnArcadeWord, 1400);
}

// ==========================================
// 5. PEXESO
// ==========================================
function startPexesoGame(pairCount) {
  isCampaignMinigame = false;
  pexesoPairCount = pairCount; selectedGame = "PEXESO";
  const vItems = getVocabItems();
  const count = Math.min(pexesoPairCount, vItems.length);
  const shuffled = [...vItems].sort(() => Math.random() - 0.5).slice(0, count);
  initPexesoBoard(shuffled);
}

function startCampaignPexeso() {
  pexesoPairCount = 6;
  selectedGame = "PEXESO";
  let shuffled = campaignMinigamePool.sort(() => Math.random() - 0.5).slice(0, pexesoPairCount);
  initPexesoBoard(shuffled);
}

function initPexesoBoard(words) {
  pexesoCards = [];
  words.forEach((w, idx) => {
    pexesoCards.push({ wordIdx: idx, text: w.question, isForeign: true });
    pexesoCards.push({ wordIdx: idx, text: cleanCzechTranslation(w.answer), isForeign: false });
  });
  pexesoCards.sort(() => Math.random() - 0.5);
  pexesoFlipped = []; pexesoMatched = []; pexesoLocked = false; pexesoAttempts = 0;
  setScreen("PLAYING");
}

function clickPexesoCard(idx) {
  if (pexesoLocked || pexesoFlipped.includes(idx) || pexesoMatched.includes(pexesoCards[idx].wordIdx)) return;
  pexesoFlipped.push(idx);
  if (isAutoTTS && pexesoCards[idx].isForeign) speakWord(pexesoCards[idx].text, selectedSubject);
  renderActiveGame();
  if (pexesoFlipped.length === 2) {
    pexesoAttempts++;
    const [c1, c2] = [pexesoCards[pexesoFlipped[0]], pexesoCards[pexesoFlipped[1]]];
    if (c1.wordIdx === c2.wordIdx) {
      sndOk(); pexesoMatched.push(c1.wordIdx); pexesoFlipped = [];
      if (pexesoMatched.length === (pexesoCards.length / 2)) {
        sndFanfare(); 
        if (!isCampaignMinigame) addReward(2, selectedGroupKey);
      }
      renderActiveGame();
    } else {
      sndErr(); pexesoLocked = true;
      setTimeout(() => { pexesoFlipped = []; pexesoLocked = false; renderActiveGame(); }, 900);
    }
  }
}

// ==========================================
// 6. KVÍZ
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
// 7. ŘADA NA ČAS
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

function startGame(game) { 
  stopArcadeLoop(); 
  stopSnakeLoop();
  selectedGame = game; 
  isCampaignMinigame = false; 
  initGameState(); 
  setScreen("PLAYING"); 
}

// ==========================================
// 8. HRA HAD (SNAKE ENGINE)
// ==========================================
function stopSnakeLoop() {
  if (snakeInterval) { clearInterval(snakeInterval); snakeInterval = null; }
  if (snakeCountdownInterval) { clearInterval(snakeCountdownInterval); snakeCountdownInterval = null; }
}

function startSnakeGame() {
  stopArcadeLoop();
  stopSnakeLoop();
  
  const vItems = getVocabItems();
  snakeDeck = vItems.filter(it => {
    let clean = it.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim();
    return clean.split(/\s+/).length === 1 && clean.length >= 2 && clean.length <= 10 && !clean.includes('.');
  }).sort(() => Math.random() - 0.5);

  if (snakeDeck.length === 0) {
    alert("V této lekci nejsou žádná vhodná jednoslovná slovíčka pro hada.");
    return;
  }

  snakeLives = 3;
  snakeScore = 0;
  snakeLevel = 1;
  snakeSpeed = 220;
  snakeShieldLetters = 0;
  selectedGame = "SNAKE";
  setScreen("PLAYING");

  setupNextSnakeWord();
  resetSnakePosition();
  startSnakeCountdown(5, "Rozhlédni se a připrav se!");
  setTimeout(attachSnakeTouchHandlers, 50);
}

function startCampaignSnake() {
  stopArcadeLoop();
  stopSnakeLoop();
  isCampaignMinigame = true;

  snakeDeck = campaignMinigamePool.filter(it => {
    let clean = it.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim();
    return clean.split(/\s+/).length === 1 && clean.length >= 2 && clean.length <= 10 && !clean.includes('.');
  }).sort(() => Math.random() - 0.5);

  if (snakeDeck.length === 0) {
    startCampaignPexeso();
    return;
  }

  snakeLives = 3;
  snakeScore = 0;
  snakeLevel = 1;
  snakeSpeed = 220;
  snakeShieldLetters = 0;
  selectedGame = "SNAKE";
  setScreen("PLAYING");

  setupNextSnakeWord();
  resetSnakePosition();
  startSnakeCountdown(5, "Rozhlédni se a připrav se!");
  setTimeout(attachSnakeTouchHandlers, 50);
}

function startSnakeCountdown(sec = 5, msg = "") {
  stopSnakeLoop();
  snakeCountdown = sec;
  snakeState = "COUNTDOWN";
  snakeStatusMsg = msg;
  renderActiveGame();
  drawSnake();

  snakeCountdownInterval = setInterval(() => {
    snakeCountdown--;
    if (snakeCountdown <= 0) {
      clearInterval(snakeCountdownInterval);
      snakeCountdownInterval = null;
      snakeState = "PLAYING";
      snakeStatusMsg = "";
      renderActiveGame();
      runSnakeLoop();
    } else {
      renderActiveGame();
      drawSnake();
    }
  }, 1000);
}

function skipSnakeCountdown(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (snakeCountdownInterval) { clearInterval(snakeCountdownInterval); snakeCountdownInterval = null; }
  snakeState = "PLAYING";
  snakeStatusMsg = "";
  renderActiveGame();
  runSnakeLoop();
}

function buySnakeShieldInGame(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (snakeLives > 1 && snakeShieldLetters <= 0) {
    snakeLives--;
    snakeShieldLetters = 20;
    sndFanfare();
    snakeStatusMsg = "🛡️ Štít aktivován! (20 písmen)";
    renderActiveGame();
    drawSnake();
  } else if (snakeLives <= 1) {
    alert("Nemůžeš obětovat své poslední srdíčko! ❤️");
  }
}

function buySnakeShieldWithCoins(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (!currentUser) return;
  const coins = getUserCoins(currentUser.name);
  if (coins >= 15 && snakeShieldLetters <= 0) {
    addCoins(currentUser.name, -15);
    snakeShieldLetters = 20;
    sndFanfare();
    snakeStatusMsg = "🛡️ Štít koupen za 15 💰! (20 písmen)";
    renderActiveGame();
    drawSnake();
  } else {
    alert("Potřebuješ alespoň 15 zlaťáků! 💰");
  }
}

function resumeSnakeWithoutShield(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  snakeState = "PLAYING";
  snakeStatusMsg = "";
  renderActiveGame();
  runSnakeLoop();
}

function setupNextSnakeWord() {
  if (snakeDeck.length === 0) {
    const vItems = getVocabItems();
    snakeDeck = vItems.filter(it => {
      let clean = it.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim();
      return clean.split(/\s+/).length === 1 && clean.length >= 2 && clean.length <= 10;
    }).sort(() => Math.random() - 0.5);
  }

  const rawItem = snakeDeck.pop();
  let cleanForeign = rawItem.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim().toUpperCase();

  snakeCurrentWord = {
    raw: rawItem,
    czech: cleanCzechTranslation(rawItem.answer),
    foreign: rawItem.question,
    cleanForeign: cleanForeign
  };

  snakeTargetLetters = getGraphemes(cleanForeign);
  snakeCurrentIdx = 0;
  spawnSnakeFood();
  updateSnakeSlotsDisplay();
}

function resetSnakePosition() {
  snakeBody = [
    { x: 5, y: 8 },
    { x: 4, y: 8 },
    { x: 3, y: 8 }
  ];
  snakeDir = { x: 1, y: 0 };
  snakeNextDir = { x: 1, y: 0 };
}

function spawnSnakeFood() {
  snakeFoods = [];
  const occupied = new Set();
  snakeBody.forEach(seg => occupied.add(`${seg.x},${seg.y}`));

  for (let i = snakeCurrentIdx; i < snakeTargetLetters.length; i++) {
    const ch = snakeTargetLetters[i];
    let pos = getRandomFreeGridPos(occupied);
    if (pos) {
      occupied.add(`${pos.x},${pos.y}`);
      snakeFoods.push({ x: pos.x, y: pos.y, char: ch, isTarget: (i === snakeCurrentIdx) });
    }
  }

  if (snakeLevel >= 2) {
    const distractorsCount = Math.min(3, snakeLevel - 1);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let d = 0; d < distractorsCount; d++) {
      let randChar = alphabet[Math.floor(Math.random() * alphabet.length)];
      let pos = getRandomFreeGridPos(occupied);
      if (pos) {
        occupied.add(`${pos.x},${pos.y}`);
        snakeFoods.push({ x: pos.x, y: pos.y, char: randChar, isTarget: false });
      }
    }
  }

  ensureTargetFoodsExist();
}

function ensureTargetFoodsExist() {
  if (!snakeTargetLetters || snakeCurrentIdx >= snakeTargetLetters.length) return;

  const neededCount = {};
  for (let i = snakeCurrentIdx; i < snakeTargetLetters.length; i++) {
    const ch = snakeTargetLetters[i];
    neededCount[ch] = (neededCount[ch] || 0) + 1;
  }

  const presentCount = {};
  snakeFoods.forEach(f => {
    presentCount[f.char] = (presentCount[f.char] || 0) + 1;
  });

  const occupied = new Set();
  snakeBody.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
  snakeFoods.forEach(f => occupied.add(`${f.x},${f.y}`));

  for (let ch in neededCount) {
    const needed = neededCount[ch];
    const present = presentCount[ch] || 0;
    const missing = needed - present;

    for (let m = 0; m < missing; m++) {
      const distractorIdx = snakeFoods.findIndex(f => !neededCount[f.char]);
      if (distractorIdx !== -1) {
        const removed = snakeFoods.splice(distractorIdx, 1)[0];
        occupied.delete(`${removed.x},${removed.y}`);
      }

      let pos = getRandomFreeGridPos(occupied);
      if (pos) {
        occupied.add(`${pos.x},${pos.y}`);
        snakeFoods.push({
          x: pos.x,
          y: pos.y,
          char: ch,
          isTarget: (ch === snakeTargetLetters[snakeCurrentIdx])
        });
      }
    }
  }

  const currentTargetChar = snakeTargetLetters[snakeCurrentIdx];
  let firstTargetMarked = false;
  snakeFoods.forEach(f => {
    if (f.char === currentTargetChar && !firstTargetMarked) {
      f.isTarget = true;
      firstTargetMarked = true;
    } else {
      f.isTarget = false;
    }
  });
}

function getRandomFreeGridPos(occupied) {
  let tries = 0;
  while (tries < 150) {
    let x = Math.floor(Math.random() * (snakeGridSize - 2)) + 1;
    let y = Math.floor(Math.random() * (snakeGridSize - 2)) + 1;
    let key = `${x},${y}`;
    if (!occupied.has(key)) return { x, y };
    tries++;
  }
  for (let x = 1; x < snakeGridSize - 1; x++) {
    for (let y = 1; y < snakeGridSize - 1; y++) {
      let key = `${x},${y}`;
      if (!occupied.has(key)) return { x, y };
    }
  }
  return null;
}

function runSnakeLoop() {
  stopSnakeLoop();
  snakeState = "PLAYING";
  snakeInterval = setInterval(() => {
    if (currentScreen !== "PLAYING" || selectedGame !== "SNAKE" || isTimerPaused) return;
    updateSnake();
    drawSnake();
  }, snakeSpeed);
}

function setSnakeDirection(dx, dy) {
  if (typeof registerUserAction === "function") registerUserAction();
  if (snakeDir.x + dx === 0 && snakeDir.y + dy === 0) return;
  snakeNextDir = { x: dx, y: dy };
}

function updateSnakeSlotsDisplay() {
  const container = document.getElementById("snake-slots-wrap");
  if (!container || !snakeTargetLetters) return;
  container.innerHTML = snakeTargetLetters.map((ch, idx) => `
    <div class="snake-slot ${idx < snakeCurrentIdx ? 'done' : (idx === snakeCurrentIdx ? 'active' : '')}">
      ${idx < snakeCurrentIdx ? ch : (idx === snakeCurrentIdx ? ch : '_')}
    </div>
  `).join('');
}

function updateSnake() {
  if (snakeState !== "PLAYING") return;
  snakeDir = { ...snakeNextDir };

  let nextX = snakeBody[0].x + snakeDir.x;
  let nextY = snakeBody[0].y + snakeDir.y;

  if (snakeShieldLetters > 0) {
    if (nextX < 0) nextX = snakeGridSize - 1;
    else if (nextX >= snakeGridSize) nextX = 0;
    if (nextY < 0) nextY = snakeGridSize - 1;
    else if (nextY >= snakeGridSize) nextY = 0;
  } else {
    if (nextX < 0 || nextX >= snakeGridSize || nextY < 0 || nextY >= snakeGridSize) {
      handleSnakeDeath("Náraz do zdi! 💥");
      return;
    }
  }

  const head = { x: nextX, y: nextY };

  if (snakeShieldLetters <= 0) {
    for (let i = 0; i < snakeBody.length - 1; i++) {
      if (snakeBody[i].x === head.x && snakeBody[i].y === head.y) {
        handleSnakeDeath("Kousnutí se do ocasu! 💥");
        return;
      }
    }
  }

  const foodIdx = snakeFoods.findIndex(f => f.x === head.x && f.y === head.y);
  if (foodIdx !== -1) {
    const eaten = snakeFoods[foodIdx];
    const targetChar = snakeTargetLetters[snakeCurrentIdx];

    if (eaten.char === targetChar) {
      sndOk();
      snakeFoods.splice(foodIdx, 1);
      snakeCurrentIdx++;
      snakeBody.unshift(head);

      updateSnakeSlotsDisplay();

      if (snakeShieldLetters > 0) {
        snakeShieldLetters--;
        if (snakeShieldLetters === 0) {
          handleShieldExpired();
          return;
        }
      }

      if (snakeCurrentIdx >= snakeTargetLetters.length) {
        handleSnakeWordComplete();
        return;
      } else {
        ensureTargetFoodsExist();
      }
    } else {
      if (snakeShieldLetters > 0) {
        sndErr();
        snakeStatusMsg = `🛡️ Štít tě ochránil před [ ${eaten.char} ]! Hledej [ ${targetChar} ]`;
        snakeState = "PAUSED_SHIELD";
        stopSnakeLoop();
        renderActiveGame();
        drawSnake();
        setTimeout(() => {
          snakeState = "PLAYING";
          runSnakeLoop();
          renderActiveGame();
        }, 1100);
        return;
      } else {
        handleSnakeDeath(`Špatné písmeno [ ${eaten.char} ]! Hledáš [ ${targetChar} ]`);
        return;
      }
    }
  } else {
    snakeBody.unshift(head);
    snakeBody.pop();
  }
}

function handleShieldExpired() {
  snakeState = "SHIELD_EXPIRED_PAUSE";
  stopSnakeLoop();
  sndErr();
  renderActiveGame();
}

function handleSnakeWordComplete() {
  snakeState = "WORD_DONE";
  stopSnakeLoop();
  sndFanfare();
  snakeScore++;
  addReward(1, "Had");

  if (isAutoTTS && snakeCurrentWord) speakWord(snakeCurrentWord.foreign, selectedSubject);

  if (snakeScore % 3 === 0) {
    snakeLevel++;
    snakeSpeed = Math.max(110, snakeSpeed - 15);
  }

  setTimeout(() => {
    setupNextSnakeWord();
    resetSnakePosition();
    startSnakeCountdown(3, "Další slovo!");
    setTimeout(attachSnakeTouchHandlers, 20);
  }, 1000);

  renderActiveGame();
}

function handleSnakeDeath(reason) {
  snakeState = "HIT";
  stopSnakeLoop();
  sndErr();
  snakeLives--;
  snakeStatusMsg = reason;

  if (snakeLives <= 0) {
    snakeState = "GAMEOVER";
    renderActiveGame();
  } else {
    setTimeout(() => {
      resetSnakePosition();
      ensureTargetFoodsExist();
      startSnakeCountdown(5, reason);
      setTimeout(attachSnakeTouchHandlers, 20);
    }, 1200);
    renderActiveGame();
  }
}

function drawSnake() {
  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#08101e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += snakeCellSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += snakeCellSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  snakeFoods.forEach(f => {
    let px = f.x * snakeCellSize;
    let py = f.y * snakeCellSize;

    ctx.save();
    if (f.isTarget) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.28)";
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = "rgba(0, 188, 212, 0.15)";
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 2, snakeCellSize - 4, snakeCellSize - 4, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = f.isTarget ? "#facc15" : "#ffffff";
    ctx.font = "bold 13px Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.char, px + (snakeCellSize / 2), py + (snakeCellSize / 2) + 1);
    ctx.restore();
  });

  snakeBody.forEach((seg, idx) => {
    let px = seg.x * snakeCellSize;
    let py = seg.y * snakeCellSize;

    ctx.save();
    if (idx === 0) {
      ctx.fillStyle = snakeShieldLetters > 0 ? "#38bdf8" : "#22c55e";
      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, snakeCellSize - 2, snakeCellSize - 2, 6);
      ctx.fill();

      ctx.fillStyle = "#000000";
      if (snakeDir.x === 1) {
        ctx.fillRect(px + 13, py + 4, 3, 3); ctx.fillRect(px + 13, py + 13, 3, 3);
      } else if (snakeDir.x === -1) {
        ctx.fillRect(px + 4, py + 4, 3, 3); ctx.fillRect(px + 4, py + 13, 3, 3);
      } else if (snakeDir.y === 1) {
        ctx.fillRect(px + 4, py + 13, 3, 3); ctx.fillRect(px + 13, py + 13, 3, 3);
      } else {
        ctx.fillRect(px + 4, py + 4, 3, 3); ctx.fillRect(px + 13, py + 4, 3, 3);
      }
    } else {
      if (snakeShieldLetters > 0) {
        ctx.fillStyle = idx % 2 === 0 ? "#0284c7" : "#0369a1";
      } else {
        ctx.fillStyle = idx % 2 === 0 ? "#16a34a" : "#15803d";
      }
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, snakeCellSize - 4, snakeCellSize - 4, 4);
      ctx.fill();
    }
    ctx.restore();
  });
}

window.addEventListener("keydown", (e) => {
  if (currentScreen === "PLAYING" && selectedGame === "SNAKE") {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "ArrowUp" || e.key === "w" || e.key === "W") setSnakeDirection(0, -1);
    else if (e.code === "ArrowDown" || e.key === "s" || e.key === "S") setSnakeDirection(0, 1);
    else if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") setSnakeDirection(-1, 0);
    else if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") setSnakeDirection(1, 0);
  }
});

function attachSnakeTouchHandlers() {
  const wrap = document.querySelector(".snake-canvas-wrap");
  const canvas = document.getElementById("snake-canvas");
  if (!wrap || !canvas) return;

  const preventDefaultTouch = (e) => {
    if (e.cancelable) e.preventDefault();
  };

  wrap.addEventListener("touchstart", (e) => {
    preventDefaultTouch(e);
    if (typeof registerUserAction === "function") registerUserAction();
    if (e.touches && e.touches[0]) {
      snakeTouchStartX = e.touches[0].clientX;
      snakeTouchStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  wrap.addEventListener("touchmove", (e) => {
    preventDefaultTouch(e);
    if (!e.touches || !e.touches[0]) return;
    const dx = e.touches[0].clientX - snakeTouchStartX;
    const dy = e.touches[0].clientY - snakeTouchStartY;
    const threshold = 18;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        setSnakeDirection(dx > 0 ? 1 : -1, 0);
      } else {
        setSnakeDirection(0, dy > 0 ? 1 : -1);
      }
      snakeTouchStartX = e.touches[0].clientX;
      snakeTouchStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  wrap.addEventListener("touchend", preventDefaultTouch, { passive: false });
}

// ==========================================
// 9. KAMPAŇ ENGINE (SPIRÁLA)
// ==========================================
function startCampaign() {
  let q = [];
  let allVItems = getVocabItems();
  let allQItems = getQuizItems();

  let currentVItems = allVItems.filter(it => it.lesson === selectedGroupKey);
  let olderVItems = allVItems.filter(it => it.lesson !== selectedGroupKey && (parseInt(it.lesson.replace(/\D/g, ''))||1) < (parseInt(selectedGroupKey.replace(/\D/g, ''))||1));
  let currentQItems = allQItems.filter(it => it.lesson === selectedGroupKey);

  let qRevision = []; let qNewPassive = []; let qNewActive = []; let qGrammar = []; let qSentences = [];

  if (olderVItems.length > 0) {
      let shuffledOlder = olderVItems.sort(() => Math.random() - 0.5).slice(0, 5);
      shuffledOlder.forEach(it => {
          if (it.question.trim().includes(' ')) qRevision.push({ type: 'SCRAMBLE', data: it });
          else qRevision.push({ type: 'QUIZ_IN', data: it });
      });
  }

  currentVItems.forEach(it => {
      if (it.question.trim().includes(' ') || it.question.trim().includes('-')) {
          qSentences.push({ type: 'SCRAMBLE', data: it });
      } else {
          qNewPassive.push({ type: 'QUIZ_IN', data: it });
          qNewActive.push({ type: 'QUIZ_OUT', data: it });
          qSentences.push({ type: 'SCRAMBLE', data: it });
      }
  });

  currentQItems.forEach(it => qGrammar.push({ type: 'KVIZ', data: it }));

  qRevision.sort(() => Math.random() - 0.5); 
  qNewPassive.sort(() => Math.random() - 0.5); 
  qNewActive.sort(() => Math.random() - 0.5); 
  qGrammar.sort(() => Math.random() - 0.5); 
  qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);

  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       
       let localItems = [...currentVItems, ...olderVItems];
       let pool = [...new Set(localItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
       if (pool.length > 0) {
           while (pool.length < 3) {
               pool.push(pool[Math.floor(Math.random() * pool.length)]);
           }
       } else {
           pool = ["...", "...", "..."];
       }
       
       pool.sort(() => Math.random() - 0.5);
       task.opts = [correctAns, ...pool.slice(0, 3)].sort(() => Math.random() - 0.5);
       task.correctAns = correctAns;
       task.prompt = isOut ? cleanCzechTranslation(task.data.answer) : task.data.question;

    } else if (task.type === 'SCRAMBLE') {
       const raw = task.data.question.trim();
       const isWordMode = (raw.split(/\s+/).length >= 3 || raw.length > 15);
       const tokens = isWordMode ? (raw.includes('-') ? raw.split('-').map(s=>s.trim()) : raw.split(/\s+/)) : getGraphemes(raw);
       task.tokens = tokens;
       task.tiles = tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
       task.placed = [];
       task.isWordMode = isWordMode;
       task.hadMistake = false;
    } else if (task.type === 'KVIZ') {
       task.opts = task.data.options;
       task.correctAns = task.data.answer;
       task.prompt = formatPromptText(task.data.question);
    }
  });

  cmpQueue = q; 
  cmpIdx = 0; 
  cmpHearts = 5; 
  cmpState = 'PLAYING'; 
  cmpChosenOpt = null; 
  isCampaignMinigame = false;

  selectedGame = 'CAMPAIGN'; 
  setScreen('PLAYING');
  if (isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') speakWord(cmpQueue[0].prompt, selectedSubject);
}

function clickCmpQuizOpt(opt) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  cmpChosenOpt = opt; 
  cmpState = 'EVAL';

  if (opt === task.correctAns) {
    sndOk();
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
      const dir = task.type === 'QUIZ_OUT' ? 'DIR_OUT' : 'DIR_IN';
      const mVal = getSavedMastery(task.data.question, dir);
      if (mVal < 2) saveWordMasteryToGoogle(task.data.question, mVal + 1, dir);
    }
  } else {
    sndErr(); 
    cmpHearts = Math.max(0, cmpHearts - 1);
    let newTask = JSON.parse(JSON.stringify(task));
    if (newTask.opts) newTask.opts.sort(() => Math.random() - 0.5);
    cmpQueue.push(newTask);
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
      saveWordMasteryToGoogle(task.data.question, 0, task.type === 'QUIZ_OUT' ? 'DIR_OUT' : 'DIR_IN');
    }
  }

  if (isAutoTTS && task.type !== 'QUIZ_IN') {
    let toRead = task.type === 'KVIZ' ? task.data.question.replace(/___+/g, task.data.answer) : task.data.question;
    speakWord(toRead.replace(/[*_]/g, ''), selectedSubject);
  }
  renderActiveGame();
}

function clickCmpScrambleTile(idx) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  const tile = task.tiles[idx];
  if (tile.used) return;

  if (tile.text === task.tokens[task.placed.length]) {
    sndOk(); 
    tile.used = true; 
    task.placed.push(tile.text);
    if (task.placed.length === task.tokens.length) { 
      cmpState = 'EVAL'; 
      if (isAutoTTS) speakWord(task.data.question, selectedSubject); 
      
      if (!task.hadMistake) {
        const mIn = getSavedMastery(task.data.question, 'DIR_IN');
        const mOut = getSavedMastery(task.data.question, 'DIR_OUT');
        if (mIn < 2) saveWordMasteryToGoogle(task.data.question, mIn + 1, 'DIR_IN');
        if (mOut < 2) saveWordMasteryToGoogle(task.data.question, mOut + 1, 'DIR_OUT');
      }
    }
  } else {
    sndErr(); 
    cmpHearts = Math.max(0, cmpHearts - 1);
    task.hadMistake = true;
    
    let newTask = { type: 'SCRAMBLE', data: task.data, tokens: task.tokens, isWordMode: task.isWordMode, hadMistake: false };
    newTask.tiles = task.tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
    newTask.placed = []; 
    cmpQueue.push(newTask);
  }
  renderActiveGame();
}

function nextCmpTask() {
  cmpIdx++; 
  cmpState = 'PLAYING'; 
  cmpChosenOpt = null; 
  renderActiveGame();
  if (cmpIdx < cmpQueue.length && isAutoTTS && cmpQueue[cmpIdx].type === 'QUIZ_IN') speakWord(cmpQueue[cmpIdx].prompt, selectedSubject);
}

function launchCampaignMinigame() {
    let allVItems = getVocabItems();
    let singleWords = allVItems.filter(it => it.question.split(' ').length <= 2 && !it.question.includes('.'));
    
    let currentLvlNum = parseInt(selectedGroupKey.replace(/\D/g, '')) || 1;
    let currentSingle = singleWords.filter(it => it.lesson === selectedGroupKey);
    
    let olderSingle = singleWords.filter(it => {
        let itNum = parseInt(it.lesson.replace(/\D/g, '')) || 1;
        return it.lesson !== selectedGroupKey && itNum < currentLvlNum;
    }).sort(() => Math.random() - 0.5);

    campaignMinigamePool = [...currentSingle, ...olderSingle].slice(0, 30);
    isCampaignMinigame = true;
    campaignMinigameCoins = cmpHearts;

    if (campaignMinigamePool.length > 0 && campaignMinigamePool.length < 10) {
        let tempPool = [...campaignMinigamePool];
        while (campaignMinigamePool.length < 20) {
            campaignMinigamePool.push(tempPool[Math.floor(Math.random() * tempPool.length)]);
        }
    } else if (campaignMinigamePool.length === 0) {
        finishCampaign(campaignMinigameCoins); 
        return; 
    }

    let r = Math.random();
    let isGerman = getTargetLang(selectedSubject).startsWith('de');
    let articlesCount = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question)).length;
    let hasArticles = isGerman && articlesCount >= 8;

    if (hasArticles) {
        if (r < 0.25) startCampaignArcade("ARTICLES");
        else if (r < 0.50) startCampaignArcade("TRANSLATE");
        else if (r < 0.75) startCampaignPexeso();
        else startCampaignSnake();
    } else {
        if (r < 0.33) startCampaignArcade("TRANSLATE");
        else if (r < 0.66) startCampaignPexeso();
        else startCampaignSnake();
    }
}

function finishCampaign(coins) {
  addCoins(currentUser.name, coins);
  addReward(1, "Trénink: " + selectedGroupKey);
  setScreen("CAMPAIGN_HUB");
}

// ==========================================
// 10. HLAVNÍ RENDERÉR VŠECH HER
// ==========================================
function renderActiveGame() {
  const main = document.getElementById("main-content");
  if (!main) return;
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
  const vItems = getVocabItems();
  const sItems = getSeqItems();

  // KARTY
  if (selectedGame === "CARDS") {
    const w = vItems[vCardIdx];
    const pct = Math.round(((vCardIdx + 1) / vItems.length) * 100);
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Karty: ${vCardIdx + 1} z ${vItems.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}">
        ${w.question} <span class="audio-btn" onclick="speakCurrentCard()">🔊</span>
      </div>
      <div class="prompt-box" style="color:#fff;">${cleanCzechTranslation(w.answer)}</div>
      ${w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:12px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
      <div class="grid-2">
        <div class="action-btn" onclick="vCardPrev()">Předchozí</div>
        <div class="action-btn" onclick="vCardNext()">Další ➔</div>
      </div>
    `;
  }

  // ZKOUŠENÍ Z HLAVY (S PODPOROU DÁVEK PO 15 POLOŽKÁCH)
  else if (selectedGame === "ADAPTIVE") {
    const stats = getMasteryStats();
    const pct = Math.round((stats.current / stats.total) * 100);
    const isDirOut = testingDirection === "DIR_OUT";

    if (stats.masteredCount >= stats.totalWords) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">${isAdaptiveBatchMode ? 'BLOK 15 SLOV ZVLÁDNUT! 🎉' : 'KOMPLETNĚ ZVLÁDNUTO! 🎉'}</h2>
          <p style="color:#fff;margin-bottom:15px;">Všech ${stats.totalWords} položek bloku umíš na 2 ★!</p>
          <div class="action-btn" onclick="startScrambleFromAdaptiveBatch()">SKLÁDAT TĚCHTO ${stats.totalWords} SLOV 🧩</div>
          ${isAdaptiveBatchMode ? `<div class="action-btn green" onclick="initGameState();renderActiveGame();">DALŠÍ BLOK (15 SLOV) ➔</div>` : ''}
          <div class="action-btn" onclick="toggleTestingDirection()">PŘEPNOUT SMĚR (${isDirOut ? 'Cizí ➔ 🇨🇿' : '🇨🇿 ➔ Cizí'}) ⇄</div>
          <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const w = vItems[vCurrentWord];
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>${isAdaptiveBatchMode ? 'Blok: ' + stats.masteredCount + ' z ' + stats.totalWords + ' (2 ★)' : 'Zvládnuto: ' + stats.masteredCount + ' z ' + stats.totalWords}</span>
          <span style="color:var(--col-green);">${pct} % (${stats.current}/${stats.total} b.)</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:4px;">
        <span>Slovo: ${vMastery[vCurrentWord]||0}/2 ★</span>
        <button class="toggle-btn on" onclick="toggleTestingDirection()">${isDirOut?'🇨🇿 ➔ Cizí':'Cizí ➔ 🇨🇿'}</button>
      </div>
      <div class="prompt-box" style="color:#fff;">
        ${isDirOut ? cleanCzechTranslation(w.answer) : w.question}
        ${!isDirOut ? `<span class="audio-btn" onclick="speakAdaptiveCurrent()">🔊</span>` : ''}
      </div>
      <div class="prompt-box ${(!isDirOut && isHebrew) ? 'hebrew-text' : (isDirOut && isHebrew && vQuizRevealed ? 'hebrew-text' : '')}" style="color:${vQuizRevealed?'var(--col-yellow)' : 'var(--col-text-muted)'};">
        ${vQuizRevealed ? (isDirOut ? w.question : cleanCzechTranslation(w.answer)) : '[ ? ? ? ]'}
        ${(vQuizRevealed && isDirOut) ? `<span class="audio-btn" onclick="speakAdaptiveCurrent()">🔊</span>` : ''}
      </div>
      ${vQuizRevealed ? `
        ${w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:10px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
        <div class="grid-2">
          <div class="action-btn red" onclick="answerAdaptive(false)">Nevěděl jsem (0 ★)</div>
          <div class="action-btn green" onclick="answerAdaptive(true)">Věděl jsem (+1 ★)</div>
        </div>
      ` : `<div class="action-btn" onclick="revealAdaptiveQuiz()">ZKONTROLOVAT</div>`}
    `;
  }

  // SKLÁDÁNÍ (SCRAMBLE)
  else if (selectedGame === "SCRAMBLE") {
    const w = vItems[vCurrentWord];
    const pct = Math.min(100, Math.round((scrambleSolvedCount / vItems.length) * 100));
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Složeno: ${scrambleSolvedCount} z ${vItems.length}</span>
          <span style="color:var(--col-yellow);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box">Slož: <b>${cleanCzechTranslation(w.answer)}</b></div>
      <div class="slots-row ${isHebrew ? 'hebrew-text' : ''}">
        ${scrambleTiles.map((t, i) => `<div class="letter-slot ${scrambleIsWordMode?'word-slot':''} ${i<scramblePlaced.length?'filled':''}">${i<scramblePlaced.length?scramblePlaced[i]:'_'}</div>`).join('')}
      </div>
      ${!scrambleDone ? `
        <div class="letters-row">
          ${scrambleTiles.map((t, idx) => `<div class="letter-tile ${scrambleIsWordMode?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''}" onclick="clickScrambleTile(${idx})">${t.text}</div>`).join('')}
        </div>
      ` : `
        ${w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:8px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
        <div class="action-btn ${scrambleHadMistake?'red':'green'}" onclick="initScramble();renderActiveGame();">
          ${scrambleHadMistake ? 'DOKONČENO S CHYBOU ➔ DALŠÍ' : 'SPRÁVNĚ! ➔ DALŠÍ SLOVO'}
        </div>
      `}
    `;
  }

  // ARKÁDA: PADAJÍCÍ SLOVA
  else if (selectedGame === "ARCADE") {
    let btns = [];
    if (arcadeMode === "TRANSLATE") btns = arcadeCurrentOptions;
    else if (arcadeMode.includes("DER_DIE_DAS") || arcadeMode === "ARTICLES") btns = ['DER', 'DIE', 'DAS'];
    else if (arcadeMode.includes("A_AN")) btns = ['A', 'AN'];
    else btns = ['I / Í', 'Y / Ý'];

    if (arcadeState === "GAMEOVER") {
      if (isCampaignMinigame) {
          let bonusCoins = Math.floor(arcadeScore / 10);
          main.innerHTML = `
            <div style="text-align:center;padding:35px;">
              <h2 style="color:var(--col-green);font-size:28px;">TRÉNINK DOKONČEN! 🎉</h2>
              <p style="font-size:20px;color:#fff;margin:10px 0;">Sestřeleno: <b>${arcadeScore} slov</b> (Bonus: +${bonusCoins} 💰)</p>
              <p style="font-size:24px;color:var(--col-yellow);margin-bottom:25px;">Celkem získáváš: +${campaignMinigameCoins + bonusCoins} 💰</p>
              <div class="action-btn green" onclick="finishCampaign(${campaignMinigameCoins + bonusCoins})">PŘIPSAT ZLAŤÁKY A ZPĚT</div>
            </div>
          `;
      } else {
          main.innerHTML = `
            <div style="text-align:center;padding:35px;">
              <h2 style="color:var(--col-red);font-size:28px;">KONEC HRY! 💔</h2>
              <p style="font-size:20px;color:#fff;margin:10px 0;">Sestřeleno: <b>${arcadeScore} slov</b> (LVL ${arcadeLevel})</p>
              <div class="action-btn green" onclick="startArcadeGame()">HRÁT ZNOVU ➔</div>
              <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT</div>
            </div>
          `;
      }
      return;
    }

    let disp = "";
    let subDisp = "";
    if (arcadeCurrent) {
        if (arcadeMode === "TRANSLATE") {
            disp = cleanCzechTranslation(arcadeCurrent.answer);
        } else if (arcadeMode.includes("DER_DIE_DAS") || arcadeMode === "ARTICLES" || arcadeMode.includes("A_AN")) {
            disp = arcadeCurrent.question.replace(/^(der|die|das|a|an)\s+/i, '');
            subDisp = cleanCzechTranslation(arcadeCurrent.answer);
        } else {
            disp = arcadeCurrent.question;
            subDisp = cleanCzechTranslation(arcadeCurrent.answer);
        }
    }

    main.innerHTML = `
      <div class="arcade-arena">
        <div class="arcade-top-bar">
          <span>${"❤️".repeat(arcadeLives)}</span>
          <span style="color:var(--col-yellow);">LVL ${arcadeLevel}</span>
          <span style="color:var(--col-active-tab);">Body: ${arcadeScore}</span>
        </div>
        <div class="arcade-playfield" id="arcade-field">
          ${arcadeCurrent ? `
            <div id="arcade-falling-elem" class="falling-item" style="top:${arcadeY}px; left:${arcadeX}%;">
              <div class="falling-main-word">${disp}</div>
              ${subDisp ? `<div class="falling-sub-word">${subDisp}</div>` : ''}
            </div>
          ` : ''}
          <div class="arcade-danger-line"></div>
        </div>
        <div class="arcade-bottom-bar" style="${arcadeMode==='TRANSLATE'?'flex-wrap:wrap;justify-content:center;':''}">
          ${btns.map(b => `<div class="arcade-btn" style="${arcadeMode==='TRANSLATE'?'font-size:16px;min-width:30%;padding:10px 5px;height:auto;margin:2px;':''}" onclick="clickArcadeChoice('${b.replace(/'/g,"\\'")}')">${b}</div>`).join('')}
        </div>
      </div>
    `;
  }

  // PEXESO
  else if (selectedGame === "PEXESO") {
    const totalPairs = Math.min(pexesoPairCount, pexesoCards.length / 2);
    const isDone = pexesoMatched.length === totalPairs;
    
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Pexeso: ${pexesoMatched.length} / ${totalPairs} dvojic</span>
          <span style="color:var(--col-yellow);">Pokusy: ${pexesoAttempts}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${(pexesoMatched.length / totalPairs) * 100}%;"></div></div>
      </div>
      ${!isDone ? `
        <div class="pexeso-grid" style="grid-template-columns: repeat(4, 1fr);">
          ${pexesoCards.map((c, i) => {
            const m = pexesoMatched.includes(c.wordIdx), f = pexesoFlipped.includes(i);
            return `<div class="pexeso-card ${m?'matched':(f?'flipped':'hidden')}" style="${(m||f) && c.text.length>10?'font-size:12px;':''}" onclick="clickPexesoCard(${i})">${m||f?c.text:'❓'}</div>`;
          }).join('')}
        </div>
      ` : (isCampaignMinigame ? `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);">TRÉNINK DOKONČEN! 🎉</h2>
          <p style="font-size:18px;color:#fff;margin:10px 0;">Pexeso zvládnuto za <b>${pexesoAttempts} pokusů</b>.</p>
          <p style="font-size:24px;color:var(--col-yellow);margin-bottom:25px;">Celkem získáváš: +${campaignMinigameCoins + (pexesoAttempts <= 12 ? 3 : (pexesoAttempts <= 16 ? 2 : 1))} 💰</p>
          <div class="action-btn green" onclick="finishCampaign(${campaignMinigameCoins + (pexesoAttempts <= 12 ? 3 : (pexesoAttempts <= 16 ? 2 : 1))})">PŘIPSAT ZLAŤÁKY A ZPĚT</div>
        </div>
      ` : `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);">HOTOVO ZA ${pexesoAttempts} POKUSŮ! 🎉</h2>
          <div class="action-btn green" onclick="startPexesoGame(pexesoPairCount)">HRÁT ZNOVU</div>
          <div class="action-btn" onclick="setScreen('SELECT_PEXESO_SIZE')">ZMĚNIT VELIKOST</div>
        </div>
      `)}
    `;
  }

  // KVÍZ (SAMOSTATNÝ)
  else if (selectedGame === "QUIZ") {
    if (qActiveList.length === 0) {
      main.innerHTML = `<div style="text-align:center;padding:30px;"><h2>V této lekci není žádný kvíz.</h2><div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT</div></div>`;
      return;
    }

    if (qCurStep >= qActiveList.length) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">KVÍZ DOKONČEN! 🎉</h2>
          <p style="color:#fff;margin-bottom:15px;">Zvládl jsi všech ${qActiveList.length} otázek!</p>
          <div class="action-btn green" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const q = qActiveList[qCurStep];
    const pct = Math.round(((qCurStep + 1) / qActiveList.length) * 100);

    let promptDisplay = formatPromptText(q.question);
    if (qAnswered) {
      const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${q.answer}</span>`;
      if (q.question.includes('___')) {
        promptDisplay = formatPromptText(q.question.replace(/___+/g, fillHtml));
      } else {
        promptDisplay = formatPromptText(q.question) + " " + fillHtml;
      }
    }

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Kvíz: Otázka ${qCurStep + 1} z ${qActiveList.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:22px;color:#fff;margin:15px 0;">
        ${promptDisplay}
        ${(qAnswered && getTargetLang(selectedSubject) !== 'cs-CZ') ? `<span class="audio-btn" onclick="speakWord('${(q.question.includes('___') ? q.question.replace(/___+/g, q.answer) : q.question + ' ' + q.answer).replace(/[*_]/g, '')}', '${selectedSubject}')">🔊</span>` : ''}
      </div>
      <div class="grid-2">
        ${q.options.map((opt, optIdx) => {
          let btnCls = "";
          if (qAnswered) {
            if (opt === q.answer) btnCls = "correct";
            else if (opt === qChosenOpt) btnCls = "wrong";
          }
          return `<div class="opt-btn ${btnCls}" onclick="clickQuizOpt(${optIdx})">${opt}</div>`;
        }).join('')}
      </div>
      ${qAnswered ? `
        ${q.help ? `<div style="text-align:center;color:var(--col-yellow);margin:10px 0;font-size:16px;font-weight:bold;">[ ${q.help} ]</div>` : ''}
        <div class="action-btn green" style="margin-top:12px;" onclick="nextQuizStep()">DALŠÍ OTÁZKA ➔</div>
      ` : ''}
    `;
  }

  // PROCEDURÁLNÍ MATEMATIKA
  else if (selectedGame === "PROCEDURAL_MATH") {
    const isAns = (typeof mathChosenAnswer !== "undefined" && mathChosenAnswer !== null);
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Série správně: ${typeof mathStreak !== "undefined" ? mathStreak : 0} 🔥</span>
          <span style="color:var(--col-active-tab);">${selectedGroupKey}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${Math.min(100, (typeof mathStreak !== "undefined" ? mathStreak : 0) * 10)}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:36px;color:#fff;margin:20px 0;">${typeof mathTask !== "undefined" ? mathTask.q : ""}</div>
      <div class="grid-2">
        ${(typeof mathTask !== "undefined" && mathTask.opts ? mathTask.opts : []).map(opt => `
          <div class="opt-btn ${isAns ? (String(opt)===String(mathTask.ans)?'correct':(opt===mathChosenAnswer?'wrong':'')) : ''}" style="height:60px;font-size:26px;font-weight:bold;" onclick="clickMathChoice('${opt}')">${opt}</div>
        `).join('')}
      </div>
      ${isAns ? `<div class="action-btn ${String(mathChosenAnswer)===String(mathTask.ans)?'green':'red'}" onclick="generateMathTask();renderActiveGame();">DALŠÍ PŘÍKLAD ➔</div>` : ''}
    `;
  }

  // ŘADA NA ČAS
  else if (selectedGame === "SEQ") {
    if (sItems.length === 0) return;
    const seqConfig = sItems[selectedSeqIndex] || sItems[0];
    const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);
    const isFinished = seqTargetIdx >= itemsList.length;
    const targetWord = itemsList[seqTargetIdx];
    const pct = Math.round((seqTargetIdx / itemsList.length) * 100);

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Položka ${Math.min(seqTargetIdx + 1, itemsList.length)} z ${itemsList.length} ${seqHintActive ? '<b style="color:var(--col-yellow);">[NÁPOVĚDA]</b>' : ''}</span>
          <span id="seq-timer" style="color:var(--col-yellow);font-weight:bold;">0.0 s</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}" style="margin:8px 0;min-height:56px;color:#fff;font-size:22px;">
        ${itemsList.slice(0, seqTargetIdx).join(' ')} 
        <span style="color:var(--col-yellow);">${seqHintActive ? `[ ${targetWord}! ]` : '[ ??? ]'}</span>
      </div>
      ${!isFinished ? `
        <div class="grid-2">
          ${seqSlots.map((itemIdx, slot) => {
            const isHintSlot = (seqHintActive && itemIdx === seqTargetIdx);
            return `<div id="seq-btn-${slot}" class="opt-btn ${isHebrew ? 'hebrew' : ''} ${isHintSlot ? 'hint' : ''}" onclick="clickSeqSlot(${slot})">${itemIdx !== -1 ? itemsList[itemIdx] : ''}</div>`;
          }).join('')}
        </div>
      ` : `<div class="action-btn green" onclick="initSequence();renderActiveGame();">DOKONČENO! HRÁT ZNOVU</div>`}
    `;
  }

  // HRA HAD (SNAKE S ODPOČTEM A PLNÝM DISPLEJEM)
  else if (selectedGame === "SNAKE") {
    if (snakeState === "GAMEOVER") {
      if (isCampaignMinigame) {
        let bonusCoins = Math.floor(snakeScore / 2);
        main.innerHTML = `
          <div style="text-align:center;padding:35px;">
            <h2 style="color:var(--col-green);font-size:28px;">TRÉNINK DOKONČEN! 🎉</h2>
            <p style="font-size:20px;color:#fff;margin:10px 0;">Had poskládal: <b>${snakeScore} slov</b> (Bonus: +${bonusCoins} 💰)</p>
            <p style="font-size:24px;color:var(--col-yellow);margin-bottom:25px;">Celkem získáváš: +${campaignMinigameCoins + bonusCoins} 💰</p>
            <div class="action-btn green" onclick="finishCampaign(${campaignMinigameCoins + bonusCoins})">PŘIPSAT ZLAŤÁKY A ZPĚT</div>
          </div>
        `;
      } else {
        main.innerHTML = `
          <div style="text-align:center;padding:35px;">
            <h2 style="color:var(--col-red);font-size:28px;">KONEC HRY! 💔</h2>
            <p style="font-size:20px;color:#fff;margin:12px 0;">Správně složeno: <b>${snakeScore} slov</b></p>
            <div class="action-btn green" onclick="startSnakeGame()">HRÁT ZNOVU ➔</div>
            <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT</div>
          </div>
        `;
      }
      return;
    }

    const canBuyShield = snakeLives > 1 && snakeShieldLetters <= 0;
    const coins = currentUser ? getUserCoins(currentUser.name) : 0;
    const canBuyShieldCoins = snakeLives === 1 && snakeShieldLetters <= 0 && coins >= 15;

    let targetLetterChar = (snakeTargetLetters && snakeTargetLetters[snakeCurrentIdx]) ? snakeTargetLetters[snakeCurrentIdx] : '';

    main.innerHTML = `
      <div class="snake-container">
        <div class="snake-header-box">
          <div class="snake-stats">
            <span>${"❤️".repeat(snakeLives)}</span>
            
            ${snakeShieldLetters > 0 ? `
              <span class="snake-shield-btn active">🛡️ Štít: ${snakeShieldLetters} p.</span>
            ` : (canBuyShield ? `
              <button class="snake-shield-btn" ontouchstart="buySnakeShieldInGame(event)" onclick="buySnakeShieldInGame(event)">
                🛡️ Štít (-1 ❤️ / 20 p.)
              </button>
            ` : (canBuyShieldCoins ? `
              <button class="snake-shield-btn" style="border-color:var(--col-yellow);color:var(--col-yellow);" ontouchstart="buySnakeShieldWithCoins(event)" onclick="buySnakeShieldWithCoins(event)">
                🛡️ Štít (15 💰 / 20 p.)
              </button>
            ` : `
              <span class="snake-shield-btn" style="opacity:0.4;">🛡️ Štít</span>
            `))}

            <span style="color:var(--col-active-tab);">Body: ${snakeScore}</span>
          </div>

          ${snakeCurrentWord ? `
            <div class="snake-prompt-cz">${snakeCurrentWord.czech}</div>
            <div id="snake-slots-wrap" class="snake-slots-row">
              ${snakeTargetLetters.map((ch, idx) => `
                <div class="snake-slot ${idx < snakeCurrentIdx ? 'done' : (idx === snakeCurrentIdx ? 'active' : '')}">
                  ${idx < snakeCurrentIdx ? ch : (idx === snakeCurrentIdx ? ch : '_')}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="snake-status-bar" style="color:${snakeState==='PAUSED_SHIELD'?'var(--col-yellow)':'var(--col-red)'};">
            ${snakeState === "HIT" || snakeState === "PAUSED_SHIELD" ? snakeStatusMsg : ''}
          </div>
        </div>

        <div class="snake-canvas-wrap">
          <canvas id="snake-canvas" width="340" height="340"></canvas>

          <!-- 5SEKUNDOVÝ ODPOČET S TLAČÍTKEM NA ŠTÍT PŘÍMO V ZORNÉM POLI -->
          ${snakeState === "COUNTDOWN" ? `
            <div class="snake-overlay">
              <div class="snake-countdown-num">${snakeCountdown}</div>
              <div style="font-size:15px;color:#fff;font-weight:bold;margin-bottom:6px;">
                ${snakeStatusMsg || "Připrav se!"}
              </div>
              <div style="font-size:13px;color:var(--col-yellow);margin-bottom:12px;">
                Hledej písmeno: <b style="font-size:20px;text-decoration:underline;">[ ${targetLetterChar} ]</b>
              </div>

              <div style="display:flex;flex-direction:column;gap:8px;width:100%;max-width:250px;">
                ${canBuyShield ? `
                  <button class="action-btn" style="background:#4338ca;border-color:#818cf8;padding:8px;font-size:14px;margin:0;"
                          ontouchstart="buySnakeShieldInGame(event)" onclick="buySnakeShieldInGame(event)">
                    🛡️ Koupit štít (-1 ❤️ / 20 p.)
                  </button>
                ` : (snakeShieldLetters > 0 ? `
                  <div style="background:rgba(6,95,70,0.9);border:1px solid #34d399;color:#a7f3d0;padding:6px;border-radius:6px;font-size:12px;font-weight:bold;">
                    🛡️ Štít je aktivní (${snakeShieldLetters} p.)
                  </div>
                ` : (canBuyShieldCoins ? `
                  <button class="action-btn" style="background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);padding:8px;font-size:14px;margin:0;"
                          ontouchstart="buySnakeShieldWithCoins(event)" onclick="buySnakeShieldWithCoins(event)">
                    🛡️ Koupit štít za 15 💰 (20 p.)
                  </button>
                ` : ''))}

                <button class="action-btn green" style="padding:8px;font-size:14px;margin:0;"
                        ontouchstart="skipSnakeCountdown(event)" onclick="skipSnakeCountdown(event)">
                  Spustit ihned ⏩
                </button>
              </div>
            </div>
          ` : ''}

          <!-- DIALOG PŘI VYPRŠENÍ ŠTÍTU -->
          ${snakeState === "SHIELD_EXPIRED_PAUSE" ? `
            <div class="snake-overlay">
              <h3 style="color:var(--col-yellow);font-size:22px;margin-bottom:6px;">🛡️ ŠTÍT VYPRŠEL!</h3>
              <p style="font-size:13px;color:#fff;margin-bottom:14px;">Dál už tě zdi ani tvůj ocas neochrání.</p>
              ${canBuyShield ? `
                <button class="action-btn" style="background:#4338ca;border-color:#818cf8;width:100%;max-width:250px;margin-bottom:8px;padding:9px;font-size:14px;" 
                        ontouchstart="buySnakeShieldInGame(event)" onclick="buySnakeShieldInGame(event)">
                  Koupit další štít (-1 ❤️ / 20 p.)
                </button>
              ` : (canBuyShieldCoins ? `
                <button class="action-btn" style="background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);width:100%;max-width:250px;margin-bottom:8px;padding:9px;font-size:14px;" 
                        ontouchstart="buySnakeShieldWithCoins(event)" onclick="buySnakeShieldWithCoins(event)">
                  Koupit štít za 15 💰 (20 p.)
                </button>
              ` : '')}
              <button class="action-btn green" style="width:100%;max-width:250px;padding:9px;font-size:14px;" 
                      ontouchstart="resumeSnakeWithoutShield(event)" onclick="resumeSnakeWithoutShield(event)">
                Pokračovat bez štítu ▶️
              </button>
            </div>
          ` : ''}
        </div>

        <div class="snake-dpad">
          <div class="dpad-row">
            <button class="dpad-btn" ontouchstart="event.preventDefault(); setSnakeDirection(0, -1);" onclick="setSnakeDirection(0, -1)">▲</button>
          </div>
          <div class="dpad-row">
            <button class="dpad-btn" ontouchstart="event.preventDefault(); setSnakeDirection(-1, 0);" onclick="setSnakeDirection(-1, 0)">◄</button>
            <button class="dpad-btn" ontouchstart="event.preventDefault(); setSnakeDirection(0, 1);" onclick="setSnakeDirection(0, 1)">▼</button>
            <button class="dpad-btn" ontouchstart="event.preventDefault(); setSnakeDirection(1, 0);" onclick="setSnakeDirection(1, 0)">►</button>
          </div>
        </div>
      </div>
    `;
    drawSnake();
    setTimeout(attachSnakeTouchHandlers, 50);
  }

  // KAMPAŇ (SPIRÁLA)
  else if (selectedGame === "CAMPAIGN") {
    if (cmpIdx >= cmpQueue.length) {
      launchCampaignMinigame();
      return;
    }

    const task = cmpQueue[cmpIdx];
    const pct = Math.round((cmpIdx / cmpQueue.length) * 100);
    const heartsHtml = "❤️".repeat(cmpHearts) + "🖤".repeat(5 - cmpHearts);

    let html = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Trénink: Úkol ${cmpIdx + 1} z ${cmpQueue.length}</span>
          <span style="font-size:14px;">${heartsHtml}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
    `;

    if (task.type === 'KVIZ' || task.type.startsWith('QUIZ')) {
      const isEval = cmpState === 'EVAL';
      let promptDisplay = task.prompt;

      if (isEval && task.type === 'KVIZ') {
        const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${task.correctAns}</span>`;
        if (task.data.question.includes('___')) {
          promptDisplay = formatPromptText(task.data.question.replace(/___+/g, fillHtml));
        } else {
          promptDisplay = formatPromptText(task.data.question) + " " + fillHtml;
        }
      }

      html += `<div class="prompt-box" style="font-size:24px;color:#fff;margin:20px 0;">
                 ${promptDisplay}
                 ${(isEval && getTargetLang(selectedSubject) !== 'cs-CZ' && task.type !== 'QUIZ_IN') ? `<span class="audio-btn" onclick="speakWord('${(task.type==='KVIZ' && task.data.question.includes('___') ? task.data.question.replace(/___+/g, task.data.answer) : task.data.question).replace(/[*_]/g, '')}', '${selectedSubject}')">🔊</span>` : ''}
               </div>`;
      
      html += `<div class="grid-2">`;
      task.opts.forEach(opt => {
        let btnCls = "";
        if (isEval) {
          if (opt === task.correctAns) btnCls = "correct";
          else if (opt === cmpChosenOpt) btnCls = "wrong";
        }
        html += `<div class="opt-btn ${btnCls}" onclick="clickCmpQuizOpt('${opt.replace(/'/g, "\\'")}')">${opt}</div>`;
      });
      html += `</div>`;

      if (isEval) {
        if (task.data.help) html += `<div style="text-align:center;color:var(--col-yellow);margin:12px 0;font-weight:bold;">[ ${task.data.help} ]</div>`;
        html += `<div class="action-btn green" style="margin-top:15px;" onclick="nextCmpTask()">DALŠÍ ➔</div>`;
      }
    }
    else if (task.type === 'SCRAMBLE') {
      html += `
        <div class="prompt-box">Slož: <b>${cleanCzechTranslation(task.data.answer)}</b></div>
        <div class="slots-row ${isHebrew ? 'hebrew-text' : ''}">
          ${task.tiles.map((t, i) => `<div class="letter-slot ${task.isWordMode?'word-slot':''} ${i<task.placed.length?'filled':''}">${i<task.placed.length?task.placed[i]:'_'}</div>`).join('')}
        </div>
      `;
      if (cmpState !== 'EVAL') {
        html += `<div class="letters-row">${task.tiles.map((t, i) => `<div class="letter-tile ${task.isWordMode?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''}" onclick="clickCmpScrambleTile(${i})">${t.text}</div>`).join('')}</div>`;
      } else {
        if (task.data.help) html += `<div style="text-align:center;color:var(--col-active-tab);font-weight:bold;margin:10px 0;">[ ${task.data.help} ]</div>`;
        html += `<div class="action-btn green" onclick="nextCmpTask()">DALŠÍ ➔</div>`;
      }
    }
    main.innerHTML = html;
  }
}
