let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];

function updateVoices() { if ('speechSynthesis' in window) cachedVoices = window.speechSynthesis.getVoices(); }
if ('speechSynthesis' in window) { updateVoices(); window.speechSynthesis.onvoiceschanged = updateVoices; }
function toggleAutoTTS() { isAutoTTS = !isAutoTTS; localStorage.setItem("auto_tts", isAutoTTS); updateTTSBtnUI(); }
function updateTTSBtnUI() { const btn = document.getElementById("btn-tts-auto"); if (btn) { btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn"; btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp"; } }

function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  setTimeout(() => {
    let toSpeak = text.replace(/\s*\([^)]*\)/gi, '').trim();
    const u = new SpeechSynthesisUtterance(toSpeak); u.rate = 0.88;
    if (cachedVoices.length === 0) updateVoices();
    window.speechSynthesis.speak(u);
  }, 40);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
  try {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime); osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
function sndOk() { playTone(880, 'sine', 0.08); setTimeout(() => playTone(1320, 'sine', 0.1), 80); }
function sndErr() { playTone(220, 'square', 0.15); }
function sndFanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.1), i * 110)); }

function addReward(count = 1, section = "Lekce") {
  if (!currentUser) return; currentUser.stars = (currentUser.stars || 0) + count;
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
}

function getSavedMastery(itemQuestion, direction) { return 0; /* Zde napojíš na appData.progress podle původní logiky */ }
function saveWordMasteryToGoogle(itemQuestion, masteryLevel, direction) {}

function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (currentScreen === "PLAYING") setScreen("SELECT_GAME");
  else if (currentScreen === "SELECT_GAME") setScreen("SELECT_GROUP");
  else if (currentScreen === "SELECT_GROUP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_SUBJECT") setScreen("SELECT_USER");
}

function startGame(game) { 
  if (typeof stopArcadeLoop === "function") stopArcadeLoop(); 
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  selectedGame = game; 
  if(typeof initGameState === "function") initGameState(); 
  setScreen("PLAYING"); 
}

// ==============================================================
// ZDE PŘIJDE TVOJE OBŘÍ FUNKCE renderActiveGame() (zcela beze změny)
// Ponechal jsem zkrácenou verzi pro přehlednost, vlož sem celou
// ==============================================================
function renderActiveGame() {
  const main = document.getElementById("main-content");
  if (!main) return;
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr');
  const vItems = getVocabItems();

  if (selectedGame === "CARDS") {
    const w = vItems[typeof vCardIdx !== 'undefined' ? vCardIdx : 0];
    main.innerHTML = `<div class="prompt-box">${w ? w.question : ''} <span class="audio-btn" onclick="speakCurrentCard()">🔊</span></div>
                      <div class="prompt-box" style="color:#fff;">${w ? cleanCzechTranslation(w.answer) : ''}</div>
                      <div class="grid-2"><div class="action-btn" onclick="vCardPrev()">Předchozí</div><div class="action-btn" onclick="vCardNext()">Další ➔</div></div>`;
  }
  else if (selectedGame === "SCRAMBLE") {
     main.innerHTML = `<div>SCRAMBLE HRA</div>`;
  }
  else if (selectedGame === "SNAKE") {
      // Sem nakopíruj svůj kód pro Hada z původního renderActiveGame
      if (typeof snakeState === "undefined") {
        main.innerHTML = `<div style="color:red;">Had se nenačetl!</div>`; return;
      }
      main.innerHTML = `
        <div class="snake-container">
           <div class="snake-header-box">Body: ${snakeScore} | Životy: ${snakeLives}</div>
           <div class="snake-canvas-wrap"><canvas id="snake-canvas" width="340" height="340"></canvas></div>
        </div>`;
      if (typeof drawSnake === "function") { drawSnake(); setTimeout(attachSnakeTouchHandlers, 50); }
  }
  // ATD PRO OSTATNÍ HRY... 
  // (Nakopíruj si sem celou svoji původní renderActiveGame() funkci, tady nebude ničemu překážet a je tu správně.)
}
