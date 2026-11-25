// ==========================================
// KAMPAŇ (SPIRÁLA), CHYTRÝ TRÉNINK A MINIHRY
// ==========================================
let cmpQueue = [];
let cmpIdx = 0;
let cmpHearts = 5;
let cmpState = 'PLAYING';
let cmpChosenOpt = null;

let cmpMistakes = [];        // Seznam slov, ve kterých žák během tréninku chyboval
let cmpSummaryShown = false; // Zda už jsme ukázali závěrečný přehled chyb

let isCampaignMinigame = false;
let campaignMinigameCoins = 0;
let campaignMinigamePool = [];

let cmpCapOneLevelPerSession = false;
let cmpSessionAdvanced = new Set();

function advanceCmpMastery(question, dir, step = 1) {
  const advKey = `${question}:::${dir}`;
  if (cmpCapOneLevelPerSession) {
    if (cmpSessionAdvanced.has(advKey)) return;
    cmpSessionAdvanced.add(advKey);
    step = 1;
  }
  const cur = getSavedMastery(question, dir);
  if (cur < 2) {
    saveWordMasteryToGoogle(question, Math.min(2, cur + step), dir);
  }
}

// Inteligentní generátor falešných odpovědí pro Matematiku (zachovává jednotky i formát zlomků)
function generateMathDistractors(correctStr, fallbackPool) {
  const s = String(correctStr).trim();
  const distractors = new Set();

  // 1. Pokud odpověď obsahuje zlomek ve tvaru [a/b] nebo a/b
  const fracMatch = s.match(/(\[?)(\d+)\s*\/\s*(\d+)(\]?)/);
  if (fracMatch) {
    let n = parseInt(fracMatch[2], 10);
    let d = parseInt(fracMatch[3], 10);
    const deltas = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [1, 1], [-1, 1]];
    for (let [dn, dd] of deltas) {
      let nn = Math.max(1, n + dn);
      let nd = Math.max(2, d + dd);
      if (nn === n && nd === d) continue;
      let fake = s.replace(fracMatch[0], `${fracMatch[1]}${nn}/${nd}${fracMatch[4]}`);
      if (fake !== s) distractors.add(fake);
      if (distractors.size >= 3) break;
    }
  }

  // 2. Pokud odpověď obsahuje číslo (celé nebo desetinné) + libovolné jednotky (např. "15 cm²", "-4", "3,5 kg")
  const numMatch = s.match(/-?\d+([.,]\d+)?/);
  if (distractors.size < 3 && numMatch) {
    const rawNum = numMatch[0];
    const hasComma = rawNum.includes(',');
    const isFloat = rawNum.includes('.') || hasComma;
    const val = parseFloat(rawNum.replace(',', '.'));
    
    let tries = 0;
    while (distractors.size < 3 && tries < 30) {
      tries++;
      let step = isFloat ? (Math.floor(Math.random() * 5) + 1) * 0.5 : (Math.floor(Math.random() * 5) + 1);
      if (Math.abs(val) >= 50 && !isFloat) step *= (Math.random() > 0.5 ? 10 : 2);
      let fakeVal = val + (Math.random() > 0.5 ? step : -step);
      if (val >= 0 && fakeVal < 0) fakeVal = val + step + tries; // U kladných úloh negenerujeme záporné
      
      let fakeNumStr = isFloat ? fakeVal.toFixed(rawNum.split(/[.,]/)[1].length) : String(Math.round(fakeVal));
      if (hasComma) fakeNumStr = fakeNumStr.replace('.', ',');
      
      let fakeFull = s.replace(rawNum, fakeNumStr);
      if (fakeFull !== s) distractors.add(fakeFull);
    }
  }

  // 3. Pojistka, kdyby byla odpověď čistě slovní (např. "rovnostranný")
  for (let item of fallbackPool) {
    if (distractors.size >= 3) break;
    if (item !== s) distractors.add(item);
  }
  while (distractors.size < 3) distractors.add(s + " ?");

  return Array.from(distractors).slice(0, 3);
}

