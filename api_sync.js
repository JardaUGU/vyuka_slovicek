/**
 * MODUL PRO KOMUNIKACI S GOOGLE SHEETS API A LOKÁLNÍ CACHE
 */

async function loadData() {
  checkDateRollover();
  if (currentUser) todaySecondsStudied = loadUserStudyTime(currentUser.name);
  
  const cached = localStorage.getItem("app_data");
  if (cached) {
    try {
      appData = JSON.parse(cached);
      if (!appData.items) appData.items = []; 
      if (typeof renderScreen === "function") renderScreen();
    } catch(e) { if (typeof renderScreen === "function") renderScreen(); }
  } else { if (typeof renderScreen === "function") renderScreen(); }
  
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
      if (typeof renderScreen === "function") renderScreen();
    } else { if (typeof renderScreen === "function") renderScreen(); }
  } catch(e) { console.log("Offline mód aktivní"); if (typeof renderScreen === "function") renderScreen(); }
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
  if (typeof renderScreen === "function") renderScreen();
}

function sendTimeHeartbeatToGoogle() {
  if (!currentUser) return;
  try {
    const fd = new URLSearchParams(); fd.append("action", "log_activity"); fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject || "Výuka"); fd.append("section", "Časomíra");
    fd.append("stars", 0); fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
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
