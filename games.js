/**
 * HERNÍ REŽIMY: KARTY, OBOUSMĚRNÉ ZKOUŠENÍ, CHYTRÉ SKLÁDÁNÍ, RYCHLÁ VOLBA, PEXESO, KVÍZ, ŘADA
 */
function getVocabItems() { return (activeItems || []).filter(it => it.type === "SLOVO"); }
function getQuizItems()  { return (activeItems || []).filter(it => it.type === "KVIZ"); }
function getSeqItems()   { return (activeItems || []).filter(it => it.type === "RADA"); }

function getGraphemes(str) {
  if (window.Intl && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  return str.split('');
}

// PŘÍSNÁ DETEKCE RYCHLÉ VOLBY: Povolí se POUZE, pokud daná lekce reálně obsahuje min. 3 vhodné položky
function getQuickChoiceMode() {
  const vItems = getVocabItems();
  const s = selectedSubject.toLowerCase();

  if (s.includes("nemc") || s === "de") {
    const count = vItems.filter(it => /^(der|die|das)\s/i.test(it.question)).length;
    if (count >= 3) return "DER_DIE_DAS";
  }
  if (s.includes("angli") || s === "en") {
    const count = vItems.filter(it => /^(a|an)\s/i.test(it.question)).length;
    if (count >= 3) return "A_AN";
  }
  if (s.includes("cest") || s === "cs") {
    const count = vItems.filter(it => it.question.includes('_')).length;
    if (count >= 3) return "I_Y";
  }
  return null;
}

// ========================================================
// 1. ZKOUŠENÍ Z HLAVY (LEITNER BEZ NECHTĚNÉHO OPAKOVÁNÍ)
// ========================================================
let vMastery = {};
let vActivePool = 3;
let vCurrentWord = 0;
let vLastWord = -1;
let vCardIdx = 0;
let vQuizRevealed = false;

function initGameState() {
  const vItems = getVocabItems();
  if (vItems.length > 0) {
    vMastery = {};
    let masteredCount = 0;

    vItems.forEach((w, i) => {
      const m = getSavedMastery(w.question, testingDirection);
      vMastery[i] = m;
      if (m >= 2) masteredCount++;
    });

    const baseWin = getAdaptiveWindowSize(currentUser.grade);
    vActivePool = Math.min(vItems.length, Math.max(baseWin, masteredCount + baseWin));
    vLastWord = -1;

    if (selectedGame === "CARDS") {
      vCardIdx = 0;
      if (isAutoTTS && vItems.length > 0) speakWord(vItems[0].question, selectedSubject);
    }
    if (selectedGame === "ADAPTIVE") pickNextAdaptiveWord();
    if (selectedGame === "SCRAMBLE") { scrambleDeck = []; scrambleSolvedCount = 0; initScramble(); }
    if (selectedGame === "MISSING") { missingDeck = []; missingSolvedCount = 0; initMissing(); }
    if (selectedGame === "QUICK_CHOICE") { quickDeck = []; quickSolvedCount = 0; initQuickChoice(); }
  }
  if (selectedGame === "QUIZ") { qCurStep = 0; qAnswered = false; }
  if (selectedGame === "SEQ") initSequence();
}

function getMasteryStats() {
  const vItems = getVocabItems();
  if (vItems.length === 0) return { current: 0, total: 1, masteredCount: 0, totalWords: 1 };
  let current = 0;
  let masteredCount = 0;
  vItems.forEach((_, i) => {
    const m = vMastery[i] || 0;
    current += m;
    if (m >= 2) masteredCount++;
  });
  return {
    current: current,
    total: vItems.length * 2,
    masteredCount: masteredCount,
    totalWords: vItems.length
  };
}

// OPRAVA VÝBĚRU SLOVA: Žádné opakování hotových slov, zákaz 2× stejného po sobě
function pickNextAdaptiveWord() {
  const vItems = getVocabItems();
  vQuizRevealed = false;

  const stats = getMasteryStats();
  if (stats.masteredCount >= stats.totalWords) {
    vCurrentWord = -1;
    return;
  }

  // Zajistíme, aby v aktivním okně byla dostupná neprobíraná slova
  while (vActivePool < vItems.length) {
    const unmasteredInPool = [];
    for (let i = 0; i < vActivePool; i++) {
      if ((vMastery[i] || 0) < 2) unmasteredInPool.push(i);
    }
    if (unmasteredInPool.length >= 2) break;
    vActivePool++;
  }

  // Sebereme VÝHRADNĚ slova s úrovní < 2 (naučená slova nevracíme!)
  const available = [];
  for (let i = 0; i < vActivePool; i++) {
    if ((vMastery[i] || 0) < 2) available.push(i);
  }

  if (available.length === 0) {
    for (let i = 0; i < vItems.length; i++) {
      if ((vMastery[i] || 0) < 2) available.push(i);
    }
  }

  // Vyloučíme okamžité opakování stejného slova, pokud jich máme více
  let candidates = available;
  if (available.length > 1 && vLastWord !== -1) {
    candidates = available.filter(idx => idx !== vLastWord);
  }

  // Prioritizujeme slova s 0 hvězdami (chybná) před slovy s 1 hvězdou
  const mistakes = candidates.filter(idx => (vMastery[idx] || 0) === 0);
  if (mistakes.length > 0 && Math.random() < 0.75) {
    vCurrentWord = mistakes[Math.floor(Math.random() * mistakes.length)];
  } else {
    vCurrentWord = candidates[Math.floor(Math.random() * candidates.length)];
  }

  vLastWord = vCurrentWord;
}

function answerAdaptive(known) {
  const vItems = getVocabItems();
  const w = vItems[vCurrentWord];

  if (known) {
    sndOk();
    addReward(1, selectedGroupKey);
    vMastery[vCurrentWord] = Math.min(2, (vMastery[vCurrentWord] || 0) + 1);

    if (vMastery[vCurrentWord] >= 2 && vActivePool < vItems.length) {
      vActivePool++;
    }
    saveWordMasteryToGoogle(w.question, vMastery[vCurrentWord], testingDirection);
  } else {
    sndErr();
    vMastery[vCurrentWord] = 0;
    saveWordMasteryToGoogle(w.question, 0, testingDirection);
  }

  pickNextAdaptiveWord();
  renderActiveGame();
}

function revealAdaptiveQuiz() {
  vQuizRevealed = true;
  renderActiveGame();
  if (isAutoTTS && vCurrentWord !== -1) {
    const vItems = getVocabItems();
    speakWord(vItems[vCurrentWord].question, selectedSubject);
  }
}

// ========================================================
// 2. CHYTRÉ SKLÁDÁNÍ (SLOVA VS. PÍSMENA)
// ========================================================
let scrambleDeck = [];
let scramblePlaced = [];
let scrambleTiles = [];
let scrambleIsWordMode = false;
let scrambleHadMistake = false;
let scrambleDone = false;
let scrambleSolvedCount = 0;

function initScramble() {
  const vItems = getVocabItems();
  if (!scrambleDeck || scrambleDeck.length === 0) {
    scrambleDeck = vItems.map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  vCurrentWord = scrambleDeck.pop();
  const w = vItems[vCurrentWord];
  scramblePlaced = [];
  scrambleHadMistake = false;
  scrambleDone = false;

  const rawTarget = w.question.trim();
  const words = rawTarget.split(/\s+/);

  if (words.length >= 3 || rawTarget.length > 15) {
    scrambleIsWordMode = true;
    let tokens = rawTarget.includes('-') 
      ? rawTarget.split('-').map(s => s.trim()) 
      : words;
    
    scrambleTiles = tokens.map((chunk, idx) => ({ text: chunk, originalIdx: idx, used: false }))
                          .sort(() => Math.random() - 0.5);
  } else {
    scrambleIsWordMode = false;
    const graphemes = getGraphemes(rawTarget);
    scrambleTiles = graphemes.map((ch, idx) => ({ text: ch, originalIdx: idx, used: false }))
                             .sort(() => Math.random() - 0.5);
  }
}

function clickScrambleTile(idx) {
  if (scrambleDone) return;
  const item = scrambleTiles[idx];
  if (item.used) return;

  const vItems = getVocabItems();
  const w = vItems[vCurrentWord];

  let targetTokens = [];
  if (scrambleIsWordMode) {
    targetTokens = w.question.includes('-')
      ? w.question.split('-').map(s => s.trim())
      : w.question.trim().split(/\s+/);
  } else {
    targetTokens = getGraphemes(w.question.trim());
  }

  const expected = targetTokens[scramblePlaced.length];

  if (item.text === expected) {
    sndOk();
    item.used = true;
    scramblePlaced.push(item.text);

    if (scramblePlaced.length === targetTokens.length) {
      scrambleDone = true;
      scrambleSolvedCount++;
      if (!scrambleHadMistake) {
        addReward(1, selectedGroupKey);
        sndFanfare();
      }
      if (isAutoTTS) speakWord(w.question, selectedSubject);
    }
  } else {
    sndErr();
    scrambleHadMistake = true;
  }
  renderActiveGame();
}

function nextScrambleStep() {
  initScramble();
  renderActiveGame();
}

// ========================================================
// 3. RYCHLÁ VOLBA (S POVINNÝM TLAČÍTKEM "DALŠÍ")
// ========================================================
let quickDeck = [];
let quickCurrentItem = null;
let quickSolvedCount = 0;
let quickChosen = null;

function initQuickChoice() {
  const vItems = getVocabItems();
  const mode = getQuickChoiceMode();
  quickChosen = null;

  quickDeck = vItems.filter(it => {
    if (mode === "DER_DIE_DAS") return /^(der|die|das)\s/i.test(it.question);
    if (mode === "A_AN") return /^(a|an)\s/i.test(it.question);
    if (mode === "I_Y") return it.question.includes('_');
    return false;
  }).sort(() => Math.random() - 0.5);

  if (quickDeck.length > 0) {
    quickCurrentItem = quickDeck.pop();
  } else {
    quickCurrentItem = null;
  }
}

function answerQuickChoice(choice) {
  if (quickChosen !== null || !quickCurrentItem) return;
  quickChosen = choice;

  const mode = getQuickChoiceMode();
  let isCorrect = false;

  if (mode === "DER_DIE_DAS") {
    isCorrect = quickCurrentItem.question.toLowerCase().startsWith(choice.toLowerCase() + " ");
  } else if (mode === "A_AN") {
    isCorrect = quickCurrentItem.question.toLowerCase().startsWith(choice.toLowerCase() + " ");
  } else if (mode === "I_Y") {
    isCorrect = quickCurrentItem.answer.trim().toLowerCase() === choice.toLowerCase();
  }

  if (isCorrect) {
    sndOk();
    quickSolvedCount++;
    addReward(1, selectedGroupKey);
    if (isAutoTTS) speakWord(quickCurrentItem.question, selectedSubject);
  } else {
    sndErr();
  }
  renderActiveGame();
}

function nextQuickChoiceStep() {
  quickChosen = null;
  if (quickDeck.length > 0) {
    quickCurrentItem = quickDeck.pop();
  } else {
    initQuickChoice();
  }
  renderActiveGame();
}

// ========================================================
// 4. DOPLŇOVÁNÍ PÍSMENE, PEXESO, KVÍZ, ŘADA
// ========================================================
let missingDeck = [];
let missingSlot = 0;
let missingChoices = [];
let missingChosen = -1;
let missingSolvedCount = 0;

function initMissing() {
  const vItems = getVocabItems();
  if (!missingDeck || missingDeck.length === 0) {
    missingDeck = vItems.map((_, i) => i).sort(() => Math.random() - 0.5);
  }
  vCurrentWord = missingDeck.pop();
  const w = vItems[vCurrentWord];
  const letters = getGraphemes(w.question);
  missingSlot = Math.floor(Math.random() * letters.length);
  const correctCh = letters[missingSlot];
  missingChosen = -1;

  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  missingChoices = [correctCh];
  while (missingChoices.length < 3) {
    let r = alphabet[Math.floor(Math.random() * alphabet.length)];
    if (!missingChoices.includes(r)) missingChoices.push(r);
  }
  missingChoices.sort(() => Math.random() - 0.5);
}

function clickMissingOption(idx) {
  if (missingChosen !== -1) return;
  missingChosen = idx;
  const vItems = getVocabItems();
  const w = vItems[vCurrentWord];
  const letters = getGraphemes(w.question);
  const isCorrect = missingChoices[idx] === letters[missingSlot];

  if (isCorrect) {
    sndOk();
    missingSolvedCount++;
    addReward(1, selectedGroupKey);
    if (isAutoTTS) speakWord(w.question, selectedSubject);
  } else {
    sndErr();
  }
  renderActiveGame();
}

function nextMissingStep() {
  initMissing();
  renderActiveGame();
}

let pexesoPairCount = 4;
let pexesoCards = [];
let pexesoFlipped = [];
let pexesoMatched = [];
let pexesoLocked = false;
let pexesoAttempts = 0;

function startPexesoGame(pairCount) {
  pexesoPairCount = pairCount;
  selectedGame = "PEXESO";
  initPexeso();
  setScreen("PLAYING");
}

function initPexeso() {
  const vItems = getVocabItems();
  const count = Math.min(pexesoPairCount, vItems.length);
  const shuffledWords = [...vItems].sort(() => Math.random() - 0.5).slice(0, count);

  pexesoCards = [];
  shuffledWords.forEach((w, wIdx) => {
    pexesoCards.push({ id: `f_${wIdx}`, wordIdx: wIdx, text: w.question, isForeign: true });
    pexesoCards.push({ id: `c_${wIdx}`, wordIdx: wIdx, text: w.answer, isForeign: false });
  });

  pexesoCards.sort(() => Math.random() - 0.5);
  pexesoFlipped = [];
  pexesoMatched = [];
  pexesoLocked = false;
  pexesoAttempts = 0;
}

function clickPexesoCard(index) {
  if (pexesoLocked) return;
  if (pexesoFlipped.includes(index)) return;
  if (pexesoMatched.includes(pexesoCards[index].wordIdx)) return;

  pexesoFlipped.push(index);
  const cardJustFlipped = pexesoCards[index];

  if (isAutoTTS && cardJustFlipped.isForeign) {
    speakWord(cardJustFlipped.text, selectedSubject);
  }

  renderActiveGame();

  if (pexesoFlipped.length === 2) {
    pexesoAttempts++;
    const idx1 = pexesoFlipped[0];
    const idx2 = pexesoFlipped[1];
    const card1 = pexesoCards[idx1];
    const card2 = pexesoCards[idx2];

    if (card1.wordIdx === card2.wordIdx) {
      sndOk();
      pexesoMatched.push(card1.wordIdx);
      pexesoFlipped = [];

      if (pexesoMatched.length === Math.min(pexesoPairCount, getVocabItems().length)) {
        sndFanfare();
        const maxIdeal = pexesoPairCount * 2;
        const starsEarned = (pexesoAttempts <= maxIdeal) ? (pexesoPairCount >= 6 ? 4 : 2) : 1;
        addReward(starsEarned, selectedGroupKey);
      }
      renderActiveGame();
    } else {
      sndErr();
      pexesoLocked = true;
      setTimeout(() => {
        pexesoFlipped = [];
        pexesoLocked = false;
        renderActiveGame();
      }, 900);
    }
  }
}

let qCurStep = 0;
let qAnswered = false;

function clickQuizOpt(chosen) {
  if (qAnswered) return;
  const qItems = getQuizItems();
  const q = qItems[qCurStep];
  qAnswered = true;
  if (chosen === q.answer) { sndOk(); addReward(1, selectedGroupKey); }
  else sndErr();
  renderActiveGame();
}

function nextQuizStep() {
  const qItems = getQuizItems();
  qCurStep++;
  qAnswered = false;
  if (qCurStep >= qItems.length) setScreen("SELECT_GAME");
  else renderActiveGame();
}

let seqTargetIdx = 0;
let seqSlots = [];
let seqStartTime = 0;
let seqTimerInterval = null;
let seqHintActive = false;
let seqInactivityTimer = null;

function resetInactivityTimer() {
  if (seqInactivityTimer) clearTimeout(seqInactivityTimer);
  seqInactivityTimer = setTimeout(() => {
    seqHintActive = true;
    renderActiveGame();
  }, 3000);
}

function initSequence() {
  const sItems = getSeqItems();
  if (sItems.length === 0) return;
  const itemsList = sItems[0].answer.split('|').map(s => s.trim()).filter(Boolean);

  seqTargetIdx = 0;
  seqHintActive = false;
  seqSlots = [-1, -1, -1, -1];
  seqSlots[0] = 0;
  if (itemsList.length > 1) seqSlots[1] = 1;
  for (let s = 2; s < Math.min(4, itemsList.length); s++) seqSlots[s] = s;
  seqSlots.sort(() => Math.random() - 0.5);

  seqStartTime = Date.now();
  if (seqTimerInterval) clearInterval(seqTimerInterval);
  seqTimerInterval = setInterval(() => {
    const el = document.getElementById("seq-timer");
    if (el && seqTargetIdx < itemsList.length) {
      el.innerText = ((Date.now() - seqStartTime) / 1000).toFixed(1) + " s";
    }
  }, 100);

  resetInactivityTimer();
}

function clickSeqSlot(slot) {
  const sItems = getSeqItems();
  const itemsList = sItems[0].answer.split('|').map(s => s.trim()).filter(Boolean);
  const btnEl = document.getElementById(`seq-btn-${slot}`);

  if (seqSlots[slot] === seqTargetIdx) {
    sndOk();
    seqTargetIdx++;
    seqHintActive = false;

    if (seqTargetIdx >= itemsList.length) {
      clearInterval(seqTimerInterval);
      if (seqInactivityTimer) clearTimeout(seqInactivityTimer);
      sndFanfare();
      addReward(3, selectedGroupKey);
    } else {
      const next = seqTargetIdx + 1;
      seqSlots[slot] = next < itemsList.length ? next : -1;
      resetInactivityTimer();
    }
    renderActiveGame();
  } else {
    sndErr();
    if (btnEl) {
      btnEl.classList.add("wrong");
      setTimeout(() => { if (btnEl) btnEl.classList.remove("wrong"); }, 250);
    }
    seqHintActive = true;
    resetInactivityTimer();
    renderActiveGame();
  }
}

function vCardPrev() {
  const vItems = getVocabItems();
  vCardIdx = (vCardIdx + vItems.length - 1) % vItems.length;
  renderActiveGame();
  if (isAutoTTS && vItems.length > 0) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function vCardNext() {
  const vItems = getVocabItems();
  vCardIdx = (vCardIdx + 1) % vItems.length;
  renderActiveGame();
  if (isAutoTTS && vItems.length > 0) speakWord(vItems[vCardIdx].question, selectedSubject);
}

function startGame(game) {
  selectedGame = game;
  initGameState();
  setScreen("PLAYING");
}

function renderActiveGame() {
  const main = document.getElementById("main-content");
  const isHebrew = selectedSubject.toLowerCase().includes('hebr') || selectedSubject === 'HE';
  const vItems = getVocabItems();
  const qItems = getQuizItems();
  const sItems = getSeqItems();

  // 1. KARTY
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
        ${w.question}
        <span class="audio-btn" onclick="speakWord('${w.question}', '${selectedSubject}')" title="Přečíst">🔊</span>
      </div>
      <div class="prompt-box" style="color:#fff;font-size:22px;">${w.answer}</div>
      <div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:12px;">[ ${w.help || ''} ]</div>
      <div class="grid-2">
        <div class="action-btn" onclick="vCardPrev()">Předchozí</div>
        <div class="action-btn" onclick="vCardNext()">Další (${vCardIdx+1}/${vItems.length})</div>
      </div>
    `;
  }

  // 2. OBOUSMĚRNÉ ZKOUŠENÍ (BEZ NECHTĚNÉHO OPAKOVÁNÍ)
  else if (selectedGame === "ADAPTIVE") {
    const stats = getMasteryStats();
    const pct = Math.round((stats.current / stats.total) * 100);
    const isDirOut = testingDirection === "DIR_OUT";

    if (stats.masteredCount >= stats.totalWords) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px 10px;">
          <h2 style="color:var(--col-green);font-size:26px;margin-bottom:12px;">KOMPLETNĚ ZVLÁDNUTO! 🎉</h2>
          <p style="font-size:17px;color:#fff;margin-bottom:8px;">Všech ${stats.totalWords} slov v tomto směru (${isDirOut ? '🇨🇿 ➔ Cizí' : 'Cizí ➔ 🇨🇿'}) umíš na 2 ★!</p>
          <div class="action-btn" style="margin-bottom:10px;" onclick="toggleTestingDirection()">PŘEPNOUT NA DRUHÝ SMĚR ⇄</div>
          <div class="action-btn green" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU HRY ➔</div>
        </div>
      `;
      return;
    }

    const w = vItems[vCurrentWord];
    const mVal = vMastery[vCurrentWord] || 0;
    const promptText = isDirOut ? w.answer : w.question;
    const targetText = isDirOut ? w.question : w.answer;

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Učení: ${stats.masteredCount} z ${stats.totalWords} (${stats.current}/${stats.total} b.)</span>
          <span style="color:var(--col-green);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--col-text-muted);margin-bottom:4px;">
        <span>Slovo: ${mVal}/2 ★</span>
        <button class="toggle-btn on" onclick="toggleTestingDirection()" style="font-size:11px;padding:2px 8px;">
          Směr: ${isDirOut ? '🇨🇿 ➔ Cizí' : 'Cizí ➔ 🇨🇿'} ⇄
        </button>
      </div>
      <div class="prompt-box" style="color:#fff;margin-top:2px;">${promptText}</div>
      <div class="prompt-box ${(!isDirOut && isHebrew) ? 'hebrew-text' : (isDirOut && isHebrew && vQuizRevealed ? 'hebrew-text' : '')}" style="color:${vQuizRevealed ? 'var(--col-yellow)' : 'var(--col-text-muted)'};">
        ${vQuizRevealed ? targetText : '[ ? ? ? ]'}
        ${(vQuizRevealed && isDirOut) ? `<span class="audio-btn" onclick="speakWord('${w.question}', '${selectedSubject}')">🔊</span>` : ''}
      </div>
      ${vQuizRevealed ? `
        <div style="text-align:center;color:var(--col-active-tab);margin-bottom:8px;">[ ${w.help || ''} ]</div>
        <div class="grid-2">
          <div class="action-btn red" onclick="answerAdaptive(false)">Nevěděl jsem (0 ★)</div>
          <div class="action-btn green" onclick="answerAdaptive(true)">Věděl jsem (+1 ★)</div>
        </div>
      ` : `
        <div class="action-btn" onclick="revealAdaptiveQuiz()">ZKONTROLOVAT</div>
      `}
    `;
  }

  // 3. SKLÁDÁNÍ
  else if (selectedGame === "SCRAMBLE") {
    const w = vItems[vCurrentWord];
    const pct = Math.min(100, Math.round((scrambleSolvedCount / vItems.length) * 100));

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Vyřešeno: ${scrambleSolvedCount} z ${vItems.length}</span>
          <span style="color:var(--col-yellow);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:20px;color:#fff;margin-top:4px;">Slož: <b>${w.answer}</b></div>
      <div class="slots-row ${isHebrew ? 'hebrew-text' : ''}">
        ${scrambleTiles.map((tile, i) => `
          <div class="letter-slot ${scrambleIsWordMode ? 'word-slot' : ''} ${i < scramblePlaced.length ? 'filled' : ''}">
            ${i < scramblePlaced.length ? scramblePlaced[i] : '_'}
          </div>
        `).join('')}
      </div>
      ${!scrambleDone ? `
        <div class="letters-row">
          ${scrambleTiles.map((item, idx) => `
            <div class="letter-tile ${scrambleIsWordMode ? 'word-tile' : ''} ${isHebrew ? 'hebrew' : ''} ${item.used ? 'used' : ''}" onclick="clickScrambleTile(${idx})">
              ${item.text}
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="text-align:center;color:var(--col-active-tab);margin-bottom:6px;">[ ${w.help || ''} ]</div>
        <div class="action-btn ${scrambleHadMistake ? 'red' : 'green'}" onclick="nextScrambleStep()">
          ${scrambleHadMistake ? 'DOKONČENO S CHYBOU ➔ DALŠÍ' : 'SPRÁVNĚ! ➔ DALŠÍ SLOVO'}
        </div>
      `}
    `;
  }

  // 4. RYCHLÁ VOLBA (S FIXACÍ A TLAČÍTKEM "DALŠÍ")
  else if (selectedGame === "QUICK_CHOICE") {
    const mode = getQuickChoiceMode();
    const it = quickCurrentItem;
    if (!it) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2>Žádné položky pro tento režim v této lekci.</h2>
          <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT</div>
        </div>
      `;
      return;
    }

    let promptClean = it.question;
    let btns = [];

    if (mode === "DER_DIE_DAS") {
      promptClean = it.question.replace(/^(der|die|das)\s+/i, '');
      btns = ['DER', 'DIE', 'DAS'];
    } else if (mode === "A_AN") {
      promptClean = it.question.replace(/^(a|an)\s+/i, '');
      btns = ['A', 'AN'];
    } else if (mode === "I_Y") {
      btns = ['I / Í', 'Y / Ý'];
    }

    const isAnswered = quickChosen !== null;

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Rychlá volba: ${quickSolvedCount} vyřešeno</span>
          <span style="color:var(--col-yellow);">Zbývá: ${quickDeck.length + 1}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:100%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:32px;color:#fff;margin:20px 0;">
        ${isAnswered ? it.question : promptClean}
      </div>
      <p style="text-align:center;color:var(--col-text-muted);font-size:16px;margin-bottom:15px;">${it.answer}</p>
      <div style="display:flex;gap:10px;justify-content:center;">
        ${btns.map(b => {
          let cls = "";
          if (isAnswered) {
            let isThisCorrect = false;
            if (mode === "DER_DIE_DAS" || mode === "A_AN") isThisCorrect = it.question.toLowerCase().startsWith(b.toLowerCase() + " ");
            if (mode === "I_Y") isThisCorrect = it.answer.trim().toLowerCase() === b.toLowerCase();
            
            if (isThisCorrect) cls = "correct";
            else if (b === quickChosen) cls = "wrong";
          }
          return `<div class="opt-btn ${cls}" style="flex:1;height:65px;font-size:22px;font-weight:bold;" onclick="answerQuickChoice('${b}')">${b}</div>`;
        }).join('')}
      </div>
      ${isAnswered ? `
        <div class="action-btn green" style="margin-top:20px;" onclick="nextQuickChoiceStep()">DALŠÍ ➔</div>
      ` : ''}
    `;
  }

  // 5. MATEMATIKA (S FIXACÍ A TLAČÍTKEM "DALŠÍ")
  else if (selectedGame === "PROCEDURAL_MATH") {
    const isAnswered = mathChosenAnswer !== null;

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Série správně: ${mathStreak} 🔥</span>
          <span style="color:var(--col-active-tab);">${selectedGroupKey}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${Math.min(100, mathStreak * 10)}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:36px;color:#fff;margin:20px 0;">${mathTask.q}</div>
      <div class="grid-2">
        ${mathTask.opts.map(opt => {
          let cls = "";
          if (isAnswered) {
            if (String(opt) === String(mathTask.ans)) cls = "correct";
            else if (opt === mathChosenAnswer) cls = "wrong";
          }
          return `
            <div class="opt-btn ${cls}" style="height:60px;font-size:26px;font-weight:bold;" onclick="clickMathChoice('${opt}')">
              ${opt}
            </div>
          `;
        }).join('')}
      </div>
      ${isAnswered ? `
        <div class="action-btn ${String(mathChosenAnswer) === String(mathTask.ans) ? 'green' : 'red'}" style="margin-top:16px;" onclick="nextMathStep()">
          DALŠÍ PŘÍKLAD ➔
        </div>
      ` : ''}
    `;
  }

  // 6. DOPLŇOVÁNÍ PÍSMENE
  else if (selectedGame === "MISSING") {
    const w = vItems[vCurrentWord];
    const letters = getGraphemes(w.question);
    const pct = Math.min(100, Math.round((missingSolvedCount / vItems.length) * 100));

    let maskedWord = "";
    letters.forEach((ch, idx) => {
      if (idx === missingSlot) {
        maskedWord += missingChosen === -1 ? " [ _ ] " : ` [ ${ch} ] `;
      } else {
        maskedWord += ch + " ";
      }
    });

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Doplněno: ${missingSolvedCount} z ${vItems.length}</span>
          <span style="color:var(--col-yellow);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:20px;color:#fff;margin-top:4px;">Doplň: <b>${w.answer}</b></div>
      <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}">${maskedWord}</div>
      <div class="grid-2">
        ${missingChoices.map((ch, i) => {
          const isCorrect = ch === letters[missingSlot];
          const cls = missingChosen !== -1 ? (isCorrect ? 'correct' : (i === missingChosen ? 'wrong' : '')) : '';
          return `<div class="opt-btn ${isHebrew ? 'hebrew' : ''} ${cls}" onclick="clickMissingOption(${i})">${ch}</div>`;
        }).join('')}
      </div>
      ${missingChosen !== -1 ? `<div class="action-btn" onclick="nextMissingStep()">DALŠÍ ➔</div>` : ''}
    `;
  }

  // 7. PEXESO
  else if (selectedGame === "PEXESO") {
    const totalPairs = Math.min(pexesoPairCount, vItems.length);
    const isComplete = pexesoMatched.length === totalPairs;

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Pexeso: ${pexesoMatched.length} / ${totalPairs} dvojic</span>
          <span style="color:var(--col-yellow);">Pokusy: ${pexesoAttempts}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${(pexesoMatched.length / totalPairs) * 100}%;"></div></div>
      </div>
      ${!isComplete ? `
        <div class="pexeso-grid" style="grid-template-columns: repeat(4, 1fr);">
          ${pexesoCards.map((c, i) => {
            const isMatched = pexesoMatched.includes(c.wordIdx);
            const isFlipped = pexesoFlipped.includes(i);
            let cls = isMatched ? 'matched' : (isFlipped ? 'flipped' : 'hidden');
            if (c.isForeign && isHebrew) cls += ' hebrew';
            return `
              <div class="pexeso-card ${cls}" onclick="clickPexesoCard(${i})">
                ${isMatched || isFlipped ? c.text : '❓'}
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div style="text-align:center;padding:30px 10px;">
          <h2 style="color:var(--col-green);font-size:26px;margin-bottom:8px;">VÝBORNĚ! PEXESO SPLNĚNO!</h2>
          <p style="color:var(--col-yellow);font-size:18px;margin-bottom:6px;">Hotovo za ${pexesoAttempts} pokusů!</p>
          <div class="action-btn green" onclick="initPexeso();renderActiveGame();">HRÁT ZNOVU ➔</div>
          <div class="action-btn" style="margin-top:10px;" onclick="setScreen('SELECT_PEXESO_SIZE')">ZMĚNIT VELIKOST PEXESA</div>
        </div>
      `}
    `;
  }

  // 8. KVÍZ
  else if (selectedGame === "QUIZ") {
    const q = qItems[qCurStep];
    const pct = Math.round(((qCurStep + 1) / qItems.length) * 100);
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Kvíz: ${qCurStep + 1} z ${qItems.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:20px;color:#fff;">${q.question}</div>
      <div class="grid-2" style="margin-top:10px;">
        ${q.options.map(opt => `
          <div class="opt-btn ${qAnswered ? (opt === q.answer ? 'correct' : 'wrong') : ''}" onclick="clickQuizOpt('${opt}')">
            ${opt}
          </div>
        `).join('')}
      </div>
      ${qAnswered ? `
        <div style="text-align:center;color:var(--col-yellow);margin-top:8px;">${q.help || ''}</div>
        <div class="action-btn" onclick="nextQuizStep()">DALŠÍ ➔</div>
      ` : ''}
    `;
  }

  // 9. ŘADA NA ČAS
  else if (selectedGame === "SEQ") {
    const seqConfig = sItems[0];
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
            return `
              <div id="seq-btn-${slot}" class="opt-btn ${isHebrew ? 'hebrew' : ''} ${isHintSlot ? 'hint' : ''}" onclick="clickSeqSlot(${slot})">
                ${itemIdx !== -1 ? itemsList[itemIdx] : ''}
              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="action-btn green" onclick="initSequence();renderActiveGame();">DOKONČENO! HRÁT ZNOVU</div>
      `}
    `;
  }
}