// ==========================================
// CHYTRÝ TRÉNINK PRO BĚŽNÉ LEKCE (MIX)
// ==========================================
function assignHardScrambles(queue, maxCount = 2) {
  const scrambleTasks = queue.filter(t => t.type === 'SCRAMBLE' && t.data && t.data.question);
  const eligible = scrambleTasks.filter(t => {
    const raw = t.data.question.replace(/\s*\([^)]*\)/g, '').trim();
    const isWM = (raw.split(/\s+/).length >= 3 || raw.length > 15);
    const toks = isWM ? (raw.includes('-') ? raw.split('-').map(s => s.trim()) : raw.split(/\s+/)) : getGraphemes(raw);
    return toks.length >= 2;
  });
  if (eligible.length === 0) return;

  const sorted = [...eligible].sort((a, b) => {
    const sa = getSavedMastery(a.data.question, 'DIR_IN') + getSavedMastery(a.data.question, 'DIR_OUT');
    const sb = getSavedMastery(b.data.question, 'DIR_IN') + getSavedMastery(b.data.question, 'DIR_OUT');
    if ((sa > 0) !== (sb > 0)) return sb - sa; // Přednostně známější slova (>= 1 ★)
    return Math.random() - 0.5;
  });
  sorted.slice(0, maxCount).forEach(t => { t.isHard = true; });
}

function removeCmpScramblePlaced(pIdx) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  if (!task || !task.isHard) return;
  const origIdx = task.hardPlacedIds[pIdx];
  if (origIdx !== undefined && task.tiles[origIdx]) task.tiles[origIdx].used = false;
  task.placed.splice(pIdx, 1);
  task.hardPlacedIds.splice(pIdx, 1);
  renderActiveGame();
}

function clearCmpScramblePlaced() {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  if (!task || !task.isHard) return;
  task.placed = [];
  task.hardPlacedIds = [];
  task.tiles.forEach(t => { t.used = false; });
  renderActiveGame();
}

function checkCmpHardScramble() {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  if (!task || !task.isHard || task.placed.length === 0) return;

  const isCorrect = (task.placed.length === task.tokens.length) && task.placed.every((t, i) => t === task.tokens[i]);
  cmpState = 'EVAL';

  if (isCorrect) {
    sndOk(false);
    if (typeof addReward === "function") addReward(1, "Trénink: " + selectedGroupKey);
    const isMultiWord = task.data.question.trim().includes(' ') || task.data.question.trim().includes('-');
    const step = isMultiWord ? 2 : 1;
    advanceCmpMastery(task.data.question, 'DIR_IN', step);
    advanceCmpMastery(task.data.question, 'DIR_OUT', step);
  } else {
    sndErr();
    task.hadMistake = true;
    cmpHearts = Math.max(0, cmpHearts - 1);
    if (task.data && !cmpMistakes.some(m => m.question === task.data.question)) {
      cmpMistakes.push(task.data);
    }
    let newTask = {
      type: 'SCRAMBLE', data: task.data, tokens: task.tokens, isWordMode: task.isWordMode,
      hadMistake: false, wave: task.wave, isHard: false, hardPlacedIds: []
    };
    newTask.tiles = task.tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
    newTask.placed = [];
    requeueFailedTask(newTask);
  }

  if (typeof isAutoTTS !== "undefined" && isAutoTTS) {
    speakWord(task.data.question, selectedSubject);
  }
  renderActiveGame();
}
function startSmartMix() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof stopTargetTimer === "function") stopTargetTimer();

  cmpCapOneLevelPerSession = false;
  cmpSessionAdvanced = new Set();

  const allItems = activeItems.filter(it => 
    (typeof viewMode !== 'undefined' && viewMode === "LESSONS" ? it.lesson : it.topic) === selectedGroupKey
  );
  if (allItems.length === 0) return;
