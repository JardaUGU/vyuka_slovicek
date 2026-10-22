// ==========================================
// HERNÍ MÓD: PEXESO
// ==========================================

let pexesoPairCount = 4;
let pexesoCards = [];
let pexesoFlipped = [];
let pexesoMatched = [];
let pexesoLocked = false;
let pexesoAttempts = 0;

function startPexesoGame(pairCount) {
  isCampaignMinigame = false;
  pexesoPairCount = pairCount; 
  selectedGame = "PEXESO";
  const vItems = getVocabItems();
  const count = Math.min(pexesoPairCount, vItems.length);
  const shuffled = [...vItems].sort(() => Math.random() - 0.5).slice(0, count);
  initPexesoBoard(shuffled);
}

function startCampaignPexeso() {
  isCampaignMinigame = true;
  pexesoPairCount = 6;
  selectedGame = "PEXESO";
  let uniquePool = [];
  let seen = new Set();
  for (let w of campaignMinigamePool) {
    if (!seen.has(w.question)) {
      seen.add(w.question);
      uniquePool.push(w);
    }
  }
  let shuffled = uniquePool.sort(() => Math.random() - 0.5).slice(0, pexesoPairCount);
  initPexesoBoard(shuffled);
}

function initPexesoBoard(words) {
  pexesoCards = [];
  words.forEach((w, idx) => {
    pexesoCards.push({ wordIdx: idx, text: w.question, isForeign: true });
    pexesoCards.push({ wordIdx: idx, text: cleanCzechTranslation(w.answer), isForeign: false });
  });
  pexesoCards.sort(() => Math.random() - 0.5);
  pexesoFlipped = []; 
  pexesoMatched = []; 
  pexesoLocked = false; 
  pexesoAttempts = 0;
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
      sndOk(); 
      pexesoMatched.push(c1.wordIdx); 
      pexesoFlipped = [];
      if (pexesoMatched.length === (pexesoCards.length / 2)) {
        sndFanfare(); 
        if (!isCampaignMinigame) addReward(2, selectedGroupKey);
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
