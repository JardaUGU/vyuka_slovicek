/**
 * MODUL PRO KOMUNIKACI S GOOGLE SHEETS API A LOKÁLNÍ CACHE
 */

function syncAllUsersTimeFromCloud(usersArr) {
  if (!Array.isArray(usersArr)) return;
  usersArr.forEach(u => {
    if (u && u.name && u.todayMinutes !== undefined) {
      const cloudSec = Math.round(Number(u.todayMinutes) * 60);
      const localSec = loadUserStudyTime(u.name);
      if (cloudSec > localSec) {
        localStorage.setItem(getStudyTimeKey(u.name), String(cloudSec));
      }
    }
  });
  if (currentUser) {
    todaySecondsStudied = loadUserStudyTime(currentUser.name);
    lastCloudSyncSec = todaySecondsStudied;
    if (typeof updateStudyTimerUI === "function") updateStudyTimerUI();
  }
}

function syncAllUsersStreakFromCloud(usersArr) {
  if (!Array.isArray(usersArr)) return;
  usersArr.forEach(u => {
    if (!u || !u.name) return;
    const uKey = u.name.toLowerCase().trim();
    if (u.pin !== undefined) localStorage.setItem(`user_pin_${uKey}`, String(u.pin || ''));
    const cloudLast = typeof parseDateOnlyStr === "function" ? parseDateOnlyStr(u.streakLastDate) : String(u.streakLastDate || '').slice(0, 10);
    const localLast = typeof parseDateOnlyStr === "function" ? parseDateOnlyStr(localStorage.getItem(`streak_last_date_${uKey}`) || "") : "";

    if (cloudLast && (!localLast || cloudLast >= localLast)) {
      localStorage.setItem(`streak_${uKey}`, String(Number(u.streak || 0)));
      localStorage.setItem(`streak_last_date_${uKey}`, cloudLast);
      const cloudFreeze = (u.inventory && u.inventory["Zmrazeni"] !== undefined)
        ? u.inventory["Zmrazeni"]
        : (u.inventory && u.inventory["zmrazeni"] !== undefined ? u.inventory["zmrazeni"] : undefined);
      if (cloudFreeze !== undefined) {
        localStorage.setItem(`item_Zmrazeni_${uKey}`, String(Number(cloudFreeze)));
      }
      if (Array.isArray(u.streakFreezeDates)) {
        localStorage.setItem(`freeze_dates_${uKey}`, JSON.stringify(u.streakFreezeDates));
      }
    } else if (localLast > cloudLast) {
      u.streak = Number(localStorage.getItem(`streak_${uKey}`) || u.streak || 0);
      u.streakLastDate = localLast;
      const localFreeze = localStorage.getItem(`item_Zmrazeni_${uKey}`);
      if (localFreeze !== null && u.inventory) {
        u.inventory["Zmrazeni"] = Number(localFreeze);
        u.inventory["zmrazeni"] = Number(localFreeze);
      }
    }
  });
}

function syncAllUsersXpFromCloud(usersArr) {
  if (!Array.isArray(usersArr)) return;
  const monStr = typeof getMondayDateStrClient === "function" ? getMondayDateStrClient() : "";
  usersArr.forEach(u => {
    if (!u || !u.name) return;
    const uKey = u.name.toLowerCase().trim();

    const cloudXp = Number(u.xp || 0);
    const localXp = Number(localStorage.getItem(`xp_${uKey}`) || 0);
    const bestXp = Math.max(cloudXp, localXp);
    localStorage.setItem(`xp_${uKey}`, String(bestXp));
    u.xp = bestXp;

    const cloudW = Number(u.weeklyXp || 0);
    const localStart = localStorage.getItem(`weekly_xp_start_${uKey}`) || "";
    const localW = (localStart === monStr) ? Number(localStorage.getItem(`weekly_xp_${uKey}`) || 0) : 0;
    const bestW = Math.max(cloudW, localW);
    localStorage.setItem(`weekly_xp_${uKey}`, String(bestW));
    if (monStr) localStorage.setItem(`weekly_xp_start_${uKey}`, monStr);
    u.weeklyXp = bestW;
  });
}

function syncAllUsersAvatarFromCloud(usersArr) {
  if (!Array.isArray(usersArr)) return;
  usersArr.forEach(u => {
    if (!u || !u.name) return;
    const uKey = u.name.toLowerCase().trim();
    if (Array.isArray(u.avatarItems)) {
      let local = [];
      try { local = JSON.parse(localStorage.getItem(`av_items_${uKey}`) || '[]'); } catch(e) {}
      const merged = [...new Set([...u.avatarItems, ...local])];
      localStorage.setItem(`av_items_${uKey}`, JSON.stringify(merged));
      u.avatarItems = merged;
    }
    const lastLocalTs = Number(localStorage.getItem(`av_ts_${uKey}`) || 0);
    if (u.avatarEquipStr && (Date.now() - lastLocalTs > 10000)) {
      localStorage.setItem(`av_equip_${uKey}`, u.avatarEquipStr);
    }
  });
}

