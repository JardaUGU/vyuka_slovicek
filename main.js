/**
 * HLAVNÍ JÁDRO APLIKACE (Globální data, Zabezpečení, Ekologie, Časomíra)
 */
/**
 * AUTOMATICKÉ PŘEPÍNÁNÍ DATABÁZE (Pro kolegy a více tříd/rodin)
 * - Tvůj výchozí odkaz funguje bez parametrů.
 * - Kolega otevře odkaz s parametrem ?db=JEHO_URL (stačí jednou, uloží se do localStorage).
 */
const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxaxBIXP-ECpWstcqRDw8RuT_ds6UwcplU_3pZ9_-ksELN5FVeGt5EHjjexkJVmx1FR_w/exec";

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has('db')) {
  const customDb = urlParams.get('db').trim();
  if (customDb === 'reset' || customDb === 'default') {
    localStorage.removeItem('custom_api_url');
  } else if (customDb.startsWith('http')) {
    localStorage.setItem('custom_api_url', customDb);
    // Vymažeme starou cache z předchozí databáze
    localStorage.removeItem('app_data');
    localStorage.removeItem('cur_user');
  }
  // Očistíme adresní řádek, aby tam nestrašil dlouhý odkaz
  window.history.replaceState({}, document.title, window.location.pathname);
}

const API_URL = localStorage.getItem('custom_api_url') || DEFAULT_API_URL;
const APP_VERSION = "7.4";

let appData = { users: [], progress: {}, items: [], syncDate: "" };
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
applyAppSkin('default');

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
  } else { alert("Nemáš dostatek zlaťáků! 🪙"); }
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
  const vItems = getVocabItems(); const s = (selectedSubject || '').toLowerCase();
  if (s.includes("nemc") || s === "de") { if (vItems.filter(it => /^(der|die|das)\s/i.test(it.question)).length >= 3) return "DER_DIE_DAS"; }
  if (s.includes("angli") || s === "en" || s.includes("inteligentn")) { if (vItems.filter(it => /^(a|an)\s/i.test(it.question)).length >= 3) return "A_AN"; }
  if (s.includes("cest") || s === "cs") { if (vItems.filter(it => it.question.includes('_')).length >= 3) return "I_Y"; }
  return null;
}

function isItemAllowedForGrade(it, userG) {
  const subjLow = (it.subject || '').toLowerCase();
  // Kampaně (Cesty) mají vlastní řízení postupu podle lekcí
  if (subjLow.includes('cesta') || subjLow.includes('postupn') || subjLow.includes('inteligentn')) return true;
  
  // Dospělý (třída >= 90) vidí vždy všechny ročníky
  if (userG >= 90) return true;

  // Žáci vidí striktně pouze úlohy určené pro jejich třídu (MinTrida === Trida žáka)
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
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const lowKey = String(itemKey || '').toLowerCase();
  if (u && u.inventory) {
    if (u.inventory[itemKey] !== undefined) return Number(u.inventory[itemKey]);
    if (u.inventory[lowKey] !== undefined) return Number(u.inventory[lowKey]);
  }
  return Number(localStorage.getItem(`item_${itemKey}_${uKey}`) || 0);
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
      const prevInv = Number(u.inventory[itemKey] ?? u.inventory[itemKey.toLowerCase()]) || 0;
      u.inventory[itemKey] = prevInv + 1;
      u.inventory[itemKey.toLowerCase()] = prevInv + 1;
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
  } else { alert("Nemáš dostatek zlaťáků! 🪙"); }
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
function parseDateOnlyStr(val) {
  if (!val) return "";
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    if (s.length > 10 && s.includes('T') && s.endsWith('Z')) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    return s.slice(0, 10);
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return "";
}

function getUserStreak(userName) { 
  if (!userName) return 0;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const cloudStreak = (u && u.streak !== undefined) ? Number(u.streak) : 0;
  const cloudLast = (u && u.streakLastDate) ? parseDateOnlyStr(u.streakLastDate) : "";
  const localStreak = Number(localStorage.getItem(`streak_${uKey}`) || 0);
  const localLast = parseDateOnlyStr(localStorage.getItem(`streak_last_date_${uKey}`) || "");

  if (localLast && (!cloudLast || localLast > cloudLast)) return localStreak;
  if (cloudLast) return cloudStreak;
  return Math.max(cloudStreak, localStreak);
}

