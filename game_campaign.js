// ==========================================
// KAMPAŇ (SPIRÁLA) A MINIHRY
// ==========================================
let cmpQueue = [];
let cmpIdx = 0;
let cmpHearts = 5;
let cmpState = 'PLAYING';
let cmpChosenOpt = null;

let isCampaignMinigame = false;
let campaignMinigameCoins = 0;
let campaignMinigamePool = [];
// ==========================================
// CHYTRÝ TRÉNINK PRO BĚŽNÉ LEKCE (MIX)
// ==========================================
function startSmartMix() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();

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

  // Aby v jednom tréninku nebylo 45 úkolů, vezmeme do vln max 10 položek (cca 25-30 úkolů celkem)
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

  // ROBUSTNÍ POJISTKA (Anti-clustering): Prohledá vlnu a bezpečně vymění slovíčko,
  // aniž by se vlnový systém rozbil nebo míchal typy úloh z jiných vln.
  const secureWaveTransition = (prevWave, nextWave) => {
    if (prevWave.length > 0 && nextWave.length > 1) {
      const lastQuestion = prevWave[prevWave.length - 1].data.question;
      if (nextWave[0].data.question === lastQuestion) {
        // Najde ve vlně první úlohu, která se liší, a prohodí ji na 1. místo
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
  
  // Zjistíme, která vlna byla před vlnou 3 skutečně poslední (wave2 může být výjimečně prázdná)
  const activePrevWave = wave2.length > 0 ? wave2 : wave1;
  secureWaveTransition(activePrevWave, wave3);

  let q = [...wave1, ...wave2, ...wave3];
  // Zvýšen limit na 35, aby se zbytečně neodstřihávala fáze "Skládání" (wave3) na konci
  if (q.length > 35) q = q.slice(0, 35);

  // 4. Doplnit možnosti a grafémy
  const vItemsOnly = allItems.filter(i => i.type === "SLOVO");
  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       
       let shortItems = vItemsOnly.filter(i => {
         if (selectedSubject === "Matematika") return true; // V matematice bereme všechny odpovědi
         const qWords = i.question.replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const aWords = cleanCzechTranslation(i.answer).replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const isSentence = /[.?!]$/.test(i.question.trim());
         return qWords <= 2 && aWords <= 3 && !isSentence;
       });
       if (shortItems.length < 4) shortItems = vItemsOnly;

       let falsePool = [...new Set(shortItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       if (falsePool.length > 0) { while (falsePool.length < 3) falsePool.push(falsePool[Math.floor(Math.random() * falsePool.length)]); } 
       else falsePool = ["...", "...", "..."];
       
       falsePool.sort(() => Math.random() - 0.5);
       task.opts = [correctAns, ...falsePool.slice(0, 3)].sort(() => Math.random() - 0.5);
       task.correctAns = correctAns;
       
       // OPRAVA: Pro matematiku proženeme zadání přes formatPromptText, aby byly zlomky hezké!
       let rawPrompt = isOut ? cleanCzechTranslation(task.data.answer) : task.data.question;
       task.prompt = typeof formatPromptText === 'function' ? formatPromptText(rawPrompt) : rawPrompt;

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
  selectedGame = 'CAMPAIGN'; 
  setScreen('PLAYING');
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') speakWord(cmpQueue[0].prompt, selectedSubject);
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

  // Upřednostníme slova, která ještě nemají plné mistrovství (2 hvězdy v obou směrech)
  let unmasteredVItems = currentVItems.filter(it => 
    getSavedMastery(it.question, 'DIR_IN') < 2 || getSavedMastery(it.question, 'DIR_OUT') < 2
  );
  
  let targetVItems = [...unmasteredVItems].sort(() => Math.random() - 0.5);

  // OPRAVA: Pokud je nezvládnutých slov méně než 12, doplníme je zvládnutými slovy z aktuální lekce,
  // aby měl trénink za 5 zlaťáků vždy smysluplnou a dostatečnou délku.
  if (targetVItems.length < 12) {
    let masteredVItems = currentVItems.filter(it => !unmasteredVItems.includes(it)).sort(() => Math.random() - 0.5);
    targetVItems = [...targetVItems, ...masteredVItems];
  }
  
  // Nyní bezpečně ořízneme na max 12 slov (což vygeneruje cca 25 - 40 úkolů)
  targetVItems = targetVItems.slice(0, 12);

  targetVItems.forEach(it => {
      if (it.question.trim().includes(' ') || it.question.trim().includes('-')) {
          qSentences.push({ type: 'SCRAMBLE', data: it });
      } else {
          if (getSavedMastery(it.question, 'DIR_IN') < 2) qNewPassive.push({ type: 'QUIZ_IN', data: it });
          if (getSavedMastery(it.question, 'DIR_OUT') < 2) qNewActive.push({ type: 'QUIZ_OUT', data: it });
          qSentences.push({ type: 'SCRAMBLE', data: it });
      }
  });

  currentQItems.forEach(it => qGrammar.push({ type: 'KVIZ', data: it }));

  qRevision.sort(() => Math.random() - 0.5); qNewPassive.sort(() => Math.random() - 0.5); 
  qNewActive.sort(() => Math.random() - 0.5); qGrammar.sort(() => Math.random() - 0.5); qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);

  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       let localItems = [...currentVItems, ...olderVItems];
       
       // OPRAVA: Pro jednoslovné kvízy bereme do možností pouze krátké výrazy (1-2 slova, ne celé věty)
       let shortItems = localItems.filter(i => {
         const qWords = i.question.replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const aWords = cleanCzechTranslation(i.answer).replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const isSentence = /[.?!]$/.test(i.question.trim());
         return qWords <= 2 && aWords <= 3 && !isSentence;
       });
       // Pojistka: pokud by v lekci bylo méně než 4 krátká slova, doplníme z celé lekce
       if (shortItems.length < 4) shortItems = localItems;

       let pool = [...new Set(shortItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
       if (pool.length > 0) { while (pool.length < 3) pool.push(pool[Math.floor(Math.random() * pool.length)]); } 
       else pool = ["...", "...", "..."];
       
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
       task.placed = []; task.isWordMode = isWordMode; task.hadMistake = false;
    } else if (task.type === 'KVIZ') {
       task.opts = task.data.options; task.correctAns = task.data.answer; task.prompt = formatPromptText(task.data.question);
    }
  });

  cmpQueue = q; cmpIdx = 0; cmpHearts = 5; cmpState = 'PLAYING'; cmpChosenOpt = null; isCampaignMinigame = false;
  selectedGame = 'CAMPAIGN'; setScreen('PLAYING');
  if (isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') speakWord(cmpQueue[0].prompt, selectedSubject);
}

// Nahrazení funkce clickCmpQuizOpt (aby uměla ukládat mastery i pro Kvízy!)
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
    let newTask = JSON.parse(JSON.stringify(task));
    if (newTask.opts) newTask.opts.sort(() => Math.random() - 0.5);
    requeueFailedTask(newTask); // <--- UPRAVENO: vloží na konec aktuální vlny
    
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN' || task.type === 'KVIZ') {
        const dir = task.type === 'QUIZ_OUT' ? 'DIR_OUT' : (task.type === 'KVIZ' ? 'DIR_OUT' : 'DIR_IN');
        saveWordMasteryToGoogle(task.data.question, 0, dir);
    }
  }

  if (typeof isAutoTTS !== "undefined" && isAutoTTS && task.type !== 'QUIZ_IN') {
    let toRead = task.type === 'KVIZ' ? task.data.question.replace(/___+/g, task.data.answer) : task.data.question;
    speakWord(toRead.replace(/[*_]/g, ''), selectedSubject);
  }
  renderActiveGame();
}