async function loadData() {
  checkDateRollover();
  if (currentUser) {
    todaySecondsStudied = loadUserStudyTime(currentUser.name);
    lastCloudSyncSec = todaySecondsStudied;
  }

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

    if (json && json.status !== "error" && Array.isArray(json.items)) {
      json.syncDate = getTodayDateStr();
      appData = json;
      localStorage.setItem("app_data", JSON.stringify(json));

      syncAllUsersTimeFromCloud(appData.users);
      syncAllUsersStreakFromCloud(appData.users);
      syncAllUsersXpFromCloud(appData.users);
      syncAllUsersAvatarFromCloud(appData.users);

      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        if (foundU) {
          currentUser.targetMinutes = foundU.targetMinutes || 15;
          currentUser.grade = parseInt(foundU.grade) || 2;
          currentUser.coins = Number(foundU.coins || 0);
          currentUser.inventory = foundU.inventory || {};
          let cloudThemes = Array.isArray(foundU.unlockedThemes) ? foundU.unlockedThemes : (typeof foundU.unlockedThemes === 'string' ? foundU.unlockedThemes.split(',').map(s => s.trim().toLowerCase()) : []);
          let mergedThemes = [...new Set(['default', ...cloudThemes, ...getUserUnlockedThemes(currentUser.name)])];
          saveUserUnlockedThemes(currentUser.name, mergedThemes);
          currentUser.unlockedThemes = mergedThemes;
          currentUser.activeTheme = getUserActiveTheme(currentUser.name);
          currentUser.startLevels = foundU.startLevels || {};
          localStorage.setItem("cur_user", JSON.stringify(currentUser));
        }
      }
      if (typeof renderScreen === "function") renderScreen();
    } else { if (typeof renderScreen === "function") renderScreen(); }
  } catch(e) { console.warn("Offline mód aktivní:", e); if (typeof renderScreen === "function") renderScreen(); }
}

async function syncData() {
  const statusEl = document.getElementById("footer-status");
  if (statusEl) statusEl.innerText = "Stahuji...";
  try {
    const fetchUrl = API_URL + '?t=' + Date.now() + '&clientDate=' + getTodayDateStr();
    const res = await fetch(fetchUrl);
    const json = await res.json();

    if (json && json.status !== "error" && Array.isArray(json.items)) {
      json.syncDate = getTodayDateStr();
      appData = json;
      localStorage.setItem("app_data", JSON.stringify(json));
      if (statusEl) statusEl.innerText = `OK: ${appData.items.length} úloh`;

      syncAllUsersTimeFromCloud(appData.users);
      syncAllUsersStreakFromCloud(appData.users);
      syncAllUsersXpFromCloud(appData.users);
      syncAllUsersAvatarFromCloud(appData.users);

      if (currentUser && appData.users) {
        const foundU = appData.users.find(u => u.name.toLowerCase().trim() === currentUser.name.toLowerCase().trim());
        if (foundU) {
          currentUser.coins = Number(foundU.coins || 0);
          currentUser.inventory = foundU.inventory || {};
          let mergedThemes = getUserUnlockedThemes(currentUser.name);
          saveUserUnlockedThemes(currentUser.name, mergedThemes);
          currentUser.unlockedThemes = mergedThemes;
          currentUser.activeTheme = getUserActiveTheme(currentUser.name);
          localStorage.setItem("cur_user", JSON.stringify(currentUser));
          if (typeof applyAppSkin === 'function') applyAppSkin(currentUser.activeTheme);
        }
      }
    }
  } catch(e) { if (statusEl) statusEl.innerText = (appData && appData.items && appData.items.length > 0) ? `OK: ${appData.items.length} úloh` : "Offline"; }
  if (typeof renderScreen === "function") renderScreen();
}

function sendTimeHeartbeatToGoogle() {
  if (!currentUser || todaySecondsStudied <= 0) return;
  try {
    const fd = new URLSearchParams();
    fd.append("action", "log_activity");
    fd.append("user", currentUser.name);
    fd.append("subject", typeof selectedSubject !== 'undefined' && selectedSubject ? selectedSubject : "Výuka");
    fd.append("section", "Časomíra");
    fd.append("stars", 0);
    fd.append("minutes", (todaySecondsStudied / 60).toFixed(2));
    fd.append("clientDate", getTodayDateStr());
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd, keepalive: true });
  } catch(e) {}
}

async function saveWordMasteryToGoogle(itemQuestion, masteryLevel, direction) {
  if (!currentUser) return;
  try {
    const uKey = currentUser.name.toLowerCase().trim();
    const compKey = `${typeof selectedSubject!=='undefined'?selectedSubject:''}:::${itemQuestion}:::${direction}`;
    if (!appData.progress) appData.progress = {};
    if (!appData.progress[uKey]) appData.progress[uKey] = {};
    appData.progress[uKey][compKey] = masteryLevel;
    localStorage.setItem("app_data", JSON.stringify(appData));
    const fd = new URLSearchParams();
    fd.append("action", "save_mastery"); fd.append("user", currentUser.name);
    fd.append("subject", typeof selectedSubject!=='undefined'?selectedSubject:''); fd.append("foreign", itemQuestion);
    fd.append("mastery", masteryLevel); fd.append("direction", direction);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    sendTimeHeartbeatToGoogle();
  } else if (document.visibilityState === "visible") {
    checkDateRollover();
    syncDataQuietly();
  }
});