function getUserStreakStatus(userName) {
  const todayStr = getTodayDateStr();
  if (!userName) return { rawStreak: 0, effectiveStreak: 0, state: 'NONE', missedDays: 0, freezes: 0, lastCompleted: '', days: [], message: '' };

  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);

  const cloudStreak = (u && u.streak !== undefined) ? Number(u.streak) : 0;
  const cloudLast = (u && u.streakLastDate) ? parseDateOnlyStr(u.streakLastDate) : "";
  const localStreak = Number(localStorage.getItem(`streak_${uKey}`) || 0);
  const localLast = parseDateOnlyStr(localStorage.getItem(`streak_last_date_${uKey}`) || "");

  let rawStreak = 0;
  let lastCompleted = "";
  if (localLast && (!cloudLast || localLast > cloudLast)) {
    rawStreak = localStreak;
    lastCompleted = localLast;
  } else if (cloudLast) {
    rawStreak = cloudStreak;
    lastCompleted = cloudLast;
  } else {
    rawStreak = Math.max(cloudStreak, localStreak);
  }

  const targetMin = (u && u.targetMinutes) ? Number(u.targetMinutes) : ((currentUser && currentUser.name.toLowerCase().trim() === uKey) ? Number(currentUser.targetMinutes || 15) : 15);
  const freezes = getUserItemCount(userName, "Zmrazeni");

  const cloudDaily = (u && u.dailyHistory) ? u.dailyHistory : {};
  const cloudFreezeDates = (u && Array.isArray(u.streakFreezeDates)) ? u.streakFreezeDates : [];
  let localFreezeDates = [];
  try { localFreezeDates = JSON.parse(localStorage.getItem(`freeze_dates_${uKey}`) || '[]'); } catch(e) {}
  const freezeDatesSet = new Set([...cloudFreezeDates, ...localFreezeDates]);

  const localTodayMin = loadUserStudyTime(userName) / 60;
  const cloudTodayMin = (u && appData.syncDate === todayStr) ? Number(u.todayMinutes || 0) : 0;
  const todayMin = Math.max(localTodayMin, cloudTodayMin);
  const isTodayDone = (todayMin >= targetMin) || (lastCompleted === todayStr);

  let diffDays = 0;
  let missedDays = 0;
  let effectiveStreak = rawStreak;
  let state = 'NONE';
  let message = '';

  if (lastCompleted && rawStreak > 0) {
    const lastD = new Date(lastCompleted + "T12:00:00Z");
    const todayD = new Date(todayStr + "T12:00:00Z");
    diffDays = Math.round((todayD - lastD) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      state = 'DONE_TODAY';
      message = `Skvělé! Dnešní cíl je splněn (${rawStreak} dní v řadě).`;
    } else if (diffDays === 1) {
      state = 'ACTIVE_PENDING';
      message = `Držíš sérii ${rawStreak} dní. Splň dnes ${targetMin} min a posuň ji na ${rawStreak + 1}!`;
    } else {
      missedDays = diffDays - 1;
      if (freezes >= missedDays) {
        state = 'FREEZABLE';
        effectiveStreak = rawStreak;
        message = `🧊 Vynechal(a) jsi ${missedDays} ${missedDays === 1 ? 'den' : (missedDays < 5 ? 'dny' : 'dní')}. Splň dnes ${targetMin} min a série ${rawStreak} dní se zachrání pomocí ${missedDays}× 🧊!`;
      } else {
        state = 'BROKEN';
        effectiveStreak = 0;
        message = `💔 Vynechal(a) jsi ${missedDays} ${missedDays === 1 ? 'den' : (missedDays < 5 ? 'dny' : 'dní')} bez dostatku zmrazení. Série ${rawStreak} dní skončila – dnes začni novou!`;
      }
    }
  } else {
    state = 'NONE';
    effectiveStreak = 0;
    message = `Splň dnes ${targetMin} minut studia a začni svou sérii! 🔥`;
  }

  const dayNames = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
  const todayD = new Date(todayStr + "T12:00:00Z");
  const allHistoryDates = Object.keys(cloudDaily).filter(d => Number(cloudDaily[d]) > 0);
  const earliestActivity = allHistoryDates.length > 0 ? allHistoryDates.sort()[0] : "";

  const days = [];
  for (let offset = -6; offset <= 0; offset++) {
    const dObj = new Date(todayD.getTime() + offset * 24 * 60 * 60 * 1000);
    const dStr = dObj.toISOString().slice(0, 10);
    const label = (offset === 0) ? 'Dnes' : dayNames[dObj.getUTCDay()];
    const mins = (dStr === todayStr) ? todayMin : Number(cloudDaily[dStr] || 0);

    let dState = 'EMPTY';
    if (mins >= targetMin || (dStr === lastCompleted && rawStreak > 0)) {
      dState = 'DONE';
    } else if (freezeDatesSet.has(dStr)) {
      dState = 'FREEZE';
    } else if (dStr === todayStr) {
      dState = 'TODAY_PENDING';
    } else if (lastCompleted && dStr > lastCompleted && dStr < todayStr) {
      dState = (state === 'FREEZABLE') ? 'PENDING_FREEZE' : 'MISSED';
    } else if (earliestActivity && dStr >= earliestActivity) {
      dState = 'MISSED';
    }

    const minuteLabel = (mins > 0 && mins < 1) ? '<1m' : `${Math.floor(mins)}m`;
    days.push({ dateStr: dStr, label: label, minutes: Math.floor(mins), minuteLabel: minuteLabel, targetMin: targetMin, state: dState });
  }

  return { rawStreak, effectiveStreak, state, missedDays, freezes, lastCompleted, isTodayDone, days, message };
}

