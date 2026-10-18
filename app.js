/**
 * JÁDRO APLIKACE, ČASOVAČ, SYNCHRONIZACE, EKONOMIKA A ROZHRANÍ
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxaxBIXP-ECpWstcqRDw8RuT_ds6UwcplU_3pZ9_-ksELN5FVeGt5EHjjexkJVmx1FR_w/exec";

let appData = { users: [], progress: {}, items: [] };
let currentUser = JSON.parse(localStorage.getItem("cur_user") || 'null');
let filterExactGradeOnly = true;
let viewMode = "LESSONS";

let currentScreen = "SELECT_USER";
let selectedSubject = "";
let selectedGroupKey = "";
let activeItems = [];
let selectedGame = "";
let selectedSeqIndex = 0;
let testingDirection = localStorage.getItem("testing_dir") || "DIR_OUT";

function forceHardReload() {
  window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
}

function cleanCzechTranslation(text) {
  if (!text) return "";
  return text.replace(/\s*\([^)]*r\.\)/gi, '').replace(/\s*\((sg|pl)\.\)/gi, '').trim();
}

function getVocabItems() { return (activeItems || []).filter(it => it.type === "SLOVO"); }
function getQuizItems()  { return (activeItems || []).filter(it => it.type === "KVIZ"); }
function getSeqItems()   { return (activeItems || []).filter(it => it.type === "RADA"); }

function getAdaptiveWindowSize(grade) {
  const g = parseInt(grade) || 2;
  return g >= 90 ? 12 : (g >= 10 ? 10 : Math.max(3, g));
}

function getGraphemes(str) {
  if (window.Intl && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(str), s => s.segment);
  }
  return str.split('');
}

function getQuickChoiceMode() {
  const vItems = getVocabItems();
  const s = (selectedSubject || '').toLowerCase();
  if (s.includes("nemc") || s === "de") {
    if (vItems.filter(it => /^(der|die|das)\s/i.test(it.question)).length >= 3) return "DER_DIE_DAS";
  }
  if (s.includes("angli") || s === "en" || s.includes("inteligentn")) {
    if (vItems.filter(it => /^(a|an)\s/i.test(it.question)).length >= 3) return "A_AN";
  }
  if (s.includes("cest") || s === "cs") {
    if (vItems.filter(it => it.question.includes('_')).length >= 3) return "I_Y";
  }
  return null;
}

function isItemAllowedForGrade(it, userG) {
  const itemG = parseInt(it.minGrade) || 2;
  const subjLow = (it.subject || '').toLowerCase();
  if (subjLow.includes('cesta') || subjLow.includes('postupn') || subjLow.includes('inteligentn')) return true;
  const isVerbGroup = (it.lesson || '').toLowerCase().includes('sloves') || (it.topic || '').toLowerCase().includes('sloves');
  if (isVerbGroup && userG >= 5) return true;
  if (!filterExactGradeOnly || userG >= 90) return true;
  return itemG === userG;
}

// --- MODULÁRNÍ EKONOMIKA A INVENTÁŘ ---
function getUserCoins(userName) {
  if (!userName) return 0;
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === userName.toLowerCase().trim());
  return u ? Number(u.coins || 0) : Number(localStorage.getItem(`coins_${userName.toLowerCase().trim()}`) || 0);
}

function getUserItemCount(userName, itemKey) {
  if (!userName) return 0;
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === userName.toLowerCase().trim());
  if (u && u.inventory && u.inventory[itemKey] !== undefined) return Number(u.inventory[itemKey]);
  return Number(localStorage.getItem(`item_${itemKey}_${userName.toLowerCase().trim()}`) || 0);
}

function addCoins(userName, amount) {
  if (!userName) return;
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === userName.toLowerCase().trim());
  if (u) u.coins = Math.max(0, (u.coins || 0) + amount);
  try {
    const fd = new URLSearchParams();
    fd.append("action", "add_coins"); fd.append("user", userName); fd.append("amount", amount);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

function buyShopItem(itemKey, cost) {
  if (!currentUser) return;
  const currentCoins = getUserCoins(currentUser.name);
  if (currentCoins >= cost) {
    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
    if (u) {
      u.coins -= cost;
      if (!u.inventory) u.inventory = {};
      u.inventory[itemKey] = (u.inventory[itemKey] || 0) + 1;
    }
    try {
      const fd = new URLSearchParams();
      fd.append("action", "buy_item"); fd.append("user", currentUser.name);
      fd.append("itemKey", itemKey); fd.append("cost", cost);
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
    alert(`Úspěšně zakoupeno! 🛒\nPoložka ${itemKey} byla přidána.`);
    renderScreen();
  } else {
    alert("Nemáš dostatek zlaťáků! 💰");
  }
}

window.buyFreeze = function() {
  buyShopItem("Zmrazeni", 20);
};

// --- ČASOVAČ, STREAK & ZÁPATÍ ---
function updateFooter() {
  const fUser = document.getElementById("footer-user");
  if (fUser) fUser.innerText = currentUser ? `Žák: ${currentUser.name}` : "Žák: --";
}

function getStudyTimeKey(userName) {
  const d = new Date();
  return `study_sec_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}_${(userName || 'user').toLowerCase().trim()}`;
}

function loadUserStudyTime(userName) {
  if (!userName) return 0;
  return Number(localStorage.getItem(getStudyTimeKey(userName)) || 0);
}

function getUserStreak(userName) {
  if (!userName) return 0;
  return Number(localStorage.getItem(`streak_${userName.toLowerCase().trim()}`) || 0);
}

function updateUserStreak(userName, targetMinutes) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim();
  const d = new Date();
  const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const lastCompleted = localStorage.getItem(`streak_last_date_${uKey}`);
  
  if (lastCompleted === todayStr) return;

  let streak = Number(localStorage.getItem(`streak_${uKey}`) || 0);
  const yest = new Date(Date.now() - 86400000);
  const yestStr = `${yest.getFullYear()}-${yest.getMonth() + 1}-${yest.getDate()}`;

  if (lastCompleted === yestStr) {
    streak += 1;
  } else if (lastCompleted) {
    let freezes = getUserItemCount(userName, "Zmrazeni");
    if (freezes > 0) {
      streak += 1;
      alert("🧊 Tvoje série byla zachráněna pomocí zmrazení!");
    } else {
      streak = 1;
    }
  } else {
    streak = 1;
  }

  localStorage.setItem(`streak_${uKey}`, streak);
  localStorage.setItem(`streak_last_date_${uKey}`, todayStr);
}

let todaySecondsStudied = currentUser ? loadUserStudyTime(currentUser.name) : 0;
let lastUserActivityTime = Date.now();
let isTimerPaused = false;
let lastCloudSyncSec = 0;

function registerUserAction() {
  lastUserActivityTime = Date.now();
  if (isTimerPaused) { isTimerPaused = false; updateStudyTimerUI(); }
  if (cachedVoices.length === 0) updateVoices();
}
window.addEventListener('click', registerUserAction, true);
window.addEventListener('touchstart', registerUserAction, true);

setInterval(() => {
  if (currentScreen === "PLAYING" && currentUser) {
    const idleTime = Date.now() - lastUserActivityTime;
    if (idleTime < 15000) {
      todaySecondsStudied++;
      localStorage.setItem(getStudyTimeKey(currentUser.name), todaySecondsStudied);
      isTimerPaused = false;

      const targetSec = (currentUser.targetMinutes || 15) * 60;
      if (todaySecondsStudied >= targetSec) updateUserStreak(currentUser.name, currentUser.targetMinutes || 15);

      if (todaySecondsStudied - lastCloudSyncSec >= 45) {
        lastCloudSyncSec = todaySecondsStudied;
        sendTimeHeartbeatToGoogle();
      }
    } else {
      isTimerPaused = true;
    }
  } else {
    isTimerPaused = true;
  }
  updateStudyTimerUI();
}, 1000);

function updateStudyTimerUI() {
  const box = document.getElementById("study-timer");
  const footerGoal = document.getElementById("footer-goal");
  if (!box || !currentUser) return;

  const targetSec = (currentUser.targetMinutes || 15) * 60;
  const isGoalReached = todaySecondsStudied >= targetSec;
  const bonusSec = Math.max(0, todaySecondsStudied - targetSec);
  const format = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const spentMin = Math.floor(todaySecondsStudied / 60);
  const targetMin = currentUser.targetMinutes || 15;

  if (footerGoal) {
    if (isGoalReached) {
      const bMin = Math.floor(bonusSec / 60);
      footerGoal.innerHTML = `<span style="color:var(--col-yellow);font-weight:bold;">★ ${spentMin} / ${targetMin} min (+${bMin} min)</span>`;
    } else {
      footerGoal.innerText = `${spentMin} / ${targetMin} min ⏱️`;
    }
  }

  const isPaused = (currentScreen !== "PLAYING" || isTimerPaused);
  if (isGoalReached) {
    box.className = isPaused ? "study-timer-box bonus paused" : "study-timer-box bonus";
    box.innerText = isPaused ? `⏸️ ★ BONUS: +${format(bonusSec)}` : `★ BONUS: +${format(bonusSec)}`;
  } else {
    box.className = isPaused ? "study-timer-box paused" : "study-timer-box";
    box.innerText = isPaused ? `⏸️ ${format(todaySecondsStudied)} / ${format(targetSec)}` : `⏱️ ${format(todaySecondsStudied)} / ${format(targetSec)}`;
  }
}

function sendTimeHeartbeatToGoogle() {
  if (!currentUser) return;
  try {
    const fd = new URLSearchParams();
    fd.append("action", "log_activity"); fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject || "Výuka"); fd.append("section", "Časomíra");
    fd.append("stars", 0); fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

// --- VÝSLOVNOST (TTS) S PŘESNÝM SMĚROVÁNÍM NA iOS ---
let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];

function updateVoices() {
  if ('speechSynthesis' in window) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedVoices = v;
  }
}
if ('speechSynthesis' in window) { updateVoices(); window.speechSynthesis.onvoiceschanged = updateVoices; }

function toggleAutoTTS() { isAutoTTS = !isAutoTTS; localStorage.setItem("auto_tts", isAutoTTS); updateTTSBtnUI(); }

function updateTTSBtnUI() {
  const btn = document.getElementById("btn-tts-auto");
  if (btn) { btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn"; btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp"; }
}

function getTargetLang(subjectName) {
  const s = (subjectName || selectedSubject || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes('angli') || s === 'en' || s.includes('inteligentn')) return 'en-GB';
  if (s.includes('nemc') || s === 'de') return 'de-DE';
  if (s.includes('hebr') || s === 'he') return 'he-IL';
  return 'cs-CZ';
}

function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  setTimeout(() => {
    let toSpeak = text;
    // 1. ODSTRANĚNÍ NÁPOVĚD V ZÁVORKÁCH: vymaže např. "(oni)", "(ona)", "(ž. r.)"
    toSpeak = toSpeak.replace(/\s*\([^)]*\)/gi, '').trim();
    
    if (/read\s*-\s*read\s*-\s*read/i.test(toSpeak)) toSpeak = "read, red, red";
    else toSpeak = toSpeak.replace(/\//g, ' or ').replace(/\s*-\s*/g, ', ');

    if (/^\s*I\s*[.!?]?\s*$/i.test(toSpeak)) {
      toSpeak = "eye";
    }

    const u = new SpeechSynthesisUtterance(toSpeak);
    const targetLang = getTargetLang(subjectName);
    const langPrefix = targetLang.split('-')[0];

    u.lang = targetLang; 
    u.rate = 0.88;

    if (cachedVoices.length === 0) updateVoices();
    let voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();

    const playVoice = () => {
      if (voices && voices.length > 0) {
        const isTarget = v => (v.lang || '').toLowerCase().replace('_', '-') === targetLang.toLowerCase() ||
                              (v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix);

        // 1. Prémiové hlasy
        let match = voices.find(v => isTarget(v) && /(enhanced|premium|natural|pro)/i.test(v.name));

        // 2. Vyjmenované nejlepší hlasy pro iOS
        if (!match) {
            let bestNames = [];
            if (targetLang === 'en-GB') bestNames = ['daniel', 'oliver', 'serena', 'stephanie', 'arthur', 'martha', 'kate'];
            else if (targetLang === 'de-DE') bestNames = ['anna', 'petra', 'markus', 'yannick', 'helena', 'martin'];
            else if (targetLang === 'cs-CZ') bestNames = ['iveta', 'zuzana'];
            else if (targetLang === 'en-US') bestNames = ['samantha', 'alex', 'karen', 'ava', 'tom'];

            for (let name of bestNames) {
                match = voices.find(v => isTarget(v) && v.name.toLowerCase().includes(name));
                if (match) break;
            }
        }

        // 3. Hlasy Siri
        if (!match) match = voices.find(v => isTarget(v) && /siri/i.test(v.name));
        
        // 4. Vyřazení compact plechových hlasů
        if (!match) match = voices.find(v => isTarget(v) && !/compact/i.test(v.name));
        
        // 5. Základní shoda
        if (!match) match = voices.find(isTarget);

        if (match) {
          u.voice = match;
          u.lang = match.lang; 
        }
      }
      window.speechSynthesis.speak(u);
    };

    if ((!voices || voices.length === 0) && 'speechSynthesis' in window) {
      setTimeout(() => {
        updateVoices();
        voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
        playVoice();
      }, 50);
    } else {
      playVoice();
    }
  }, 40);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
  try {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
function sndOk() { playTone(880, 'sine', 0.08); setTimeout(() => playTone(1320, 'sine', 0.1), 80); }
function sndErr() { playTone(220, 'square', 0.15); }
function sndFanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.1), i * 110)); }

