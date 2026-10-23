/**
 * HLAVNÍ JÁDRO APLIKACE (Data, Uživatelé, Obchod, Menu, Časomíra)
 */
const API_URL = "https://script.google.com/macros/s/AKfycbxaxBIXP-ECpWstcqRDw8RuT_ds6UwcplU_3pZ9_-ksELN5FVeGt5EHjjexkJVmx1FR_w/exec";
const APP_VERSION = "7.4";

let appData = { users: [], progress: {}, items: [], syncDate: "" };
let currentUser = JSON.parse(localStorage.getItem("cur_user") || 'null');
let filterExactGradeOnly = false;
let viewMode = "LESSONS";

let currentScreen = "SELECT_USER";
let selectedSubject = "";
let selectedGroupKey = "";
let activeItems = [];
let selectedGame = "";
let selectedSeqIndex = 0;
let testingDirection = localStorage.getItem("testing_dir") || "DIR_OUT";

let todaySecondsStudied = 0;
let lastUserActivityTime = Date.now();
let isTimerPaused = false;
let lastCloudSyncSec = 0;
let previewingSkin = null;

const APP_SKINS = [
  { id: 'default', name: '🌌 Hluboký vesmír', cost: 0, desc: 'Klasický tmavomodrý noční vzhled' },
  { id: 'matrix', name: '💻 Hacker Matrix', cost: 60, desc: 'Čistý černo-zelený terminál' },
  { id: 'gold', name: '👑 Zlatý šampion', cost: 80, desc: 'Exkluzivní zlato-černý design' },
  { id: 'cyberpunk', name: '⚡ Kyberpunk', cost: 70, desc: 'Tmavě fialová s neonovou růžovou' },
  { id: 'arctic', name: '❄️ Polární záře', cost: 50, desc: 'Ledově tyrkysový světlý styl' }
];

function applyAppSkin(skinId) {
  const s = skinId || 'default';
  document.body.setAttribute('data-theme', s);
  localStorage.setItem('active_skin', s);
}
applyAppSkin(localStorage.getItem('active_skin') || 'default');

function previewSkin(skinId) { previewingSkin = skinId; document.body.setAttribute('data-theme', skinId); renderScreen(); }
function cancelPreview() { previewingSkin = null; applyAppSkin(currentUser ? currentUser.activeTheme : 'default'); renderScreen(); }

function getUserUnlockedThemes(userName) {
  if (!userName) return ['default'];
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  let cloudSkins = [];
  if (u && u.unlockedThemes) cloudSkins = Array.isArray(u.unlockedThemes) ? u.unlockedThemes : String(u.unlockedThemes).split(',').map(s => s.trim());
  let localSkins = [];
  try { localSkins = JSON.parse(localStorage.getItem(`skins_${uKey}`) || '[]'); } catch(e) {}
  let curSkins = (currentUser && currentUser.name && currentUser.name.toLowerCase().trim() === uKey && Array.isArray(currentUser.unlockedThemes)) ? currentUser.unlockedThemes : [];
  return [...new Set(['default', ...cloudSkins, ...localSkins, ...curSkins])];
}

function saveUserUnlockedThemes(userName, themesArr) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim();
  localStorage.setItem(`skins_${uKey}`, JSON.stringify(themesArr));
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.unlockedThemes = themesArr;
  if (currentUser && currentUser.name.toLowerCase().trim() === uKey) {
    currentUser.unlockedThemes = themesArr;
    localStorage.setItem("cur_user", JSON.stringify(currentUser));
  }
}

function getUserActiveTheme(userName) {
  if (!userName) return 'default';
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  return localStorage.getItem(`active_theme_${uKey}`) || (u ? u.activeTheme : null) || (currentUser ? currentUser.activeTheme : null) || 'default';
}