function updateUserStreak(userName, targetMinutes) {
  if (!userName) return;
  const uKey = userName.toLowerCase().trim(); 
  const todayStr = getTodayDateStr();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);

  let cloudLast = (u && u.streakLastDate) ? parseDateOnlyStr(u.streakLastDate) : "";
  let localLast = parseDateOnlyStr(localStorage.getItem(`streak_last_date_${uKey}`) || "");
  let lastCompleted = (cloudLast && (!localLast || cloudLast > localLast)) ? cloudLast : localLast;

  if (lastCompleted === todayStr) return;

  let streak = getUserStreak(userName);

  if (lastCompleted) {
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
       if (u && u.inventory) {
          u.inventory["Zmrazeni"] = newFreezeCount;
          u.inventory["zmrazeni"] = newFreezeCount;
        }

        // Zápis zachráněných dnů i lokálně pro okamžité zobrazení v kalendáři
        let localFreezeDates = [];
        try { localFreezeDates = JSON.parse(localStorage.getItem(`freeze_dates_${uKey}`) || '[]'); } catch(e) {}
        for (let d = 1; d <= missedDays; d++) {
          const mdStr = new Date(lastDate.getTime() + d * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
          if (!localFreezeDates.includes(mdStr)) localFreezeDates.push(mdStr);
        }
        localStorage.setItem(`freeze_dates_${uKey}`, JSON.stringify(localFreezeDates));
        if (u) u.streakFreezeDates = [...new Set([...(u.streakFreezeDates || []), ...localFreezeDates])];

        streak += 1; 
        alert(`🧊 Tvoje série byla zachráněna! Spotřebováno zmrazení: ${missedDays}x`);
      } else { 
        streak = 1; 
        alert("Tvá denní série byla přerušena, protože jsi neměl dostatek zmrazení na všechny vynechané dny."); 
      }
    } else {
      streak = Math.max(1, streak);
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
  if (typeof sendTimeHeartbeatToGoogle === "function") sendTimeHeartbeatToGoogle();
}

