/**
 * HERNÍ REŽIMY: KARTY, ZKOUŠENÍ, SKLÁDÁNÍ, ARKÁDA, PEXESO, KVÍZ, ŘADA NA ČAS, KAMPAŇ (SPIRÁLA)
 */

let isCampaignMinigame = false;
let campaignMinigameCoins = 0;
let campaignMinigamePool = [];
let arcadeMode = "";
let arcadeCurrentOptions = [];
let qActiveList = [];

function formatPromptText(text) {
  if (!text) return "";
  return text.replace(/\*([^*]+)\*/g, '<b style="color:var(--col-yellow);text-decoration:underline;">$1</b>');
}

// ==========================================
// 1. OVLÁDÁNÍ KARET (DALŠÍ / PŘEDCHOZÍ / ZVUK)
// ==========================================
let vCardIdx = 0;

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
// 2. ZKOUŠENÍ Z HLAVY
// ==========================================
let vMastery = {}, vActivePool = 3, vCurrentWord = 0, vLastWord = -1, vQuizRevealed = false;
let scrambleDeck = [], scramblePlaced = [], scrambleTiles = [], scrambleIsWordMode = false, scrambleHadMistake = false, scrambleDone = false, scrambleSolvedCount = 0;
let pexesoPairCount = 4, pexesoCards = [], pexesoFlipped = [], pexesoMatched = [], pexesoLocked = false, pexesoAttempts = 0;
let qCurStep = 0, qAnswered = false, qChosenOpt = null;
let seqTargetIdx = 0, seqSlots = [], seqStartTime = 0, seqTimerInterval = null, seqHintActive = false, seqInactivityTimer = null;

function initGameState() {
  const vItems = getVocabItems();
  const qItems = getQuizItems();
  const sItems = getSeqItems();

  if (vItems.length > 0) {
    vMastery = {}; let masteredCount = 0;
    vItems.forEach((w, i) => {
      const m = getSavedMastery(w.question, testingDirection);
      vMastery[i] = m; if (m >= 2) masteredCount++;
    });
    vActivePool = Math.min(vItems.length, Math.max(getAdaptiveWindowSize(currentUser ? currentUser.grade : 2), masteredCount + 3));
    vLastWord = -1; vCardIdx = 0;

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
  let current = 0, masteredCount = 0;
  vItems.forEach((_, i) => {
    const m = vMastery[i] || 0;
    current += m;
    if (m >= 2) masteredCount++;
  });
  return { current, total: vItems.length * 2, masteredCount, totalWords: vItems.length };
}

function pickNextAdaptiveWord() {
  const vItems = getVocabItems();
  vQuizRevealed = false;
  const stats = getMasteryStats();
  if (stats.masteredCount >= stats.totalWords) { vCurrentWord = -1; return; }

  while (vActivePool < vItems.length) {
    let unmastered = 0;
    for (let i = 0; i < vActivePool; i++) if ((vMastery[i] || 0) < 2) unmastered++;
    if (unmastered >= 2) break;
    vActivePool++;
  }

  let available = [];
  for (let i = 0; i < vActivePool; i++) if ((vMastery[i] || 0) < 2) available.push(i);
  if (available.length === 0) {
    for (let i = 0; i < vItems.length; i++) if ((vMastery[i] || 0) < 2) available.push(i);
  }

  let candidates = available.length > 1 && vLastWord !== -1 ? available.filter(i => i !== vLastWord) : available;
  const mistakes = candidates.filter(i => (vMastery[i] || 0) === 0);
  vCurrentWord = (mistakes.length > 0 && Math.random() < 0.75) ? mistakes[Math.floor(Math.random() * mistakes.length)] : candidates[Math.floor(Math.random() * candidates.length)];
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
    if (vMastery[vCurrentWord] >= 2 && vActivePool < vItems.length) vActivePool++;
    saveWordMasteryToGoogle(w.question, vMastery[vCurrentWord], testingDirection);
  } else {
    sndErr(); vMastery[vCurrentWord] = 0;
    saveWordMasteryToGoogle(w.question, 0, testingDirection);
  }
  pickNextAdaptiveWord();
  renderActiveGame();
}

