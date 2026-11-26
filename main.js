/**
 * HLAVNÍ JÁDRO APLIKACE (Globální stav, Navigace, Časomíra, PIN)
 */

const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxaxBIXP-ECpWstcqRDw8RuT_ds6UwcplU_3pZ9_-ksELN5FVeGt5EHjjexkJVmx1FR_w/exec";

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('db')) {
  const customDb = urlParams.get('db').trim();
  if (customDb === 'reset' || customDb === 'default') {
    localStorage.removeItem('custom_api_url');
  } else if (customDb.startsWith('http')) {
    localStorage.setItem('custom_api_url', customDb);
    localStorage.removeItem('app_data');
    localStorage.removeItem('cur_user');
  }
  window.history.replaceState({}, document.title, window.location.pathname);
}

const API_URL = localStorage.getItem('custom_api_url') || DEFAULT_API_URL;
const APP_VERSION = "7.7";

let appData = { users: [], progress: {}, items: [], syncDate: "" };
let currentUser = JSON.parse(localStorage.getItem("cur_user") || 'null');
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

function setUserPIN() {
  if (!currentUser) return;
  openPinModal({
    title: "🔐 Ochrana profilu: " + currentUser.name,
    subtitle: "Zadej nové heslo (nech prázdné a potvrď pro zrušení):",
    placeholder: "Nové heslo...",
    maskInput: false,
    onSubmit: (newPin) => {
      const pinStr = newPin.trim();
      const uKey = currentUser.name.toLowerCase().trim();
      const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
      if (u) u.pin = pinStr;
      localStorage.setItem(`user_pin_${uKey}`, pinStr);
      try {
        const fd = new URLSearchParams();
        fd.append("action", "set_pin"); fd.append("user", currentUser.name); fd.append("pin", pinStr);
        fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
      } catch(e) {}
      alert(pinStr ? `Skvělé! Tvé heslo bylo nastaveno na: ${pinStr}` : "Heslo bylo zrušeno. Přístup je volný.");
      if (typeof renderScreen === 'function') renderScreen();
      return true;
    }
  });
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
  const vItems = getVocabItems();
  const s = (selectedSubject || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes("nemc") || s === "de") { if (vItems.filter(it => /^(der|die|das)\s/i.test(it.question)).length >= 3) return "DER_DIE_DAS"; }
  if (s.includes("angli") || s === "en" || s.includes("inteligentn")) { if (vItems.filter(it => /^(a|an)\s/i.test(it.question)).length >= 3) return "A_AN"; }
  if (s.includes("cest") || s === "cs") { if (vItems.filter(it => it.question.includes('_')).length >= 3) return "I_Y"; }
  return null;
}

function isItemAllowedForGrade(it, userG) {
  const subjLow = (it.subject || '').toLowerCase();
  if (subjLow.includes('cesta') || subjLow.includes('postupn') || subjLow.includes('inteligentn')) return true;
  if (userG >= 90) return true;
  return (parseInt(it.minGrade) || 2) === userG;
}

function saveSnakeRecord(length) {
  if (!currentUser) return;
  const currentMax = Number(currentUser.maxSnake || 0);
  if (length > currentMax) {
    currentUser.maxSnake = length;
    localStorage.setItem("cur_user", JSON.stringify(currentUser));

    const uKey = currentUser.name.toLowerCase().trim();
    const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
    if (u) u.maxSnake = length;

    try {
      const fd = new URLSearchParams();
      fd.append("action", "save_snake_record");
      fd.append("user", currentUser.name);
      fd.append("record", length);
      fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
    } catch(e) {}
  }
}

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
  const statusEl = document.getElementById("footer-status");
  if (statusEl) {
    if (appData && Array.isArray(appData.items) && appData.items.length > 0) statusEl.innerText = `OK: ${appData.items.length} úloh`;
    else if (statusEl.innerText.includes("Restart")) statusEl.innerText = `v${APP_VERSION} (OK)`;
  }
}

function getStudyTimeKey(userName) { return `study_sec_${getTodayDateStr()}_${(userName || 'user').toLowerCase().trim()}`; }
function loadUserStudyTime(userName) { if (!userName) return 0; return Number(localStorage.getItem(getStudyTimeKey(userName)) || 0); }