function registerUserAction() {
  checkDateRollover();
  lastUserActivityTime = Date.now();
  if (isTimerPaused) {
    isTimerPaused = false;
    updateStudyTimerUI();
  }
  // Okamžitě odemkne a probudí zvuk i TTS na iPhonu / iPadu
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
  if (currentScreen === "AVATAR_SHOP" && scr !== "AVATAR_SHOP" && typeof cancelAvatarPreview === "function") cancelAvatarPreview();
  currentScreen = scr; registerUserAction(); 
  hideSystemKeyboard();
  setTimeout(hideSystemKeyboard, 80);
  if(typeof renderScreen==='function') renderScreen(); 
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
  const themesArr = typeof getUserUnlockedThemes==='function'?getUserUnlockedThemes(name):[]; 
  const activeTh = typeof getUserActiveTheme==='function'?getUserActiveTheme(name):'default';
  currentUser = { 
    name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0,
    startLevels: (foundU && foundU.startLevels) ? foundU.startLevels : {},
    inventory: (foundU && foundU.inventory) ? foundU.inventory : {},
    unlockedThemes: themesArr, activeTheme: activeTh, coins: foundU ? Number(foundU.coins || 0) : 0,
    maxSnake: foundU ? Number(foundU.maxSnake || 0) : 0, xp: foundU ? Number(foundU.xp || 0) : 0,
    weeklyXp: foundU ? Number(foundU.weeklyXp || 0) : 0
  };
  localStorage.setItem("cur_user", JSON.stringify(currentUser)); 
  if(typeof applyAppSkin==='function') applyAppSkin(currentUser.activeTheme);
  
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

// =========================================================================
// GAMIFIKACE: EFEKTY A VIZUÁLNÍ ODMĚNY
// =========================================================================

// Sledování poslední pozice kliknutí (abychom věděli, odkud má vyletět +1)
window.lastClickX = window.innerWidth / 2;
window.lastClickY = window.innerHeight / 2;
window.addEventListener('pointerdown', (e) => {
    window.lastClickX = e.clientX;
    window.lastClickY = e.clientY;
}, true);

// Zobrazí plovoucí text (+1 ★) v místě posledního dotyku
function showFloatingPoint(text = "+1 ★") {
    // V Pexesu, Příběhu a Hadovi to ruší, tam to vynecháme
    if (selectedGame === "PEXESO" || selectedGame === "STORY" || selectedGame === "SNAKE") return;

    const el = document.createElement("div");
    el.className = "floating-point";
    el.innerText = text;
    el.style.left = window.lastClickX + "px";
    el.style.top = window.lastClickY + "px";
    document.body.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 850);
}

