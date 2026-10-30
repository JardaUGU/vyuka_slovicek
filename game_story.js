// ==========================================
// INTERAKTIVNÍ ČTEČKA PŘÍBĚHŮ (STORY MODE)
// ==========================================
let storyList = [];
let storyStep = 0;
let storyAnswered = false;
let storyChosenOpt = null;
let storyShowTrans = false;
let storyMaxHearts = 0; // NOVÉ
let storyHearts = 0; // NOVÉ

function launchStoryMode(topicName) {
  selectedGroupKey = topicName;
  const userG = parseInt(currentUser.grade) || 2;
  
  // Zachováme přesné pořadí vět tak, jak jdou za sebou v tabulce
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

  // Spočítáme kolik má příběh otázek a dáme tolik srdíček
  storyMaxHearts = storyList.filter(it => it.options && it.options.length > 0).length;
  if (storyMaxHearts === 0) storyMaxHearts = 1; // Pojistka, kdyby byl příběh jen čtecí
  storyHearts = storyMaxHearts;

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
    storyHearts = Math.max(0, storyHearts - 1); // Ztráta srdíčka při chybě
  }

  // Přečte větu POUZE tehdy, pokud je to doplňovačka cizího textu (obsahuje '___').
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
    addCoins(currentUser.name, storyHearts); // Přidá tolik zlaťáků, kolik zbylo srdíček
    addReward(3, "Příběh: " + selectedGroupKey);
    saveWordMasteryToGoogle(selectedGroupKey, 2, "STORY");
    localStorage.setItem(`story_done_${uKey}_${selectedGroupKey}`, "1");
    sndFanfare();
  } else {
    addReward(1, "Opakování příběhu: " + selectedGroupKey);
  }
  
  const sLow = (selectedSubject || "").toLowerCase();
  if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) {
    setScreen("CAMPAIGN_HUB");
  } else {
    setScreen("SELECT_GAME");
  }
}
