/**
 * MODUL PRO ADVENTNÍ KALENDÁŘ (1.–24. prosince)
 * Pravidlo: 1 splněný denní limit = otevření 1 adventního okénka (aktuálního nebo zpětně za nesplněný den).
 */

const ADVENT_ORDER = [
  14, 3, 21, 8, 1, 19,
  11, 24, 6, 16, 2, 12,
  22, 9, 4, 17, 7, 20,
  13, 5, 23, 10, 15, 18
];

const ADVENT_REWARDS = {
  1:  { coins: 5,  label: "5 zlaťáků", icon: "🪙" },
  2:  { coins: 8,  label: "8 zlaťáků", icon: "🪙" },
  3:  { xp: 50,    label: "50 XP", icon: "⚡" },
  4:  { coins: 10, label: "10 zlaťáků", icon: "🪙" },
  5:  { coins: 15, xp: 50, label: "Mikuláš: 15 zlaťáků + 50 XP", icon: "🎅" },
  6:  { freeze: 1, label: "1× Zmrazení série", icon: "🧊" },
  7:  { coins: 8,  label: "8 zlaťáků", icon: "🪙" },
  8:  { xp: 75,    label: "75 XP", icon: "⚡" },
  9:  { coins: 10, label: "10 zlaťáků", icon: "🪙" },
  10: { coins: 12, label: "12 zlaťáků", icon: "🪙" },
  11: { xp: 100,   label: "100 XP", icon: "⚡" },
  12: { freeze: 1, coins: 5, label: "1× Zmrazení + 5 zlaťáků", icon: "🧊" },
  13: { coins: 12, label: "12 zlaťáků", icon: "🪙" },
  14: { xp: 100,   label: "100 XP", icon: "⚡" },
  15: { coins: 15, label: "15 zlaťáků", icon: "🪙" },
  16: { coins: 12, label: "12 zlaťáků", icon: "🪙" },
  17: { xp: 120,   label: "120 XP", icon: "⚡" },
  18: { freeze: 1, coins: 10, label: "1× Zmrazení + 10 zlaťáků", icon: "🧊" },
  19: { coins: 15, label: "15 zlaťáků", icon: "🪙" },
  20: { xp: 150,   label: "150 XP", icon: "⚡" },
  21: { coins: 18, label: "18 zlaťáků", icon: "🪙" },
  22: { coins: 20, label: "20 zlaťáků", icon: "🪙" },
  23: { xp: 200, coins: 10, label: "200 XP + 10 zlaťáků", icon: "🌟" },
  24: { coins: 35, freeze: 1, xp: 250, label: "Štědrý den: 35 zlaťáků + 1× Zmrazení + 250 XP!", icon: "🎄" }
};

function getAdventContext() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const todayStr = getTodayDateStr();
  const isDecember = (month === 12);
  const isCountdown = (month === 11 && day >= 24);
  const maxDayAllowed = isDecember ? Math.min(24, day) : 0;
  return { year, month, day, todayStr, isDecember, isCountdown, maxDayAllowed };
}

function getUserAdventState(userName) {
  const ctx = getAdventContext();
  if (!userName) return { year: ctx.year, days: [], lastDate: "" };
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);

  let localObj = { year: ctx.year, days: [] };
  try {
    const raw = JSON.parse(localStorage.getItem(`advent_days_${uKey}`) || 'null');
    if (raw && raw.year === ctx.year && Array.isArray(raw.days)) localObj = raw;
  } catch (e) {}

  const cloudDays = (u && u.adventYear === ctx.year && Array.isArray(u.adventDays)) ? u.adventDays : [];
  const mergedDays = [...new Set([...localObj.days, ...cloudDays])].map(Number).filter(n => n >= 1 && n <= 24).sort((a, b) => a - b);

  const localLast = localStorage.getItem(`advent_last_${uKey}`) || "";
  const cloudLast = (u && u.adventLastDate) ? String(u.adventLastDate).slice(0, 10) : "";
  const lastDate = (localLast > cloudLast) ? localLast : cloudLast;

  return { year: ctx.year, days: mergedDays, lastDate };
}