// 1. Zjistit mastery pro všechny trénovatelné položky (Kvízy i Slova)
  const trainableItems = allItems.filter(it => it.type === "SLOVO" || it.type === "KVIZ");
  if (trainableItems.length === 0) return;

  const getItemScore = (it) => {
    if (it.type === "SLOVO") {
      return getSavedMastery(it.question, 'DIR_IN') + getSavedMastery(it.question, 'DIR_OUT'); // max 4
    }
    return getSavedMastery(it.question, 'DIR_OUT') * 2; // max 4
  };

  let unmastered = trainableItems.filter(it => getItemScore(it) < 4);
  let mastered = trainableItems.filter(it => getItemScore(it) >= 4);

  // 2. Výběr 10 položek: přednostně chybné/nedokončené, zbytek do 10 doplníme zvládnutými z lekce
  let wavePool = [];
  if (unmastered.length > 0) {
    unmastered.sort((a, b) => {
      const sa = getItemScore(a), sb = getItemScore(b);
      if (sa !== sb) return sa - sb; // 0 ★ před 1 ★
      return Math.random() - 0.5;
    });
    const fillers = [...mastered].sort(() => Math.random() - 0.5);
    wavePool = [...unmastered, ...fillers].slice(0, 10);
  } else {
    wavePool = [...trainableItems].sort(() => Math.random() - 0.5).slice(0, 10);
    wavePool.forEach(it => {
      saveWordMasteryToGoogle(it.question, 0, 'DIR_OUT');
      if (it.type === "SLOVO") saveWordMasteryToGoogle(it.question, 0, 'DIR_IN');
    });
  }

  // 3. Vytvořit 3 navazující vlny (1. Poznávání -> 2. Aktivní překlad -> 3. Skládání)
  let wave1 = []; // Kvízy a Cizí -> CZ
  let wave2 = []; // CZ -> Cizí
  let wave3 = []; // Skládání (Scramble)

  wavePool.forEach(it => {
    if (it.type === "KVIZ") {
      wave1.push({ type: 'KVIZ', data: it, wave: 1 });
    } else if (it.type === "SLOVO") {
      if (selectedSubject === "Matematika") {
         wave1.push({ type: 'QUIZ_IN', data: it, wave: 1 });
      } else {
         const mIn = getSavedMastery(it.question, 'DIR_IN');
         const mOut = getSavedMastery(it.question, 'DIR_OUT');
         const forcePractice = (mIn >= 2 && mOut >= 2); // Doplněná slova procvičíme ve všech vlnách
         const isMultiWord = it.question.trim().includes(' ') || it.question.trim().includes('-');
         if (isMultiWord) {
            if (mIn < 2 || forcePractice) {
               wave1.push({ type: 'QUIZ_IN', data: it, wave: 1 });
            }
            wave3.push({ type: 'SCRAMBLE', data: it, wave: 3 });
         } else {
            if (mIn < 2 || forcePractice) wave1.push({ type: 'QUIZ_IN', data: it, wave: 1 });
            if (mOut < 2 || forcePractice) wave2.push({ type: 'QUIZ_OUT', data: it, wave: 2 });
            wave3.push({ type: 'SCRAMBLE', data: it, wave: 3 });
         }
      }
    }
  });

  // Zamícháme každou vlnu zvlášť
  wave1.sort(() => Math.random() - 0.5);
  wave2.sort(() => Math.random() - 0.5);
  wave3.sort(() => Math.random() - 0.5);

  // Anti-clustering pojistka mezi vlnami
  const secureWaveTransition = (prevWave, nextWave) => {
    if (prevWave.length > 0 && nextWave.length > 1) {
      const lastQuestion = prevWave[prevWave.length - 1].data.question;
      if (nextWave[0].data.question === lastQuestion) {
        for (let i = 1; i < nextWave.length; i++) {
          if (nextWave[i].data.question !== lastQuestion) {
            let temp = nextWave[0];
            nextWave[0] = nextWave[i];
            nextWave[i] = temp;
            break;
          }
        }
      }
    }
  };

  secureWaveTransition(wave1, wave2);
  const activePrevWave = wave2.length > 0 ? wave2 : wave1;
  secureWaveTransition(activePrevWave, wave3);

  let q = [...wave1, ...wave2, ...wave3];
  if (q.length > 35) q = q.slice(0, 35);

  // 4. Doplnit možnosti, grafémy a poslechové výzvy
  const vItemsOnly = allItems.filter(i => i.type === "SLOVO");
  assignHardScrambles(q, 2);
  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       
       let shortItems = vItemsOnly.filter(i => {
         if (selectedSubject === "Matematika") return true;
         const qWords = i.question.replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const aWords = cleanCzechTranslation(i.answer).replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const isSentence = /[.?!]$/.test(i.question.trim());
         return qWords <= 2 && aWords <= 3 && !isSentence;
       });
       if (shortItems.length < 4) shortItems = vItemsOnly;

       let falsePool = [...new Set(shortItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
       if (selectedSubject === "Matematika") {
         falsePool = generateMathDistractors(correctAns, falsePool);
       } else if (falsePool.length > 0) {
         while (falsePool.length < 3) falsePool.push(falsePool[Math.floor(Math.random() * falsePool.length)]);
       } else {
         falsePool = ["...", "...", "..."];
       }
       
       falsePool.sort(() => Math.random() - 0.5);
       task.opts = [correctAns, ...falsePool.slice(0, 3)].sort(() => Math.random() - 0.5);
       task.correctAns = correctAns;
       
       let rawPrompt = isOut ? cleanCzechTranslation(task.data.answer) : task.data.question;
       task.prompt = typeof formatPromptText === 'function' ? formatPromptText(rawPrompt) : rawPrompt;

       // Poslechová výzva 🎧 pro 35 % pasivních otázek v cizích jazycích
       if (task.type === 'QUIZ_IN' && selectedSubject !== "Matematika" && typeof isAutoTTS !== "undefined" && isAutoTTS && getTargetLang(selectedSubject) !== 'cs-CZ') {
         if (Math.random() < 0.35) task.isAudioOnly = true;
       }

    } else if (task.type === 'SCRAMBLE') {
    const raw = task.data.question.replace(/\s*\([^)]*\)/g, '').trim();
    const isWordMode = (raw.split(/\s+/).length >= 3 || raw.length > 15);
    const tokens = isWordMode ? (raw.includes('-') ? raw.split('-').map(s=>s.trim()) : raw.split(/\s+/)) : getGraphemes(raw);
    const distractors = (task.isHard && typeof buildScrambleDistractors === "function")
      ? buildScrambleDistractors(tokens, isWordMode, task.data.question, vItemsOnly, selectedSubject)
      : [];
    task.tokens = tokens;
    task.tiles = [...tokens, ...distractors].map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
    task.placed = []; task.hardPlacedIds = []; task.isWordMode = isWordMode; task.hadMistake = false;
 } else if (task.type === 'KVIZ') {
       task.opts = task.data.options; task.correctAns = task.data.answer; task.prompt = formatPromptText(task.data.question);
    }
  });

  cmpQueue = q; cmpIdx = 0; cmpHearts = 5; cmpState = 'PLAYING'; cmpChosenOpt = null; isCampaignMinigame = false;
  cmpMistakes = []; cmpSummaryShown = false;
  selectedGame = 'CAMPAIGN'; 
  setScreen('PLAYING');
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') {
    speakWord(cmpQueue[0].data.question, selectedSubject);
  }
}
function startCampaign() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof stopTargetTimer === "function") stopTargetTimer();

  cmpCapOneLevelPerSession = true;
  cmpSessionAdvanced = new Set();

  let q = [];
  let allVItems = getVocabItems();
  let allQItems = getQuizItems();

  // Zjistíme startovní lekci uživatele (Start_...) a seřadíme lekce od nejstarší
  const subjNorm = selectedSubject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  let userMinLvl = 1;
  if (currentUser && currentUser.startLevels) {
    for (let k in currentUser.startLevels) {
      if (subjNorm.includes(k) || k.includes(subjNorm)) {
        userMinLvl = Number(currentUser.startLevels[k]) || 1;
        break;
      }
    }
  }

  const allLessonsSorted = [...new Set(allVItems.map(it => it.lesson))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  let startLessonIdx = 0;
  for (let i = 0; i < allLessonsSorted.length; i++) {
    let num = parseInt(allLessonsSorted[i].replace(/\D/g, '')) || 1;
    if (num <= userMinLvl) startLessonIdx = i;
  }
  const curLessonIdx = allLessonsSorted.indexOf(selectedGroupKey);
  const olderLessonNames = (curLessonIdx > startLessonIdx)
    ? allLessonsSorted.slice(startLessonIdx, curLessonIdx)
    : [];

  let currentVItems = allVItems.filter(it => it.lesson === selectedGroupKey);
  let olderVItems = allVItems.filter(it => olderLessonNames.includes(it.lesson));
  let currentQItems = allQItems.filter(it => it.lesson === selectedGroupKey);
  let olderQItems = allQItems.filter(it => olderLessonNames.includes(it.lesson));

  let qRevision = []; let qNewPassive = []; let qNewActive = []; let qGrammar = []; let qSentences = [];

  // 1. DOČIŠŤOVÁNÍ STARŠÍCH LEKCÍ OD NEJSTARŠÍ (< 100 %)
  let unmasteredOlderTasks = [];
  for (let lName of olderLessonNames) {
    if (unmasteredOlderTasks.length >= 8) break;

    const lWords = olderVItems.filter(it => it.lesson === lName);
    const lQuizzes = olderQItems.filter(it => it.lesson === lName);

    for (let it of lWords) {
      if (unmasteredOlderTasks.length >= 8) break;
      const mIn = getSavedMastery(it.question, 'DIR_IN');
      const mOut = getSavedMastery(it.question, 'DIR_OUT');
      if (mIn < 2 || mOut < 2) {
        const isMulti = it.question.trim().includes(' ') || it.question.trim().includes('-');
        let taskType = 'QUIZ_IN';
        if (isMulti) {
          taskType = 'SCRAMBLE';
        } else if (mOut < 2 && mIn >= 2) {
          taskType = Math.random() < 0.5 ? 'QUIZ_OUT' : 'SCRAMBLE';
        } else if (mIn < 2 && mOut >= 2) {
          taskType = 'QUIZ_IN';
        } else {
          taskType = Math.random() < 0.5 ? 'QUIZ_IN' : 'QUIZ_OUT';
        }
        unmasteredOlderTasks.push({ type: taskType, data: it, wave: 1 });
      }
    }

    for (let qIt of lQuizzes) {
      if (unmasteredOlderTasks.length >= 8) break;
      if (getSavedMastery(qIt.question, 'DIR_OUT') < 2) {
        unmasteredOlderTasks.push({ type: 'KVIZ', data: qIt, wave: 1 });
      }
    }
  }

  if (unmasteredOlderTasks.length > 0) {
    qRevision = unmasteredOlderTasks;
  } else if (olderVItems.length > 0) {
    // Všechny starší lekce jsou na 100 % -> jen lehké udržovací opakování
    let shuffledOlder = [...olderVItems].sort(() => Math.random() - 0.5).slice(0, 3);
    shuffledOlder.forEach(it => {
      if (it.question.trim().includes(' ') || it.question.trim().includes('-')) {
        qRevision.push({ type: 'SCRAMBLE', data: it, wave: 1 });
      } else {
        qRevision.push({ type: 'QUIZ_IN', data: it, wave: 1 });
      }
    });
  }

  // 2. AKTUÁLNÍ LEKCE (max 8 slov, přednost mají 0 ★ před 1 ★)
  let unmasteredVItems = currentVItems.filter(it => 
    getSavedMastery(it.question, 'DIR_IN') < 2 || getSavedMastery(it.question, 'DIR_OUT') < 2
  );

  unmasteredVItems.sort((a, b) => {
    const scoreA = getSavedMastery(a.question, 'DIR_IN') + getSavedMastery(a.question, 'DIR_OUT');
    const scoreB = getSavedMastery(b.question, 'DIR_IN') + getSavedMastery(b.question, 'DIR_OUT');
    if (scoreA !== scoreB) return scoreA - scoreB;
    return Math.random() - 0.5;
  });

  let targetVItems = [...unmasteredVItems];
  if (targetVItems.length < 8) {
    let masteredVItems = currentVItems.filter(it => !unmasteredVItems.includes(it)).sort(() => Math.random() - 0.5);
    targetVItems = [...targetVItems, ...masteredVItems];
  }
  targetVItems = targetVItems.slice(0, 8);

  targetVItems.forEach(it => {
      let forceTest = (getSavedMastery(it.question, 'DIR_IN') === 2 && getSavedMastery(it.question, 'DIR_OUT') === 2);
      
      if (it.question.trim().includes(' ') || it.question.trim().includes('-')) {
          qSentences.push({ type: 'SCRAMBLE', data: it, wave: 3 });
      } else {
          if (getSavedMastery(it.question, 'DIR_IN') < 2 || forceTest) qNewPassive.push({ type: 'QUIZ_IN', data: it, wave: 1 });
          if (getSavedMastery(it.question, 'DIR_OUT') < 2 || forceTest) qNewActive.push({ type: 'QUIZ_OUT', data: it, wave: 2 });
          qSentences.push({ type: 'SCRAMBLE', data: it, wave: 3 });
      }
  });

  // U kvízů aktuální lekce mají přednost nedokončené (< 2 ★), max 6
  const sortedQuizzes = [...currentQItems].sort((a, b) => {
    const ma = getSavedMastery(a.question, 'DIR_OUT');
    const mb = getSavedMastery(b.question, 'DIR_OUT');
    if (ma !== mb) return ma - mb;
    return Math.random() - 0.5;
  }).slice(0, 6);
  sortedQuizzes.forEach(it => qGrammar.push({ type: 'KVIZ', data: it, wave: 2 }));

  qRevision.sort(() => Math.random() - 0.5); qNewPassive.sort(() => Math.random() - 0.5); 
  qNewActive.sort(() => Math.random() - 0.5); qGrammar.sort(() => Math.random() - 0.5); qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);
  assignHardScrambles(q, 2);
  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       let localItems = [...currentVItems, ...olderVItems];
       
       let shortItems = localItems.filter(i => {
         const qWords = i.question.replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const aWords = cleanCzechTranslation(i.answer).replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const isSentence = /[.?!]$/.test(i.question.trim());
         return qWords <= 2 && aWords <= 3 && !isSentence;
       });
       if (shortItems.length < 4) shortItems = localItems;

       let pool = [...new Set(shortItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
       if (selectedSubject === "Matematika") {
         pool = generateMathDistractors(correctAns, pool);
       } else if (pool.length > 0) {
         while (pool.length < 3) pool.push(pool[Math.floor(Math.random() * pool.length)]);
       } else {
         pool = ["...", "...", "..."];
       }
       
       pool.sort(() => Math.random() - 0.5);
       task.opts = [correctAns, ...pool.slice(0, 3)].sort(() => Math.random() - 0.5);
       task.correctAns = correctAns;
       task.prompt = isOut ? cleanCzechTranslation(task.data.answer) : task.data.question;

       if (task.type === 'QUIZ_IN' && selectedSubject !== "Matematika" && typeof isAutoTTS !== "undefined" && isAutoTTS && getTargetLang(selectedSubject) !== 'cs-CZ') {
         if (Math.random() < 0.35) task.isAudioOnly = true;
       }

    } else if (task.type === 'SCRAMBLE') {
    const raw = task.data.question.replace(/\s*\([^)]*\)/g, '').trim();
    const isWordMode = (raw.split(/\s+/).length >= 3 || raw.length > 15);
    const tokens = isWordMode ? (raw.includes('-') ? raw.split('-').map(s=>s.trim()) : raw.split(/\s+/)) : getGraphemes(raw);
    const distractors = (task.isHard && typeof buildScrambleDistractors === "function")
      ? buildScrambleDistractors(tokens, isWordMode, task.data.question, allVItems, selectedSubject)
      : [];
    task.tokens = tokens;
    task.tiles = [...tokens, ...distractors].map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
    task.placed = []; task.hardPlacedIds = []; task.isWordMode = isWordMode; task.hadMistake = false;
 }} else if (task.type === 'KVIZ') {
       task.opts = task.data.options; task.correctAns = task.data.answer; task.prompt = formatPromptText(task.data.question);
    }
  });

  cmpQueue = q; cmpIdx = 0; cmpHearts = 5; cmpState = 'PLAYING'; cmpChosenOpt = null; isCampaignMinigame = false;
  cmpMistakes = []; cmpSummaryShown = false;
  selectedGame = 'CAMPAIGN'; setScreen('PLAYING');
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') {
    speakWord(cmpQueue[0].data.question, selectedSubject);
  }
}
function clickCmpQuizOpt(optOrIdx) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx];
  if (!task) return;
  const opt = (typeof optOrIdx === 'number' && Array.isArray(task.opts)) ? task.opts[optOrIdx] : optOrIdx;
  cmpChosenOpt = opt; cmpState = 'EVAL';

  if (opt === task.correctAns) {
    sndOk(false);
    if (typeof addReward === "function") addReward(1, "Trénink: " + selectedGroupKey);
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN' || task.type === 'KVIZ') {
      const dir = (task.type === 'QUIZ_OUT' || task.type === 'KVIZ') ? 'DIR_OUT' : 'DIR_IN';
      advanceCmpMastery(task.data.question, dir, 1);
    }
  } else {
    sndErr(); cmpHearts = Math.max(0, cmpHearts - 1);
    if (task.data && !cmpMistakes.some(m => m.question === task.data.question)) {
      cmpMistakes.push(task.data);
    }
    let newTask = JSON.parse(JSON.stringify(task));
    newTask.isAudioOnly = false;
    if (newTask.opts) newTask.opts.sort(() => Math.random() - 0.5);
    requeueFailedTask(newTask);
    
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN' || task.type === 'KVIZ') {
        const dir = (task.type === 'QUIZ_OUT' || task.type === 'KVIZ') ? 'DIR_OUT' : 'DIR_IN';
        saveWordMasteryToGoogle(task.data.question, 0, dir);
        cmpSessionAdvanced.delete(`${task.data.question}:::${dir}`);
    }
  }

  if (typeof isAutoTTS !== "undefined" && isAutoTTS && (task.type !== 'QUIZ_IN' || task.isAudioOnly)) {
    let toRead = task.type === 'KVIZ' ? task.data.question.replace(/___+/g, task.data.answer) : task.data.question;
    speakWord(toRead.replace(/[*_]/g, ''), selectedSubject);
  }
  renderActiveGame();
}
function requeueFailedTask(newTask) {
  if (!newTask.wave) {
    cmpQueue.push(newTask);
    return;
  }
  let insertIdx = cmpQueue.length;
  for (let i = cmpIdx + 1; i < cmpQueue.length; i++) {
    if ((cmpQueue[i].wave || 99) > newTask.wave) {
      insertIdx = i;
      break;
    }
  }
  cmpQueue.splice(insertIdx, 0, newTask);
}