function addReward(count = 1, section = "Lekce") {
  if (!currentUser) return;
  currentUser.stars = (currentUser.stars || 0) + count;
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  updateFooter();
  try {
    const fd = new URLSearchParams();
    fd.append("action", "log_activity"); fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject); fd.append("section", section);
    fd.append("stars", count); fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

// --- BLESKOVÉ NAČTENÍ Z PAMĚTI A PROBUZENÍ SÍTĚ ---
async function loadData() {
  const cached = localStorage.getItem("app_data");
  if (cached) {
    try {
      appData = JSON.parse(cached);
      if (!appData.items) appData.items = [];
      // Okamžitě vykreslíme obrazovku z paměti telefonu (0 ms prodleva)
      renderScreen();
    } catch(e) {}
  }
  
  // Stahování z cloudu probíhá na pozadí, aniž by blokovalo žáka
  await syncData();
}

async function syncData() {
  const statusEl = document.getElementById("footer-status");
  if (statusEl) statusEl.innerText = "Stahuji...";
  try {
    const controller = new AbortController();
    // Pro mobil zkrátíme limit na 10s, aby nevisel zbytečně dlouho
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    // Přidán časový parametr ?t=..., aby Safari necachovalo starou odpověď
    const fetchUrl = API_URL + (API_URL.includes('?') ? '&' : '?') + 't=' + Date.now();
    const res = await fetch(fetchUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const json = await res.json();
    if (json && json.items) {
      appData = json;
      localStorage.setItem("app_data", JSON.stringify(json));
      if (statusEl) statusEl.innerText = `OK: ${appData.items.length} úloh`;

      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        if (foundU) {
          currentUser.targetMinutes = foundU.targetMinutes || 15;
          currentUser.grade = parseInt(foundU.grade) || 2;
          currentUser.coins = Number(foundU.coins || 0);
          currentUser.inventory = foundU.inventory || {};
          currentUser.startLevels = foundU.startLevels || {};
          
          if (foundU.todayMinutes !== undefined) {
            const cloudSec = Math.round(Number(foundU.todayMinutes) * 60);
            if (cloudSec > todaySecondsStudied) {
              todaySecondsStudied = cloudSec;
              localStorage.setItem(getStudyTimeKey(currentUser.name), todaySecondsStudied);
            }
          }
          localStorage.setItem("cur_user", JSON.stringify(currentUser));
        }
      }
    }
  } catch(e) { 
    if (statusEl) {
      // Pokud máme data v paměti, napíšeme OK z paměti, ne chybový stav
      statusEl.innerText = (appData && appData.items && appData.items.length > 0) 
        ? `OK: ${appData.items.length} úloh` 
        : "Offline";
    }
  }
  renderScreen();
}

async function saveWordMasteryToGoogle(itemQuestion, masteryLevel, direction) {
  if (!currentUser) return;
  try {
    const uKey = currentUser.name.toLowerCase().trim();
    const compKey = `${selectedSubject}:::${itemQuestion}:::${direction}`;
    if (!appData.progress) appData.progress = {};
    if (!appData.progress[uKey]) appData.progress[uKey] = {};
    appData.progress[uKey][compKey] = masteryLevel;
    localStorage.setItem("app_data", JSON.stringify(appData));
    const fd = new URLSearchParams();
    fd.append("action", "save_mastery"); fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject); fd.append("foreign", itemQuestion);
    fd.append("mastery", masteryLevel); fd.append("direction", direction);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
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

// --- NAVIGACE ---
function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  sendTimeHeartbeatToGoogle();
  if (currentScreen === "PLAYING" && selectedGame === "PEXESO") setScreen("SELECT_PEXESO_SIZE");
  else if (currentScreen === "PLAYING" && selectedGame === "SEQ" && getSeqItems().length > 1) setScreen("SELECT_SEQ_ITEM");
  else if (currentScreen === "SELECT_PEXESO_SIZE" || currentScreen === "SELECT_SEQ_ITEM") setScreen("SELECT_GAME");
  else if (currentScreen === "PLAYING") {
    if (selectedGame === "CAMPAIGN") setScreen("CAMPAIGN_HUB");
    else if (selectedSubject === "Matematika") setScreen("SELECT_MATH_OP");
    else setScreen("SELECT_GAME");
  }
  else if (currentScreen === "CAMPAIGN_HUB") setScreen("SELECT_SUBJECT"); 
  else if (currentScreen === "SELECT_MATH_OP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_GAME") setScreen("SELECT_GROUP");
  else if (currentScreen === "SELECT_GROUP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_SUBJECT") setScreen("SELECT_USER");
}

function setScreen(scr) { currentScreen = scr; registerUserAction(); renderScreen(); }

function selectUser(name, grade, targetMinutes) {
  const foundU = (appData.users || []).find(u => u.name.toLowerCase().trim() === name.toLowerCase().trim());
  currentUser = { 
    name, 
    grade: parseInt(grade) || 2, 
    targetMinutes: parseInt(targetMinutes) || 15, 
    stars: 0,
    startLevels: (foundU && foundU.startLevels) ? foundU.startLevels : {},
    inventory: (foundU && foundU.inventory) ? foundU.inventory : {},
    coins: foundU ? Number(foundU.coins || 0) : 0
  };
  localStorage.setItem("cur_user", JSON.stringify(currentUser));

  let localSec = loadUserStudyTime(currentUser.name);
  let cloudSec = foundU ? Math.round(Number(foundU.todayMinutes || 0) * 60) : 0;
  todaySecondsStudied = Math.max(localSec, cloudSec);
  localStorage.setItem(getStudyTimeKey(currentUser.name), todaySecondsStudied);

  isTimerPaused = false;
  updateStudyTimerUI();
  setScreen("SELECT_SUBJECT");
}

function chooseSubject(subj) { 
  selectedSubject = subj; 
  const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => {
    if (it.subject !== selectedSubject) return false;
    if (!isItemAllowedForGrade(it, userG)) return false;
    return true;
  });

  const sLow = selectedSubject.toLowerCase();
  if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) {
    setScreen("CAMPAIGN_HUB");
  } else {
    setScreen("SELECT_GROUP");
  }
}