// Zařadí zkaženou úlohu na konec její aktuální vlny (místo úplného konce tréninku)
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
  if (tile.used) return;

  if (tile.text === task.tokens[task.placed.length]) {
    sndOk(); tile.used = true; task.placed.push(tile.text);
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
    }
   } else {
    sndErr(); cmpHearts = Math.max(0, cmpHearts - 1); task.hadMistake = true;
    let newTask = { type: 'SCRAMBLE', data: task.data, tokens: task.tokens, isWordMode: task.isWordMode, hadMistake: false, wave: task.wave };
    newTask.tiles = task.tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
    newTask.placed = []; 
    requeueFailedTask(newTask); // <--- UPRAVENO: vloží na konec aktuální vlny
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
    let currentLvlNum = parseInt(selectedGroupKey.replace(/\D/g, '')) || 1;
    let currentSingle = singleWords.filter(it => it.lesson === selectedGroupKey);
    let olderSingle = singleWords.filter(it => {
        let itNum = parseInt(it.lesson.replace(/\D/g, '')) || 1;
        return it.lesson !== selectedGroupKey && itNum < currentLvlNum;
    }).sort(() => Math.random() - 0.5);

    campaignMinigamePool = [...currentSingle, ...olderSingle].slice(0, 30);
    // OKAMŽITÉ PŘIPSÁNÍ ZLAŤÁKŮ ZA DOKONČENÝ TRÉNINK (i kdyby hráč z minihry odešel)
    if (cmpHearts > 0) {
      addCoins(currentUser.name, cmpHearts);
    }
    addReward(1, "Trénink: " + selectedGroupKey);
    isCampaignMinigame = true; 
    campaignMinigameCoins = 0; // Zlaťáky za srdíčka už jsou v kapse, v minihře se hraje jen o bonus

    if (campaignMinigamePool.length > 0 && campaignMinigamePool.length < 10) {
        let tempPool = [...campaignMinigamePool];
        while (campaignMinigamePool.length < 20) campaignMinigamePool.push(tempPool[Math.floor(Math.random() * tempPool.length)]);
    } else if (campaignMinigamePool.length === 0) {
        finishCampaign(campaignMinigameCoins); return; 
    }

    let r = Math.random(); let isGerman = getTargetLang(selectedSubject).startsWith('de');
    let articlesCount = campaignMinigamePool.filter(it => /^(der|die|das)\s/i.test(it.question)).length;

    if (isGerman && articlesCount >= 8) {
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

function finishCampaign(bonusCoins) {
  if (bonusCoins > 0) {
    addCoins(currentUser.name, bonusCoins);
  }
  
  const sLow = (selectedSubject || "").toLowerCase();
  // Pokud hrajeme běžný předmět (např. Hebrejštinu), vrátíme se do výběru her
  if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) {
    setScreen("CAMPAIGN_HUB");
  } else {
    setScreen("SELECT_GAME");
  }
}