function clickCmpScrambleTile(idx) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx]; const tile = task.tiles[idx];
  
  if (tile.used || tile.isWrong) return; 
  if (task.isHard) {
    sndOk(false);
    tile.used = true;
    task.placed.push(tile.text);
    task.hardPlacedIds.push(idx);
    renderActiveGame();
    return;
  }
  if (tile.text === task.tokens[task.placed.length]) {
    sndOk(false); 
    tile.used = true; 
    task.placed.push(tile.text);
    
    if (task.placed.length === task.tokens.length) { 
      cmpState = 'EVAL'; if (isAutoTTS) speakWord(task.data.question, selectedSubject); 
      if (!task.hadMistake) {
        if (typeof addReward === "function") addReward(1, "Trénink: " + selectedGroupKey);
        const isMultiWord = task.data.question.trim().includes(' ') || task.data.question.trim().includes('-');
        const step = isMultiWord ? 2 : 1;
        advanceCmpMastery(task.data.question, 'DIR_IN', step);
        advanceCmpMastery(task.data.question, 'DIR_OUT', step);
      }
    } else {
      const nextExpected = task.tokens[task.placed.length];
      task.tiles.forEach(t => { 
        if (t.text === nextExpected) t.isWrong = false; 
      });
    }
  } else {
    sndErr(); 
    tile.isWrong = true;
    
    if (!task.hadMistake) {
      cmpHearts = Math.max(0, cmpHearts - 1); 
      task.hadMistake = true;
      if (task.data && !cmpMistakes.some(m => m.question === task.data.question)) {
        cmpMistakes.push(task.data);
      }
      let newTask = { type: 'SCRAMBLE', data: task.data, tokens: task.tokens, isWordMode: task.isWordMode, hadMistake: false, wave: task.wave };
      newTask.tiles = task.tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
      newTask.placed = []; 
      requeueFailedTask(newTask); 
    }
  }
  renderActiveGame();
}

