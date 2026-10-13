/**
 * JÁDRO APLIKACE, ČASOVAČ, SYNCHRONIZACE, SDRÍLENÉ POMOCNÉ FUNKCE A NAVIGACE
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

// Směr zkoušení: DIR_OUT = CZ -> Cizí, DIR_IN = Cizí -> CZ
let testingDirection = localStorage.getItem("testing_dir") || "DIR_OUT";

function forceHardReload() {
  window.location.href = window.location.origin + window.location.pathname + '?reload=' + Date.now();
}

// --- SDRÍLENÉ POMOCNÉ FUNKCE PRO VŠECHNY MODULY ---
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
    const count = vItems.filter(it => /^(der|die|das)\s/i.test(it.question)).length;
    if (count >= 3) return "DER_DIE_DAS";
  }
  if (s.includes("angli") || s === "en") {
    const count = vItems.filter(it => /^(a|an)\s/i.test(it.question)).length;
    if (count >= 3) return "A_AN";
  }
  if (s.includes("cest") || s === "cs") {
    const count = vItems.filter(it => it.question.includes('_')).length;
    if (count >= 3) return "I_Y";
  }
  return null;
}

// --- ČASOVAČ & STREAK ---
function getStudyTimeKey(userName) {
  const d = new Date();
  const dateKey = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const uKey = (userName || 'user').toLowerCase().trim();
  return `study_sec_${dateKey}_${uKey}`;
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
  } else {
    streak = 1;
  }

  localStorage.setItem(`streak_${uKey}`, streak);
  localStorage.setItem(`streak_last_date_${uKey}`, todayStr);
}

let todaySecondsStudied = currentUser ? loadUserStudyTime(currentUser.name) : 0;
let lastUserActivityTime = Date.now();
let isTimerPaused = false;

function registerUserAction() {
  lastUserActivityTime = Date.now();
  if (isTimerPaused) {
    isTimerPaused = false;
    updateStudyTimerUI();
  }
}

window.addEventListener('click', registerUserAction, true);
window.addEventListener('touchstart', registerUserAction, true);

// INVARIANT: Přísná pauza po 15 sekundách nečinnosti
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
  const format = s => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  };

  const spentMin = Math.floor(todaySecondsStudied / 60);
  if (footerGoal) {
    footerGoal.innerText = `${spentMin} / ${currentUser.targetMinutes || 15} min ⏱️`;
  }

  if (currentScreen !== "PLAYING" || isTimerPaused) {
    box.className = "study-timer-box paused";
    box.innerText = `⏸️ ${format(todaySecondsStudied)} / ${format(targetSec)}`;
  } else if (todaySecondsStudied < targetSec) {
    box.className = "study-timer-box";
    box.innerText = `⏱️ ${format(todaySecondsStudied)} / ${format(targetSec)}`;
  } else {
    const bonusSec = todaySecondsStudied - targetSec;
    box.className = "study-timer-box bonus";
    box.innerText = `★ BONUS: +${format(bonusSec)}`;
  }
}

// --- VÝSLOVNOST (TTS) & AUDIO ---
let isAutoTTS = localStorage.getItem("auto_tts") !== "false";

function toggleAutoTTS() {
  isAutoTTS = !isAutoTTS;
  localStorage.setItem("auto_tts", isAutoTTS);
  updateTTSBtnUI();
}

function updateTTSBtnUI() {
  const btn = document.getElementById("btn-tts-auto");
  if (!btn) return;
  btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn";
  btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp";
}

function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();

  let toSpeak = text;
  if (text.toLowerCase().includes('read - read - read') || text.toLowerCase().includes('read-read-read')) {
    toSpeak = "read, red, red";
  } else if (text.includes('-')) {
    toSpeak = text.replace(/\//g, ' or ').replace(/-/g, ', ');
  }

  const u = new SpeechSynthesisUtterance(toSpeak);
  const s = (subjectName || selectedSubject || '').toLowerCase();
  
  let targetLang = 'cs-CZ';
  if (s.includes('angli') || s === 'en') targetLang = 'en-US';
  else if (s.includes('nemc') || s === 'de') targetLang = 'de-DE';
  else if (s.includes('hebr') || s === 'he') targetLang = 'he-IL';

  u.lang = targetLang;
  u.rate = 0.86;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const match = voices.find(v => v.lang.startsWith(targetLang.split('-')[0]));
    if (match) u.voice = match;
  }
  window.speechSynthesis.speak(u);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
function sndOk() { playTone(880, 'sine', 0.08); setTimeout(() => playTone(1320, 'sine', 0.1), 80); }
function sndErr() { playTone(220, 'square', 0.15); }
function sndFanfare() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.1), i * 110));
}

function addReward(count = 1, section = "Lekce") {
  if (!currentUser) return;
  currentUser.stars = (currentUser.stars || 0) + count;
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  updateFooter();

  try {
    const fd = new URLSearchParams();
    fd.append("action", "log_activity");
    fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject);
    fd.append("section", section);
    fd.append("stars", count);
    fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

function updateFooter() {
  if (!currentUser) return;
  const g = parseInt(currentUser.grade) || 2;
  const gradeLabel = g >= 10 && g < 90 ? `${g - 9}. ročník SŠ` : (g <= 9 ? `${g}. tř.` : 'Dospělý');
  const streak = getUserStreak(currentUser.name);
  document.getElementById("footer-user").innerHTML = `${currentUser.name} (${gradeLabel}) <span class="streak-badge">🔥 ${streak}</span>`;
}

// --- NAČÍTÁNÍ DAT S GARANCÍ VYKRESLENÍ (NEZAMRZNE) ---
async function loadData() {
  const cached = localStorage.getItem("app_data");
  if (cached) {
    try {
      appData = JSON.parse(cached);
      if (!appData.items) appData.items = [];
      renderScreen();
    } catch(e) {}
  }
  await syncData();
  renderScreen(); // Pojistka: vždy vykreslit po pokusu o sync
}

async function syncData() {
  const statusEl = document.getElementById("footer-status");
  if (statusEl) statusEl.innerText = "Stahuji...";
  try {
    const res = await fetch(API_URL);
    const json = await res.json();
    
    if (!json.items) {
      if (statusEl) statusEl.innerText = "Chyba API";
      renderScreen();
      return;
    }

    appData = json;
    localStorage.setItem("app_data", JSON.stringify(json));

    if (statusEl) statusEl.innerText = `OK: ${appData.items.length} úloh`;

    if (currentUser && appData.users) {
      const foundU = appData.users.find(u => u.name.toLowerCase() === currentUser.name.toLowerCase());
      if (foundU) {
        currentUser.targetMinutes = foundU.targetMinutes || 15;
        currentUser.grade = parseInt(foundU.grade) || 2;
        localStorage.setItem("cur_user", JSON.stringify(currentUser));
      }
    }
    renderScreen();
  } catch(e) {
    if (statusEl) statusEl.innerText = "Offline";
    renderScreen();
  }
}

// Uložení pokroku do listu Pokrok s 4-prvkovým klíčem
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
    fd.append("action", "save_mastery");
    fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject);
    fd.append("foreign", itemQuestion);
    fd.append("mastery", masteryLevel);
    fd.append("direction", direction);
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
  if (userMap[itemQuestion] !== undefined) return Number(userMap[itemQuestion]);
  return 0;
}

function getGroupMasteryPercent(groupItems, subjName) {
  if (!currentUser || !groupItems || groupItems.length === 0) return 0;
  const vList = groupItems.filter(it => it.type === "SLOVO");
  if (vList.length === 0) return 0;

  let points = 0;
  const totalPossible = vList.length * 4;

  vList.forEach(it => {
    const mOut = getSavedMastery(it.question, "DIR_OUT");
    const mIn = getSavedMastery(it.question, "DIR_IN");
    points += (mOut + mIn);
  });

  return Math.min(100, Math.round((points / totalPossible) * 100));
}

function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
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

function setScreen(scr) {
  currentScreen = scr;
  registerUserAction();
  renderScreen();
}

function selectUser(name, grade, targetMinutes) {
  currentUser = { name, grade: parseInt(grade) || 2, targetMinutes: parseInt(targetMinutes) || 15, stars: 0 };
  localStorage.setItem("cur_user", JSON.stringify(currentUser));
  todaySecondsStudied = loadUserStudyTime(currentUser.name);
  lastUserActivityTime = Date.now();
  isTimerPaused = false;
  updateStudyTimerUI();
  setScreen("SELECT_SUBJECT");
}

function chooseSubject(subj) {
  selectedSubject = subj;
  setScreen("SELECT_GROUP");
}

function chooseGroup(groupName) {
  selectedGroupKey = groupName;
  const userG = parseInt(currentUser.grade) || 2;
  activeItems = (appData.items || []).filter(it => {
    if (it.subject !== selectedSubject) return false;
    if (filterExactGradeOnly && userG < 90) {
      if ((parseInt(it.minGrade) || 2) !== userG) return false;
    }
    const key = (viewMode === "LESSONS") ? it.lesson : it.topic;
    return key === groupName;
  });
  setScreen("SELECT_GAME");
}

function toggleTestingDirection() {
  testingDirection = (testingDirection === "DIR_OUT") ? "DIR_IN" : "DIR_OUT";
  localStorage.setItem("testing_dir", testingDirection);
  if (typeof initGameState === "function") initGameState();
  renderScreen();
}

function renderScreen() {
  updateFooter();
  updateStudyTimerUI();
  updateTTSBtnUI();
  const main = document.getElementById("main-content");
  const bUser = document.getElementById("badge-user");
  const bSubj = document.getElementById("badge-subj");
  const bGroup = document.getElementById("badge-group");

  bUser.innerText = currentUser ? currentUser.name : "Uživatel";

  // 1. VÝBĚR UŽIVATELE
  if (currentScreen === "SELECT_USER" || !currentUser) {
    bSubj.style.display = "none";
    bGroup.style.display = "none";
    const uList = (appData.users && appData.users.length) ? appData.users : [];

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
          const streak = getUserStreak(u.name);
          return `
            <div class="tile" style="${currentUser && currentUser.name === u.name ? 'border-color:var(--col-green);background:#142838;' : ''}" onclick="selectUser('${u.name}', ${g}, ${u.targetMinutes||15})">
              <h2>${u.name}</h2>
              <p>${grLabel}</p>
              <p style="color:var(--col-orange);margin-top:4px;">🔥 Série: ${streak} dní</p>
              <p style="color:var(--col-yellow);margin-top:2px;">⏱️ Cíl: ${u.targetMinutes||15} min</p>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // 2. VÝBĚR PŘEDMĚTU
  else if (currentScreen === "SELECT_SUBJECT") {
    bSubj.style.display = "none";
    bGroup.style.display = "none";

    const subjectsMap = {};
    const userG = parseInt(currentUser.grade) || 2;

    (appData.items || []).forEach(it => {
      const itemG = parseInt(it.minGrade) || 2;
      if (filterExactGradeOnly && userG < 90) {
        if (itemG !== userG) return;
      }
      if (!subjectsMap[it.subject]) {
        subjectsMap[it.subject] = { name: it.subject, count: 0 };
      }
      subjectsMap[it.subject].count++;
    });

    const availableSubjects = Object.values(subjectsMap);

    let html = `
      <div class="filter-bar">
        <span>Filtr: ${filterExactGradeOnly ? 'Jen ' + userG + '. třída' : 'Všechny ročníky'}</span>
        <button class="toggle-btn ${filterExactGradeOnly ? 'on' : ''}" onclick="filterExactGradeOnly=!filterExactGradeOnly;renderScreen();">
          ${filterExactGradeOnly ? 'Jen má třída' : 'Všechny ročníky'}
        </button>
      </div>
      <div class="grid-2">
        <div class="tile" style="border-color:var(--col-active-tab);background:#102538;" onclick="openMathOperationSelect()">
          <h2 style="color:var(--col-active-tab);">🔢 Matematika</h2>
          <p>Výběr operací a obtížností</p>
        </div>
    `;

    availableSubjects.forEach(s => {
      html += `
        <div class="tile" onclick="chooseSubject('${s.name}')">
          <h2>${s.name}</h2>
          <p>${s.count} úloh k procvičení</p>
        </div>
      `;
    });

    html += `</div>`;
    main.innerHTML = html;
  }

  // 3. VÝBĚR OPERACE V MATEMATICE
  else if (currentScreen === "SELECT_MATH_OP") {
    bSubj.style.display = "flex";
    bSubj.innerText = "Matematika";
    bGroup.style.display = "none";
    if (typeof renderMathOpSelection === "function") renderMathOpSelection();
  }

  // 4. VÝBĚR SKUPINY (LEKCE / TÉMATA)
  else if (currentScreen === "SELECT_GROUP") {
    bSubj.style.display = "flex";
    bSubj.innerText = selectedSubject;
    bGroup.style.display = "none";

    const userG = parseInt(currentUser.grade) || 2;

    const subjItems = (appData.items || []).filter(it => {
      if (it.subject !== selectedSubject) return false;
      if (!filterExactGradeOnly) return true;
      if (userG >= 90) return true;
      return (parseInt(it.minGrade) || 2) === userG;
    });

    const groupsMap = {};
    subjItems.forEach(it => {
      const key = (viewMode === "LESSONS") ? it.lesson : it.topic;
      if (!key) return;
      if (!groupsMap[key]) groupsMap[key] = { name: key, count: 0, minGrade: it.minGrade, types: new Set(), rawItems: [] };
      groupsMap[key].count++;
      groupsMap[key].types.add(it.type);
      groupsMap[key].rawItems.push(it);
      if (it.minGrade > groupsMap[key].minGrade) groupsMap[key].minGrade = it.minGrade;
    });

    const groups = Object.values(groupsMap);
    const gradeStr = userG >= 10 && userG < 90 ? `${userG - 9}. ročník SŠ` : `${userG}. třída`;

    let html = `
      <div class="filter-bar">
        <div style="display:flex;gap:4px;">
          <button class="toggle-btn ${viewMode === 'LESSONS' ? 'on' : ''}" onclick="viewMode='LESSONS';renderScreen();">📁 Podle lekcí</button>
          <button class="toggle-btn ${viewMode === 'TOPICS' ? 'on' : ''}" onclick="viewMode='TOPICS';renderScreen();">🏷️ Podle témat</button>
        </div>
        <button class="toggle-btn ${filterExactGradeOnly ? 'on' : ''}" onclick="filterExactGradeOnly=!filterExactGradeOnly;renderScreen();">
          ${filterExactGradeOnly ? 'Jen ' + gradeStr : 'Všechny ročníky'}
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
    `;

    if (groups.length === 0) {
      html += `<div style="text-align:center;padding:25px;color:var(--col-text-muted);">Pro ${gradeStr} tu zatím není látka. Přepněte na "Všechny ročníky".</div>`;
    } else {
      groups.forEach(g => {
        const typeLabels = Array.from(g.types).map(t => t === 'SLOVO' ? 'Slova' : (t === 'KVIZ' ? 'Kvíz' : 'Řada')).join(', ');
        const gGrade = parseInt(g.minGrade) || 2;
        const gGradeLabel = gGrade >= 10 && gGrade < 90 ? `${gGrade - 9}. ročník SŠ` : (gGrade <= 9 ? `${gGrade}. tř.` : 'Dospělý');
        const mPct = getGroupMasteryPercent(g.rawItems, selectedSubject);

        html += `
          <div class="tile" style="flex-direction:column;align-items:stretch;padding:12px;gap:6px;" onclick="chooseGroup('${g.name}')">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div style="text-align:left;">
                <h2>${g.name}</h2>
                <p>${typeLabels} (${gGradeLabel})</p>
              </div>
              <span style="color:var(--col-active-tab);font-weight:bold;">${g.count} úloh</span>
            </div>
            ${g.types.has('SLOVO') ? `
              <div style="display:flex;align-items:center;gap:8px;">
                <div class="bargraph-track" style="height:6px;flex:1;">
                  <div class="bargraph-fill" style="width:${mPct}%;background:${mPct===100?'var(--col-green)':'linear-gradient(90deg, var(--col-active-tab), var(--col-green))'};"></div>
                </div>
                <span style="font-size:11px;font-weight:bold;color:${mPct===100?'var(--col-green)':'var(--col-yellow)'};">${mPct} %</span>
              </div>
            ` : ''}
          </div>
        `;
      });
    }

    html += '</div>';
    main.innerHTML = html;
  }

  // 5. VÝBĚR HRY
  else if (currentScreen === "SELECT_GAME") {
    bSubj.style.display = "flex";
    bGroup.style.display = "flex";
    bGroup.innerText = selectedGroupKey;

    const vItems = getVocabItems();
    const qItems = getQuizItems();
    const sItems = getSeqItems();
    const quickMode = getQuickChoiceMode();

    let tilesHtml = `<div class="grid-2">`;

    if (vItems.length > 0) {
      tilesHtml += `
        <div class="tile" onclick="startGame('CARDS')"><h2>1. Karty</h2><p>Čtení a poslech (${vItems.length})</p></div>
        <div class="tile" style="border-color:var(--col-green);" onclick="startGame('ADAPTIVE')">
          <h2 style="color:var(--col-green);">2. Zkoušení</h2>
          <p>${testingDirection === 'DIR_OUT' ? '🇨🇿 ➔ Cizí' : 'Cizí ➔ 🇨🇿'} (Konec při 2 ★)</p>
        </div>
        <div class="tile" onclick="startGame('SCRAMBLE')"><h2>3. Skládání</h2><p>Pravopis slov a frází</p></div>
        <div class="tile" onclick="startGame('MISSING')"><h2>4. Doplň písmeno</h2><p>Doplň znak</p></div>
      `;
    }

    if (quickMode) {
      const labels = {
        "DER_DIE_DAS": "DER / DIE / DAS",
        "A_AN": "A / AN",
        "I_Y": "I / Y"
      };
      tilesHtml += `
        <div class="tile" style="border-color:var(--col-orange);grid-column: span 2;background:#231a0a;" onclick="startArcadeGame()">
          <h2 style="color:var(--col-orange);">☄️ Padající slova (${labels[quickMode]})</h2>
          <p>Arkáda: 3 životy, zrychlující se pád!</p>
        </div>
        <div class="tile" style="border-color:var(--col-yellow);grid-column: span 2;" onclick="startGame('QUICK_CHOICE')">
          <h2 style="color:var(--col-yellow);">⚡ Trénink volby (${labels[quickMode]})</h2>
          <p>Klidné procvičování bez stresu</p>
        </div>
      `;
    }

    if (qItems.length > 0) {
      tilesHtml += `
        <div class="tile" style="border-color:var(--col-green);" onclick="startGame('QUIZ')">
          <h2 style="color:var(--col-green);">📝 Kvíz / Test</h2>
          <p>${qItems.length} otázek</p>
        </div>
      `;
    }

    if (sItems.length > 0) {
      tilesHtml += `
        <div class="tile" style="border-color:var(--col-yellow);" onclick="startGame('SEQ')">
          <h2 style="color:var(--col-yellow);">⏱️ Řada na čas</h2>
          <p>Básničky a posloupnosti</p>
        </div>
      `;
    }

    tilesHtml += `</div>`;

    if (vItems.length > 0) {
      tilesHtml += `
        <div class="tile" style="margin-top:10px;padding:12px;border-color:var(--col-yellow);" onclick="setScreen('SELECT_PEXESO_SIZE')">
          <h2 style="color:var(--col-yellow);">🃏 PEXESO (Hledání dvojic)</h2>
          <p>Procvič si paměť</p>
        </div>
      `;
    }

    main.innerHTML = tilesHtml;
  }

  // 6. VELIKOST PEXESA
  else if (currentScreen === "SELECT_PEXESO_SIZE") {
    bGroup.style.display = "flex";
    bGroup.innerText = selectedGroupKey;
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
    bSubj.style.display = "flex";
    bSubj.innerText = selectedSubject;
    bGroup.style.display = "flex";
    bGroup.innerText = selectedGroupKey;
    if (typeof renderActiveGame === "function") renderActiveGame();
  }
}

// SPOUŠTĚNÍ: Okamžitý start i při hotovém načtení DOMu
function startApp() {
  loadData();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}
