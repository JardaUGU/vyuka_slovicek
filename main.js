/**
 * HLAVNÍ JÁDRO APLIKACE (Globální data, Zabezpečení, Ekologie, Časomíra)
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

function previewSkin(skinId) { previewingSkin = skinId; document.body.setAttribute('data-theme', skinId); if(typeof renderScreen==='function') renderScreen(); }
function cancelPreview() { previewingSkin = null; applyAppSkin(currentUser ? currentUser.activeTheme : 'default'); if(typeof renderScreen==='function') renderScreen(); }

function getUserUnlockedThemes(userName) {
  if (!userName) return ['default'];
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  let cloudSkins = [];
  if (u && u.unlockedThemes) cloudSkins = Array.isArray(u.unlockedThemes) ? u.unlockedThemes : String(u.unlockedThemes).split(',').map(s => s.trim());
  let localSkins = []; try { localSkins = JSON.parse(localStorage.getItem(`skins_${uKey}`) || '[]'); } catch(e) {}
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
  previewingSkin = null; if (!currentUser) return;
  const currentCoins = getUserCoins(currentUser.name);
  if (currentCoins >= cost) {
    const uKey = currentUser.name.toLowerCase().trim();
    // Odečteme pouze lokálně (v Google Sheets odečítá přímo akce "buy_theme"!)
    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
    if (u) u.coins = Math.max(0, Number(u.coins || 0) - cost);
    currentUser.coins = u ? u.coins : Math.max(0, currentCoins - cost);
    localStorage.setItem(`coins_${uKey}`, String(currentUser.coins));

    let themes = getUserUnlockedThemes(currentUser.name);
    if (!themes.includes(skinId)) themes.push(skinId);
    saveUserUnlockedThemes(currentUser.name, themes);
    localStorage.setItem(`active_theme_${uKey}`, skinId);
    currentUser.activeTheme = skinId;
    localStorage.setItem("cur_user", JSON.stringify(currentUser));
    applyAppSkin(skinId);
    if (u) { u.unlockedThemes = themes; u.activeTheme = skinId; }
    
    try {
      const fd = new URLSearchParams(); fd.append("action", "buy_theme"); fd.append("user", currentUser.name); fd.append("themeId", skinId); fd.append("cost", cost);
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
    alert("Nový vzhled byl odemčen a nasazen! 🎨"); if(typeof renderScreen==='function') renderScreen();
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
    const fd = new URLSearchParams(); fd.append("action", "set_theme"); fd.append("user", currentUser.name); fd.append("themeId", skinId);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
  if(typeof renderScreen==='function') renderScreen();
}

function setUserPIN() {
  if (!currentUser) return;
  const newPin = prompt("Zadej nový číselný PIN (např. 1234). Pokud chceš PIN zrušit, nevyplňuj nic a dej OK:");
  if (newPin !== null) {
     const pinStr = newPin.trim(); const uKey = currentUser.name.toLowerCase().trim();
     const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
     if (u) u.pin = pinStr;
     localStorage.setItem(`user_pin_${uKey}`, pinStr);
     try {
       const fd = new URLSearchParams(); fd.append("action", "set_pin"); fd.append("user", currentUser.name); fd.append("pin", pinStr);
       fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
     } catch(e) {}
     alert(pinStr ? `Skvělé! Tvé heslo bylo nastaveno na: ${pinStr}` : "Heslo bylo zrušeno. Přístup je volný.");
     if(typeof renderScreen==='function') renderScreen();
  }
}

function forceHardReload() { const newUrl = window.location.origin + window.location.pathname + '?v=' + Date.now(); window.location.replace(newUrl); }
function cleanCzechTranslation(text) { return text ? text.trim() : ""; }
function getVocabItems() { return (activeItems || []).filter(it => it.type === "SLOVO"); }
function getQuizItems()  { return (activeItems || []).filter(it => it.type === "KVIZ"); }
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
  if (u && u.coins !== undefined) return Math.max(0, Number(u.coins));
  return Math.max(0, Number(localStorage.getItem(`coins_${userName.toLowerCase().trim()}`) || 0));
}

function getUserItemCount(userName, itemKey) {
  if (!userName) return 0;
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === userName.toLowerCase().trim());
  if (u && u.inventory && u.inventory[itemKey] !== undefined) return Number(u.inventory[itemKey]);
  return Number(localStorage.getItem(`item_${itemKey}_${userName.toLowerCase().trim()}`) || 0);
}

function addCoins(userName, amount) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) {
    u.coins = Math.max(0, Number(u.coins || 0) + amount);
    localStorage.setItem(`coins_${uKey}`, String(u.coins));
  }
  if (currentUser && currentUser.name.toLowerCase().trim() === uKey) {
    currentUser.coins = u ? u.coins : Math.max(0, Number(currentUser.coins || 0) + amount);
    localStorage.setItem("cur_user", JSON.stringify(currentUser));
  }
  try {
    const fd = new URLSearchParams(); fd.append("action", "add_coins"); fd.append("user", userName); fd.append("amount", amount);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

function buyShopItem(itemKey, cost) {
  if (!currentUser) return;
  const currentCoins = getUserCoins(currentUser.name); const uKey = currentUser.name.toLowerCase().trim();
  if (currentCoins >= cost) {
    // Odečteme pouze lokálně (v Google Sheets odečítá přímo akce "buy_item"!)
    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
    if (u) { 
      u.coins = Math.max(0, Number(u.coins || 0) - cost); 
      if (!u.inventory) u.inventory = {}; 
      u.inventory[itemKey] = (u.inventory[itemKey] || 0) + 1; 
    }
    currentUser.coins = u ? u.coins : Math.max(0, currentCoins - cost);
    localStorage.setItem(`coins_${uKey}`, String(currentUser.coins));
    localStorage.setItem("cur_user", JSON.stringify(currentUser));

    let curCount = Number(localStorage.getItem(`item_${itemKey}_${uKey}`) || 0);
    localStorage.setItem(`item_${itemKey}_${uKey}`, curCount + 1);

    try {
      const fd = new URLSearchParams(); fd.append("action", "buy_item"); fd.append("user", currentUser.name); fd.append("itemKey", itemKey); fd.append("cost", cost);
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
    alert(`Úspěšně zakoupeno! 🛒\nPoložka ${itemKey} byla přidána.`); if(typeof renderScreen==='function') renderScreen();
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
function getUserStreak(userName) { 
  if (!userName) return 0;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const cloudStreak = (u && u.streak !== undefined) ? Number(u.streak) : 0;
  const localStreak = Number(localStorage.getItem(`streak_${uKey}`) || 0);
  return Math.max(cloudStreak, localStreak);
}

function updateUserStreak(userName, targetMinutes) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim(); 
  const todayStr = getTodayDateStr();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);

  // Vezmeme nejnovější datum splnění (buď z cloudu, nebo z localStorage)
  let cloudLast = (u && u.streakLastDate) ? String(u.streakLastDate).slice(0, 10) : "";
  let localLast = localStorage.getItem(`streak_last_date_${uKey}`) || "";
  let lastCompleted = (cloudLast > localLast) ? cloudLast : localLast;

  if (lastCompleted === todayStr) return; // Dnes už je splněno

  let streak = getUserStreak(userName);

  if (lastCompleted) {
    // Převod na poledne UTC zabrání chybám při posunu zimního/letního času mezi Safari a Chrome
    const lastDate = new Date(lastCompleted + "T12:00:00Z"); 
    const todayDate = new Date(todayStr + "T12:00:00Z");
    const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) { 
      streak += 1; 
    } else if (diffDays > 1) {
      const missedDays = diffDays - 1; 
      let freezes = getUserItemCount(userName, "Zmrazeni");
      if (freezes >= missedDays) {
        let newFreezeCount = freezes - missedDays;
        localStorage.setItem(`item_Zmrazeni_${uKey}`, newFreezeCount);
        if (u && u.inventory) u.inventory["Zmrazeni"] = newFreezeCount;
        streak += 1; 
        alert(`🧊 Tvoje série byla zachráněna! Spotřebováno zmrazení: ${missedDays}x`);
      } else { 
        streak = 1; 
        alert("Tvá denní série byla přerušena, protože jsi neměl dostatek zmrazení na všechny vynechané dny."); 
      }
    }
  } else { 
    streak = 1; 
  }

  localStorage.setItem(`streak_${uKey}`, streak); 
  localStorage.setItem(`streak_last_date_${uKey}`, todayStr);
  if (u) {
    u.streak = streak;
    u.streakLastDate = todayStr;
  }
  // Okamžitě odešleme aktualizovaný čas na server, aby si i Google Sheets zapsal dnešní streak
  if (typeof sendTimeHeartbeatToGoogle === "function") sendTimeHeartbeatToGoogle();
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
  // DŮLEŽITÉ: Čas studia se nezapočítává pouze u oddechové hry Had (SNAKE)
  const isJustGame = (currentScreen === "PLAYING" && selectedGame === "SNAKE");
  
  if (currentScreen === "PLAYING" && currentUser && !isJustGame) {
    const idleTime = Date.now() - lastUserActivityTime;
    if (idleTime < 15000) {
      todaySecondsStudied++;
      localStorage.setItem(getStudyTimeKey(currentUser.name), String(todaySecondsStudied));
      isTimerPaused = false;
      
      const targetSec = (currentUser.targetMinutes || 15) * 60;
      if (todaySecondsStudied >= targetSec) updateUserStreak(currentUser.name, currentUser.targetMinutes || 15);
      
      if (todaySecondsStudied - lastCloudSyncSec >= 30) { 
        lastCloudSyncSec = todaySecondsStudied; 
        if (typeof sendTimeHeartbeatToGoogle === 'function') sendTimeHeartbeatToGoogle(); 
      }
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
  if (isGoalReached) { box.className = isPaused ? "study-timer-box bonus paused" : "study-timer-box bonus"; box.innerText = isPaused ? `⏸️ ★ BONUS: +${format(bonusSec)}` : `★ BONUS: +${format(bonusSec)}`; } 
  else { box.className = isPaused ? "study-timer-box paused" : "study-timer-box"; box.innerText = isPaused ? `⏸️ ${format(todaySecondsStudied)} / ${format(targetSec)}` : `⏱️ ${format(todaySecondsStudied)} / ${format(targetSec)}`; }
}

function setScreen(scr) { 
  if (currentScreen === "SHOP" && scr !== "SHOP") cancelPreview();
  currentScreen = scr; registerUserAction(); if(typeof renderScreen==='function') renderScreen(); 
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
  const themesArr = typeof getUserUnlockedThemes==='function'?getUserUnlockedThemes(name):[]; 
  const activeTh = typeof getUserActiveTheme==='function'?getUserActiveTheme(name):'default';
  currentUser = { 
    name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0,
    startLevels: (foundU && foundU.startLevels) ? foundU.startLevels : {},
    inventory: (foundU && foundU.inventory) ? foundU.inventory : {},
    unlockedThemes: themesArr, activeTheme: activeTh, coins: foundU ? Number(foundU.coins || 0) : 0
  };
  localStorage.setItem("cur_user", JSON.stringify(currentUser)); 
  if(typeof applyAppSkin==='function') applyAppSkin(currentUser.activeTheme);
  
  // DŮLEŽITÉ (BUGFIX): Načtení maximálního času z cloudu a z lokální paměti
  let localSec = typeof loadUserStudyTime==='function'?loadUserStudyTime(currentUser.name):0;
  let cloudSec = (foundU && appData.syncDate === getTodayDateStr()) ? Math.round(Number(foundU.todayMinutes || 0) * 60) : 0;
  todaySecondsStudied = Math.max(localSec, cloudSec);
  localStorage.setItem(getStudyTimeKey(currentUser.name), String(todaySecondsStudied));
  
  lastCloudSyncSec = todaySecondsStudied; 

  isTimerPaused = false; 
  if(typeof updateStudyTimerUI==='function') updateStudyTimerUI(); 
  if(typeof setScreen==='function') setScreen("SELECT_SUBJECT");
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
  if (sItems.length === 1) { selectedSeqIndex = 0; if(typeof startGame==='function') startGame('SEQ'); } 
  else setScreen('SELECT_SEQ_ITEM');
}

function toggleTestingDirection() {
  testingDirection = (testingDirection === "DIR_OUT") ? "DIR_IN" : "DIR_OUT";
  localStorage.setItem("testing_dir", testingDirection);
  if (typeof initGameState === "function") initGameState();
  if (typeof renderScreen === "function") renderScreen();
}

window.startStory = function(topicName) {
  if (typeof launchStoryMode === "function") launchStoryMode(topicName);
};

// Spouštěč při startu
document.addEventListener("DOMContentLoaded", () => { if(typeof loadData==='function') loadData(); });