// Minimalistický Confetti engine (Canvas)
function triggerConfetti() {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'confetti-canvas';
        document.body.appendChild(canvas);
    }
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    
    const particles = [];
    const colors = ['#22c55e', '#3b82f6', '#facc15', '#ef4444', '#a855f7'];
    
    for (let i = 0; i < 80; i++) {
        particles.push({
            x: canvas.width / 2,
            y: canvas.height / 2 + 50,
            r: Math.random() * 6 + 4,
            dx: Math.random() * 10 - 5,
            dy: Math.random() * -10 - 5,
            color: colors[Math.floor(Math.random() * colors.length)]
        });
    }

    let frame = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let active = false;
        particles.forEach(p => {
            p.x += p.dx;
            p.y += p.dy;
            p.dy += 0.4; // Gravitace
            if (p.y < canvas.height) active = true;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        frame++;
        if (active && frame < 150) requestAnimationFrame(animate);
        else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    animate();
}

function hideSystemKeyboard() {
  try {
    if (document.activeElement && typeof document.activeElement.blur === "function") {
      document.activeElement.blur();
    }
    if (navigator.virtualKeyboard && typeof navigator.virtualKeyboard.hide === "function") {
      navigator.virtualKeyboard.hide();
    }
  } catch (e) {}
}

function getMondayDateStrClient() {
  const todayStr = getTodayDateStr();
  const d = new Date(todayStr + "T12:00:00Z");
  const day = d.getUTCDay();
  const diffToMon = (day === 0) ? -6 : (1 - day);
  return new Date(d.getTime() + diffToMon * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getLevelInfo(totalXp) {
  let xp = Math.max(0, Number(totalXp) || 0);
  let level = 1;
  let need = 250 * level;
  while (xp >= need) {
    xp -= need;
    level++;
    need = 250 * level;
  }
  const pct = Math.min(100, Math.round((xp / need) * 100));
  return { level, currentLevelXp: xp, nextLevelXp: need, pct, totalXp: Math.max(0, Number(totalXp) || 0) };
}

function getStreakXpInfo(userName) {
  const st = (typeof getUserStreakStatus === "function") ? getUserStreakStatus(userName) : { effectiveStreak: 0 };
  const s = st.effectiveStreak || 0;
  if (s >= 14) return { multiplier: 1.5, bonusPct: 50, streak: s };
  if (s >= 7)  return { multiplier: 1.3, bonusPct: 30, streak: s };
  if (s >= 3)  return { multiplier: 1.15, bonusPct: 15, streak: s };
  return { multiplier: 1.0, bonusPct: 0, streak: s };
}

function getUserXp(userName) {
  if (!userName) return 0;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const cloudXp = u ? Number(u.xp || 0) : 0;
  const localXp = Number(localStorage.getItem(`xp_${uKey}`) || 0);
  return Math.max(cloudXp, localXp);
}

function getUserWeeklyXp(userName) {
  if (!userName) return 0;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const cloudW = u ? Number(u.weeklyXp || 0) : 0;
  const monStr = getMondayDateStrClient();
  const localStart = localStorage.getItem(`weekly_xp_start_${uKey}`) || "";
  const localW = (localStart === monStr) ? Number(localStorage.getItem(`weekly_xp_${uKey}`) || 0) : 0;
  return Math.max(cloudW, localW);
}

function showLevelUpToast(newLevel) {
  if (typeof triggerConfetti === "function") triggerConfetti();
  const existing = document.getElementById("level-up-toast");
  if (existing) existing.remove();
  const el = document.createElement("div");
  el.id = "level-up-toast";
  el.className = "level-up-toast";
  el.innerHTML = `🎉 <b>LEVEL UP!</b> Dosáhl(a) jsi <b>Úrovně ${newLevel}</b>! ⚡`;
  document.body.appendChild(el);
  setTimeout(() => { if (el.parentNode) el.remove(); }, 3400);
}

function addLocalXp(userName, xpGain) {
  if (!userName || !xpGain || xpGain <= 0) return;
  const uKey = userName.toLowerCase().trim();
  const oldLvl = getLevelInfo(getUserXp(userName)).level;

  const newTotal = getUserXp(userName) + xpGain;
  const monStr = getMondayDateStrClient();
  const newWeekly = getUserWeeklyXp(userName) + xpGain;

  localStorage.setItem(`xp_${uKey}`, String(newTotal));
  localStorage.setItem(`weekly_xp_${uKey}`, String(newWeekly));
  localStorage.setItem(`weekly_xp_start_${uKey}`, monStr);

  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) { u.xp = newTotal; u.weeklyXp = newWeekly; }
  if (currentUser && currentUser.name.toLowerCase().trim() === uKey) {
    currentUser.xp = newTotal;
    currentUser.weeklyXp = newWeekly;
    localStorage.setItem("cur_user", JSON.stringify(currentUser));
  }

  const newLvl = getLevelInfo(newTotal).level;
  if (newLvl > oldLvl) showLevelUpToast(newLvl);
}
const AVATAR_CATEGORIES = [
  { id: 'base', label: '🧑 Postava' },
  { id: 'hat', label: '👑 Čepice' },
  { id: 'glasses', label: '😎 Brýle' },
  { id: 'outfit', label: '🦸 Oblek' },
  { id: 'pet', label: '🐉 Doplněk' },
  { id: 'bg', label: '🌌 Pozadí' }
];

const AVATAR_ITEMS = [
  // Postavy
  { id: 'base_boy', slot: 'base', name: 'Kluk', cost: 0 },
  { id: 'base_girl', slot: 'base', name: 'Holka', cost: 0 },
  { id: 'base_cat', slot: 'base', name: 'Kočka 🐱', cost: 30 },
  { id: 'base_robot', slot: 'base', name: 'Robot 🤖', cost: 45 },
  { id: 'base_alien', slot: 'base', name: 'Mimozemšťan 👾', cost: 55 },
  // Čepice
  { id: 'hat_cap', slot: 'hat', name: 'Kšiltovka 🧢', cost: 20 },
  { id: 'hat_headphones', slot: 'hat', name: 'Sluchátka 🎧', cost: 30 },
  { id: 'hat_viking', slot: 'hat', name: 'Vikingská helma', cost: 45 },
  { id: 'hat_wizard', slot: 'hat', name: 'Čaroděj 🧙', cost: 55 },
  { id: 'hat_crown', slot: 'hat', name: 'Zlatá koruna 👑', cost: 80 },
  // Brýle
  { id: 'gl_nerd', slot: 'glasses', name: 'Chytré brýle 🤓', cost: 15 },
  { id: 'gl_sun', slot: 'glasses', name: 'Sluneční 😎', cost: 25 },
  { id: 'gl_pirate', slot: 'glasses', name: 'Pirátská páska 🏴‍☠️', cost: 30 },
  { id: 'gl_visor', slot: 'glasses', name: 'Kyber-vizor', cost: 50 },
  // Oblečení
  { id: 'outfit_tee', slot: 'outfit', name: 'Modré triko', cost: 0 },
  { id: 'outfit_bolt', slot: 'outfit', name: 'Triko Blesk ⚡', cost: 20 },
  { id: 'outfit_hoodie', slot: 'outfit', name: 'Zelená mikina', cost: 25 },
  { id: 'outfit_armor', slot: 'outfit', name: 'Rytířské brnění', cost: 50 },
  { id: 'outfit_cape', slot: 'outfit', name: 'Superhrdina 🦸', cost: 60 },
  // Doplňky / Mazlíčci
  { id: 'pet_ball', slot: 'pet', name: 'Fotbalový míč ⚽', cost: 20 },
  { id: 'pet_sword', slot: 'pet', name: 'Rytířský meč ⚔️', cost: 35 },
  { id: 'pet_wand', slot: 'pet', name: 'Kouzelná hůlka ✨', cost: 40 },
  { id: 'pet_rocket', slot: 'pet', name: 'Mini-raketa 🚀', cost: 50 },
  { id: 'pet_dragon', slot: 'pet', name: 'Mini-drak 🐉', cost: 75 },
  // Pozadí
  { id: 'bg_space', slot: 'bg', name: 'Noční vesmír', cost: 0 },
  { id: 'bg_forest', slot: 'bg', name: 'Zelený les', cost: 15 },
  { id: 'bg_lava', slot: 'bg', name: 'Sopečná láva', cost: 30 },
  { id: 'bg_gold', slot: 'bg', name: 'Zlatá záře', cost: 60 }
];

let avatarShopTab = 'hat';
let avatarPreviewEquip = null;

function parseAvatarEquipStr(str) {
  const res = { base: 'base_boy', bg: 'bg_space', outfit: 'outfit_tee', hat: '', glasses: '', pet: '' };
  if (!str) return res;
  String(str).split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k in res) res[k] = v;
    }
  });
  return res;
}