function buySkin(skinId, cost) {
  previewingSkin = null;
  if (!currentUser) return;
  const currentCoins = getUserCoins(currentUser.name);
  if (currentCoins >= cost) {
    addCoins(currentUser.name, -cost);
    const uKey = currentUser.name.toLowerCase().trim();
    let themes = getUserUnlockedThemes(currentUser.name);
    if (!themes.includes(skinId)) themes.push(skinId);
    
    saveUserUnlockedThemes(currentUser.name, themes);
    localStorage.setItem(`active_theme_${uKey}`, skinId);
    currentUser.activeTheme = skinId;
    localStorage.setItem("cur_user", JSON.stringify(currentUser));
    applyAppSkin(skinId);

    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
    if (u) { u.unlockedThemes = themes; u.activeTheme = skinId; }
    
    try {
      const fd = new URLSearchParams();
      fd.append("action", "buy_theme"); fd.append("user", currentUser.name);
      fd.append("themeId", skinId); fd.append("cost", cost);
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
    
    alert("Nový vzhled byl odemčen a nasazen! 🎨");
    renderScreen();
  } else { alert("Nemáš dostatek zlaťáků! 💰"); }
}

function equipSkin(skinId) {
  previewingSkin = null; if (!currentUser) return;
  const uKey = currentUser.name.toLowerCase().trim();
  currentUser.activeTheme = skinId;
  localStorage.setItem(`active_theme_${uKey}`, skinId);
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  applyAppSkin(skinId);
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.activeTheme = skinId;
  
  try {
    const fd = new URLSearchParams();
    fd.append("action", "set_theme"); fd.append("user", currentUser.name); fd.append("themeId", skinId);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
  
  renderScreen();
}

function setUserPIN() {
  if (!currentUser) return;
  const newPin = prompt("Zadej nový číselný PIN (např. 1234). Pokud chceš PIN zrušit, nevyplňuj nic a dej OK:");
  if (newPin !== null) {
     const pinStr = newPin.trim();
     const uKey = currentUser.name.toLowerCase().trim();
     const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
     if (u) u.pin = pinStr;
     localStorage.setItem(`user_pin_${uKey}`, pinStr);
     try {
       const fd = new URLSearchParams(); fd.append("action", "set_pin"); fd.append("user", currentUser.name); fd.append("pin", pinStr);
       fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
     } catch(e) {}
     alert(pinStr ? `Skvělé! Tvé heslo bylo nastaveno na: ${pinStr}` : "Heslo bylo zrušeno. Přístup je volný.");
     renderScreen();
  }
}

function forceHardReload() { const newUrl = window.location.origin + window.location.pathname + '?v=' + Date.now(); window.location.replace(newUrl); }
function cleanCzechTranslation(text) { return text ? text.trim() : ""; }
function getVocabItems() { return (activeItems || []).filter(it => it.type === "SLOVO"); }
function getQuizItems() { return (activeItems || []).filter(it => it.type === "KVIZ"); }
function getSeqItems()   { return (activeItems || []).filter(it => it.type === "RADA"); }
function getAdaptiveWindowSize(grade) { const g = parseInt(grade) || 2; return g >= 90 ? 12 : (g >= 10 ? 10 : Math.max(3, g)); }
function getGraphemes(str) {
  if (window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter('und', { granularity: 'grapheme' }).segment(str), s => s.segment);
  return str.split('');
}

function getQuickChoiceMode() {
  const vItems = getVocabItems(); const s = (selectedSubject || '').toLowerCase();
  if (s.includes("nemc") || s === "de") { if (vItems.filter(it => /^(der|die|das)\s/i.test(it.question)).length >= 3) return "DER_DIE_DAS"; }
  if (s.includes("angli") || s === "en" || s.includes("inteligentn")) { if (vItems.filter(it => /^(a|an)\s/i.test(it.question)).length >= 3) return "A_AN"; }
  if (s.includes("cest") || s === "cs") { if (vItems.filter(it => it.question.includes('_')).length >= 3) return "I_Y"; }
  return null;
}

function isItemAllowedForGrade(it, userG) {
  const subjLow = (it.subject || '').toLowerCase();
  if (subjLow.includes('cesta') || subjLow.includes('postupn') || subjLow.includes('inteligentn')) return true;
  if (((it.lesson||'').toLowerCase().includes('sloves') || (it.topic||'').toLowerCase().includes('sloves')) && userG >= 5) return true;
  if (!filterExactGradeOnly || userG >= 90) return true;
  return (parseInt(it.minGrade) || 2) === userG;
}

function getUserCoins(userName) {
  if (!userName) return 0;
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === userName.toLowerCase().trim());
  const cloudCoins = u ? Number(u.coins || 0) : 0;
  const localCoins = Number(localStorage.getItem(`coins_${userName.toLowerCase().trim()}`) || 0);
  return Math.max(cloudCoins, localCoins);
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
    const fd = new URLSearchParams(); fd.append("action", "add_coins"); fd.append("user", userName); fd.append("amount", amount);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

function buyShopItem(itemKey, cost) {
  if (!currentUser) return;
  const currentCoins = getUserCoins(currentUser.name);
  const uKey = currentUser.name.toLowerCase().trim();
  if (currentCoins >= cost) {
    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
    if (u) { u.coins -= cost; if (!u.inventory) u.inventory = {}; u.inventory[itemKey] = (u.inventory[itemKey] || 0) + 1; }
    let curCount = Number(localStorage.getItem(`item_${itemKey}_${uKey}`) || 0);
    localStorage.setItem(`item_${itemKey}_${uKey}`, curCount + 1);
    addCoins(currentUser.name, -cost);
    try {
      const fd = new URLSearchParams(); fd.append("action", "buy_item"); fd.append("user", currentUser.name); fd.append("itemKey", itemKey); fd.append("cost", cost);
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
    alert(`Úspěšně zakoupeno! 🛒\nPoložka ${itemKey} byla přidána.`);
    renderScreen();
  } else { alert("Nemáš dostatek zlaťáků! 💰"); }
}
window.buyFreeze = function() { buyShopItem("Zmrazeni", 20); };

function getTodayDateStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let activeDateStr = getTodayDateStr();

function checkDateRollover() {
  const today = getTodayDateStr();
  if (today !== activeDateStr) {
    activeDateStr = today; todaySecondsStudied = 0; lastCloudSyncSec = 0;
    if (currentUser) localStorage.setItem(getStudyTimeKey(currentUser.name), "0");
    updateStudyTimerUI(); if (typeof renderScreen === "function") renderScreen();
  }
}

function updateFooter() {
  const fUser = document.getElementById("footer-user"); if (fUser) fUser.innerText = currentUser ? `Žák: ${currentUser.name}` : "Žák: --";
  const statusEl = document.getElementById("footer-status"); if (statusEl && statusEl.innerText.includes("Restart")) statusEl.innerText = `v${APP_VERSION} (OK)`;
}

function getStudyTimeKey(userName) { return `study_sec_${getTodayDateStr()}_${(userName || 'user').toLowerCase().trim()}`; }
function loadUserStudyTime(userName) { if (!userName) return 0; return Number(localStorage.getItem(getStudyTimeKey(userName)) || 0); }
function getUserStreak(userName) { if (!userName) return 0; return Number(localStorage.getItem(`streak_${userName.toLowerCase().trim()}`) || 0); }

function updateUserStreak(userName, targetMinutes) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim();
  const todayStr = getTodayDateStr();
  const lastCompleted = localStorage.getItem(`streak_last_date_${uKey}`);
  if (lastCompleted === todayStr) return; 

  let streak = Number(localStorage.getItem(`streak_${uKey}`) || 0);

  if (lastCompleted) {
    const lastDate = new Date(lastCompleted);
    const todayDate = new Date(todayStr);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      streak += 1;
    } else if (diffDays > 1) {
      const missedDays = diffDays - 1;
      let freezes = getUserItemCount(userName, "Zmrazeni");
      
      if (freezes >= missedDays) {
        let newFreezeCount = freezes - missedDays;
        localStorage.setItem(`item_Zmrazeni_${uKey}`, newFreezeCount);
        const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
        if (u && u.inventory) u.inventory["Zmrazeni"] = newFreezeCount;
        
        streak += 1;
        alert(`🧊 Tvoje série byla zachráněna! Spotřebováno zmrazení: ${missedDays}x`);
      } else {
        streak = 1;
        alert("Tvá denní série byla přerušena, protože jsi neměl dostatek zmrazení na všechny vynechané dny.");
      }
    }
  } else { streak = 1; }

  localStorage.setItem(`streak_${uKey}`, streak);
  localStorage.setItem(`streak_last_date_${uKey}`, todayStr);
}

function registerUserAction() {
  checkDateRollover(); lastUserActivityTime = Date.now();
  if (isTimerPaused) { isTimerPaused = false; updateStudyTimerUI(); }
  if (typeof updateVoices === "function" && typeof cachedVoices !== "undefined" && cachedVoices.length === 0) updateVoices();
}
window.addEventListener('click', registerUserAction, true);
window.addEventListener('touchstart', registerUserAction, true);
window.addEventListener('keydown', registerUserAction, true);

setInterval(() => {
  checkDateRollover();
  const isJustGame = (currentScreen === "PLAYING" && (selectedGame === "SNAKE" || selectedGame === "ARCADE"));
  
  if (currentScreen === "PLAYING" && currentUser && !isJustGame) {
    const idleTime = Date.now() - lastUserActivityTime;
    if (idleTime < 15000) {
      todaySecondsStudied++;
      localStorage.setItem(getStudyTimeKey(currentUser.name), String(todaySecondsStudied));
      isTimerPaused = false;
      const targetSec = (currentUser.targetMinutes || 15) * 60;
      if (todaySecondsStudied >= targetSec) updateUserStreak(currentUser.name, currentUser.targetMinutes || 15);
      if (todaySecondsStudied - lastCloudSyncSec >= 45) { lastCloudSyncSec = todaySecondsStudied; sendTimeHeartbeatToGoogle(); }
    } else { isTimerPaused = true; }
  } else { isTimerPaused = true; }
  
  updateStudyTimerUI();
}, 1000);

function updateStudyTimerUI() {
  const box = document.getElementById("study-timer"); const footerGoal = document.getElementById("footer-goal");
  if (!box || !currentUser) return;
  const targetSec = (currentUser.targetMinutes || 15) * 60; const isGoalReached = todaySecondsStudied >= targetSec;
  const bonusSec = Math.max(0, todaySecondsStudied - targetSec);
  const format = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const spentMin = Math.floor(todaySecondsStudied / 60); const targetMin = currentUser.targetMinutes || 15;
  
  if (footerGoal) {
    if (isGoalReached) { const bMin = Math.floor(bonusSec / 60); footerGoal.innerHTML = `<span style="color:var(--col-yellow);font-weight:bold;">★ ${spentMin} / ${targetMin} min (+${bMin} min)</span>`; } 
    else { footerGoal.innerText = `${spentMin} / ${targetMin} min ⏱️`; }
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

function sendTimeHeartbeatToGoogle() {}

async function loadData() {
  checkDateRollover();
  if (currentUser) todaySecondsStudied = loadUserStudyTime(currentUser.name);
  const cached = localStorage.getItem("app_data");
  if (cached) { try { appData = JSON.parse(cached); if (!appData.items) appData.items = []; renderScreen(); } catch(e) { renderScreen(); } } 
  else { renderScreen(); }
  syncDataQuietly();
}

async function syncDataQuietly() {
  try {
    const res = await fetch(API_URL + '?t=' + Date.now() + '&clientDate=' + getTodayDateStr());
    const json = await res.json();
    if (json.appVersion && String(json.appVersion) !== String(APP_VERSION)) { forceHardReload(); return; }
    
    if (json && json.items) {
      json.syncDate = getTodayDateStr(); appData = json; localStorage.setItem("app_data", JSON.stringify(json));
      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        if (foundU) {
          currentUser.targetMinutes = foundU.targetMinutes || 15; currentUser.grade = parseInt(foundU.grade) || 2;
          currentUser.coins = Number(foundU.coins || 0); currentUser.inventory = foundU.inventory || {};
          let cloudThemes = Array.isArray(foundU.unlockedThemes) ? foundU.unlockedThemes : (typeof foundU.unlockedThemes === 'string' ? foundU.unlockedThemes.split(',').map(s => s.trim().toLowerCase()) : []);
          let mergedThemes = [...new Set(['default', ...cloudThemes, ...getUserUnlockedThemes(currentUser.name)])];
          saveUserUnlockedThemes(currentUser.name, mergedThemes);
          currentUser.unlockedThemes = mergedThemes; currentUser.activeTheme = getUserActiveTheme(currentUser.name);
          currentUser.startLevels = foundU.startLevels || {};
          localStorage.setItem("cur_user", JSON.stringify(currentUser));
        }
      }
      renderScreen();
    } else { renderScreen(); }
  } catch(e) { console.log("Offline mód aktivní"); renderScreen(); }
}

async function syncData() {
  const statusEl = document.getElementById("footer-status");
  if (statusEl) statusEl.innerText = "Stahuji...";
  try {
    const fetchUrl = API_URL + '?t=' + Date.now() + '&clientDate=' + getTodayDateStr();
    const res = await fetch(fetchUrl);
    const json = await res.json();

    if (json.appVersion && String(json.appVersion) !== String(APP_VERSION)) { forceHardReload(); return; }

    if (json && json.items) {
      json.syncDate = getTodayDateStr(); appData = json; localStorage.setItem("app_data", JSON.stringify(json));
      if (statusEl) statusEl.innerText = `OK: ${appData.items.length} úloh`;

      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        if (foundU) {
          currentUser.coins = Number(foundU.coins || 0); currentUser.inventory = foundU.inventory || {};
          let mergedThemes = getUserUnlockedThemes(currentUser.name); saveUserUnlockedThemes(currentUser.name, mergedThemes);
          currentUser.unlockedThemes = mergedThemes; currentUser.activeTheme = getUserActiveTheme(currentUser.name);
          localStorage.setItem("cur_user", JSON.stringify(currentUser)); applyAppSkin(currentUser.activeTheme);
        }
      }
    }
  } catch(e) { if (statusEl) statusEl.innerText = (appData && appData.items && appData.items.length > 0) ? `OK: ${appData.items.length} úloh` : "Offline"; }
  renderScreen();
}

function setScreen(scr) { 
  if (currentScreen === "SHOP" && scr !== "SHOP") cancelPreview();
  currentScreen = scr; registerUserAction(); renderScreen(); 
}

function selectUser(name, grade, targetMinutes) {
  const uKey = name.toLowerCase().trim();
  const foundU = (appData.users || []).find(u => u.name.toLowerCase().trim() === uKey);
  
  const savedPin = (foundU && foundU.pin) ? foundU.pin : localStorage.getItem(`user_pin_${uKey}`);
  if (savedPin && savedPin !== "") {
     const inputPin = prompt(`Profil ${name} je chráněn PINem. Zadejte heslo:`);
     if (inputPin === null) return; 
     if (inputPin !== savedPin) { alert("Nesprávné heslo!"); return; }
  }

  checkDateRollover();
  const themesArr = getUserUnlockedThemes(name); const activeTh = getUserActiveTheme(name);
  currentUser = { 
    name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0,
    startLevels: (foundU && foundU.startLevels) ? foundU.startLevels : {},
    inventory: (foundU && foundU.inventory) ? foundU.inventory : {},
    unlockedThemes: themesArr, activeTheme: activeTh, coins: foundU ? Number(foundU.coins || 0) : 0
  };
  localStorage.setItem("cur_user", JSON.stringify(currentUser)); applyAppSkin(currentUser.activeTheme);
  
  todaySecondsStudied = loadUserStudyTime(currentUser.name);
  isTimerPaused = false; updateStudyTimerUI(); setScreen("SELECT_SUBJECT");
}

function chooseSubject(subj) { 
  selectedSubject = subj; const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => it.subject === selectedSubject && isItemAllowedForGrade(it, userG));
  const sLow = selectedSubject.toLowerCase();
  if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) setScreen("CAMPAIGN_HUB"); else setScreen("SELECT_GROUP");
}