function nextCmpTask() {
  cmpIdx++; cmpState = 'PLAYING'; cmpChosenOpt = null; renderActiveGame();
  if (cmpIdx < cmpQueue.length && isAutoTTS && cmpQueue[cmpIdx].type === 'QUIZ_IN') {
    speakWord(cmpQueue[cmpIdx].data.question, selectedSubject);
  }
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
    const heartsFromLesson = cmpHearts;
    addReward(1, "Trénink: " + selectedGroupKey);
    isCampaignMinigame = true; 
    campaignMinigameCoins = 0;

    if (campaignMinigamePool.length > 0 && campaignMinigamePool.length < 10) {
        let tempPool = [...campaignMinigamePool];
        while (campaignMinigamePool.length < 20) campaignMinigamePool.push(tempPool[Math.floor(Math.random() * tempPool.length)]);
    } else if (campaignMinigamePool.length === 0) {
        if (heartsFromLesson > 0) addCoins(currentUser.name, heartsFromLesson);
        finishCampaign(campaignMinigameCoins); return; 
    }

    let r = Math.random(); 
    let isGerman = getTargetLang(selectedSubject).startsWith('de');
    let articlesCount = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question)).length;

    const cashOutNow = () => { if (heartsFromLesson > 0) addCoins(currentUser.name, heartsFromLesson); };

    if (isGerman && articlesCount >= 8) {
        if (r < 0.20) { cashOutNow(); startCampaignArcade("ARTICLES"); }
        else if (r < 0.40) { cashOutNow(); startCampaignArcade("TRANSLATE"); }
        else if (r < 0.60) { cashOutNow(); startCampaignPexeso(); }
        else if (r < 0.80 && typeof startCampaignSnake === "function") startCampaignSnake(heartsFromLesson);
        else if (typeof startCampaignTarget === "function") { cashOutNow(); startCampaignTarget(); }
    } else {
        if (r < 0.25) { cashOutNow(); startCampaignArcade("TRANSLATE"); }
        else if (r < 0.50) { cashOutNow(); startCampaignPexeso(); }
        else if (r < 0.75 && typeof startCampaignSnake === "function") startCampaignSnake(heartsFromLesson);
        else if (typeof startCampaignTarget === "function") { cashOutNow(); startCampaignTarget(); }
    }
}

function finishCampaign(bonusCoins) {
  if (typeof cashOutSnakeLessonHearts === "function") cashOutSnakeLessonHearts();
  if (bonusCoins > 0) {
    addCoins(currentUser.name, bonusCoins);
  }
  
  const sLow = (selectedSubject || "").toLowerCase();
  if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) {
    setScreen("CAMPAIGN_HUB");
  } else {
    setScreen("SELECT_GAME");
  }
}
