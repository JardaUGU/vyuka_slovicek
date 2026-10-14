/**
 * JÁDRO APLIKACE, ČASOVAČ, SYNCHRONIZACE, ROČNÍKOVÉ FILTRY A VÝSLOVNOST PRO SAFARI
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
let testingDirection = localStorage.getItem("testing_dir") || "DIR_OUT";

function forceHardReload() {
  window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
}

function cleanCzechTranslation(text) {
  if (!text) return "";
  return text.replace(/\s*\([^)]*r\.\)/gi, '').replace(/\s*\((sg|pl)\.\)/gi, '').trim();
}

// --- POMOCNÉ FILTRAČNÍ FUNKCE ---
function getVocabItems() { return (activeItems || []).filter(it => it.type === "SLOVO"); }
function getQuizItems()  { return (activeItems || []).filter(it => it.type === "KVIZ"); }
function getSeqItems()   { return (activeItems || []).filter(it => it.type === "RADA"); }

function getAdaptiveWindowSize(grade) {
  const g = parseInt(grade) || 2;
  if (g >= 90) return 12;
  if (g >= 10) return 10;
  return Math.max(3, g);
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
  if (s.includes("angli") || s === "en") {
    if (vItems.filter(it => /^(a|an)\s/i.test(it.question)).length >= 3) return "A_AN";
  }
  if (s.includes("cest") || s === "cs") {
    if (vItems.filter(it => it.question.includes('_')).length >= 3) return "I_Y";
  }
  return null;
}

// Výjimka ze specifikace: Nepravidelná slovesa vidí 5. třída i všechny vyšší ročníky
function isItemAllowedForGrade(it, userG) {
  const itemG = parseInt(it.minGrade) || 2;
  const isVerbGroup = (it.lesson || '').toLowerCase().includes('sloves') || (it.topic || '').toLowerCase().includes('sloves');
  if (isVerbGroup && userG >= 5) return true;

  if (!filterExactGradeOnly || userG >= 90) return true;
  return itemG === userG;
}

// --- ČASOVAČ & STREAK ---
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

  if (lastCompleted === yestStr) streak += 1;
  else streak = 1;

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

// Přísná pauza po 15 s nečinnosti + odeslání času do cloudu každých 45 s
setInterval(() => {
  if (currentScreen === "PLAYING" && currentUser) {
    const idleTime = Date.now() - lastUserActivityTime;
    if (idleTime < 15000) {
      todaySecondsStudied++;
      localStorage.setItem(getStudyTimeKey(currentUser.name), todaySecondsStudied);
      isTimerPaused = false;

      const targetSec = (currentUser.targetMinutes || 15) * 60;
      if (todaySecondsStudied >= targetSec) {
        updateUserStreak(currentUser.name, currentUser.targetMinutes || 15);
      }

      // Synchronizace času do Google Sheets každých 45 sekund čistého studia
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

// Bonusový čas je viditelný VŽDY po dosažení limitu (i v pauze a v menu)
function updateStudyTimerUI() {
  const box = document.getElementById("study-timer");
  const footerGoal = document.getElementById("footer-goal");
  if (!box || !currentUser) return;

  const targetSec = (currentUser.targetMinutes || 15) * 60;
  const isGoalReached = todaySecondsStudied >= targetSec;
  const bonusSec = Math.max(0, todaySecondsStudied - targetSec);

  const format = s => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

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

// Odeslání času do Google Sheets
function sendTimeHeartbeatToGoogle() {
  if (!currentUser) return;
  try {
    const fd = new URLSearchParams();
    fd.append("action", "log_activity");
    fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject || "Výuka");
    fd.append("section", "Časomíra");
    fd.append("stars", 0);
    fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

// --- VÝSLOVNOST (TTS) PRO SAFARI NA IPHONE SE ---
let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];

function updateVoices() {
  if ('speechSynthesis' in window) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedVoices = v;
  }
}
if ('speechSynthesis' in window) {
  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

function toggleAutoTTS() { 
  isAutoTTS = !isAutoTTS; 
  localStorage.setItem("auto_tts", isAutoTTS); 
  updateTTSBtnUI(); 
}

function updateTTSBtnUI() {
  const btn = document.getElementById("btn-tts-auto");
  if (btn) { 
    btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn"; 
    btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp"; 
  }
}

function getTargetLang(subjectName) {
  const s = (subjectName || selectedSubject || '')
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (s.includes('angli') || s === 'en') return 'en-US';
  if (s.includes('nemc') || s === 'de') return 'de-DE';
  if (s.includes('hebr') || s === 'he') return 'he-IL';
  return 'cs-CZ';
}

function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  const toSpeak = text.replace(/\//g, ' or ').replace(/-/g, ', ');
  const u = new SpeechSynthesisUtterance(toSpeak);
  const targetLang = getTargetLang(subjectName);
  const langPrefix = targetLang.split('-')[0];

  u.lang = targetLang;
  u.rate = 0.86;

  if (cachedVoices.length === 0) updateVoices();
  let voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();

  if ((!voices || voices.length === 0) && 'speechSynthesis' in window) {
    setTimeout(() => {
      updateVoices();
      const v2 = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
      if (v2 && v2.length > 0) {
        let m2 = v2.find(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix));
        if (!m2 && langPrefix === 'de') m2 = v2.find(v => /anna|petra|markus/i.test(v.name));
        if (!m2 && langPrefix === 'en') m2 = v2.find(v => /samantha|daniel|karen|alex/i.test(v.name));
        if (m2) u.voice = m2;
      }
      window.speechSynthesis.speak(u);
    }, 50);
    return;
  }

  if (voices && voices.length > 0) {
    let match = voices.find(v => (v.lang || '').toLowerCase().replace('_', '-') === targetLang.toLowerCase());
    if (!match) match = voices.find(v => (v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix));
    if (!match && langPrefix === 'de') match = voices.find(v => /anna|petra|markus/i.test(v.name));
    if (!match && langPrefix === 'en') match = voices.find(v => /samantha|daniel|karen|alex/i.test(v.name));
    if (match) u.voice = match;
  }

  window.speechSynthesis.speak(u);
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

function updateFooter() {
  if (!currentUser) return;
  const g = parseInt(currentUser.grade) || 2;
  const gradeLabel = g >= 10 && g < 90 ? `${g - 9}. ročník SŠ` : (g <= 9 ? `${g}. tř.` : 'Dospělý');
  document.getElementById("footer-user").innerHTML = `${currentUser.name} (${gradeLabel}) <span class="streak-badge">🔥 ${getUserStreak(currentUser.name)}</span>`;
}

// --- SYNCHRONIZACE DAT (STÁHNE I DNEŠNÍ ČAS Z JINÝCH ZAŘÍZENÍ) ---
async function loadData() {
  const cached = localStorage.getItem("app_data");
  if (cached) {
    try {
      appData = JSON.parse(cached);
      if (!appData.items) appData.items = [];
      renderScreen();
    } catch(e) {}
  } else {
    renderScreen();
  }
  await syncData();
}

async function syncData() {
  const statusEl = document.getElementById("footer-status");
  if (statusEl) statusEl.innerText = "Stahuji...";
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    const json = await res.json();
    if (json && json.items) {
      appData = json;
      localStorage.setItem("app_data", JSON.stringify(json));
      if (statusEl) statusEl.innerText = `OK: ${appData.items.length} úloh`;

      // Přenesení minut z jiného zařízení
      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase() === currentUser.name.toLowerCase());
        if (foundU) {
          currentUser.targetMinutes = foundU.targetMinutes || 15;
          currentUser.grade = parseInt(foundU.grade) || 2;
          
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
    if (statusEl) statusEl.innerText = "Offline";
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
  vList.forEach(it => {
    points += getSavedMastery(it.question, "DIR_OUT") + getSavedMastery(it.question, "DIR_IN");
  });
  return Math.min(100, Math.round((points / (vList.length * 4)) * 100));
}

// --- NAVIGACE ---
function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  sendTimeHeartbeatToGoogle();
  if (currentScreen === "PLAYING" && selectedGame === "PEXESO") setScreen("SELECT_PEXESO_SIZE");
  else if (currentScreen === "SELECT_PEXESO_SIZE") setScreen("SELECT_GAME");
  else if (currentScreen === "PLAYING") {
    if (selectedSubject === "Matematika") setScreen("SELECT_MATH_OP");
    else setScreen("SELECT_GAME");
  }
  else if (currentScreen === "SELECT_MATH_OP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_GAME") setScreen("SELECT_GROUP");
  else if (currentScreen === "SELECT_GROUP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_SUBJECT") setScreen("SELECT_USER");
}

function setScreen(scr) { currentScreen = scr; registerUserAction(); renderScreen(); }

function selectUser(name, grade, targetMinutes) {
  currentUser = { name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0 };
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  todaySecondsStudied = loadUserStudyTime(currentUser.name);
  isTimerPaused = false;
  updateStudyTimerUI();
  setScreen("SELECT_SUBJECT");
}

function chooseSubject(subj) { selectedSubject = subj; setScreen("SELECT_GROUP"); }

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

function toggleTestingDirection() {
  testingDirection = (testingDirection === "DIR_OUT") ? "DIR_IN" : "DIR_OUT";
  localStorage.setItem("testing_dir", testingDirection);
  if (typeof initGameState === "function") initGameState();
  renderScreen();
}

// --- HLAVNÍ RENDERÉR ---
function renderScreen() {
  updateFooter(); updateStudyTimerUI(); updateTTSBtnUI();
  const main = document.getElementById("main-content");
  const bUser = document.getElementById("badge-user");
  const bSubj = document.getElementById("badge-subj");
  const bGroup = document.getElementById("badge-group");
  bUser.innerText = currentUser ? currentUser.name : "Uživatel";

  // 1. VÝBĚR UŽIVATELE (UKAZUJE DNEŠNÍ MINUTY A BONUS)
  if (currentScreen === "SELECT_USER" || !currentUser) {
    bSubj.style.display = "none"; bGroup.style.display = "none";
    const uList = appData.users || [];
    if (uList.length === 0) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;color:var(--col-text-muted);">
          <p style="margin-bottom:15px;">Načítám profily z tabulky...</p>
          <button class="action-btn" onclick="syncData()">Zkusit znovu 🔄</button>
        </div>
      `;
      return;
    }
    main.innerHTML = `
      <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Kdo se jde učit?</h2>
      <div class="grid-2">
        ${uList.map(u => {
          const g = parseInt(u.grade) || 2;
          const grLabel = g >= 10 && g < 90 ? `${g - 9}. ročník SŠ` : (g <= 9 ? `${g}. třída ZŠ` : 'Dospělý');
          const uSec = loadUserStudyTime(u.name);
          const uMin = Math.floor(uSec / 60);
          const targetM = u.targetMinutes || 15;
          const isDone = uMin >= targetM;
          return `
            <div class="tile" style="${isDone ? 'border-color:var(--col-yellow);background:#1a2512;' : ''}" onclick="selectUser('${u.name}', ${g}, ${targetM})">
              <h2>${u.name}</h2><p>${grLabel}</p>
              <p style="color:var(--col-orange);margin-top:4px;">🔥 Série: ${getUserStreak(u.name)} dní</p>
              <p style="color:${isDone ? 'var(--col-yellow)' : 'var(--col-text-muted)'};margin-top:2px;font-weight:bold;">
                ⏱️ Dnes: ${uMin} / ${targetM} min ${isDone ? '★' : ''}
              </p>
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
    
    (appData.items || []).forEach(it => {
      if (!isItemAllowedForGrade(it, userG)) return;
      subjs[it.subject] = (subjs[it.subject] || 0) + 1;
    });

    const availableNames = Object.keys(subjs);

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

    availableNames.forEach(s => {
      html += `<div class="tile" onclick="chooseSubject('${s}')"><h2>${s}</h2><p>${subjs[s]} úloh</p></div>`;
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

  // 5. VÝBĚR HRY
  else if (currentScreen === "SELECT_GAME") {
    bSubj.style.display = "flex"; bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    const vItems = getVocabItems(), qItems = getQuizItems(), quickMode = getQuickChoiceMode();
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
          <h2 style="color:var(--col-orange);">☄️ Padající slova (${quickMode.replace(/_/g, ' ')})</h2><p>Arkáda: 3 životy, zrychlování po celé ploše!</p>
        </div>
      `;
    }
    if (qItems.length > 0) {
      html += `<div class="tile" style="border-color:var(--col-green);" onclick="startGame('QUIZ')"><h2 style="color:var(--col-green);">📝 Kvíz</h2><p>${qItems.length} otázek</p></div>`;
    }
    html += `</div>`;
    main.innerHTML = html;
  }

  // 6. VELIKOST PEXESA
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

  // 7. AKTIVNÍ HRA
  else if (currentScreen === "PLAYING") {
    bSubj.style.display = "flex"; bSubj.innerText = selectedSubject;
    bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey;
    if (typeof renderActiveGame === "function") renderActiveGame();
  }
}

// Spuštění po načtení
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => loadData());
} else {
  loadData();
}