// ==========================================
// 3. SKLÁDÁNÍ SLOV A FRÁZÍ
// ==========================================
function initScramble() {
  const vItems = getVocabItems();
  if (!scrambleDeck || scrambleDeck.length === 0) scrambleDeck = vItems.map((_, i) => i).sort(() => Math.random() - 0.5);
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
// 4. ARKÁDA PADAJÍCÍ SLOVA (S PODPOROU KAMPANĚ)
// ==========================================
let arcadeDeck = [], arcadeCurrent = null, arcadeLives = 3, arcadeScore = 0, arcadeLevel = 1, arcadeY = 0, arcadeX = 50, arcadeSpeed = 0.8, arcadeAnimId = null, arcadeState = "PLAYING";

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
    if (m) {
        if (arcadeMode === "TRANSLATE") {
            m.innerText = arcadeCurrent.question; // V překladu ukáže správné cizí slovo
        } else {
            m.innerText = arcadeCurrent.question;
        }
    }
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
  pexesoPairCount = 6; // Pro kampaň pevně 12 karet
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
  const itemsList = sItems[selectedSeqIndex].answer.split('|').map(s => s.trim()).filter(Boolean);

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
  const itemsList = sItems[selectedSeqIndex].answer.split('|').map(s => s.trim()).filter(Boolean);
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

function startGame(game) { stopArcadeLoop(); selectedGame = game; isCampaignMinigame = false; initGameState(); setScreen("PLAYING"); }

// ==========================================
// 8. HLAVNÍ RENDERÉR VŠECH HER
// ==========================================
function renderActiveGame() {
  const main = document.getElementById("main-content");
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

  // ZKOUŠENÍ Z HLAVY
  else if (selectedGame === "ADAPTIVE") {
    const stats = getMasteryStats();
    const pct = Math.round((stats.current / stats.total) * 100);
    const isDirOut = testingDirection === "DIR_OUT";

    if (stats.masteredCount >= stats.totalWords) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">KOMPLETNĚ ZVLÁDNUTO! 🎉</h2>
          <p style="color:#fff;margin-bottom:15px;">Všech ${stats.totalWords} položek umíš na 2 ★!</p>
          <div class="action-btn" onclick="toggleTestingDirection()">PŘEPNOUT SMĚR (${isDirOut ? 'Cizí ➔ 🇨🇿' : '🇨🇿 ➔ Cizí'}) ⇄</div>
          <div class="action-btn green" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const w = vItems[vCurrentWord];
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Zvládnuto: ${stats.masteredCount} z ${stats.totalWords} slov (2 ★)</span>
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

  // SKLÁDÁNÍ
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
          let bonusCoins = Math.floor(arcadeScore / 5);
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
            return `<div class="pexeso-card ${m?'matched':(f?'flipped':'hidden')}" style="${c.text.length>10?'font-size:12px;':''}" onclick="clickPexesoCard(${i})">${m||f?c.text:'❓'}</div>`;
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

  // KVÍZ (Samostatný)
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

  // ŘADA NA ČAS
  else if (selectedGame === "SEQ") {
    if (sItems.length === 0) return;
    const seqConfig = sItems[selectedSeqIndex];
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

  // --- KAMPAŇ (SPIRÁLA) ---
  else if (selectedGame === "CAMPAIGN") {
    if (cmpIdx >= cmpQueue.length) {
      launchCampaignMinigame(); // Přechod na minihru na konci
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

// ==========================================
// 9. KAMPAŇ ENGINE (OPRAVENO)
// ==========================================
let cmpQueue = [];
let cmpIdx = 0;
let cmpHearts = 5;
let cmpState = 'PLAYING'; 
let cmpChosenOpt = null;

function startCampaign() {
  let q = [];
  let allVItems = getVocabItems();
  let allQItems = getQuizItems();

  // Proměnná selectedGroupKey (aktuální level) je již 100% správně vypočítána a nastavena z app.js
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
      }
  });

  currentQItems.forEach(it => qGrammar.push({ type: 'KVIZ', data: it }));

  qRevision.sort(() => Math.random() - 0.5); qNewPassive.sort(() => Math.random() - 0.5); qNewActive.sort(() => Math.random() - 0.5); qGrammar.sort(() => Math.random() - 0.5); qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);

  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       
       let localItems = [...currentVItems, ...olderVItems];
       let pool = [...new Set(localItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
       if (pool.length < 3) {
           let extra = [...new Set(allVItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns && !pool.includes(ans));
           extra.sort((a, b) => Math.abs(a.length - correctAns.length) - Math.abs(b.length - correctAns.length));
           pool.push(...extra.slice(0, 3));
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
    } else if (task.type === 'KVIZ') {
       task.opts = task.data.options;
       task.correctAns = task.data.answer;
       task.prompt = formatPromptText(task.data.question);
    }
  });

  cmpQueue = q; cmpIdx = 0; cmpHearts = 5; cmpState = 'PLAYING'; cmpChosenOpt = null; isCampaignMinigame = false;
  selectedGame = 'CAMPAIGN'; setScreen('PLAYING');
  if (isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') speakWord(cmpQueue[0].prompt, selectedSubject);
}
function clickCmpQuizOpt(opt) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  cmpChosenOpt = opt; cmpState = 'EVAL';

  if (opt === task.correctAns) {
    sndOk();
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
      const dir = task.type === 'QUIZ_OUT' ? 'DIR_OUT' : 'DIR_IN';
      const mVal = getSavedMastery(task.data.question, dir);
      if (mVal < 2) saveWordMasteryToGoogle(task.data.question, mVal + 1, dir);
    }
  } else {
    sndErr(); cmpHearts = Math.max(0, cmpHearts - 1);
    let newTask = JSON.parse(JSON.stringify(task));
    if (newTask.opts) newTask.opts.sort(() => Math.random() - 0.5);
    cmpQueue.push(newTask);
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') saveWordMasteryToGoogle(task.data.question, 0, task.type === 'QUIZ_OUT' ? 'DIR_OUT' : 'DIR_IN');
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
    sndOk(); tile.used = true; task.placed.push(tile.text);
    if (task.placed.length === task.tokens.length) { cmpState = 'EVAL'; if (isAutoTTS) speakWord(task.data.question, selectedSubject); }
  } else {
    sndErr(); cmpHearts = Math.max(0, cmpHearts - 1);
    let newTask = { type: 'SCRAMBLE', data: task.data, tokens: task.tokens, isWordMode: task.isWordMode };
    newTask.tiles = task.tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
    newTask.placed = []; cmpQueue.push(newTask);
  }
  renderActiveGame();
}

function nextCmpTask() {
  cmpIdx++; cmpState = 'PLAYING'; cmpChosenOpt = null; renderActiveGame();
  if (cmpIdx < cmpQueue.length && isAutoTTS && cmpQueue[cmpIdx].type === 'QUIZ_IN') speakWord(cmpQueue[cmpIdx].prompt, selectedSubject);
}

function launchCampaignMinigame() {
    let allVItems = getVocabItems();
    let singleWords = allVItems.filter(it => it.question.split(' ').length <= 2 && !it.question.includes('.'));
    
    let currentSingle = singleWords.filter(it => it.lesson === selectedGroupKey);
    let olderSingle = singleWords.filter(it => it.lesson !== selectedGroupKey).sort(() => Math.random() - 0.5);
    campaignMinigamePool = [...currentSingle, ...olderSingle].slice(0, 30);

    isCampaignMinigame = true;
    campaignMinigameCoins = cmpHearts; // 1 srdce = 1 zlaťák

    if (campaignMinigamePool.length < 6) { finishCampaign(campaignMinigameCoins); return; }

    let r = Math.random();
    let isGerman = getTargetLang(selectedSubject).startsWith('de');
    let articlesCount = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question)).length;

    if (isGerman && articlesCount >= 8 && r < 0.33) startCampaignArcade("ARTICLES");
    else if (r < (isGerman && articlesCount >= 8 ? 0.66 : 0.5)) startCampaignArcade("TRANSLATE");
    else startCampaignPexeso();
}

function finishCampaign(coins) {
  addCoins(currentUser.name, coins);
  addReward(1, "Trénink: " + selectedGroupKey);
  
  // Návrat do hubu – hub si sám načte a posune další level
  setScreen("CAMPAIGN_HUB");
}