function chooseGroup(groupName) {
  selectedGroupKey = groupName; const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => it.subject === selectedSubject && isItemAllowedForGrade(it, userG) && (viewMode === "LESSONS" ? it.lesson : it.topic) === groupName);
  setScreen("SELECT_GAME");
}

function openSequenceMenu() {
  const sItems = getSeqItems();
  if (sItems.length === 1) { selectedSeqIndex = 0; startGame('SEQ'); } else setScreen('SELECT_SEQ_ITEM');
}

function toggleTestingDirection() {
  testingDirection = (testingDirection === "DIR_OUT") ? "DIR_IN" : "DIR_OUT";
  localStorage.setItem("testing_dir", testingDirection);
  if (typeof initGameState === "function") initGameState();
  renderScreen();
}

// SPUŠTĚNÍ PŘÍBĚHU PŘÍMO DO ČTEČKY
window.startStory = function(topicName) {
  if (typeof launchStoryMode === "function") {
    launchStoryMode(topicName);
  }
};

function renderScreen() {
  try {
    updateFooter(); updateStudyTimerUI(); 
    if (typeof updateTTSBtnUI === "function") updateTTSBtnUI();
    const main = document.getElementById("main-content");
    const bUser = document.getElementById("badge-user"); const bSubj = document.getElementById("badge-subj"); const bGroup = document.getElementById("badge-group");
    bUser.innerText = currentUser ? currentUser.name : "Uživatel";

    // 1. VÝBĚR UŽIVATELE
    if (currentScreen === "SELECT_USER" || !currentUser) {
      bSubj.style.display = "none"; bGroup.style.display = "none";
      const uList = appData.users || [];
      if (uList.length === 0) {
        main.innerHTML = `<div style="text-align:center;padding:30px;"><p style="margin-bottom:15px;">Načítám profily z tabulky...</p></div>`;
        return;
      }
      main.innerHTML = `
        <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Kdo se jde učit?</h2>
        <div class="grid-2">
          ${uList.map(u => {
            const g = parseInt(u.grade) || 2;
            const uSec = loadUserStudyTime(u.name);
            const uMin = Math.floor(uSec / 60); const targetM = u.targetMinutes || 15; const isDone = uMin >= targetM;
            const streakDays = (u.streak !== undefined) ? u.streak : getUserStreak(u.name);
            const coins = Number(u.coins || 0); const freezes = getUserItemCount(u.name, "Zmrazeni");
            const hasPin = !!(u.pin || localStorage.getItem(`user_pin_${u.name.toLowerCase().trim()}`));
            let themesArr = getUserUnlockedThemes(u.name);
            const unlockedSkins = themesArr.filter(t => t !== 'default').map(t => { const s = APP_SKINS.find(x => x.id === t); return s ? s.name.split(' ')[0] : t; }).join(' ');

            return `
              <div class="tile" style="${isDone ? 'border-color:var(--col-yellow);background:#1a2512;' : ''} position:relative;" onclick="selectUser('${u.name.replace(/'/g, "\\'")}', ${g}, ${targetM})">
                ${hasPin ? `<div style="position:absolute; top:8px; right:8px; font-size:16px;">🔒</div>` : ''}
                <h2>${u.name}</h2><p>${g >= 10 && g < 90 ? `${g-9}. ročník SŠ` : (g<=9 ? `${g}. tř.` : 'Dospělý')}</p>
                <p style="color:var(--col-orange);margin-top:4px;">🔥 Série: ${streakDays} dní</p>
                <p style="color:${isDone ? 'var(--col-yellow)' : 'var(--col-text-muted)'};margin-top:2px;font-weight:bold;">⏱️ Dnes: ${uMin}/${targetM} min ${isDone?'★':''}</p>
                <p style="color:var(--col-text-muted);margin-top:4px;font-size:12px;background:rgba(0,0,0,0.3);padding:2px 6px;border-radius:6px;min-height:22px;">
                  💰 ${coins} | 🧊 ${freezes}x
                  ${unlockedSkins ? `<br>🎨 ${unlockedSkins}` : ''}
                </p>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 2. VÝBĚR PŘEDMĚTU + OBCHOD
    else if (currentScreen === "SELECT_SUBJECT") {
      bSubj.style.display = "none"; bGroup.style.display = "none";
      const userG = parseInt(currentUser.grade) || 2;
      const subjs = {};
      (appData.items || []).forEach(it => { if (isItemAllowedForGrade(it, userG)) subjs[it.subject] = (subjs[it.subject] || 0) + 1; });

      const coins = getUserCoins(currentUser.name);
      const freezes = getUserItemCount(currentUser.name, "Zmrazeni");
      const unlocked = getUserUnlockedThemes(currentUser.name);
      const skinCount = unlocked.length;

      let html = `
        <div class="filter-bar">
          <span>Filtr: ${filterExactGradeOnly ? 'Jen ' + userG + '. třída' : 'Všechny ročníky'}</span>
          <button class="toggle-btn ${filterExactGradeOnly ? 'on' : ''}" onclick="filterExactGradeOnly=!filterExactGradeOnly;renderScreen();">
            ${filterExactGradeOnly ? 'Jen má třída' : 'Všechny ročníky'}
          </button>
        </div>

        <div class="tile" style="border-color:var(--col-yellow);background:#1f1905;margin-bottom:10px;padding:12px 14px;cursor:pointer;" onclick="setScreen('SHOP')">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:32px;">🛒</span>
              <div style="text-align:left;">
                <h2 style="color:var(--col-yellow);margin-bottom:2px;font-size:18px;">Obchod, Vzhledy a Profil</h2>
                <p style="color:var(--col-text-muted);font-size:12px;">Společný obchod pro všechny předměty</p>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="color:var(--col-yellow);font-size:18px;font-weight:bold;">${coins} 💰</div>
              <div style="color:var(--col-active-tab);font-size:12px;margin-top:2px;">🧊 ${freezes}x | 🎨 ${skinCount}</div>
            </div>
          </div>
        </div>

        <div class="grid-2">
          <div class="tile" style="border-color:var(--col-active-tab);background:#102538;" onclick="if(typeof openMathOperationSelect === 'function') openMathOperationSelect()">
            <h2 style="color:var(--col-active-tab);">🔢 Matematika</h2><p>Výběr operací a dril</p>
          </div>
      `;
      Object.keys(subjs).forEach(s => {
        const sLow = s.toLowerCase();
        const isCesta = sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn");
        const stl = isCesta ? 'border-color:var(--col-green);background:#112a1f;' : '';
        const ikn = isCesta ? '🚀 ' : '';
        html += `<div class="tile" style="${stl}" onclick="chooseSubject('${s.replace(/'/g, "\\'")}')"><h2>${ikn}${s}</h2><p>${subjs[s]} úloh</p></div>`;
      });
      html += `</div>`;
      main.innerHTML = html;
    }

    // 3. SPOLEČNÝ OBCHOD
    else if (currentScreen === "SHOP") {
      bSubj.style.display = "flex"; bSubj.innerText = "🛒 Obchod"; bGroup.style.display = "none";
      const coins = getUserCoins(currentUser.name); const freezes = getUserItemCount(currentUser.name, "Zmrazeni");
      const unlockedThemes = getUserUnlockedThemes(currentUser.name); const activeTheme = getUserActiveTheme(currentUser.name);
      
      const uKey = currentUser.name.toLowerCase().trim();
      const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
      const hasPin = !!(u && u.pin) || !!localStorage.getItem(`user_pin_${uKey}`);

      main.innerHTML = `
        <div style="padding:4px;">
          <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;">
             <div><b style="font-size:16px;">🔐 Ochrana profilu</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">Zamez ostatním ve vstupu do tvého účtu.</p></div>
             <button class="action-btn" style="margin:0;padding:8px 12px;font-size:14px;" onclick="setUserPIN()">${hasPin ? 'Změnit PIN' : 'Nastavit PIN'}</button>
          </div>

          <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <div><b style="font-size:16px;">🧊 Zmrazení série</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">Ochrání tvou sérii, když vynecháš den.</p></div>
              <span style="font-size:15px;color:var(--col-active-tab);font-weight:bold;margin-left:8px;">Máš: ${freezes}x</span>
            </div>
            <button class="action-btn" style="background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);padding:10px;font-size:15px;width:100%;margin-top:6px;" onclick="buyFreeze()">Koupit zmrazení (Cena: 20 💰)</button>
          </div>

          <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;">
            <div style="display:flex;flex-direction:column;gap:8px;">
              ${APP_SKINS.map(skin => {
                const isUnlocked = unlockedThemes.includes(skin.id); const isActive = activeTheme === skin.id; const isPreview = previewingSkin === skin.id;
                return `
                  <div style="display:flex;flex-direction:column;background:var(--col-bg);padding:10px 12px;border-radius:8px;border:1px solid ${isActive?'var(--col-active-tab)':'var(--col-card-border)'};">
                    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                      <div><b style="color:var(--col-yellow);font-size:15px;">${skin.name}</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">${skin.desc}</p></div>
                      <div style="display:flex;gap:6px;flex-wrap:wrap;">
                        ${isActive ? `<span style="color:var(--col-green);font-size:12px;font-weight:bold;padding:6px 10px;background:rgba(34,197,94,0.1);border-radius:6px;border:1px solid var(--col-green);">✅ Aktivní</span>` 
                          : isUnlocked ? `<button class="toggle-btn on" style="font-size:13px;padding:6px 14px;" onclick="equipSkin('${skin.id}')">Nasadit</button>` 
                          : (isPreview ? `<button class="toggle-btn" style="font-size:12px;padding:4px 8px;background:#1e293b;border-color:#94a3b8;" onclick="cancelPreview()">Zrušit náhled</button>
                                          <button class="toggle-btn" style="font-size:13px;padding:6px 10px;background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);" onclick="buySkin('${skin.id}', ${skin.cost})">Koupit (${skin.cost} 💰)</button>` 
                          : `<button class="toggle-btn" style="font-size:12px;padding:6px 10px;background:var(--col-card);border-color:var(--col-active-tab);" onclick="previewSkin('${skin.id}')">👁️ Náhled</button>`)}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="action-btn" style="margin-top:15px;" onclick="cancelPreview(); setScreen('SELECT_SUBJECT')">◀️ Zpět k výběru předmětů</div>
        </div>
      `;
    }

    // 4. VÝBĚR MATEMATIKY
    else if (currentScreen === "SELECT_MATH_OP") {
      bSubj.style.display = "flex"; bSubj.innerText = "Matematika"; bGroup.style.display = "none";
      if (typeof renderMathOpSelection === "function") renderMathOpSelection();
    }

    // 5. VÝBĚR SKUPINY (LEKCE / TÉMATA)
    else if (currentScreen === "SELECT_GROUP") {
      bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; bGroup.style.display = "none";
      const userG = parseInt(currentUser.grade) || 2; const groupsMap = {};
      activeItems.forEach(it => {
        const k = viewMode === "LESSONS" ? it.lesson : it.topic;
        if (!k) return; if (!groupsMap[k]) groupsMap[k] = { name: k, count: 0, raw: [] };
        groupsMap[k].count++; groupsMap[k].raw.push(it);
      });

      main.innerHTML = `
        <div class="filter-bar">
          <button class="toggle-btn ${viewMode==='LESSONS'?'on':''}" onclick="viewMode='LESSONS';renderScreen();">Lekce</button>
          <button class="toggle-btn ${viewMode==='TOPICS'?'on':''}" onclick="viewMode='TOPICS';renderScreen();">Témata</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${Object.values(groupsMap).map(g => {
            const mPct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(g.raw, selectedSubject) : 0;
            return `
              <div class="tile" style="flex-direction:column;align-items:stretch;padding:12px;" onclick="chooseGroup('${g.name.replace(/'/g, "\\'")}')">
                <div style="display:flex;justify-content:space-between;"><h2>${g.name}</h2><span style="color:var(--col-active-tab);">${g.count} úloh</span></div>
                <div class="bargraph-track" style="height:6px;margin-top:6px;"><div class="bargraph-fill" style="width:${mPct}%;"></div></div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 6. KAMPAŇ HUB (S PŘÍBĚHY A CEFR)
    else if (currentScreen === "CAMPAIGN_HUB") {
      bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; bGroup.style.display = "none";
      const coins = getUserCoins(currentUser.name); const vItems = getVocabItems();
      let lessons = [...new Set(vItems.map(it => it.lesson))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      const subjNorm = selectedSubject.toLowerCase().replace(/[^a-z]/g, ""); let userMinLvl = 1;
      if (currentUser && currentUser.startLevels) {
        for (let k in currentUser.startLevels) { if (subjNorm.includes(k) || k.includes(subjNorm)) { userMinLvl = Number(currentUser.startLevels[k]) || 1; break; } }
      }

      let currentLesson = lessons[0] || "Level 1";
      for (let l of lessons) {
        let num = parseInt(l.replace(/\D/g, '')) || 1; if (num < userMinLvl) continue;
        let lItems = vItems.filter(it => it.lesson === l);
        let pct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(lItems, selectedSubject) : 0;
        if (pct < 95) { currentLesson = l; break; }
      }

      selectedGroupKey = currentLesson; let curItems = vItems.filter(it => it.lesson === currentLesson);
      let currentPct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(curItems, selectedSubject) : 0;

      // CEFR Ukazatel
      let cefrHtml = "";
      if (subjNorm.includes("angli")) {
         const curIndex = lessons.indexOf(currentLesson);
         const cefrPct = Math.min(100, Math.max(0, Math.round((curIndex / Math.max(1, lessons.length - 1)) * 100)));
         cefrHtml = `
           <div style="margin-top:20px; background:var(--col-card); padding:10px 14px; border-radius:10px; border:1px solid var(--col-card-border);">
             <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <span style="font-weight:${cefrPct<25?'bold':'normal'}; color:${cefrPct<25?'inherit':'var(--col-text-muted)'};">A1</span>
                <span style="font-weight:${cefrPct>=25&&cefrPct<50?'bold':'normal'}; color:${cefrPct>=25&&cefrPct<50?'inherit':'var(--col-text-muted)'};">A2</span>
                <span style="font-weight:${cefrPct>=50&&cefrPct<75?'bold':'normal'}; color:${cefrPct>=50&&cefrPct<75?'inherit':'var(--col-text-muted)'};">B1</span>
                <span style="font-weight:${cefrPct>=75?'bold':'normal'}; color:${cefrPct>=75?'inherit':'var(--col-text-muted)'};">B2</span>
             </div>
             <div class="bargraph-track" style="height:12px; position:relative; background:#111a2a; border-radius:6px; overflow:hidden;">
               <div class="bargraph-fill" style="width:${cefrPct}%; background:linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
               <div style="position:absolute; left:25%; top:0; bottom:0; width:2px; background:var(--col-bg);"></div>
               <div style="position:absolute; left:50%; top:0; bottom:0; width:2px; background:var(--col-bg);"></div>
               <div style="position:absolute; left:75%; top:0; bottom:0; width:2px; background:var(--col-bg);"></div>
             </div>
             <div style="text-align:center; font-size:11px; color:var(--col-text-muted); margin-top:8px;">Evropský referenční rámec (CEFR)</div>
           </div>
         `;
      }

      // --- PŘÍBĚHY S KONTROLOU DOKONČENÍ A ODMĚNOU ---
      let storiesGroups = {};
      const userG = parseInt(currentUser.grade) || 2;
      let allSubjectItems = (appData.items || []).filter(it => it.subject === selectedSubject && isItemAllowedForGrade(it, userG));
      
      allSubjectItems.forEach(it => {
          if (it.type && it.type.toUpperCase().includes('PRIBEH')) {
              let t = it.topic || 'Neznámý příběh';
              if (!storiesGroups[t]) storiesGroups[t] = [];
              storiesGroups[t].push(it);
          }
      });

      let storiesHtml = "";
      let storyKeys = Object.keys(storiesGroups);
      if (storyKeys.length > 0) {
          const uKey = currentUser.name.toLowerCase().trim();
          storiesHtml += `<div style="margin-top:25px; text-align:left;">`;
          storiesHtml += `<h3 style="color:var(--col-active-tab); font-size:18px; margin-bottom:10px;">📚 Příběhy k přečtení</h3>`;
          storiesHtml += `<div style="display:flex; flex-direction:column; gap:8px;">`;
          storyKeys.forEach(title => {
              let sItems = storiesGroups[title];
              let isDone = (typeof getSavedMastery === "function" && getSavedMastery(title, "STORY") >= 2) || localStorage.getItem(`story_done_${uKey}_${title}`) === "1";
              let borderCol = isDone ? "var(--col-green)" : "var(--col-yellow)";
              let badgeText = isDone ? `<span style="color:var(--col-green); font-weight:bold; font-size:14px;">✅ Přečteno</span>` : `<span style="color:var(--col-yellow); font-weight:bold; font-size:15px;">🎁 +10 💰</span>`;

              storiesHtml += `
                <div class="tile" style="flex-direction:row; justify-content:space-between; padding:12px 14px; background:var(--col-card); border-color:${borderCol};" onclick="startStory('${title.replace(/'/g, "\\'")}')">
                  <div style="text-align:left;">
                      <h3 style="color:inherit; font-size:16px;">${isDone ? '📖 ' : '✨ '}${title}</h3>
                      <p style="color:var(--col-text-muted); font-size:12px; margin-top:2px;">${sItems.length} částí příběhu</p>
                  </div>
                  <div style="text-align:right;">
                      ${badgeText}
                  </div>
                </div>
              `;
          });
          storiesHtml += `</div></div>`;
      }

      main.innerHTML = `
        <div style="text-align:center;padding:15px 10px;">
          <h2 style="color:var(--col-active-tab);font-size:26px;margin-bottom:12px;">Spirálová výuka</h2>
          <p style="color:var(--col-text-muted);font-size:16px;margin-bottom:6px;">Aktuální lekce:</p>
          <p style="font-size:28px;font-weight:bold;margin-bottom:10px;">${currentLesson}</p>

          <div class="bargraph-container" style="max-width:280px;margin:0 auto 20px auto;">
            <div class="bargraph-header"><span>Postup lekce</span><span style="color:var(--col-green);">${currentPct} %</span></div>
            <div class="bargraph-track" style="height:8px;"><div class="bargraph-fill" style="width:${currentPct}%;"></div></div>
          </div>

          <div class="action-btn green" style="padding:18px;font-size:20px;box-shadow: 0 6px 15px rgba(34,197,94,0.3);" onclick="if(typeof startCampaign==='function') startCampaign()">
             ▶️ SPUSTIT DNEŠNÍ TRÉNINK
          </div>
          <p style="font-size:13px;color:var(--col-text-muted);margin-top:12px;">Udrž všech 5 ❤️ srdíček pro zisk zlaťáků!</p>

          ${cefrHtml}
          ${storiesHtml}

          <div class="tile" style="border-color:var(--col-yellow);background:#1f1905;margin-top:20px;padding:12px;cursor:pointer;" onclick="setScreen('SHOP')">
            <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
              <span style="color:var(--col-yellow);font-weight:bold;font-size:15px;">🛒 Přejít do Obchodu</span>
              <span style="color:var(--col-yellow);font-weight:bold;">${coins} 💰</span>
            </div>
          </div>
        </div>
      `;
    }

    // 7. VÝBĚR HRY (KLASICKÝ PŘEDMĚT)
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
          <div class="tile" style="border-color:#10b981;background:#062319;" onclick="if(typeof startSnakeGame === 'function') startSnakeGame()">
            <h2 style="color:#10b981;">🐍 Had</h2><p>Pravopis na čas</p>
          </div>
        `;
      }
      if (quickMode) {
        html += `
          <div class="tile" style="border-color:var(--col-orange);grid-column: span 2;background:#231a0a;" onclick="if(typeof startArcadeGame==='function') startArcadeGame()">
            <h2 style="color:var(--col-orange);">☄️ Padající slova (${quickMode.replace(/_/g, ' ')})</h2><p>Arkáda: 3 životy!</p>
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

    // 8. VÝBĚR ŘADY (MEZIKROK)
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

    // 9. VELIKOST PEXESA
    else if (currentScreen === "SELECT_PEXESO_SIZE") {
      bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
      main.innerHTML = `
        <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber velikost pexesa:</h2>
        <div class="grid-2">
          <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(3)"><h2>6 KARET</h2><p>3 dvojice</p></div>
          <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(4)"><h2>8 KARET</h2><p>4 dvojice</p></div>
          <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(6)"><h2>12 KARET</h2><p>6 dvojic</p></div>
          <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(8)"><h2>16 KARET</h2><p>8 dvojic</p></div>
        </div>
      `;
    }

    // 10. AKTIVNÍ HRA
    else if (currentScreen === "PLAYING") {
      bSubj.style.display = "flex"; bSubj.innerText = selectedSubject;
      bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
      if (typeof renderActiveGame === "function") renderActiveGame();
    }
  } catch (err) {
    console.error("Kritická chyba v renderScreen:", err);
    document.getElementById("main-content").innerHTML = `<div style="text-align:center;padding:30px;color:red;">Kritická chyba zobrazení.<br><br>${err.message}</div>`;
  }
}

document.addEventListener("DOMContentLoaded", () => { loadData(); });