function serializeAvatarEquip(obj) {
  return ['base', 'bg', 'outfit', 'hat', 'glasses', 'pet']
    .map(k => `${k}=${(obj && obj[k]) ? obj[k] : ''}`)
    .join(';');
}

function getUserAvatarItems(userName) {
  const defaults = ['base_boy', 'base_girl', 'bg_space', 'outfit_tee'];
  if (!userName) return defaults;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const cloud = (u && Array.isArray(u.avatarItems)) ? u.avatarItems : [];
  let local = [];
  try { local = JSON.parse(localStorage.getItem(`av_items_${uKey}`) || '[]'); } catch(e) {}
  return [...new Set([...defaults, ...cloud, ...local])];
}

function getUserAvatarEquip(userName) {
  if (!userName) return parseAvatarEquipStr('');
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const localStr = localStorage.getItem(`av_equip_${uKey}`);
  const cloudStr = u ? (u.avatarEquipStr || '') : '';
  return parseAvatarEquipStr(localStr !== null ? localStr : cloudStr);
}

function previewAvatarItem(slot, itemId) {
  if (!currentUser) return;
  const baseEq = avatarPreviewEquip ? { ...avatarPreviewEquip } : getUserAvatarEquip(currentUser.name);
  baseEq[slot] = itemId;
  avatarPreviewEquip = baseEq;
  if (typeof renderScreen === "function") renderScreen();
}

function cancelAvatarPreview() {
  avatarPreviewEquip = null;
}

