const API_URL = "https://script.google.com/macros/s/AKfycbxaxBIXP-ECpWstcqRDw8RuT_ds6UwcplU_3pZ9_-ksELN5FVeGt5EHjjexkJVmx1FR_w/exec";

let appData = { users: [], progress: {}, items: [], syncDate: "" };
let currentUser = JSON.parse(localStorage.getItem("cur_user") || 'null');
let filterExactGradeOnly = false;
let viewMode = "LESSONS";

let currentScreen = "SELECT_USER";
let selectedSubject = "";
let selectedGroupKey = "";
let activeItems = [];
let selectedGame = "";
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
  let cloudSkins = (u && u.unlockedThemes) ? (Array.isArray(u.unlockedThemes) ? u.unlockedThemes : String(u.unlockedThemes).split(',').map(s => s.trim())) : [];
  let localSkins = [];
  try { localSkins = JSON.parse(localStorage.getItem(`skins_${uKey}`) || '[]'); } catch(e) {}
  let curSkins = (currentUser && currentUser.name.toLowerCase().trim() === uKey && Array.isArray(currentUser.unlockedThemes)) ? currentUser.unlockedThemes : [];
  return [...new Set(['default', ...cloudSkins, ...localSkins, ...curSkins])];
}

function saveUserUnlockedThemes(userName, themesArr) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim();
  localStorage.setItem(`skins_${uKey}`, JSON.stringify(themesArr));
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.unlockedThemes = themesArr;
  if (currentUser && currentUser.name.toLowerCase().trim() === uKey) {
    currentUser.unlockedThemes = themesArr; localStorage.setItem("cur_user", JSON.stringify(currentUser));
  }
}

function getUserActiveTheme(userName) {
  const uKey = (userName || '').toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  return localStorage.getItem(`active_theme_${uKey}`) || (u ? u.activeTheme : null) || (currentUser ? currentUser.activeTheme : null) || 'default';
}

function buySkin(skinId, cost) {
  if (!currentUser) return;
  if (getUserCoins(currentUser.name) >= cost) {
    addCoins(currentUser.name, -cost);
    let themes = getUserUnlockedThemes(currentUser.name);
    if (!themes.includes(skinId)) themes.push(skinId);
    saveUserUnlockedThemes(currentUser.name, themes);
    equipSkin(skinId);
    alert("Nový vzhled byl odemčen a nasazen! 🎨");
  } else alert("Nemáš dostatek zlaťáků! 💰");
}

function equipSkin(skinId) {
  previewingSkin = null; if (!currentUser) return;
  currentUser.activeTheme = skinId;
  localStorage.setItem(`active_theme_${currentUser.name.toLowerCase().trim()}`, skinId);
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  applyAppSkin(skinId); renderScreen();
}

function forceHardReload() { window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now(); }
function cleanCzechTranslation(text) { return text ? text.replace(/\s*\([^)]*r\.\)/gi, '').replace(/\s*\((sg|pl)\.\)/gi, '').trim() : ""; }
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
  return Math.max(u ? Number(u.coins || 0) : 0, Number(localStorage.getItem(`coins_${userName.toLowerCase().trim()}`) || 0));
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
}

window.buyFreeze = function() {
  if (!currentUser) return;
  if (getUserCoins(currentUser.name) >= 20) {
    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
    if (u) { u.coins -= 20; u.inventory = u.inventory || {}; u.inventory["Zmrazeni"] = (u.inventory["Zmrazeni"] || 0) + 1; }
    alert("Úspěšně zakoupeno! 🛒\nPoložka Zmrazeni byla přidána."); renderScreen();
  } else alert("Nemáš dostatek zlaťáků! 💰");
};

function getTodayDateStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
let activeDateStr = getTodayDateStr();

function checkDateRollover() {
  if (getTodayDateStr() !== activeDateStr) {
    activeDateStr = getTodayDateStr(); todaySecondsStudied = 0; lastCloudSyncSec = 0;
    if (currentUser) localStorage.setItem(`study_sec_${activeDateStr}_${currentUser.name.toLowerCase().trim()}`, "0");
    updateStudyTimerUI(); if (typeof renderScreen === "function") renderScreen();
  }
}

function updateFooter() {
  const fUser = document.getElementById("footer-user"); if (fUser) fUser.innerText = currentUser ? `Žák: ${currentUser.name}` : "Žák: --";
  const statusEl = document.getElementById("footer-status"); if (statusEl && statusEl.innerText.includes("Restart")) statusEl.innerText = "v7.1 (OK)";
}

