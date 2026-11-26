/**
 * MODUL PRO EKONOMIKU (MINCE, OBCHOD, SKINY) A XP / ÚROVNĚ
 */

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

function previewSkin(skinId) { previewingSkin = skinId; document.body.setAttribute('data-theme', skinId); if (typeof renderScreen === 'function') renderScreen(); }
function cancelPreview() { previewingSkin = null; applyAppSkin(currentUser ? currentUser.activeTheme : 'default'); if (typeof renderScreen === 'function') renderScreen(); }

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
    alert("Nový vzhled byl odemčen a nasazen! 🎨"); if (typeof renderScreen === 'function') renderScreen();
  } else { alert("Nemáš dostatek zlaťáků!"); }
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
  if (typeof renderScreen === 'function') renderScreen();
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
    alert(`Úspěšně zakoupeno! 🛒\nPoložka ${itemKey} byla přidána.`); if (typeof renderScreen === 'function') renderScreen();
  } else { alert("Nemáš dostatek zlaťáků!"); }
}
window.buyFreeze = function() { buyShopItem("Zmrazeni", 20); };

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
