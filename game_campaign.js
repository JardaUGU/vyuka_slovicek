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
function startSmartMix() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof stopTargetTimer === "function") stopTargetTimer();

  const allItems = activeItems.filter(it => 
    (typeof viewMode !== 'undefined' && viewMode === "LESSONS" ? it.lesson : it.topic) === selectedGroupKey
  );
  
  if (allItems.length === 0) return;

  // 1. Zjistit mastery pro všechny položky (Kvízy i Slova)
  let pool = [];
  let unmastered = allItems.filter(it => {
    let m = 2;
    if (it.type === "SLOVO") {
      m = Math.min(getSavedMastery(it.question, 'DIR_IN'), getSavedMastery(it.question, 'DIR_OUT'));
    } else if (it.type === "KVIZ") {
      m = getSavedMastery(it.question, 'DIR_OUT');
    }
    return m < 2;
  });

  // 2. Výběr 15 položek (buď těch, co neumí, nebo 15 náhodných s resetem na 0)
  if (unmastered.length > 0) {
    pool = unmastered.sort(() => Math.random() - 0.5).slice(0, 15);
  } else {
    pool = [...allItems].sort(() => Math.random() - 0.5).slice(0, 15);
    pool.forEach(it => {
      saveWordMasteryToGoogle(it.question, 0, 'DIR_OUT');
      if (it.type === "SLOVO") saveWordMasteryToGoogle(it.question, 0, 'DIR_IN');
    });
  }

  // 3. Vytvořit 3 navazující vlny (1. Poznávání -> 2. Aktivní překlad -> 3. Skládání)
  let wave1 = []; // Kvízy a Cizí -> CZ
  let wave2 = []; // CZ -> Cizí
  let wave3 = []; // Skládání (Scramble)

  let wavePool = pool.slice(0, 10);

  wavePool.forEach(it => {
    if (it.type === "KVIZ") {
      wave1.push({ type: 'KVIZ', data: it, wave: 1 });
    } else if (it.type === "SLOVO") {
      if (selectedSubject === "Matematika") {
         wave1.push({ type: 'QUIZ_IN', data: it, wave: 1 });
      } else {
         const isMultiWord = it.question.trim().includes(' ') || it.question.trim().includes('-');
         if (isMultiWord) {
            if (getSavedMastery(it.question, 'DIR_IN') < 2) {
               wave1.push({ type: 'QUIZ_IN', data: it, wave: 1 });
            }
            wave3.push({ type: 'SCRAMBLE', data: it, wave: 3 });
         } else {
            if (getSavedMastery(it.question, 'DIR_IN') < 2) wave1.push({ type: 'QUIZ_IN', data: it, wave: 1 });
            if (getSavedMastery(it.question, 'DIR_OUT') < 2) wave2.push({ type: 'QUIZ_OUT', data: it, wave: 2 });
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
       task.tokens = tokens;
       task.tiles = tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
       task.placed = []; task.isWordMode = isWordMode; task.hadMistake = false;
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

// ==========================================
// SPIRÁLOVÁ KAMPAŇ (CESTA)
// ==========================================
function startCampaign() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof stopTargetTimer === "function") stopTargetTimer();

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
          if (it.question.trim().includes(' ')) qRevision.push({ type: 'SCRAMBLE', data: it, wave: 1 });
          else qRevision.push({ type: 'QUIZ_IN', data: it, wave: 1 });
      });
  }

  let unmasteredVItems = currentVItems.filter(it => 
    getSavedMastery(it.question, 'DIR_IN') < 2 || getSavedMastery(it.question, 'DIR_OUT') < 2
  );
  
  let targetVItems = [...unmasteredVItems].sort(() => Math.random() - 0.5);

  if (targetVItems.length < 15) {
    let masteredVItems = currentVItems.filter(it => !unmasteredVItems.includes(it)).sort(() => Math.random() - 0.5);
    targetVItems = [...targetVItems, ...masteredVItems];
  }
  
  targetVItems = targetVItems.slice(0, 15);

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

  currentQItems.forEach(it => qGrammar.push({ type: 'KVIZ', data: it, wave: 2 }));

  qRevision.sort(() => Math.random() - 0.5); qNewPassive.sort(() => Math.random() - 0.5); 
  qNewActive.sort(() => Math.random() - 0.5); qGrammar.sort(() => Math.random() - 0.5); qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);

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

       // Poslechová výzva 🎧 pro 35 % pasivních otázek v cizích jazycích
       if (task.type === 'QUIZ_IN' && selectedSubject !== "Matematika" && typeof isAutoTTS !== "undefined" && isAutoTTS && getTargetLang(selectedSubject) !== 'cs-CZ') {
         if (Math.random() < 0.35) task.isAudioOnly = true;
       }

    } else if (task.type === 'SCRAMBLE') {
       // OPRAVA: Odstranění závorek před rozpadem na kostičky i v Kampani
       const raw = task.data.question.replace(/\s*\([^)]*\)/g, '').trim();
       const isWordMode = (raw.split(/\s+/).length >= 3 || raw.length > 15);
       const tokens = isWordMode ? (raw.includes('-') ? raw.split('-').map(s=>s.trim()) : raw.split(/\s+/)) : getGraphemes(raw);
       task.tokens = tokens;
       task.tiles = tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
       task.placed = []; task.isWordMode = isWordMode; task.hadMistake = false;
    } else if (task.type === 'KVIZ') {
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

function clickCmpQuizOpt(opt) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx]; cmpChosenOpt = opt; cmpState = 'EVAL';

  if (opt === task.correctAns) {
    sndOk();
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN' || task.type === 'KVIZ') {
      const dir = task.type === 'QUIZ_OUT' ? 'DIR_OUT' : (task.type === 'KVIZ' ? 'DIR_OUT' : 'DIR_IN');
      const mVal = getSavedMastery(task.data.question, dir);
      if (mVal < 2) saveWordMasteryToGoogle(task.data.question, mVal + 1, dir);
    }
  } else {
    sndErr(); cmpHearts = Math.max(0, cmpHearts - 1);
    if (task.data && !cmpMistakes.some(m => m.question === task.data.question)) {
      cmpMistakes.push(task.data);
    }
    let newTask = JSON.parse(JSON.stringify(task));
    newTask.isAudioOnly = false; // Při opravě chyby už ukážeme i psaný text
    if (newTask.opts) newTask.opts.sort(() => Math.random() - 0.5);
    requeueFailedTask(newTask);
    
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN' || task.type === 'KVIZ') {
        const dir = task.type === 'QUIZ_OUT' ? 'DIR_OUT' : (task.type === 'KVIZ' ? 'DIR_OUT' : 'DIR_IN');
        saveWordMasteryToGoogle(task.data.question, 0, dir);
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

  if (tile.text === task.tokens[task.placed.length]) {
    sndOk(); 
    tile.used = true; 
    task.placed.push(tile.text);
    
    if (task.placed.length === task.tokens.length) { 
      cmpState = 'EVAL'; if (isAutoTTS) speakWord(task.data.question, selectedSubject); 
      if (!task.hadMistake) {
        const isMultiWord = task.data.question.trim().includes(' ') || task.data.question.trim().includes('-');
        const step = isMultiWord ? 2 : 1;
        const mIn = getSavedMastery(task.data.question, 'DIR_IN'); 
        const mOut = getSavedMastery(task.data.question, 'DIR_OUT');
        if (mIn < 2) saveWordMasteryToGoogle(task.data.question, Math.min(2, mIn + step), 'DIR_IN');
        if (mOut < 2) saveWordMasteryToGoogle(task.data.question, Math.min(2, mOut + step), 'DIR_OUT');
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
    if (cmpHearts > 0) {
      addCoins(currentUser.name, cmpHearts);
    }
    addReward(1, "Trénink: " + selectedGroupKey);
    isCampaignMinigame = true; 
    campaignMinigameCoins = 0;

    if (campaignMinigamePool.length > 0 && campaignMinigamePool.length < 10) {
        let tempPool = [...campaignMinigamePool];
        while (campaignMinigamePool.length < 20) campaignMinigamePool.push(tempPool[Math.floor(Math.random() * tempPool.length)]);
    } else if (campaignMinigamePool.length === 0) {
        finishCampaign(campaignMinigameCoins); return; 
    }

    let r = Math.random(); 
    let isGerman = getTargetLang(selectedSubject).startsWith('de');
    let articlesCount = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question)).length;

    if (isGerman && articlesCount >= 8) {
        if (r < 0.20) startCampaignArcade("ARTICLES");
        else if (r < 0.40) startCampaignArcade("TRANSLATE");
        else if (r < 0.60) startCampaignPexeso();
        else if (r < 0.80 && typeof startCampaignSnake === "function") startCampaignSnake();
        else if (typeof startCampaignTarget === "function") startCampaignTarget();
    } else {
        if (r < 0.25) startCampaignArcade("TRANSLATE");
        else if (r < 0.50) startCampaignPexeso();
        else if (r < 0.75 && typeof startCampaignSnake === "function") startCampaignSnake();
        else if (typeof startCampaignTarget === "function") startCampaignTarget();
    }
}

function finishCampaign(bonusCoins) {
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
