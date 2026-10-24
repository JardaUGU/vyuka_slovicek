/**
 * HERNÍ KŘIŽOVATKA (Spouštění her, odměny a tlačítko Zpět)
 */

function addReward(count = 1, section = "Lekce") {
  if (!currentUser) return;
  currentUser.stars = (currentUser.stars || 0) + count;
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  if(typeof updateFooter === 'function') updateFooter();
  
  if(typeof API_URL !== 'undefined') {
    try {
      const fd = new URLSearchParams();
      fd.append("action", "log_activity"); fd.append("user", currentUser.name);
      fd.append("subject", selectedSubject); fd.append("section", section);
      fd.append("stars", count); fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
  }
}

function getSavedMastery(itemQuestion, direction) {
  if (!currentUser || !appData.progress) return 0;
  const uKey = currentUser.name.toLowerCase().trim();
  const userMap = appData.progress[uKey];
  if (!userMap) return 0;
  const compKey = `${selectedSubject}:::${itemQuestion}:::${direction}`;
  if (userMap[compKey] !== undefined) return Number(userMap[compKey]);
  return Number(userMap[itemQuestion] || 0);
}

function getGroupMasteryPercent(groupItems, subjName) {
  if (!currentUser || !groupItems || groupItems.length === 0) return 0;
  const vList = groupItems.filter(it => it.type === "SLOVO");
  if (vList.length === 0) return 0;
  let points = 0;
  vList.forEach(it => { points += getSavedMastery(it.question, "DIR_OUT") + getSavedMastery(it.question, "DIR_IN"); });
  return Math.min(100, Math.round((points / (vList.length * 4)) * 100));
}

// Opravené tlačítko ZPĚT, které respektuje Příběhy a Cestu
function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof sendTimeHeartbeatToGoogle === "function") sendTimeHeartbeatToGoogle();

  const isMinigame = (typeof isCampaignMinigame !== "undefined" && isCampaignMinigame && selectedGame !== "PROCEDURAL_MATH");

  if (currentScreen === "PLAYING" && (selectedGame === "CAMPAIGN" || selectedGame === "STORY" || isMinigame)) {
    setScreen("CAMPAIGN_HUB");
  }
  else if (currentScreen === "PLAYING" && selectedGame === "PEXESO") {
    setScreen("SELECT_PEXESO_SIZE");
  }
  else if (currentScreen === "PLAYING" && selectedGame === "SEQ" && typeof getSeqItems === 'function' && getSeqItems().length > 1) {
    setScreen("SELECT_SEQ_ITEM");
  }
  else if (currentScreen === "SELECT_PEXESO_SIZE" || currentScreen === "SELECT_SEQ_ITEM") {
    setScreen("SELECT_GAME");
  }
  else if (currentScreen === "PLAYING") {
    if (selectedSubject === "Matematika") setScreen("SELECT_MATH_OP");
    else setScreen("SELECT_GAME");
  }
  else if (currentScreen === "SHOP") {
    cancelPreview();
    setScreen("SELECT_SUBJECT");
  }
  else if (currentScreen === "CAMPAIGN_HUB" || currentScreen === "SELECT_MATH_OP") {
    setScreen("SELECT_SUBJECT");
  }
  else if (currentScreen === "SELECT_GAME") {
    const sLow = (selectedSubject || "").toLowerCase();
    if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) {
      setScreen("CAMPAIGN_HUB");
    } else {
      setScreen("SELECT_GROUP");
    }
  }
  else if (currentScreen === "SELECT_GROUP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_SUBJECT") setScreen("SELECT_USER");
}

function startGame(game) { 
  if (typeof stopArcadeLoop === "function") stopArcadeLoop(); 
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  selectedGame = game; 
  if (typeof isCampaignMinigame !== "undefined") isCampaignMinigame = false; 
  if (typeof initGameState === "function") initGameState(); 
  setScreen("PLAYING"); 
}
