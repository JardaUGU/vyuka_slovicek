/**
 * MODUL PRO DENNÍ SÉRII (STREAK) A HISTORII 7 DNÍ
 */

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
