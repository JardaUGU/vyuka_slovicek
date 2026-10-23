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

  qRevision.sort(() => Math.random() - 0.5); qNewPassive.sort(() => Math.random() - 0.5); 
  qNewActive.sort(() => Math.random() - 0.5); qGrammar.sort(() => Math.random() - 0.5); qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);

  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       let localItems = [...currentVItems, ...olderVItems];
       let pool = [...new Set(localItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
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

function clickCmpQuizOpt(opt) {
  if (cmpState !== 'PLAYING') return;
  const task = cmpQueue[cmpIdx]; cmpChosenOpt = opt; cmpState = 'EVAL';

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
  const task = cmpQueue[cmpIdx]; const tile = task.tiles[idx];
  if (tile.used) return;

  if (tile.text === task.tokens[task.placed.length]) {
    sndOk(); tile.used = true; task.placed.push(tile.text);
    if (task.placed.length === task.tokens.length) { 
      cmpState = 'EVAL'; if (isAutoTTS) speakWord(task.data.question, selectedSubject); 
      if (!task.hadMistake) {
        const mIn = getSavedMastery(task.data.question, 'DIR_IN'); const mOut = getSavedMastery(task.data.question, 'DIR_OUT');
        if (mIn < 2) saveWordMasteryToGoogle(task.data.question, mIn + 1, 'DIR_IN');
        if (mOut < 2) saveWordMasteryToGoogle(task.data.question, mOut + 1, 'DIR_OUT');
      }
    }
  } else {
    sndErr(); cmpHearts = Math.max(0, cmpHearts - 1); task.hadMistake = true;
    let newTask = { type: 'SCRAMBLE', data: task.data, tokens: task.tokens, isWordMode: task.isWordMode, hadMistake: false };
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
    let currentLvlNum = parseInt(selectedGroupKey.replace(/\D/g, '')) || 1;
    let currentSingle = singleWords.filter(it => it.lesson === selectedGroupKey);
    let olderSingle = singleWords.filter(it => {
        let itNum = parseInt(it.lesson.replace(/\D/g, '')) || 1;
        return it.lesson !== selectedGroupKey && itNum < currentLvlNum;
    }).sort(() => Math.random() - 0.5);

    campaignMinigamePool = [...currentSingle, ...olderSingle].slice(0, 30);
    isCampaignMinigame = true; campaignMinigameCoins = cmpHearts;

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

function finishCampaign(coins) {
  addCoins(currentUser.name, coins); addReward(1, "Trénink: " + selectedGroupKey); setScreen("CAMPAIGN_HUB");
}

// ==========================================
// INTERAKTIVNÍ ČTEČKA PŘÍBĚHŮ (STORY MODE)
// ==========================================
let storyList = [];
let storyStep = 0;
let storyAnswered = false;
let storyChosenOpt = null;
let storyShowTrans = false;

function launchStoryMode(topicName) {
  selectedGroupKey = topicName;
  const userG = parseInt(currentUser.grade) || 2;
  
  // Zachováme přesné pořadí vět tak, jak jdou za sebou v tabulce!
  storyList = (appData.items || []).filter(it => 
    it.subject === selectedSubject && 
    isItemAllowedForGrade(it, userG) && 
    it.topic === topicName && 
    (it.type || '').toUpperCase().includes('PRIBEH')
  );

  if (storyList.length === 0) {
    alert("Tento příběh zatím neobsahuje žádné věty.");
    return;
  }

  storyStep = 0;
  storyAnswered = false;
  storyChosenOpt = null;
  storyShowTrans = false;
  selectedGame = "STORY";
  setScreen("PLAYING");
  speakCurrentStoryLine();
}

function speakCurrentStoryLine() {
  if (typeof isAutoTTS === "undefined" || !isAutoTTS || storyStep >= storyList.length) return;
  const item = storyList[storyStep];
  if (!item) return;
  const hasOpts = item.options && item.options.length > 0;
  // Pokud není kvízová, přečteme ji hned při zobrazení
  if (!hasOpts) {
    speakWord(item.question.replace(/[*_]/g, ''), selectedSubject);
  }
}

function clickStoryOpt(optIdx) {
  if (storyAnswered) return;
  const item = storyList[storyStep];
  const chosen = item.options[optIdx];
  storyAnswered = true;
  storyChosenOpt = chosen;

  if (chosen === item.answer) {
    sndOk();
  } else {
    sndErr();
  }

  // OPRAVA: Přečte větu POUZE tehdy, pokud je to doplňovačka anglického textu (obsahuje '___')
  // Pokud tam '___' není, jde o českou kontrolní otázku, takže TTS mlčí.
  if (typeof isAutoTTS !== "undefined" && isAutoTTS) {
    if (item.question.includes('___')) {
      let fullSentence = item.question.replace(/___+/g, item.answer);
      speakWord(fullSentence.replace(/[*_]/g, ''), selectedSubject);
    }
  }
  
  if (typeof renderActiveGame === 'function') renderActiveGame();
}

function nextStoryStep() {
  storyStep++;
  storyAnswered = false;
  storyChosenOpt = null;
  storyShowTrans = false;
  renderActiveGame();
  speakCurrentStoryLine();
}

// Spolehlivě zjistí, zda už byl příběh přečten (včera nebo dnes, na mobilu i PC)
function isStoryCompleted(title, sItems) {
  if (!currentUser || !title) return false;
  const uKey = currentUser.name.toLowerCase().trim();
  
  // 1. Kontrola v localStorage
  if (localStorage.getItem(`story_done_${uKey}_${title}`) === "1") return true;

  // 2. Kontrola v tabulce Pokrok (Google Sheets) pod jakýmkoliv směrem
  const userMap = (appData.progress && appData.progress[uKey]) ? appData.progress[uKey] : {};
  for (let k in userMap) {
    if (k.includes(title) && Number(userMap[k]) >= 1) return true;
  }

  // 3. Kontrola, zda už nejsou v Pokroku uložené samotné otázky z tohoto příběhu
  if (sItems && sItems.length > 0) {
    for (let it of sItems) {
      if (getSavedMastery(it.question, "DIR_OUT") >= 1 || getSavedMastery(it.question, "STORY") >= 1) {
        return true;
      }
    }
  }
  return false;
}

function finishStory() {
  const uKey = currentUser.name.toLowerCase().trim();
  const alreadyDone = isStoryCompleted(selectedGroupKey, storyList);

  if (!alreadyDone) {
    addCoins(currentUser.name, 10);
    addReward(3, "Příběh: " + selectedGroupKey);
    saveWordMasteryToGoogle(selectedGroupKey, 2, "STORY");
    localStorage.setItem(`story_done_${uKey}_${selectedGroupKey}`, "1");
    sndFanfare();
  } else {
    addReward(1, "Opakování příběhu: " + selectedGroupKey);
  }
  setScreen("CAMPAIGN_HUB");
}