function equipAvatarItem(slot, itemId) {
  if (!currentUser) return;
  avatarPreviewEquip = null;
  const uKey = currentUser.name.toLowerCase().trim();
  const eq = getUserAvatarEquip(currentUser.name);
  eq[slot] = itemId;
  const eqStr = serializeAvatarEquip(eq);

  localStorage.setItem(`av_equip_${uKey}`, eqStr);
  localStorage.setItem(`av_ts_${uKey}`, String(Date.now()));
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.avatarEquipStr = eqStr;

  try {
    const fd = new URLSearchParams();
    fd.append("action", "equip_avatar");
    fd.append("user", currentUser.name);
    fd.append("equipStr", eqStr);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
  if (typeof renderScreen === "function") renderScreen();
}

function buyAvatarItem(itemId) {
  if (!currentUser) return;
  const item = AVATAR_ITEMS.find(x => x.id === itemId);
  if (!item) return;

  const coins = getUserCoins(currentUser.name);
  if (coins < item.cost) { alert("Nemáš dostatek mincí! 🪙"); return; }

  const uKey = currentUser.name.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.coins = Math.max(0, Number(u.coins || 0) - item.cost);
  currentUser.coins = u ? u.coins : Math.max(0, coins - item.cost);
  localStorage.setItem(`coins_${uKey}`, String(currentUser.coins));

  const owned = getUserAvatarItems(currentUser.name);
  if (!owned.includes(item.id)) owned.push(item.id);
  localStorage.setItem(`av_items_${uKey}`, JSON.stringify(owned));
  if (u) u.avatarItems = owned;

  avatarPreviewEquip = null;
  const eq = getUserAvatarEquip(currentUser.name);
  eq[item.slot] = item.id;
  const eqStr = serializeAvatarEquip(eq);
  localStorage.setItem(`av_equip_${uKey}`, eqStr);
  localStorage.setItem(`av_ts_${uKey}`, String(Date.now()));
  if (u) u.avatarEquipStr = eqStr;
  localStorage.setItem("cur_user", JSON.stringify(currentUser));

  if (typeof sndFanfare === "function") sndFanfare();
  try {
    const fd = new URLSearchParams();
    fd.append("action", "buy_avatar_item");
    fd.append("user", currentUser.name);
    fd.append("itemId", item.id);
    fd.append("cost", item.cost);
    fd.append("equipStr", eqStr);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
  if (typeof renderScreen === "function") renderScreen();
}
function openPinModal({ title, subtitle, placeholder, maskInput, onSubmit }) {
  const prev = document.getElementById("pin-modal-overlay");
  if (prev) prev.remove();

  const overlay = document.createElement("div");
  overlay.id = "pin-modal-overlay";
  overlay.className = "streak-modal-backdrop";

  overlay.innerHTML = `
    <div class="streak-modal-card" onclick="event.stopPropagation()">
      <h3 style="text-align:center;color:var(--col-yellow);margin-bottom:6px;">${title}</h3>
      <p style="text-align:center;font-size:13px;color:var(--col-text-muted);margin-bottom:12px;">${subtitle}</p>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <input id="pin-modal-input" type="${maskInput ? 'password' : 'text'}"
               autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
               placeholder="${placeholder || ''}"
               style="flex:1;min-width:0;padding:11px 12px;font-size:18px;border-radius:8px;border:2px solid var(--col-active-tab);background:var(--col-card);color:var(--col-text);user-select:text;-webkit-user-select:text;" />
        <button id="pin-modal-eye" type="button" class="toggle-btn" style="padding:11px 12px;font-size:18px;" title="Zobrazit/skrýt">👁️</button>
      </div>
      <div id="pin-modal-error" style="color:var(--col-red);font-size:13px;font-weight:bold;text-align:center;min-height:18px;margin-bottom:8px;"></div>
      <div class="grid-2">
        <button id="pin-modal-cancel" type="button" class="action-btn" style="margin-top:0;background:var(--col-card-alt);">Zrušit</button>
        <button id="pin-modal-ok" type="button" class="action-btn green" style="margin-top:0;">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const inp = document.getElementById("pin-modal-input");
  const errEl = document.getElementById("pin-modal-error");
  const eyeBtn = document.getElementById("pin-modal-eye");

  const closeModal = () => {
    if (inp) {
      inp.readOnly = true;
      inp.disabled = true;
      inp.blur();
    }
    hideSystemKeyboard();
    setTimeout(hideSystemKeyboard, 100);
    if (overlay.parentNode) overlay.remove();
  };

  overlay.onclick = closeModal;
  document.getElementById("pin-modal-cancel").onclick = closeModal;

  eyeBtn.onclick = () => {
    inp.type = (inp.type === "password") ? "text" : "password";
  };

  const handleConfirm = () => {
    const res = onSubmit(inp.value);
    if (res === true) {
      closeModal();
    } else {
      errEl.innerText = res || "Neplatné heslo!";
      inp.select();
    }
  };

  document.getElementById("pin-modal-ok").onclick = handleConfirm;
  inp.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); handleConfirm(); }
  });

  setTimeout(() => { try { inp.focus(); } catch(e) {} }, 60);
}