function isUserTodayLimitDone(userName) {
  if (!userName) return false;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const targetMin = (u && u.targetMinutes) ? Number(u.targetMinutes) : ((currentUser && currentUser.targetMinutes) ? Number(currentUser.targetMinutes) : 15);
  const localMin = (typeof loadUserStudyTime === "function" ? loadUserStudyTime(userName) : 0) / 60;
  const cloudMin = (u && appData.syncDate === getTodayDateStr()) ? Number(u.todayMinutes || 0) : 0;
  return Math.max(localMin, cloudMin) >= targetMin;
}

function canClaimAdventWindow(userName) {
  const ctx = getAdventContext();
  if (!ctx.isDecember || !userName) return false;
  const st = getUserAdventState(userName);
  if (st.lastDate === ctx.todayStr) return false;
  if (st.days.length >= ctx.maxDayAllowed) return false;
  return isUserTodayLimitDone(userName);
}

function claimAdventDay(dayNum) {
  if (!currentUser) return;
  const ctx = getAdventContext();
  if (!ctx.isDecember) { alert("Adventní kalendář se otevírá od 1. prosince!"); return; }
  if (dayNum < 1 || dayNum > ctx.maxDayAllowed) { alert(`Okénko ${dayNum} se odemkne až ${dayNum}. 12.`); return; }

  const st = getUserAdventState(currentUser.name);
  if (st.days.includes(dayNum)) return;

  if (!isUserTodayLimitDone(currentUser.name)) {
    alert(`Nejprve splň dnešní denní cíl (${currentUser.targetMinutes || 15} min studia)!`);
    return;
  }
  if (st.lastDate === ctx.todayStr) {
    alert("Dnes už jsi své adventní okénko otevřel(a)! Další si můžeš otevřít zítra po splnění denního limitu.");
    return;
  }

  const reward = ADVENT_REWARDS[dayNum] || { coins: 5, label: "5 zlaťáků" };
  const uKey = currentUser.name.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);

  const newDays = [...st.days, dayNum].sort((a, b) => a - b);
  localStorage.setItem(`advent_days_${uKey}`, JSON.stringify({ year: ctx.year, days: newDays }));
  localStorage.setItem(`advent_last_${uKey}`, ctx.todayStr);
  if (u) {
    u.adventYear = ctx.year;
    u.adventDays = newDays;
    u.adventLastDate = ctx.todayStr;
  }

  // Přičteme odměnu lokálně (na serveru ji bezpečně zapíše claim_advent)
  if (reward.coins) {
    const newCoins = (typeof getUserCoins === "function" ? getUserCoins(currentUser.name) : 0) + reward.coins;
    if (u) u.coins = newCoins;
    currentUser.coins = newCoins;
    localStorage.setItem(`coins_${uKey}`, String(newCoins));
  }
  if (reward.freeze) {
    const curF = typeof getUserItemCount === "function" ? getUserItemCount(currentUser.name, "Zmrazeni") : 0;
    const newF = curF + reward.freeze;
    localStorage.setItem(`item_Zmrazeni_${uKey}`, String(newF));
    if (u && u.inventory) {
      u.inventory["Zmrazeni"] = newF;
      u.inventory["zmrazeni"] = newF;
    }
  }
  if (reward.xp && typeof addLocalXp === "function") {
    addLocalXp(currentUser.name, reward.xp);
  }
  localStorage.setItem("cur_user", JSON.stringify(currentUser));

  if (typeof sndFanfare === "function") sndFanfare();

  try {
    const fd = new URLSearchParams();
    fd.append("action", "claim_advent");
    fd.append("user", currentUser.name);
    fd.append("day", String(dayNum));
    fd.append("minutes", (todaySecondsStudied / 60).toFixed(2));
    fd.append("clientDate", ctx.todayStr);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd, keepalive: true });
  } catch (e) {}

  alert(`🎁 Okénko ${dayNum}. 12. otevřeno!\nZískal(a) jsi: ${reward.label}`);
  if (typeof renderScreen === "function") renderScreen();
}

