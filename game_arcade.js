let arcadeMode = "";
let arcadeCurrentOptions = [];
let arcadeDeck = [], arcadeCurrent = null, arcadeLives = 3, arcadeScore = 0, arcadeLevel = 1, arcadeY = 0, arcadeX = 50, arcadeSpeed = 0.8, arcadeAnimId = null, arcadeState = "PLAYING";

function stopArcadeLoop() {
  if (arcadeAnimId) { cancelAnimationFrame(arcadeAnimId); arcadeAnimId = null; }
}

function startArcadeGame() {
  stopArcadeLoop();
  // ... tvůj kód arkády
}
// ... (spawnArcadeWord, runArcadeLoop atd.)