function getUserStreak(userName) { return Number(localStorage.getItem(`streak_${(userName||'').toLowerCase().trim()}`) || 0); }
function updateUserStreak(userName, targetMinutes) { /* Zachována z tvého kódu */ }

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
  if (currentScreen === "PLAYING" && selectedGame === "SNAKE" && typeof snakeState !== "undefined" && snakeState === "PLAYING") lastUserActivityTime = Date.now();
  if (currentScreen === "PLAYING" && currentUser) {
    if (Date.now() - lastUserActivityTime < 15000) {
      todaySecondsStudied++; localStorage.setItem(`study_sec_${activeDateStr}_${currentUser.name.toLowerCase().trim()}`, String(todaySecondsStudied)); isTimerPaused = false;
      if (todaySecondsStudied >= (currentUser.targetMinutes || 15) * 60) updateUserStreak(currentUser.name, currentUser.targetMinutes || 15);
    } else isTimerPaused = true;
  } else isTimerPaused = true;
  updateStudyTimerUI();
}, 1000);

function updateStudyTimerUI() {
  const box = document.getElementById("study-timer"); const footerGoal = document.getElementById("footer-goal");
  if (!box || !currentUser) return;
  const targetSec = (currentUser.targetMinutes || 15) * 60; const isGoalReached = todaySecondsStudied >= targetSec;
  const format = s => `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
  const isPaused = (currentScreen !== "PLAYING" || isTimerPaused);
  if (footerGoal) footerGoal.innerHTML = isGoalReached ? `<span style="color:var(--col-yellow);font-weight:bold;">★ ${Math.floor(todaySecondsStudied/60)} / ${currentUser.targetMinutes} min</span>` : `${Math.floor(todaySecondsStudied/60)} / ${currentUser.targetMinutes} min ⏱️`;
  box.className = "study-timer-box" + (isGoalReached ? " bonus" : "") + (isPaused ? " paused" : "");
  box.innerText = isPaused ? `⏸️ ${format(todaySecondsStudied)} / ${format(targetSec)}` : `⏱️ ${format(todaySecondsStudied)} / ${format(targetSec)}`;
}

async function loadData() {
  checkDateRollover();
  if (currentUser) todaySecondsStudied = Number(localStorage.getItem(`study_sec_${activeDateStr}_${currentUser.name.toLowerCase().trim()}`) || 0);
  const cached = localStorage.getItem("app_data");
  if (cached) { try { appData = JSON.parse(cached); if (!appData.items) appData.items = []; renderScreen(); } catch(e) {} } else renderScreen();
  await syncData();
}

async function syncData() {
  try {
    const res = await fetch(API_URL + '?t=' + Date.now() + '&clientDate=' + getTodayDateStr());
    const json = await res.json();
    if (json && json.items) {
      json.syncDate = getTodayDateStr(); appData = json; localStorage.setItem("app_data", JSON.stringify(json));
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
  } catch(e) { console.error("Offline mód"); }
  renderScreen();
}

function setScreen(scr) { currentScreen = scr; registerUserAction(); renderScreen(); }

function selectUser(name, grade, targetMinutes) {
  checkDateRollover();
  currentUser = { name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0 };
  const foundU = (appData.users || []).find(u => u.name.toLowerCase().trim() === name.toLowerCase().trim());
  if (foundU) { currentUser.coins = Number(foundU.coins || 0); currentUser.activeTheme = getUserActiveTheme(name); }
  localStorage.setItem("cur_user", JSON.stringify(currentUser)); applyAppSkin(currentUser.activeTheme);
  todaySecondsStudied = Number(localStorage.getItem(`study_sec_${activeDateStr}_${name.toLowerCase().trim()}`) || 0);
  isTimerPaused = false; updateStudyTimerUI(); setScreen("SELECT_SUBJECT");
}

function chooseSubject(subj) {
  selectedSubject = subj; const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => it.subject === subj && isItemAllowedForGrade(it, userG));
  if (subj.toLowerCase().includes("cesta")) setScreen("CAMPAIGN_HUB"); else setScreen("SELECT_GROUP");
}

function chooseGroup(groupName) {
  selectedGroupKey = groupName; const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => it.subject === selectedSubject && isItemAllowedForGrade(it, userG) && (viewMode === "LESSONS" ? it.lesson : it.topic) === groupName);
  setScreen("SELECT_GAME");
}

function renderScreen() {
  updateFooter(); updateStudyTimerUI(); 
  if (typeof updateTTSBtnUI === "function") updateTTSBtnUI();
  const main = document.getElementById("main-content");
  const bUser = document.getElementById("badge-user"); const bSubj = document.getElementById("badge-subj"); const bGroup = document.getElementById("badge-group");
  bUser.innerText = currentUser ? currentUser.name : "Uživatel";

  if (currentScreen === "SELECT_USER" || !currentUser) {
    bSubj.style.display = "none"; bGroup.style.display = "none";
    main.innerHTML = `<h2 style="text-align:center;color:var(--col-yellow);">Kdo se jde učit?</h2><div class="grid-2">
      ${(appData.users || []).map(u => `<div class="tile" onclick="selectUser('${u.name}', ${u.grade}, ${u.targetMinutes})"><h2>${u.name}</h2><p>💰 ${u.coins || 0}</p></div>`).join('')}
    </div>`;
  } else if (currentScreen === "SELECT_SUBJECT") {
    bSubj.style.display = "none"; bGroup.style.display = "none";
    const subjs = {}; (appData.items || []).forEach(it => { if (isItemAllowedForGrade(it, currentUser.grade)) subjs[it.subject] = (subjs[it.subject] || 0) + 1; });
    main.innerHTML = `<div class="tile" style="border-color:var(--col-yellow);margin-bottom:10px;" onclick="setScreen('SHOP')"><h2>🛒 Obchod a Vzhledy</h2><p>${getUserCoins(currentUser.name)} 💰</p></div>
      <div class="grid-2"><div class="tile" onclick="openMathOperationSelect()"><h2>🔢 Matematika</h2></div>
      ${Object.keys(subjs).map(s => `<div class="tile" onclick="chooseSubject('${s}')"><h2>${s}</h2><p>${subjs[s]} úloh</p></div>`).join('')}</div>`;
  } else if (currentScreen === "SHOP") {
    bSubj.style.display = "flex"; bSubj.innerText = "🛒 Obchod"; bGroup.style.display = "none";
    main.innerHTML = `<div style="padding:10px;"><button class="action-btn" onclick="buyFreeze()">Koupit zmrazení (20 💰)</button>
      ${APP_SKINS.map(s => `<button class="action-btn" onclick="buySkin('${s.id}', ${s.cost})">${s.name} (${s.cost} 💰)</button>`).join('')}
      <button class="action-btn" style="background:var(--col-card);" onclick="setScreen('SELECT_SUBJECT')">Zpět</button></div>`;
  } else if (currentScreen === "SELECT_GROUP") {
    bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; bGroup.style.display = "none";
    const gMap = {}; activeItems.forEach(it => { const k = viewMode === "LESSONS" ? it.lesson : it.topic; if(k) gMap[k] = (gMap[k] || 0) + 1; });
    main.innerHTML = `<div style="display:flex;flex-direction:column;gap:8px;">${Object.keys(gMap).map(k => `<div class="tile" onclick="chooseGroup('${k}')"><h2>${k}</h2><p>${gMap[k]} úloh</p></div>`).join('')}</div>`;
  } else if (currentScreen === "SELECT_GAME") {
    bSubj.style.display = "flex"; bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    main.innerHTML = `<div class="grid-2">
      <div class="tile" onclick="startGame('CARDS')"><h2>1. Karty</h2></div>
      <div class="tile" style="border-color:var(--col-green);" onclick="startGame('ADAPTIVE')"><h2 style="color:var(--col-green);">2. Zkoušení</h2></div>
      <div class="tile" onclick="startGame('SCRAMBLE')"><h2>3. Skládání</h2></div>
      <div class="tile" onclick="setScreen('SELECT_PEXESO_SIZE')"><h2>🃏 Pexeso</h2></div>
      <div class="tile" style="border-color:#10b981;" onclick="startSnakeGame()"><h2 style="color:#10b981;">🐍 Had</h2></div>
      <div class="tile" style="border-color:var(--col-orange);" onclick="startArcadeGame()"><h2 style="color:var(--col-orange);">☄️ Padající slova</h2></div>
      <div class="tile" onclick="startGame('QUIZ')"><h2>📝 Kvíz</h2></div>
    </div>`;
  } else if (currentScreen === "PLAYING") {
    bSubj.style.display = "flex"; bGroup.style.display = "flex";
    if (typeof renderActiveGame === "function") renderActiveGame();
  }
}

// SPOUŠTĚČ APLIKACE
document.addEventListener("DOMContentLoaded", () => { loadData(); });