function registerUserAction() {
  checkDateRollover();
  lastUserActivityTime = Date.now();
  if (isTimerPaused) {
    isTimerPaused = false;
    updateStudyTimerUI();
  }
  if (typeof unlockAudioForiOS === "function") {
    unlockAudioForiOS();
  }
}
window.addEventListener('touchstart', registerUserAction, true);
window.addEventListener('touchend', registerUserAction, true);
window.addEventListener('pointerdown', registerUserAction, true);
window.addEventListener('click', registerUserAction, true);
window.addEventListener('keydown', registerUserAction, true);

setInterval(() => {
  checkDateRollover();
  const isJustGame = (currentScreen === "PLAYING" && selectedGame === "SNAKE");

  if (currentScreen === "PLAYING" && currentUser && !isJustGame) {
    const idleTime = Date.now() - lastUserActivityTime;
    if (idleTime < 15000) {
      todaySecondsStudied++;
      localStorage.setItem(getStudyTimeKey(currentUser.name), String(todaySecondsStudied));
      isTimerPaused = false;

      const targetSec = (currentUser.targetMinutes || 15) * 60;
      if (todaySecondsStudied >= targetSec && typeof updateUserStreak === "function") {
        updateUserStreak(currentUser.name, currentUser.targetMinutes || 15);
      }

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
  if (currentScreen === "SHOP" && scr !== "SHOP" && typeof cancelPreview === "function") cancelPreview();
  if (currentScreen === "AVATAR_SHOP" && scr !== "AVATAR_SHOP" && typeof cancelAvatarPreview === "function") cancelAvatarPreview();
  currentScreen = scr; registerUserAction();
  if (typeof hideSystemKeyboard === "function") {
    hideSystemKeyboard();
    setTimeout(hideSystemKeyboard, 80);
  }
  if (typeof renderScreen === 'function') renderScreen();
}

function selectUser(name, grade, targetMinutes) {
  const uKey = name.toLowerCase().trim();
  const foundU = (appData.users || []).find(u => u.name.toLowerCase().trim() === uKey);
  const savedPin = (foundU && foundU.pin !== undefined) ? foundU.pin : localStorage.getItem("user_pin_" + uKey);

  if (savedPin && savedPin !== "") {
    openPinModal({
      title: "🔒 Profil: " + name,
      subtitle: "Profil je chráněn. Zadej heslo:",
      placeholder: "Heslo...",
      maskInput: true,
      onSubmit: (inputPin) => {
        if (inputPin.trim() !== String(savedPin).trim()) {
          return "Nesprávné heslo!";
        }
        completeSelectUser(name, grade, targetMinutes);
        return true;
      }
    });
    return;
  }
  completeSelectUser(name, grade, targetMinutes);
}

function completeSelectUser(name, grade, targetMinutes) {
  const uKey = name.toLowerCase().trim();
  const foundU = (appData.users || []).find(u => u.name.toLowerCase().trim() === uKey);
  checkDateRollover();
  const themesArr = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(name) : ['default'];
  const activeTh = typeof getUserActiveTheme === 'function' ? getUserActiveTheme(name) : 'default';
  currentUser = {
    name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0,
    startLevels: (foundU && foundU.startLevels) ? foundU.startLevels : {},
    inventory: (foundU && foundU.inventory) ? foundU.inventory : {},
    unlockedThemes: themesArr, activeTheme: activeTh, coins: foundU ? Number(foundU.coins || 0) : 0,
    maxSnake: foundU ? Number(foundU.maxSnake || 0) : 0, xp: foundU ? Number(foundU.xp || 0) : 0,
    weeklyXp: foundU ? Number(foundU.weeklyXp || 0) : 0
  };
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  if (typeof applyAppSkin === 'function') applyAppSkin(currentUser.activeTheme);

  let localSec = loadUserStudyTime(currentUser.name);
  let cloudSec = (foundU && appData.syncDate === getTodayDateStr()) ? Math.round(Number(foundU.todayMinutes || 0) * 60) : 0;
  todaySecondsStudied = Math.max(localSec, cloudSec);
  localStorage.setItem(getStudyTimeKey(currentUser.name), String(todaySecondsStudied));

  lastCloudSyncSec = todaySecondsStudied;
  isTimerPaused = false;
  updateStudyTimerUI();
  setScreen("SELECT_SUBJECT");
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
  if (sItems.length === 1) { selectedSeqIndex = 0; if (typeof startGame === 'function') startGame('SEQ'); }
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

document.addEventListener("DOMContentLoaded", () => { if (typeof loadData === 'function') loadData(); });