function chooseGroup(groupName) {
  selectedGroupKey = groupName;
  const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => {
    if (it.subject !== selectedSubject) return false;
    if (!isItemAllowedForGrade(it, userG)) return false;
    return (viewMode === "LESSONS" ? it.lesson : it.topic) === groupName;
  });
  setScreen("SELECT_GAME");
}

function openSequenceMenu() {
  const sItems = getSeqItems();
  if (sItems.length === 1) {
    selectedSeqIndex = 0;
    startGame('SEQ');
  } else {
    setScreen('SELECT_SEQ_ITEM');
  }
}

function toggleTestingDirection() {
  testingDirection = (testingDirection === "DIR_OUT") ? "DIR_IN" : "DIR_OUT";
  localStorage.setItem("testing_dir", testingDirection);
  if (typeof initGameState === "function") initGameState();
  renderScreen();
}

// --- HLAVNÍ RENDERÉR OBRAZOVEK ---
function renderScreen() {
  updateFooter(); updateStudyTimerUI(); updateTTSBtnUI();
  const main = document.getElementById("main-content");
  const bUser = document.getElementById("badge-user");
  const bSubj = document.getElementById("badge-subj");
  const bGroup = document.getElementById("badge-group");
  bUser.innerText = currentUser ? currentUser.name : "Uživatel";

  // 1. VÝBĚR UŽIVATELE
  if (currentScreen === "SELECT_USER" || !currentUser) {
    bSubj.style.display = "none"; bGroup.style.display = "none";
    const uList = appData.users || [];
    if (uList.length === 0) {
      main.innerHTML = `<div style="text-align:center;padding:30px;"><p style="margin-bottom:15px;">Načítám profily z tabulky...</p><button class="action-btn" onclick="syncData()">Zkusit znovu 🔄</button></div>`;
      return;
    }
    main.innerHTML = `
      <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Kdo se jde učit?</h2>
      <div class="grid-2">
        ${uList.map(u => {
          const g = parseInt(u.grade) || 2;
          const uSec = Math.max(loadUserStudyTime(u.name), Math.round((u.todayMinutes || 0) * 60));
          const uMin = Math.floor(uSec / 60);
          const targetM = u.targetMinutes || 15;
          const isDone = uMin >= targetM;
          const streakDays = (u.streak !== undefined) ? u.streak : getUserStreak(u.name);
          return `
            <div class="tile" style="${isDone ? 'border-color:var(--col-yellow);background:#1a2512;' : ''}" onclick="selectUser('${u.name}', ${g}, ${targetM})">
              <h2>${u.name}</h2><p>${g >= 10 && g < 90 ? `${g-9}. ročník SŠ` : (g<=9 ? `${g}. tř.` : 'Dospělý')}</p>
              <p style="color:var(--col-orange);margin-top:4px;">🔥 Série: ${streakDays} dní</p>
              <p style="color:${isDone ? 'var(--col-yellow)' : 'var(--col-text-muted)'};margin-top:2px;font-weight:bold;">⏱️ Dnes: ${uMin}/${targetM} min ${isDone?'★':''}</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 2. VÝBĚR PŘEDMĚTU
  else if (currentScreen === "SELECT_SUBJECT") {
    bSubj.style.display = "none"; bGroup.style.display = "none";
    const userG = parseInt(currentUser.grade) || 2;
    const subjs = {};
    (appData.items || []).forEach(it => { if (!isItemAllowedForGrade(it, userG)) return; subjs[it.subject] = (subjs[it.subject] || 0) + 1; });

    let html = `
      <div class="filter-bar">
        <span>Filtr: ${filterExactGradeOnly ? 'Jen ' + userG + '. třída' : 'Všechny ročníky'}</span>
        <button class="toggle-btn ${filterExactGradeOnly ? 'on' : ''}" onclick="filterExactGradeOnly=!filterExactGradeOnly;renderScreen();">
          ${filterExactGradeOnly ? 'Jen má třída' : 'Všechny ročníky'}
        </button>
      </div>
      <div class="grid-2">
        <div class="tile" style="border-color:var(--col-active-tab);background:#102538;" onclick="openMathOperationSelect()">
          <h2 style="color:var(--col-active-tab);">🔢 Matematika</h2><p>Výběr operací a dril</p>
        </div>
    `;
    Object.keys(subjs).forEach(s => {
      const sLow = s.toLowerCase();
      const isCesta = sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn");
      const stl = isCesta ? 'border-color:var(--col-green);background:#112a1f;' : '';
      const ikn = isCesta ? '🚀 ' : '';
      html += `<div class="tile" style="${stl}" onclick="chooseSubject('${s}')"><h2>${ikn}${s}</h2><p>${subjs[s]} úloh</p></div>`;
    });
    html += `</div>`;
    main.innerHTML = html;
  }

  // 3. VÝBĚR MATEMATIKY
  else if (currentScreen === "SELECT_MATH_OP") {
    bSubj.style.display = "flex"; bSubj.innerText = "Matematika"; bGroup.style.display = "none";
    if (typeof renderMathOpSelection === "function") renderMathOpSelection();
  }

  // 4. VÝBĚR SKUPINY (LEKCE / TÉMATA)
  else if (currentScreen === "SELECT_GROUP") {
    bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; bGroup.style.display = "none";
    const userG = parseInt(currentUser.grade) || 2;
    const groupsMap = {};
    (appData.items || []).filter(it => it.subject === selectedSubject && isItemAllowedForGrade(it, userG)).forEach(it => {
      const k = viewMode === "LESSONS" ? it.lesson : it.topic;
      if (!k) return;
      if (!groupsMap[k]) groupsMap[k] = { name: k, count: 0, raw: [] };
      groupsMap[k].count++; groupsMap[k].raw.push(it);
    });

    main.innerHTML = `
      <div class="filter-bar">
        <button class="toggle-btn ${viewMode==='LESSONS'?'on':''}" onclick="viewMode='LESSONS';renderScreen();">Lekce</button>
        <button class="toggle-btn ${viewMode==='TOPICS'?'on':''}" onclick="viewMode='TOPICS';renderScreen();">Témata</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${Object.values(groupsMap).map(g => {
          const mPct = getGroupMasteryPercent(g.raw, selectedSubject);
          return `
            <div class="tile" style="flex-direction:column;align-items:stretch;padding:12px;" onclick="chooseGroup('${g.name}')">
              <div style="display:flex;justify-content:space-between;"><h2>${g.name}</h2><span style="color:var(--col-active-tab);">${g.count} úloh</span></div>
              <div class="bargraph-track" style="height:6px;margin-top:6px;"><div class="bargraph-fill" style="width:${mPct}%;"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 5. KAMPAŇ HUB (BEZ ROLETKY, ŘÍZENO TABULKOU)
  else if (currentScreen === "CAMPAIGN_HUB") {
    bSubj.style.display = "flex"; 
    bSubj.innerText = selectedSubject; 
    bGroup.style.display = "none";

    const coins = getUserCoins(currentUser.name);
    const vItems = getVocabItems();
    let lessons = [...new Set(vItems.map(it => it.lesson))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    // 1. Zjistíme minimální level z Google Tabulky pro daný předmět
    const subjNorm = selectedSubject.toLowerCase().replace(/[^a-z]/g, "");
    let userMinLvl = 1;
    if (currentUser && currentUser.startLevels) {
      for (let k in currentUser.startLevels) {
        if (subjNorm.includes(k) || k.includes(subjNorm)) {
          userMinLvl = Number(currentUser.startLevels[k]) || 1;
          break;
        }
      }
    }

    // 2. Najdeme první nedokončený level (od nastaveného startu výše)
    let currentLesson = lessons[0] || "Level 1";
    for (let l of lessons) {
      let num = parseInt(l.replace(/\D/g, '')) || 1;
      if (num < userMinLvl) continue;

      let lItems = vItems.filter(it => it.lesson === l);
      let pct = getGroupMasteryPercent(lItems, selectedSubject);
      if (pct < 95) {
        currentLesson = l;
        break;
      }
    }

    selectedGroupKey = currentLesson;
    let curItems = vItems.filter(it => it.lesson === currentLesson);
    let currentPct = getGroupMasteryPercent(curItems, selectedSubject);

    main.innerHTML = `
      <div style="text-align:center;padding:15px 10px;">
        <h2 style="color:var(--col-active-tab);font-size:26px;margin-bottom:12px;">Spirálová výuka</h2>
        
        <p style="color:var(--col-text-muted);font-size:16px;margin-bottom:6px;">Aktuální lekce:</p>
        <p style="color:#fff;font-size:28px;font-weight:bold;margin-bottom:10px;">${currentLesson}</p>

        <div class="bargraph-container" style="max-width:280px;margin:0 auto 20px auto;">
          <div class="bargraph-header">
            <span>Postup lekce</span>
            <span style="color:var(--col-green);">${currentPct} %</span>
          </div>
          <div class="bargraph-track" style="height:8px;">
            <div class="bargraph-fill" style="width:${currentPct}%;"></div>
          </div>
        </div>

        <div class="action-btn green" style="padding:18px;font-size:20px;box-shadow: 0 6px 15px rgba(34,197,94,0.3);" onclick="startCampaign()">
           ▶️ SPUSTIT DNEŠNÍ TRÉNINK
        </div>
        <p style="font-size:13px;color:var(--col-text-muted);margin-top:12px;">Udrž všech 5 ❤️ srdíček pro zisk zlaťáků!</p>

        <div style="margin-top:30px;background:var(--col-card);padding:15px;border-radius:10px;border:1px solid var(--col-yellow);">
           <h3 style="color:var(--col-yellow);font-size:18px;margin-bottom:8px;">🛒 Obchod</h3>
           <p style="font-size:16px;">Tvoje zlaťáky: <b style="color:var(--col-yellow);">${coins} 💰</b></p>
           <div class="action-btn" style="background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);margin-top:12px;padding:10px;" onclick="buyFreeze()">
              🧊 Zmrazit sérii (Cena: 20 💰)
           </div>
        </div>
      </div>
    `;
  }

  // 6. VÝBĚR HRY (KLASICKÝ PŘEDMĚT)
  else if (currentScreen === "SELECT_GAME") {
    bSubj.style.display = "flex"; bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    const vItems = getVocabItems(), qItems = getQuizItems(), sItems = getSeqItems(), quickMode = getQuickChoiceMode();
    let html = `<div class="grid-2">`;
    
    if (vItems.length > 0) {
      html += `
        <div class="tile" onclick="startGame('CARDS')"><h2>1. Karty</h2><p>Čtení (${vItems.length})</p></div>
        <div class="tile" style="border-color:var(--col-green);" onclick="startGame('ADAPTIVE')">
          <h2 style="color:var(--col-green);">2. Zkoušení</h2><p>${testingDirection==='DIR_OUT'?'🇨🇿 ➔ Cizí':'Cizí ➔ 🇨🇿'}</p>
        </div>
        <div class="tile" onclick="startGame('SCRAMBLE')"><h2>3. Skládání</h2><p>Pravopis</p></div>
        <div class="tile" onclick="setScreen('SELECT_PEXESO_SIZE')"><h2>🃏 Pexeso</h2><p>Hledání dvojic</p></div>
      `;
    }
    if (quickMode) {
      html += `
        <div class="tile" style="border-color:var(--col-orange);grid-column: span 2;background:#231a0a;" onclick="startArcadeGame()">
          <h2 style="color:var(--col-orange);">☄️ Padající slova (${quickMode.replace(/_/g, ' ')})</h2><p>Arkáda: 3 životy, zrychlování!</p>
        </div>
      `;
    }
    if (qItems.length > 0) {
      html += `<div class="tile" style="border-color:var(--col-green);" onclick="startGame('QUIZ')"><h2 style="color:var(--col-green);">📝 Kvíz</h2><p>${qItems.length} otázek</p></div>`;
    }
    if (sItems.length > 0) {
      html += `<div class="tile" style="border-color:var(--col-yellow);" onclick="openSequenceMenu()"><h2 style="color:var(--col-yellow);">⏱️ Řada na čas</h2><p>${sItems.length} úloh</p></div>`;
    }
    if (vItems.length === 0 && qItems.length === 0 && sItems.length === 0) {
      html += `<div style="grid-column:span 2;text-align:center;padding:20px;color:var(--col-text-muted);">V této lekci nejsou žádná data ke hraní.</div>`;
    }

    html += `</div>`;
    main.innerHTML = html;
  }

  // 7. VÝBĚR ŘADY (MEZIKROK POKUD JE ŘAD VÍCE)
  else if (currentScreen === "SELECT_SEQ_ITEM") {
    bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    const sItems = getSeqItems();
    main.innerHTML = `
      <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber, co chceš skládat:</h2>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${sItems.map((it, idx) => `
          <div class="tile" style="border-color:var(--col-yellow);padding:15px;" onclick="selectedSeqIndex=${idx}; startGame('SEQ');">
            <h2 style="color:var(--col-yellow);">${it.question}</h2>
            <p>${it.answer.split('|').length} položek v řadě</p>
          </div>
        `).join('')}
      </div>
    `;
  }

  // 8. VELIKOST PEXESA
  else if (currentScreen === "SELECT_PEXESO_SIZE") {
    bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    main.innerHTML = `
      <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber velikost pexesa:</h2>
      <div class="grid-2">
        <div class="tile" onclick="startPexesoGame(3)"><h2>6 KARET</h2><p>3 dvojice</p></div>
        <div class="tile" onclick="startPexesoGame(4)"><h2>8 KARET</h2><p>4 dvojice</p></div>
        <div class="tile" onclick="startPexesoGame(6)"><h2>12 KARET</h2><p>6 dvojic</p></div>
        <div class="tile" onclick="startPexesoGame(8)"><h2>16 KARET</h2><p>8 dvojic</p></div>
      </div>
    `;
  }

  // 9. AKTIVNÍ HRA
  else if (currentScreen === "PLAYING") {
    bSubj.style.display = "flex"; bSubj.innerText = selectedSubject;
    bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    if (typeof renderActiveGame === "function") renderActiveGame();
  }
}

// Spuštění po načtení dokumentu
if (document.readyState === "loading") { 
  document.addEventListener("DOMContentLoaded", () => loadData()); 
} else { 
  loadData(); 
}
