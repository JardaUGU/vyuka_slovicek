// Opravené tlačítko ZPĚT, které respektuje Příběhy a Cestu
function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof sendTimeHeartbeatToGoogle === "function") sendTimeHeartbeatToGoogle();

  if (currentScreen === "PLAYING" && selectedGame === "PEXESO") setScreen("SELECT_PEXESO_SIZE");
  else if (currentScreen === "PLAYING" && selectedGame === "SEQ" && getSeqItems().length > 1) setScreen("SELECT_SEQ_ITEM");
  else if (currentScreen === "SELECT_PEXESO_SIZE" || currentScreen === "SELECT_SEQ_ITEM") setScreen("SELECT_GAME");
  else if (currentScreen === "PLAYING") {
    if (selectedGame === "CAMPAIGN") setScreen("CAMPAIGN_HUB");
    else if (selectedSubject === "Matematika") setScreen("SELECT_MATH_OP");
    else setScreen("SELECT_GAME");
  }
  else if (currentScreen === "SHOP") {
    cancelPreview();
    setScreen("SELECT_SUBJECT");
  }
  else if (currentScreen === "CAMPAIGN_HUB") setScreen("SELECT_SUBJECT"); 
  else if (currentScreen === "SELECT_MATH_OP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_GAME") {
    // Oprava: Pokud jsme se sem dostali z Příběhu na Cestě
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
