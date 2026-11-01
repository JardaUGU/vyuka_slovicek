// ==========================================
// HRA PADAJÍCÍ SLOVA (ARKÁDA)
// ==========================================
let arcadeMode = "";
let arcadeCurrentOptions = [];
let arcadeDeck = [], arcadeCurrent = null, arcadeLives = 3, arcadeScore = 0, arcadeLevel = 1, arcadeY = 0, arcadeX = 50, arcadeSpeed = 0.8, arcadeAnimId = null, arcadeState = "PLAYING";

function stopArcadeLoop() {
  if (arcadeAnimId) { cancelAnimationFrame(arcadeAnimId); arcadeAnimId = null; }
}

function startArcadeGame(overrideMode) {
  stopArcadeLoop();
  isCampaignMinigame = false;
  const vItems = getVocabItems();
  
  // Zpětná kompatibilita + načtení režimu z tlačítka
  let mode = overrideMode;
  if (!mode) mode = getQuickChoiceMode();
  
  if (mode === "TRANSLATE") {
      arcadeMode = "TRANSLATE";
      arcadeDeck = vItems.filter(it => it.question.split(' ').length <= 2 && !it.question.includes('.')).sort(() => Math.random() - 0.5);
  } else {
      arcadeMode = "CLASSIC_" + mode;
      arcadeDeck = vItems.filter(it => {
        if (mode === "DER_DIE_DAS") return /^(der|die|das)\s/i.test(it.question);
        if (mode === "A_AN") return /^(a|an)\s/i.test(it.question);
        if (mode === "I_Y") return it.question.includes('_');
        return false;
      }).sort(() => Math.random() - 0.5);
  }

  if (arcadeDeck.length < 3) { alert("Málo vhodných slov pro tento režim."); return; }
  
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
  
  // OPRAVA BUGU: Slovo už nevyletí mimo hranice. Bude se držet ve středních 40% obrazovky.
  arcadeX = Math.floor(Math.random() * 40) + 30; 
  arcadeState = "PLAYING";

 if (arcadeMode === "TRANSLATE") {
      let poolToUse = isCampaignMinigame ? campaignMinigamePool : getVocabItems().filter(it => it.question.split(' ').length <= 2 && !it.question.includes('.'));
      let others = poolToUse.filter(it => it.question !== arcadeCurrent.question && cleanCzechTranslation(it.answer) !== cleanCzechTranslation(arcadeCurrent.answer)).sort(()=>Math.random()-0.5).slice(0,2);
      arcadeCurrentOptions = [arcadeCurrent.question, ...others.map(o=>o.question)].sort(()=>Math.random()-0.5);
  }
  renderActiveGame();
  runArcadeLoop();
}

function runArcadeLoop() {
  stopArcadeLoop();
  function step() {
  if (typeof currentScreen !== "undefined" && currentScreen !== "PLAYING") return;
  if (typeof selectedGame !== "undefined" && selectedGame !== "ARCADE") return;
  if (arcadeState !== "PLAYING") return;
  
  arcadeY += arcadeSpeed;
  const el = document.getElementById("arcade-falling-elem");
  const playfield = document.getElementById("arcade-field");
  if (el && playfield && arcadeY >= playfield.clientHeight - el.clientHeight - 2) {
    handleArcadeMiss();
    return;
  }
  if (el) el.style.top = arcadeY + "px";
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
    
    // NOVÉ: Přečte správné cizí slovo
    if (typeof isAutoTTS !== "undefined" && isAutoTTS && typeof speakWord === "function") {
        speakWord(arcadeCurrent.question, selectedSubject);
    }
    
    // Zvýšená prodleva z 350ms na 650ms, aby dítě stihlo slovo doposlechnout
    setTimeout(spawnArcadeWord, 650);
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
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && typeof speakWord === "function") {
      speakWord(arcadeCurrent.question, selectedSubject);
  }
  setTimeout(spawnArcadeWord, 1400);
}