function renderAdventScreen(main, bSubj, bGroup) {
  if (bSubj) { bSubj.style.display = "flex"; bSubj.innerText = "🎄 Advent"; }
  if (bGroup) bGroup.style.display = "none";

  const ctx = getAdventContext();
  const st = getUserAdventState(currentUser.name);
  const limitDone = isUserTodayLimitDone(currentUser.name);
  const canClaim = canClaimAdventWindow(currentUser.name);
  const targetMin = currentUser.targetMinutes || 15;
  const spentMin = Math.floor((typeof todaySecondsStudied !== "undefined" ? todaySecondsStudied : 0) / 60);

  let statusBanner = "";
  if (!ctx.isDecember) {
    const daysLeft = Math.max(1, 31 - ctx.day);
    statusBanner = `🎄 Adventní kalendář se odemkne <b>1. prosince</b> (zbývá ${daysLeft} ${daysLeft === 1 ? 'den' : (daysLeft < 5 ? 'dny' : 'dní')}). Každý den si po splnění denního limitu otevřeš 1 okénko!`;
  } else if (st.days.length >= 24) {
    statusBanner = `🎉 <b>Máš otevřený celý Adventní kalendář (24 / 24)!</b> Veselé Vánoce! 🎄`;
  } else if (st.lastDate === ctx.todayStr) {
    statusBanner = `✅ <b>Dnešní okénko už máš otevřené!</b> (${st.days.length}/24) Další odemkneš zítra po splnění limitu.`;
  } else if (limitDone) {
    statusBanner = `🎁 <b>Denní limit splněn!</b> Vyber si <b>1 neotevřené okénko</b> (dnešní nebo zpětně z minulých dnů).`;
  } else {
    statusBanner = `⏳ Splň dnes <b>${targetMin} min</b> studia (máš ${spentMin}/${targetMin} min) a otevři si <b>1 okénko</b> (${st.days.length}/24).`;
  }

  const doorsHtml = ADVENT_ORDER.map(dayNum => {
    const rew = ADVENT_REWARDS[dayNum] || { label: "", icon: "🎁" };
    const isOpened = st.days.includes(dayNum);
    const isFuture = !ctx.isDecember || dayNum > ctx.maxDayAllowed;
    const isReady = !isOpened && !isFuture && canClaim;

    let cls = "advent-door";
    let subText = "🔒";
    let onclickAttr = "";

    if (isOpened) {
      cls += " opened";
      const shortVal = rew.coins ? `+${rew.coins}` : (rew.freeze ? `+${rew.freeze}🧊` : `+${rew.xp}XP`);
      subText = `${rew.icon} ${shortVal}`;
    } else if (isFuture) {
      cls += " locked";
      subText = "🔒";
      onclickAttr = `onclick="alert('Okénko ${dayNum}. 12. se odemkne až ${dayNum}. prosince!')"`;
    } else if (isReady) {
      cls += " ready";
      subText = "🎁 Otevřít";
      onclickAttr = `onclick="claimAdventDay(${dayNum})"`;
    } else {
      cls += " missed";
      subText = (st.lastDate === ctx.todayStr) ? "Zítra" : "⏳ Limit";
      onclickAttr = `onclick="claimAdventDay(${dayNum})"`;
    }

    return `
      <div class="${cls}" ${onclickAttr} title="${isOpened ? rew.label : (dayNum + '. prosince')}">
        <div class="advent-num">${dayNum}</div>
        <div class="advent-sub">${subText}</div>
      </div>
    `;
  }).join('');

  main.innerHTML = `
    <div style="padding:4px;">
      <div style="background:linear-gradient(135deg, #14532d, #7f1d1d); border:2px solid var(--col-yellow); border-radius:12px; padding:12px; margin-bottom:12px; text-align:center;">
        <h2 style="color:var(--col-yellow); font-size:20px; margin-bottom:6px;">🎄 Adventní kalendář (${st.days.length}/24)</h2>
        <p style="font-size:13px; color:#fef9c3; line-height:1.4;">${statusBanner}</p>
      </div>

      <div class="advent-grid">
        ${doorsHtml}
      </div>

      <div class="action-btn" style="margin-top:14px;" onclick="setScreen('SELECT_SUBJECT')">◀️ Zpět k výběru předmětů</div>
    </div>
  `;
}
