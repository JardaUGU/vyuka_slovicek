/**
 * HERNÍ REŽIMY: KARTY, ZKOUŠENÍ, SKLÁDÁNÍ, ARKÁDA, PEXESO, KVÍZ, ŘADA NA ČAS, KAMPAŇ
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

  if (arcadeDeck.length === 0) { alert("Málo vhodných slov."); return; }
  arcadeLives = 3; arcadeScore = 0; arcadeLevel = 1; arcadeSpeed = 0.8; arcadeState = "PLAYING";
  selectedGame = "ARCADE";
  setScreen("PLAYING");
  spawnArcadeWord();
}

function startCampaignArcade(mode) {
  stopArcadeLoop();
  arcadeMode = mode;
  if (mode === "ARTICLES") arcadeDeck = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question));
  else arcadeDeck = [...campaignMinigamePool];
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
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  selectedGame = game; 
  isCampaignMinigame = false; 
  initGameState(); 
  setScreen("PLAYING"); 
}

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
        else if (typeof startCampaignSnake === "function") startCampaignSnake();
    } else {
        if (r < 0.33) startCampaignArcade("TRANSLATE");
        else if (r < 0.66) startCampaignPexeso();
        else if (typeof startCampaignSnake === "function") startCampaignSnake();
    }
}

function finishCampaign(coins) {
  addCoins(currentUser.name, coins);
  addReward(1, "Trénink: " + selectedGroupKey);
  setScreen("CAMPAIGN_HUB");
}
