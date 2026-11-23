/**
 * MODUL PRO VYKRESLOVÁNÍ MENU A OBRAZOVEK (UI MENUS)
 */

function renderScreen() {
  try {
    if (typeof updateFooter === 'function') updateFooter(); 
    if (typeof updateStudyTimerUI === 'function') updateStudyTimerUI(); 
    if (typeof updateTTSBtnUI === "function") updateTTSBtnUI();
    
    const main = document.getElementById("main-content");
    const bUser = document.getElementById("badge-user"); 
    const bSubj = document.getElementById("badge-subj"); 
    const bGroup = document.getElementById("badge-group");
    
    // Tlačítko uživatele v horní liště (odkaz do Předmětů)
    if (bUser) {
      bUser.innerText = currentUser ? currentUser.name : "Uživatel";
      bUser.onclick = () => {
         if (currentUser) setScreen('SELECT_SUBJECT');
         else setScreen('SELECT_USER');
      };
    }

    // ==========================================
    // HLAVNÍ SMĚROVAČ (ROUTER) OBRAZOVEK
    // ==========================================
    if (currentScreen === "SELECT_USER" || !currentUser) {
   document.body.setAttribute('data-theme', 'default');
 } else if (!(currentScreen === "SHOP" && typeof previewingSkin !== 'undefined' && previewingSkin)) {
   document.body.setAttribute('data-theme', currentUser.activeTheme || 'default');
 }
    if (currentScreen === "SELECT_USER" || !currentUser) {
      _renderSelectUser(main, bSubj, bGroup);
    }
    else if (currentScreen === "SELECT_SUBJECT") {
      _renderSelectSubject(main, bSubj, bGroup);
    }
    else if (currentScreen === "SHOP") {
      _renderShop(main, bSubj, bGroup);
    }
    else if (currentScreen === "AVATAR_SHOP") {
      _renderAvatarShop(main, bSubj, bGroup);
    }
    else if (currentScreen === "SELECT_GROUP" || currentScreen === "SELECT_MATH_OP") {
      _renderSelectGroup(main, bSubj, bGroup);
    }
    else if (currentScreen === "CAMPAIGN_HUB") {
      _renderCampaignHub(main, bSubj, bGroup);
    }
    else if (currentScreen === "SELECT_GAME") {
      _renderSelectGame(main, bSubj, bGroup);
    }
    else if (currentScreen === "SELECT_SEQ_ITEM") {
      _renderSelectSeqItem(main, bSubj, bGroup);
    }
    else if (currentScreen === "SELECT_PEXESO_SIZE") {
      _renderSelectPexesoSize(main, bSubj, bGroup);
    }
    else if (currentScreen === "PLAYING") {
      if (bSubj) { bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; }
      if (bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
      if (typeof renderActiveGame === "function") renderActiveGame(main);
    }

  } catch (err) {
    console.error("Kritická chyba v renderScreen:", err);
    document.getElementById("main-content").innerHTML = `<div style="text-align:center;padding:30px;color:red;">Kritická chyba zobrazení.<br><br>${err.message}</div>`;
  }
}

// -------------------------------------------------------------
// JEDNOTLIVÉ OBRAZOVKY MENU (KOMPONENTY)
// -------------------------------------------------------------

function _renderSelectUser(main, bSubj, bGroup) {
  if (bSubj) bSubj.style.display = "none"; 
  if (bGroup) bGroup.style.display = "none";
  
  const uList = typeof appData !== 'undefined' && appData.users ? appData.users : [];
  if (uList.length === 0) {
    main.innerHTML = `<div style="text-align:center;padding:30px;"><p style="margin-bottom:15px;">Načítám profily z tabulky...</p></div>`;
    return;
  }
  
  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Kdo se jde učit?</h2>
    <div class="grid-2">
      ${uList.map(u => {
        const g = parseInt(u.grade) || 2;
        const localSec = typeof loadUserStudyTime === 'function' ? loadUserStudyTime(u.name) : 0;
        const cloudSec = (typeof appData !== 'undefined' && appData.syncDate === getTodayDateStr()) ? Math.round(Number(u.todayMinutes || 0) * 60) : 0;
        const uSec = Math.max(localSec, cloudSec);
        
        const uMin = Math.floor(uSec / 60); const targetM = u.targetMinutes || 15; const isDone = uMin >= targetM;
        const st = (typeof getUserStreakStatus === 'function') ? getUserStreakStatus(u.name) : { effectiveStreak: (u.streak || 0), state: 'NONE', rawStreak: (u.streak || 0) };
        let streakLabel = `🔥 Série: ${st.effectiveStreak} dní`;
        if (st.state === 'FREEZABLE') streakLabel = `🧊 Série: ${st.effectiveStreak} dní (zachraň!)`;
        else if (st.state === 'BROKEN') streakLabel = `💔 Série: 0 (bylo ${st.rawStreak})`;
        const coins = Number(u.coins || 0); const freezes = typeof getUserItemCount === 'function' ? getUserItemCount(u.name, "Zmrazeni") : 0;
        const hasPin = !!(u.pin !== undefined ? u.pin : localStorage.getItem(`user_pin_${u.name.toLowerCase().trim()}`));
        let themesArr = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(u.name) : [];
        const unlockedSkins = themesArr.filter(t => t !== 'default').map(t => { const s = typeof APP_SKINS !== 'undefined' ? APP_SKINS.find(x => x.id === t) : null; return s ? s.name.split(' ')[0] : t; }).join(' ');
        
        const uLvl = (typeof getLevelInfo === 'function' && typeof getUserXp === 'function') ? getLevelInfo(getUserXp(u.name)) : { level: 1, totalXp: 0 };
        const uWeekXp = (typeof getUserWeeklyXp === 'function') ? getUserWeeklyXp(u.name) : 0;
        
        return `
          <div class="tile" style="${isDone ? 'border-color:var(--col-yellow);' : ''} position:relative;" onclick="if(typeof selectUser === 'function') selectUser('${u.name.replace(/'/g, "\\'")}', ${g}, ${targetM})">
            ${hasPin ? `<div style="position:absolute; top:8px; right:8px; font-size:16px;">🔒</div>` : ''}
            <div style="margin-bottom:4px;">${typeof renderAvatarSVG === 'function' ? renderAvatarSVG(u.name, 62) : ''}</div>
            <h2>${u.name}</h2><p>${g >= 10 && g < 90 ? `${g-9}. ročník SŠ` : (g<=9 ? `${g}. tř.` : 'Dospělý')}</p>
            <p style="color:var(--col-orange);margin-top:4px;cursor:pointer;text-decoration:underline dotted;" onclick="openStreakModal('${u.name.replace(/'/g, "\\'")}', event)">${streakLabel} 📅</p>
            <p style="color:${isDone ? 'var(--col-yellow)' : 'var(--col-text-muted)'};margin-top:2px;font-weight:bold;">⏱️ Dnes: ${uMin}/${targetM} min ${isDone?'★':''}</p>
            <p style="color:var(--col-active-tab);margin-top:2px;font-size:12px;font-weight:bold;">⚡ Lv.${uLvl.level} · 🏆 ${uWeekXp} XP</p>
            <p style="color:var(--col-text-muted);margin-top:4px;font-size:12px;background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:6px;min-height:22px;">
              💰 ${coins} | 🧊 ${freezes}x | 🐍 ${u.maxSnake || 0}
              ${unlockedSkins ? `<br>🎨 ${unlockedSkins}` : ''}
            </p>
          </div>
        `;
      }).join('')}
    </div>
    ${typeof renderWeeklyLeaderboardBox === 'function' ? renderWeeklyLeaderboardBox() : ''}
  `;
}

function _renderSelectSubject(main, bSubj, bGroup) {
  if (bSubj) bSubj.style.display = "none"; 
  if (bGroup) bGroup.style.display = "none";
  
  const userG = parseInt(currentUser.grade) || 2;
  const subjs = {};
  (appData.items || []).forEach(it => { if (typeof isItemAllowedForGrade === 'function' && isItemAllowedForGrade(it, userG)) subjs[it.subject] = (subjs[it.subject] || 0) + 1; });

  const coins = typeof getUserCoins === 'function' ? getUserCoins(currentUser.name) : 0;
  const freezes = typeof getUserItemCount === 'function' ? getUserItemCount(currentUser.name, "Zmrazeni") : 0;
  const unlocked = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(currentUser.name) : [];
  const skinCount = unlocked.length;

  let html = `
    ${userG >= 90 ? `
      <div class="filter-bar">
        <span>👑 Režim Dospělý: Vidíš úlohy ze všech ročníků</span>
      </div>
    ` : ''}

    <div class="tile" style="border-color:var(--col-yellow);margin-bottom:10px;padding:12px 14px;cursor:pointer;" onclick="if(typeof setScreen==='function') setScreen('SHOP')">
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <div style="display:flex;align-items:center;gap:12px;">
          <span style="font-size:32px;">🛒</span>
          <div style="text-align:left;">
            <h2 style="color:var(--col-yellow);margin-bottom:2px;font-size:18px;">Obchod, Vzhledy a Profil</h2>
            <p style="color:var(--col-text-muted);font-size:12px;">Společný obchod pro všechny předměty</p>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="color:var(--col-yellow);font-size:18px;font-weight:bold;">${coins} 🪙</div>
          <div style="color:var(--col-active-tab);font-size:12px;margin-top:2px;">🧊 ${freezes}x | 🎨 ${skinCount}</div>
        </div>
      </div>
    </div>
    <div class="grid-2">
      ${!subjs["Matematika"] ? `
        <div class="tile" style="border-color:var(--col-active-tab);" onclick="if(typeof chooseSubject === 'function') chooseSubject('Matematika')">
          <h2 style="color:var(--col-active-tab);">🔢 Matematika</h2><p>Výběr operací a dril</p>
        </div>
      ` : ''}
  `;
  
  Object.keys(subjs).forEach(s => {
    const sLow = s.toLowerCase();
    const isCesta = sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn");
    const isMat = (s === "Matematika");
    const stl = isCesta ? 'border-color:var(--col-green);' : (isMat ? 'border-color:var(--col-active-tab);' : '');
    const ikn = isCesta ? '🚀 ' : (isMat ? '🔢 ' : '');
    html += `<div class="tile" style="${stl}" onclick="if(typeof chooseSubject==='function') chooseSubject('${s.replace(/'/g, "\\'")}')"><h2>${ikn}${s}</h2><p>${isMat ? 'Dril + ' + subjs[s] + ' úloh' : subjs[s] + ' úloh'}</p></div>`;
  });
  
  html += `</div>`;
  main.innerHTML = html;
}

function _renderShop(main, bSubj, bGroup) {
  if (bSubj) { bSubj.style.display = "flex"; bSubj.innerText = "🛒 Obchod a Profil"; }
  if (bGroup) bGroup.style.display = "none";
  
  const freezes = typeof getUserItemCount === 'function' ? getUserItemCount(currentUser.name, "Zmrazeni") : 0;
  const unlockedThemes = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(currentUser.name) : []; 
  const activeTheme = typeof getUserActiveTheme === 'function' ? getUserActiveTheme(currentUser.name) : 'default';
  
  const uKey = currentUser.name.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const hasPin = !!(u && u.pin) || !!localStorage.getItem(`user_pin_${uKey}`);

  let masteredSet = new Set();
  let storiesSet = new Set();
  const prog = (appData.progress && appData.progress[uKey]) ? appData.progress[uKey] : {};
  
  for (const key in prog) {
      if (key.includes("STORY")) {
          if (Number(prog[key]) >= 1) storiesSet.add(key);
      } else {
          if (Number(prog[key]) >= 2) masteredSet.add(key);
      }
  }
  for (let i = 0; i < localStorage.length; i++) {
      const lKey = localStorage.key(i);
      if (lKey.startsWith(`story_done_${uKey}`)) storiesSet.add(lKey);
  }

  main.innerHTML = `
    <div style="padding:4px;">
    <div class="tile" style="border-color:var(--col-active-tab); flex-direction:row; justify-content:space-between; padding:12px 14px; margin-bottom:15px;" onclick="setScreen('AVATAR_SHOP')">
        <div style="display:flex; align-items:center; gap:12px;">
          ${typeof renderAvatarSVG === 'function' ? renderAvatarSVG(currentUser.name, 64) : ''}
          <div style="text-align:left;">
            <h2 style="color:var(--col-active-tab); font-size:17px; margin-bottom:2px;">👕 Šatník panáčka</h2>
            <p style="font-size:12px;">Postava, čepice, brýle, oblek, mazlíček</p>
          </div>
        </div>
        <span style="font-size:20px; color:var(--col-active-tab); font-weight:bold;">➔</span>
      </div>
      <div style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:12px; padding:15px; margin-bottom:15px; text-align:center;">
         <h2 style="color:var(--col-active-tab); font-size:19px; margin-bottom:12px;">🎓 Průkaz studenta</h2>
         <div style="display:flex; justify-content:space-around; align-items:center;">
            <div>
               <div style="font-size:26px; font-weight:bold; color:var(--col-yellow);">${masteredSet.size}</div>
               <div style="font-size:12px; color:var(--col-text-muted);">Zlatých úloh</div>
            </div>
            <div>
               <div style="font-size:26px; font-weight:bold; color:var(--col-green);">${storiesSet.size}</div>
               <div style="font-size:12px; color:var(--col-text-muted);">Příběhů</div>
            </div>
            <div>
               <div style="font-size:26px; font-weight:bold; color:#10b981;">${currentUser.maxSnake || 0}</div>
               <div style="font-size:12px; color:var(--col-text-muted);">Rekord Hada</div>
            </div>
         </div>
      </div>
      ${typeof renderStreakHistoryBox === 'function' ? renderStreakHistoryBox(currentUser.name) : ''}
      ${typeof renderXpLevelCard === 'function' ? renderXpLevelCard(currentUser.name) : ''}
      ${typeof renderWeeklyLeaderboardBox === 'function' ? renderWeeklyLeaderboardBox() : ''}

      <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;">
         <div><b style="font-size:16px;">🔐 Ochrana profilu</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">Zamez ostatním ve vstupu do tvého účtu.</p></div>
         <button class="action-btn" style="margin:0;padding:8px 12px;font-size:14px;" onclick="if(typeof setUserPIN==='function') setUserPIN()">${hasPin ? 'Změnit PIN' : 'Nastavit PIN'}</button>
      </div>

      <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div><b style="font-size:16px;">🧊 Zmrazení série</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">Ochrání tvou sérii, když vynecháš den.</p></div>
          <span style="font-size:15px;color:var(--col-active-tab);font-weight:bold;margin-left:8px;">Máš: ${freezes}x</span>
        </div>
        <button class="action-btn" style="padding:10px;font-size:15px;width:100%;margin-top:6px;" onclick="if(typeof buyFreeze==='function') buyFreeze()">Koupit zmrazení (Cena: 20 🪙)</button>
      </div>

      <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          ${typeof APP_SKINS !== 'undefined' ? APP_SKINS.map(skin => {
            const isUnlocked = unlockedThemes.includes(skin.id); const isActive = activeTheme === skin.id; const isPreview = typeof previewingSkin !== 'undefined' && previewingSkin === skin.id;
            return `
              <div style="display:flex;flex-direction:column;background:var(--col-bg);padding:10px 12px;border-radius:8px;border:1px solid ${isActive?'var(--col-active-tab)':'var(--col-card-border)'};">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                  <div><b style="color:var(--col-yellow);font-size:15px;">${skin.name}</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">${skin.desc}</p></div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    ${isActive ? `<span style="color:var(--col-green);font-size:12px;font-weight:bold;padding:6px 10px;background:rgba(34,197,94,0.1);border-radius:6px;border:1px solid var(--col-green);">✅ Aktivní</span>` 
                      : isUnlocked ? `<button class="toggle-btn on" style="font-size:13px;padding:6px 14px;" onclick="if(typeof equipSkin==='function') equipSkin('${skin.id}')">Nasadit</button>` 
                      : (isPreview ? `<button class="toggle-btn" style="font-size:12px;padding:4px 8px;" onclick="if(typeof cancelPreview==='function') cancelPreview()">Zrušit náhled</button>
                                      <button class="toggle-btn on" style="font-size:13px;padding:6px 10px;" onclick="if(typeof buySkin==='function') buySkin('${skin.id}', ${skin.cost})">Koupit (${skin.cost} 🪙)</button>` 
                      : `<button class="toggle-btn" style="font-size:12px;padding:6px 10px;border-color:var(--col-active-tab);" onclick="if(typeof previewSkin==='function') previewSkin('${skin.id}')">👁️ Náhled</button>`)}
                  </div>
                </div>
              </div>
            `;
          }).join('') : ''}
        </div>
      </div>
      <div class="action-btn" style="margin-top:15px;" onclick="if(typeof cancelPreview==='function') cancelPreview(); if(typeof setScreen==='function') setScreen('SELECT_SUBJECT')">◀️ Zpět k výběru předmětů</div>
    </div>
  `;
}

function _renderSelectGroup(main, bSubj, bGroup) {
  if (bSubj) { bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; }
  if (bGroup) bGroup.style.display = "none";
  
  let html = "";

  if (selectedSubject === "Matematika") {
    let ops = [
      { id: "FRACTIONS_STEP", title: "Zlomky (Krokově)", desc: "Sčítání a odčítání formou řešení na papíře." },
      { id: "EXPR_QUADRATIC", title: "Algebraické výrazy", desc: "Zadávej libovolné mezikroky roznásobení (x+a)²." },
      { id: "EQ_KEYBOARD", title: "Rovnice (Klávesnice)", desc: "Upravuj libovolně obě strany rovnice přes klávesnici." },
      { id: "EQ_FRACTIONS", title: "Rovnice se zlomky", desc: "Nácvik odstranění zlomku z rovnice." },
      { id: "ADD_SUB_20_NO", title: "+ a - do 20", desc: "12 + 5, 17 - 4" },
      { id: "MUL_SMALL", title: "Malá násobilka", desc: "Základy násobení" }
    ];
    html += `
      <h2 style="font-size:18px;margin-bottom:10px;text-align:center;color:var(--col-yellow);">Nekonečný trénink:</h2>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:18px;">
        ${ops.map(o => `
          <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left; ${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC'||o.id==='FRACTIONS_STEP' ? 'border-color:var(--col-green);' : ''}" onclick="if(typeof startMathPractice==='function') startMathPractice('${o.id}', '${o.title}')">
            <div><h2 style="${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC'||o.id==='FRACTIONS_STEP' ? 'color:var(--col-green);' : ''}">${o.title}</h2><p>${o.desc}</p></div>
            <span style="color:var(--col-active-tab);font-weight:bold;font-size:20px;">➔</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  const groupsMap = {};
  if (activeItems && activeItems.length > 0) {
    activeItems.forEach(it => {
      const k = (typeof viewMode !== 'undefined' && viewMode === "LESSONS") ? it.lesson : it.topic;
      if (!k) return; if (!groupsMap[k]) groupsMap[k] = { name: k, count: 0, raw: [] };
      groupsMap[k].count++; groupsMap[k].raw.push(it);
    });

    html += `
      <h2 style="font-size:18px;margin-bottom:10px;text-align:center;color:var(--col-yellow);">${selectedSubject === "Matematika" ? "Úlohy a testy z tabulky:" : "Výběr lekce / tématu:"}</h2>
      <div class="filter-bar">
        <button class="toggle-btn ${typeof viewMode !== 'undefined' && viewMode==='LESSONS'?'on':''}" onclick="if(typeof viewMode !== 'undefined') { viewMode='LESSONS'; renderScreen(); }">Lekce</button>
        <button class="toggle-btn ${typeof viewMode !== 'undefined' && viewMode==='TOPICS'?'on':''}" onclick="if(typeof viewMode !== 'undefined') { viewMode='TOPICS'; renderScreen(); }">Témata</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${Object.values(groupsMap).map(g => {
          const mPct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(g.raw, selectedSubject) : 0;
          return `
            <div class="tile" style="flex-direction:column;align-items:stretch;padding:12px;" onclick="if(typeof chooseGroup==='function') chooseGroup('${g.name.replace(/'/g, "\\'")}')">
              <div style="display:flex;justify-content:space-between;"><h2>${g.name}</h2><span style="color:var(--col-active-tab);">${g.count} úloh</span></div>
              <div class="bargraph-track" style="height:6px;margin-top:6px;"><div class="bargraph-fill" style="width:${mPct}%;"></div></div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } else if (selectedSubject !== "Matematika") {
    html += `<div style="text-align:center;padding:20px;color:var(--col-text-muted);">V tomto předmětu zatím nejsou žádné úlohy.</div>`;
  }

  main.innerHTML = html;
}

function _renderCampaignHub(main, bSubj, bGroup) {
  if (bSubj) { bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; }
  if (bGroup) bGroup.style.display = "none";
  
  const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
  let lessons = [...new Set(vItems.map(it => it.lesson))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  let userMinLvl = 1;
  const subjNorm = selectedSubject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, ""); 
  if (currentUser && currentUser.startLevels) {
    for (let k in currentUser.startLevels) { if (subjNorm.includes(k) || k.includes(subjNorm)) { userMinLvl = Number(currentUser.startLevels[k]) || 1; break; } }
  }

  let currentLessonIndex = 0;
  for (let i = 0; i < lessons.length; i++) {
    let num = parseInt(lessons[i].replace(/\D/g, '')) || 1;
    if (num <= userMinLvl) currentLessonIndex = i;
  }

  const itemsByLesson = {};
  activeItems.forEach(it => {
    if (!it.lesson) return;
    if (!itemsByLesson[it.lesson]) itemsByLesson[it.lesson] = [];
    itemsByLesson[it.lesson].push(it);
  });

  const lessonPcts = lessons.map(l =>
    (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(itemsByLesson[l] || [], selectedSubject) : 0
  );

  for (let i = currentLessonIndex; i < lessons.length; i++) {
    if (lessonPcts[i] < 85) {
      currentLessonIndex = i;
      break;
    }
    currentLessonIndex = i;
  }
  
  let cefrHtml = "";
  if (/angli|nemc|spanel|franc|ital/i.test(subjNorm)) {
     const cefrPct = Math.min(100, Math.max(0, Math.round((currentLessonIndex / Math.max(1, lessons.length - 1)) * 100)));
     cefrHtml = `
       <div style="width: 100%; max-width: 320px; margin: 5px auto 14px auto;">
         <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:5px; font-weight:bold;">
            <span style="color:${cefrPct<25?'var(--col-text)':'var(--col-text-muted)'};">A1</span>
            <span style="color:${cefrPct>=25&&cefrPct<50?'var(--col-text)':'var(--col-text-muted)'};">A2</span>
            <span style="color:${cefrPct>=50&&cefrPct<75?'var(--col-text)':'var(--col-text-muted)'};">B1</span>
            <span style="color:${cefrPct>=75?'var(--col-text)':'var(--col-text-muted)'};">B2</span>
         </div>
         <div class="bargraph-track" style="height:6px; border-radius:3px;">
           <div class="bargraph-fill" style="width:${cefrPct}%; background:linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
         </div>
       </div>
     `;
  }

  const activeLessonName = lessons[currentLessonIndex] || "";
  const activeLessonPct = lessonPcts[currentLessonIndex] || 0;
  const activeProgressHtml = activeLessonName ? `
    <div style="width:100%; max-width:320px; margin: 0 auto 18px auto; background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:8px 12px; text-align:left;">
      <div style="display:flex; justify-content:space-between; font-size:12px; font-weight:bold; margin-bottom:5px;">
        <span style="color:var(--col-yellow);">📍 ${activeLessonName}</span>
        <span style="color:var(--col-active-tab);">${activeLessonPct} % <span style="color:var(--col-text-muted);font-weight:normal;">(cíl 85 %)</span></span>
      </div>
      <div class="bargraph-track" style="height:8px; position:relative;">
        <div class="bargraph-fill" style="width:${activeLessonPct}%;"></div>
        <div style="position:absolute; left:85%; top:0; bottom:0; width:2px; background:var(--col-yellow); opacity:0.9;" title="Hranice odemčení dalšího levelu: 85 %"></div>
      </div>
    </div>
  ` : '';

  let storiesByLesson = {};
  const userG = parseInt(currentUser.grade) || 2;
  let allSubjectItems = (appData.items || []).filter(it => it.subject === selectedSubject && (typeof isItemAllowedForGrade==='function' ? isItemAllowedForGrade(it, userG) : true));
  allSubjectItems.forEach(it => {
      if (it.type && it.type.toUpperCase().includes('PRIBEH')) {
          let t = it.topic || 'Příběh';
          if (!storiesByLesson[it.lesson]) storiesByLesson[it.lesson] = [];
          if (!storiesByLesson[it.lesson].some(s => s.title === t)) {
              let sItems = allSubjectItems.filter(x => x.topic === t && x.type.toUpperCase().includes('PRIBEH'));
              storiesByLesson[it.lesson].push({ title: t, items: sItems });
          }
      }
  });

  const offsetsX = [0, -35, -70, -90, -50, 10, 60, 85, 45, -15, -60, -85, -35, 25, 75, 95, 55, 0, -45, -80]; 
  const offsetsY = [120, 150, 110, 140, 160, 115, 135, 155, 125, 145]; 
  const MAP_WIDTH = 340; const CENTER_X = MAP_WIDTH / 2; const PADDING_TOP = 40; 
  
  let nodeYPositions = []; let currentY = PADDING_TOP;
  for (let i = 0; i < lessons.length; i++) {
     nodeYPositions.push(currentY);
     currentY += offsetsY[i % offsetsY.length]; 
  }
  let svgHeight = currentY + 30; 
  let pathStringAll = ""; let pathStringDone = ""; let mapNodesHtml = "";
  
  lessons.forEach((l, i) => {
    let isCompleted = i < currentLessonIndex;
    let isActive = i === currentLessonIndex;
    let isLocked = i > currentLessonIndex;
    let pct = lessonPcts[i] || 0;
    
    let cx = CENTER_X + offsetsX[i % offsetsX.length]; let cy = nodeYPositions[i];
    let cmd = i === 0 ? "M" : "L";
    pathStringAll += `${cmd} ${cx} ${cy} `;
    if (i <= currentLessonIndex) pathStringDone += `${cmd} ${cx} ${cy} `;
    
    let nodeClass = isActive ? "active" : (isCompleted ? "completed" : "locked");
    let icon = isActive ? "▶️" : (isCompleted ? "⭐" : "🔒");
    let labelText = (isActive || isCompleted) ? `${l} · ${pct} %` : l;

    let activeRingHtml = "";
    if (isActive) {
      const r = 50;
      const circ = 2 * Math.PI * r;
      const offset = circ * (1 - Math.min(100, Math.max(0, pct)) / 100);
      activeRingHtml = `
        <svg width="110" height="110" viewBox="0 0 110 110" style="position:absolute; left:50%; top:50%; transform:translate(-50%, -50%) rotate(-90deg); pointer-events:none; z-index:1;">
          <circle cx="55" cy="55" r="${r}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="5" />
          <circle cx="55" cy="55" r="${r}" fill="none" stroke="var(--col-yellow)" stroke-width="5" stroke-linecap="round"
                  stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}" />
        </svg>
      `;
    }
    
    let storyHtml = "";
    if (storiesByLesson[l]) {
       storiesByLesson[l].forEach((story, sIdx) => {
           let isDone = (typeof isStoryCompleted === "function") && isStoryCompleted(story.title, story.items);
           let storyClass = isDone ? "done" : ""; let storyIcon = isDone ? "📖" : "🎁";
           let storySide = cx <= CENTER_X ? `left: 100%; margin-left: 14px;` : `right: 100%; margin-right: 14px;`;
           let clickAction = isLocked 
             ? `event.stopPropagation(); alert('Tento příběh se odemkne, až se dostaneš do této lekce.');` 
             : `event.stopPropagation(); if(typeof startStory==='function') startStory('${story.title.replace(/'/g, "\\'")}');`;
           storyHtml += `<div class="map-story-btn ${storyClass}" style="position: absolute; ${storySide} top: 50%; transform: translateY(-50%); z-index: 10;" onpointerdown="event.stopPropagation();" onclick="${clickAction}" title="${story.title}">${storyIcon}</div>`;
       });
    }

    let clickAction = "";
    if (isActive || isCompleted) clickAction = `if(typeof selectedGroupKey !== 'undefined') selectedGroupKey = '${l.replace(/'/g, "\\'")}'; if(typeof startCampaign==='function') startCampaign();`;

    mapNodesHtml += `
      <div class="map-node ${nodeClass}" ${isActive ? 'id="active-lesson-node"' : ''} style="position: absolute; left: ${cx}px; top: ${cy}px; transform: translate(-50%, -50%); z-index: 2;" onclick="${clickAction}">
         ${activeRingHtml}<div class="map-label ${isActive ? 'active' : ''}">${labelText}</div>${icon}${storyHtml}
      </div>`;
  });

  main.innerHTML = `
    <div style="text-align:center; padding:15px 10px 0 10px;"><h2 style="color:var(--col-active-tab);font-size:26px;margin-bottom:8px;">Cesta k mistrovství</h2>${cefrHtml}${activeProgressHtml}</div>
    <div style="position: relative; width: ${MAP_WIDTH}px; height: ${svgHeight}px; margin: 0 auto; overflow: visible;">
       <svg width="${MAP_WIDTH}" height="${svgHeight}" style="position:absolute; top:0; left:0; z-index:1; pointer-events:none;">
          <path d="${pathStringAll}" stroke="var(--col-card-border)" stroke-width="24" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          <path d="${pathStringAll}" stroke="var(--col-card-alt)" stroke-width="16" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          <path d="${pathStringDone}" stroke="#166534" stroke-width="24" fill="none" stroke-linejoin="round" stroke-linecap="round" />
          <path d="${pathStringDone}" stroke="var(--col-green)" stroke-width="16" fill="none" stroke-linejoin="round" stroke-linecap="round" />
       </svg>
       ${mapNodesHtml}
    </div>
  `;
  
  setTimeout(() => {
     const activeNode = document.getElementById('active-lesson-node');
     if (activeNode) activeNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 100);
}

function _renderSelectGame(main, bSubj, bGroup) {
  if (bSubj) { bSubj.style.display = "flex"; }
  if (bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
  
  const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
  const qItems = typeof getQuizItems === 'function' ? getQuizItems() : [];
  const sItems = typeof getSeqItems === 'function' ? getSeqItems() : [];
  const quickMode = typeof getQuickChoiceMode === 'function' ? getQuickChoiceMode() : null;
  let html = "";
  
  if (vItems.length > 0 || qItems.length > 0) {
    html += `
      <div class="action-btn" style="background:linear-gradient(135deg, #8b5cf6, #3b82f6); border-color:#c4b5fd; margin-bottom:5px; padding:16px; font-size:20px; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);" onclick="if(typeof startSmartMix==='function') startSmartMix()">
        🧠 SPUSTIT CHYTRÝ TRÉNINK
      </div>
    `;
  }

  // --- SEKCE 1: STUDIUM ---
  html += `
    <div style="margin: 18px 0 10px 0; border-bottom: 2px solid var(--col-card-border); padding-bottom: 5px;">
      <h3 style="color:var(--col-active-tab); font-size:16px; text-transform:uppercase; letter-spacing:1px;">📚 Studium</h3>
    </div>
    <div class="grid-2">
  `;
  if (vItems.length > 0) {
    html += `
      <div class="tile" onclick="if(typeof startGame==='function') startGame('CARDS')"><h2>1. Karty</h2><p>Čtení (${vItems.length})</p></div>
      <div class="tile" style="border-color:var(--col-green);" onclick="if(typeof startGame==='function') startGame('ADAPTIVE')">
        <h2 style="color:var(--col-green);">2. Zkoušení</h2><p>${typeof testingDirection!=='undefined' && testingDirection==='DIR_OUT'?'🇨🇿 ➔ Cizí':'Cizí ➔ 🇨🇿'}</p>
      </div>
      <div class="tile" onclick="if(typeof startGame==='function') startGame('SCRAMBLE')"><h2>3. Skládání</h2><p>Pravopis</p></div>
    `;
  }
  if (qItems.length > 0) {
    html += `<div class="tile" style="border-color:var(--col-green);" onclick="if(typeof startGame==='function') startGame('QUIZ')"><h2 style="color:var(--col-green);">📝 Kvíz</h2><p>${qItems.length} otázek</p></div>`;
  }
  if (sItems.length > 0) {
    html += `<div class="tile" style="border-color:var(--col-yellow);" onclick="if(typeof openSequenceMenu==='function') openSequenceMenu()"><h2 style="color:var(--col-yellow);">⏱️ Řada na čas</h2><p>${sItems.length} úloh</p></div>`;
  }
  html += `</div>`;

  // --- SEKCE 2: HRY ---
  html += `
    <div style="margin: 22px 0 10px 0; border-bottom: 2px solid var(--col-card-border); padding-bottom: 5px;">
      <h3 style="color:var(--col-yellow); font-size:16px; text-transform:uppercase; letter-spacing:1px;">🎮 Hry</h3>
    </div>
    <div class="grid-2">
  `;
  if (vItems.length > 0) {
    html += `
      <div class="tile" onclick="if(typeof setScreen==='function') setScreen('SELECT_PEXESO_SIZE')"><h2>🃏 Pexeso</h2><p>Hledání dvojic</p></div>
      <div class="tile" style="border-color:var(--col-green);" onclick="if(typeof startSnakeGame === 'function') startSnakeGame()">
        <h2 style="color:var(--col-green);">🐍 Had</h2><p>Pravopis na čas</p>
      </div>
      <div class="tile" style="border-color:var(--col-active-tab);" onclick="if(typeof startTargetGame === 'function') startTargetGame()">
        <h2 style="color:var(--col-active-tab);">🎯 Střelba</h2><p>Přetahování na čas</p>
      </div>
    `;
  }

  let translateEligible = vItems.filter(it => it.question.split(' ').length <= 2 && !it.question.includes('.')).length >= 3;
  if (translateEligible) {
    html += `
      <div class="tile" style="border-color:var(--col-orange);" onclick="if(typeof startArcadeGame==='function') startArcadeGame('TRANSLATE')">
        <h2 style="color:var(--col-orange);">☄️ Padající slova</h2><p>Rychlý překlad</p>
      </div>
    `;
  }
  if (quickMode) {
    let modeLabel = quickMode;
    if (quickMode === "DER_DIE_DAS") modeLabel = "Členy der/die/das";
    else if (quickMode === "A_AN") modeLabel = "Členy a / an";
    else if (quickMode === "I_Y") modeLabel = "Doplňování i / y";
    html += `
      <div class="tile" style="border-color:var(--col-orange);" onclick="if(typeof startArcadeGame==='function') startArcadeGame('${quickMode}')">
        <h2 style="color:var(--col-orange);">☄️ Padající slova</h2><p>${modeLabel}</p>
      </div>
    `;
  }
  if (vItems.length === 0 && qItems.length === 0 && sItems.length === 0) {
    html += `<div style="grid-column:span 2;text-align:center;padding:20px;color:var(--col-text-muted);">V této lekci nejsou žádná data ke hraní.</div>`;
  }
  html += `</div>`;
  main.innerHTML = html;
}

function _renderSelectSeqItem(main, bSubj, bGroup) {
  if (bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
  const sItems = typeof getSeqItems === 'function' ? getSeqItems() : [];
  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber, co chceš skládat:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${sItems.map((it, idx) => `
        <div class="tile" style="border-color:var(--col-yellow);padding:15px;" onclick="if(typeof selectedSeqIndex !== 'undefined') selectedSeqIndex=${idx}; if(typeof startGame==='function') startGame('SEQ');">
          <h2 style="color:var(--col-yellow);">${it.question}</h2>
          <p>${it.answer.split('|').length} položek v řadě</p>
        </div>
      `).join('')}
    </div>
  `;
}

function _renderSelectPexesoSize(main, bSubj, bGroup) {
  if (bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber velikost pexesa:</h2>
    <div class="grid-2">
      <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(3)"><h2>6 KARET</h2><p>3 dvojice</p></div>
      <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(4)"><h2>8 KARET</h2><p>4 dvojice</p></div>
      <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(6)"><h2>12 KARET</h2><p>6 dvojic</p></div>
      <div class="tile" onclick="if(typeof startPexesoGame === 'function') startPexesoGame(8)"><h2>16 KARET</h2><p>8 dvojic</p></div>
    </div>
  `;
}

function renderStreakHistoryBox(userName) {
  if (typeof getUserStreakStatus !== "function") return "";
  const st = getUserStreakStatus(userName);

  const daysHtml = st.days.map(d => {
    let cls = "empty";
    let icon = "·";
    if (d.state === "DONE") { cls = "done"; icon = "🔥"; }
    else if (d.state === "FREEZE") { cls = "freeze"; icon = "🧊"; }
    else if (d.state === "PENDING_FREEZE") { cls = "freeze pending"; icon = "🧊"; }
    else if (d.state === "MISSED") { cls = "missed"; icon = "💔"; }
    else if (d.state === "TODAY_PENDING") { cls = "today"; icon = "⏳"; }

    return `
      <div class="streak-day ${cls}" title="${d.dateStr}: ${d.minutes}/${d.targetMin} min">
        <div class="streak-day-name">${d.label}</div>
        <div class="streak-day-icon">${icon}</div>
        <div class="streak-day-min">${d.minuteLabel || (d.minutes + 'm')}</div>
      </div>
    `;
  }).join('');

  return `
    <div style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:12px; padding:12px; margin-bottom:15px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <b style="font-size:15px; color:var(--col-orange);">🔥 Posledních 7 dní série</b>
        <span style="font-size:12px; color:var(--col-active-tab);">🧊 Zmrazení: ${st.freezes}×</span>
      </div>
      <div class="streak-strip">${daysHtml}</div>
      <div style="font-size:12px; color:var(--col-text-muted); text-align:center; margin-top:8px; line-height:1.35;">
        ${st.message}
      </div>
      <div style="display:flex; justify-content:center; gap:10px; font-size:10px; color:var(--col-text-muted); margin-top:6px; opacity:0.85;">
        <span>🔥 Splněno</span><span>🧊 Zmrazeno</span><span>💔 Vynecháno</span><span>⏳ Dnes</span>
      </div>
    </div>
  `;
}

window.openStreakModal = function(userName, e) {
  if (e) e.stopPropagation();
  const existing = document.getElementById("streak-modal-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "streak-modal-overlay";
  overlay.className = "streak-modal-backdrop";
  overlay.onclick = () => overlay.remove();

  overlay.innerHTML = `
    <div class="streak-modal-card" onclick="event.stopPropagation()">
      <h3 style="text-align:center; color:var(--col-yellow); margin-bottom:10px;">Přehled série: ${userName}</h3>
      ${renderStreakHistoryBox(userName)}
      <div class="action-btn" style="margin-top:4px; padding:10px;" onclick="document.getElementById('streak-modal-overlay').remove()">Zavřít</div>
    </div>
  `;
  document.body.appendChild(overlay);
};
function renderXpLevelCard(userName) {
  if (typeof getUserXp !== "function" || typeof getLevelInfo !== "function") return "";
  const info = getLevelInfo(getUserXp(userName));
  const wXp = getUserWeeklyXp(userName);
  const stXp = getStreakXpInfo(userName);

  const bonusText = stXp.bonusPct > 0
    ? `🔥 Bonus série (${stXp.streak} d.): <b style="color:var(--col-green);">+${stXp.bonusPct} % XP</b>`
    : `🔥 Tip: Udrž sérii 3 dny v kuse a získej <b>+15 % XP</b> navíc!`;

  return `
    <div style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:12px; padding:12px; margin-bottom:15px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
        <b style="font-size:16px; color:var(--col-active-tab);">⚡ Úroveň ${info.level}</b>
        <span style="font-size:12px; color:var(--col-yellow); font-weight:bold;">Celkem: ${info.totalXp} XP | Týden: ${wXp} XP</span>
      </div>
      <div class="bargraph-track" style="height:10px;">
        <div class="bargraph-fill" style="width:${info.pct}%; background:linear-gradient(90deg, #3b82f6, #a855f7);"></div>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--col-text-muted); margin-top:5px;">
        <span>Do další úrovně: ${info.currentLevelXp} / ${info.nextLevelXp} XP</span>
        <span>${info.pct} %</span>
      </div>
      <div style="font-size:11px; color:var(--col-text-muted); margin-top:6px; text-align:center;">${bonusText}</div>
    </div>
  `;
}

function renderWeeklyLeaderboardBox() {
  const uList = (typeof appData !== 'undefined' && Array.isArray(appData.users)) ? appData.users : [];
  if (uList.length === 0 || typeof getUserWeeklyXp !== "function") return "";

  const ranked = uList.map(u => {
    const totalXp = getUserXp(u.name);
    const lvl = getLevelInfo(totalXp).level;
    const wXp = getUserWeeklyXp(u.name);
    return { name: u.name, level: lvl, weeklyXp: wXp };
  }).sort((a, b) => b.weeklyXp - a.weeklyXp);

  const maxW = Math.max(1, ranked[0].weeklyXp);
  const medals = ['🥇', '🥈', '🥉'];

  return `
    <div style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:12px; padding:12px; margin-top:14px; margin-bottom:15px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <b style="font-size:15px; color:var(--col-yellow);">🏆 Týdenní rodinná liga</b>
        <span style="font-size:11px; color:var(--col-text-muted);">Po – Ne</span>
      </div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${ranked.map((r, idx) => {
          const isMe = (typeof currentUser !== 'undefined' && currentUser && currentUser.name.toLowerCase().trim() === r.name.toLowerCase().trim());
          const pct = Math.round((r.weeklyXp / maxW) * 100);
          return `
            <div style="background:var(--col-card-alt); border:1px solid ${isMe ? 'var(--col-active-tab)' : 'var(--col-card-border)'}; border-radius:8px; padding:6px 10px;">
              <div style="display:flex; justify-content:space-between; align-items:center; font-size:13px; margin-bottom:3px;">
                <span style="display:inline-flex;align-items:center;gap:6px;">
                  <b>${medals[idx] || (idx + 1) + '.'}</b>
                  ${typeof renderAvatarSVG === 'function' ? renderAvatarSVG(r.name, 26) : ''}
                  <b>${r.name}</b> <span style="font-size:11px; color:var(--col-active-tab);">Lv.${r.level}</span>
                </span>
                <b style="color:var(--col-yellow);">${r.weeklyXp} XP</b>
              </div>
              <div class="bargraph-track" style="height:5px;">
                <div class="bargraph-fill" style="width:${pct}%; background:${idx === 0 ? 'linear-gradient(90deg, #facc15, #f97316)' : 'linear-gradient(90deg, var(--col-active-tab), var(--col-green))'};"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

let _avSvgUid = 0;

function renderAvatarSVG(userName, size = 72, overrideEquip = null) {
  const eq = overrideEquip || (typeof getUserAvatarEquip === 'function' ? getUserAvatarEquip(userName) : { base: 'base_boy', bg: 'bg_space', outfit: 'outfit_tee' });
  const uid = ++_avSvgUid;

  // 1. Pozadí
  let bgSvg = `<rect width="120" height="120" fill="#0f172a"/><circle cx="24" cy="26" r="1.5" fill="#facc15"/><circle cx="95" cy="28" r="1.8" fill="#fff"/><circle cx="88" cy="65" r="1.2" fill="#93c5fd"/><circle cx="22" cy="72" r="1.2" fill="#fff"/>`;
  let borderCol = '#38bdf8';
  if (eq.bg === 'bg_forest') {
    bgSvg = `<rect width="120" height="120" fill="#064e3b"/><circle cx="60" cy="128" r="58" fill="#15803d"/><circle cx="20" cy="115" r="35" fill="#166534"/>`;
    borderCol = '#4ade80';
  } else if (eq.bg === 'bg_lava') {
    bgSvg = `<rect width="120" height="120" fill="#450a0a"/><circle cx="60" cy="125" r="55" fill="#991b1b"/><circle cx="30" cy="30" r="2" fill="#fb923c"/><circle cx="92" cy="45" r="2.2" fill="#facc15"/>`;
    borderCol = '#f97316';
  } else if (eq.bg === 'bg_gold') {
    bgSvg = `<rect width="120" height="120" fill="#422006"/><circle cx="60" cy="60" r="46" fill="#713f12"/><circle cx="26" cy="26" r="2.5" fill="#fef08a"/><circle cx="94" cy="30" r="2" fill="#fde047"/>`;
    borderCol = '#facc15';
  }

  // 2. Plášť za tělem
  const backCape = (eq.outfit === 'outfit_cape') ? `<path d="M 34 74 L 14 120 L 106 120 L 86 74 Z" fill="#dc2626"/>` : '';

  // 3. Oblečení
  let outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#0284c7"/><path d="M 48 74 Q 60 84 72 74" fill="none" stroke="#bae6fd" stroke-width="3"/>`;
  if (eq.outfit === 'outfit_bolt') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#1e293b"/><polygon points="62,82 52,99 60,99 56,113 69,95 61,95" fill="#facc15"/>`;
  } else if (eq.outfit === 'outfit_hoodie') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#16a34a"/><path d="M 44 75 Q 60 88 76 75" fill="none" stroke="#86efac" stroke-width="4"/><line x1="53" y1="81" x2="53" y2="96" stroke="#fff" stroke-width="2"/><line x1="67" y1="81" x2="67" y2="96" stroke="#fff" stroke-width="2"/>`;
  } else if (eq.outfit === 'outfit_armor') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#64748b"/><circle cx="34" cy="85" r="10" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/><circle cx="86" cy="85" r="10" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/><path d="M 44 76 L 60 94 L 76 76" fill="none" stroke="#facc15" stroke-width="2.5"/>`;
  } else if (eq.outfit === 'outfit_cape') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#2563eb"/><polygon points="60,83 63,91 71,91 65,96 67,104 60,99 53,104 55,96 49,91 57,91" fill="#facc15"/>`;
  }

  // 4. Hlava / Postava
  let headSvg = '';
  if (eq.base === 'base_girl') {
    headSvg = `
      <rect x="53" y="64" width="14" height="13" fill="#fdba74"/>
      <path d="M 33 48 C 33 22, 87 22, 87 48 L 89 76 L 76 76 L 76 56 L 44 56 L 44 76 L 31 76 Z" fill="#92400e"/>
      <circle cx="60" cy="48" r="22" fill="#fed7aa"/>
      <path d="M 38 42 Q 48 25 62 32 Q 74 25 82 42 Q 72 20 46 24 Z" fill="#92400e"/>
      <circle cx="51" cy="47" r="3" fill="#0f172a"/><circle cx="69" cy="47" r="3" fill="#0f172a"/>
      <circle cx="52" cy="46" r="1" fill="#fff"/><circle cx="70" cy="46" r="1" fill="#fff"/>
      <path d="M 52 57 Q 60 63 68 57" fill="none" stroke="#9a3412" stroke-width="2.5" stroke-linecap="round"/>
    `;
  } else if (eq.base === 'base_cat') {
    headSvg = `
      <rect x="53" y="64" width="14" height="13" fill="#fb923c"/>
      <polygon points="39,38 40,17 54,29" fill="#fb923c"/><polygon points="42,35 43,22 51,29" fill="#fda4af"/>
      <polygon points="81,38 80,17 66,29" fill="#fb923c"/><polygon points="78,35 77,22 69,29" fill="#fda4af"/>
      <circle cx="60" cy="48" r="22" fill="#fb923c"/>
      <circle cx="51" cy="47" r="3.2" fill="#0f172a"/><circle cx="69" cy="47" r="3.2" fill="#0f172a"/>
      <polygon points="57,52 63,52 60,56" fill="#be123c"/>
      <path d="M 54 58 Q 60 62 66 58" fill="none" stroke="#7c2d12" stroke-width="2" stroke-linecap="round"/>
      <line x1="34" y1="50" x2="45" y2="52" stroke="#7c2d12" stroke-width="1.5"/><line x1="34" y1="56" x2="45" y2="55" stroke="#7c2d12" stroke-width="1.5"/>
      <line x1="86" y1="50" x2="75" y2="52" stroke="#7c2d12" stroke-width="1.5"/><line x1="86" y1="56" x2="75" y2="55" stroke="#7c2d12" stroke-width="1.5"/>
    `;
  } else if (eq.base === 'base_robot') {
    headSvg = `
      <rect x="54" y="65" width="12" height="12" fill="#64748b"/>
      <line x1="60" y1="13" x2="60" y2="26" stroke="#cbd5e1" stroke-width="3"/><circle cx="60" cy="12" r="4" fill="#38bdf8"/>
      <rect x="36" y="25" width="48" height="44" rx="10" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="43" y="39" width="34" height="15" rx="5" fill="#0f172a"/>
      <circle cx="51" cy="47" r="3.5" fill="#38bdf8"/><circle cx="69" cy="47" r="3.5" fill="#38bdf8"/>
      <rect x="49" y="59" width="22" height="5" rx="2" fill="#475569"/>
    `;
  } else if (eq.base === 'base_alien') {
    headSvg = `
      <rect x="54" y="65" width="12" height="12" fill="#22c55e"/>
      <line x1="47" y1="29" x2="41" y2="15" stroke="#4ade80" stroke-width="3"/><circle cx="40" cy="14" r="4" fill="#a855f7"/>
      <line x1="73" y1="29" x2="79" y2="15" stroke="#4ade80" stroke-width="3"/><circle cx="80" cy="14" r="4" fill="#a855f7"/>
      <circle cx="60" cy="48" r="22" fill="#4ade80"/>
      <ellipse cx="51" cy="47" rx="4.5" ry="6" fill="#0f172a"/><ellipse cx="69" cy="47" rx="4.5" ry="6" fill="#0f172a"/>
      <circle cx="52" cy="45" r="1.5" fill="#fff"/><circle cx="70" cy="45" r="1.5" fill="#fff"/>
      <path d="M 54 59 Q 60 63 66 59" fill="none" stroke="#14532d" stroke-width="2" stroke-linecap="round"/>
    `;
  } else {
    headSvg = `
      <rect x="53" y="64" width="14" height="13" fill="#fdba74"/>
      <circle cx="60" cy="48" r="22" fill="#fed7aa"/>
      <path d="M 38 42 C 38 22, 82 22, 82 42 Q 70 31 60 34 Q 49 31 38 42 Z" fill="#78350f"/>
      <circle cx="51" cy="47" r="3" fill="#0f172a"/><circle cx="69" cy="47" r="3" fill="#0f172a"/>
      <circle cx="52" cy="46" r="1" fill="#fff"/><circle cx="70" cy="46" r="1" fill="#fff"/>
      <path d="M 52 57 Q 60 63 68 57" fill="none" stroke="#9a3412" stroke-width="2.5" stroke-linecap="round"/>
    `;
  }

  // 5. Brýle
  let glassesSvg = '';
  if (eq.glasses === 'gl_nerd') {
    glassesSvg = `<circle cx="51" cy="47" r="7" fill="rgba(255,255,255,0.2)" stroke="#1e293b" stroke-width="2.2"/><circle cx="69" cy="47" r="7" fill="rgba(255,255,255,0.2)" stroke="#1e293b" stroke-width="2.2"/><line x1="58" y1="47" x2="62" y2="47" stroke="#1e293b" stroke-width="2.2"/>`;
  } else if (eq.glasses === 'gl_sun') {
    glassesSvg = `<rect x="42" y="42" width="16" height="11" rx="3" fill="#09090b"/><rect x="62" y="42" width="16" height="11" rx="3" fill="#09090b"/><line x1="58" y1="46" x2="62" y2="46" stroke="#09090b" stroke-width="2.5"/><line x1="45" y1="44" x2="49" y2="50" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/><line x1="65" y1="44" x2="69" y2="50" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/>`;
  } else if (eq.glasses === 'gl_pirate') {
    glassesSvg = `<line x1="38" y1="38" x2="82" y2="52" stroke="#09090b" stroke-width="2.2"/><circle cx="51" cy="47" r="7.5" fill="#09090b" stroke="#475569" stroke-width="1.5"/>`;
  } else if (eq.glasses === 'gl_visor') {
    glassesSvg = `<rect x="40" y="42" width="40" height="10" rx="4" fill="rgba(6,182,212,0.8)" stroke="#f43f5e" stroke-width="2"/>`;
  }

  // 6. Čepice
  let hatSvg = '';
  if (eq.hat === 'hat_cap') {
    hatSvg = `<path d="M 37 33 C 37 15, 83 15, 83 33 Z" fill="#ef4444"/><path d="M 55 30 L 92 32 L 84 36 L 55 34 Z" fill="#b91c1c"/>`;
  } else if (eq.hat === 'hat_headphones') {
    hatSvg = `<path d="M 35 47 C 35 16, 85 16, 85 47" fill="none" stroke="#1e293b" stroke-width="5"/><rect x="30" y="40" width="8" height="15" rx="4" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5"/><rect x="82" y="40" width="8" height="15" rx="4" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5"/>`;
  } else if (eq.hat === 'hat_viking') {
    hatSvg = `<path d="M 38 33 C 38 15, 82 15, 82 33 Z" fill="#94a3b8"/><rect x="37" y="29" width="46" height="5" rx="2" fill="#facc15"/><path d="M 38 28 Q 22 20 26 7 Q 32 17 42 23 Z" fill="#f8fafc"/><path d="M 82 28 Q 98 20 94 7 Q 88 17 78 23 Z" fill="#f8fafc"/>`;
  } else if (eq.hat === 'hat_wizard') {
    hatSvg = `<ellipse cx="60" cy="31" rx="30" ry="6" fill="#581c87"/><polygon points="41,30 79,30 62,3" fill="#7e22ce"/><polygon points="60,13 62,18 67,18 63,21 64,26 60,23 56,26 57,21 53,18 58,18" fill="#facc15"/>`;
  } else if (eq.hat === 'hat_crown') {
    hatSvg = `<path d="M 40 29 L 38 11 L 50 20 L 60 7 L 70 20 L 82 11 L 80 29 Z" fill="#facc15" stroke="#b45309" stroke-width="1.5"/><circle cx="60" cy="21" r="2.5" fill="#ef4444"/><circle cx="48" cy="23" r="2" fill="#3b82f6"/><circle cx="72" cy="23" r="2" fill="#3b82f6"/>`;
  }

  // 7. Doplněk / Mazlíček
  let petSvg = '';
  if (eq.pet === 'pet_ball') {
    petSvg = `<circle cx="96" cy="96" r="13" fill="#fff" stroke="#0f172a" stroke-width="2"/><polygon points="96,90 101,94 99,100 93,100 91,94" fill="#0f172a"/>`;
  } else if (eq.pet === 'pet_sword') {
    petSvg = `<polygon points="96,55 101,62 101,94 91,94 91,62" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/><rect x="86" y="93" width="20" height="4" rx="2" fill="#facc15"/><rect x="94" y="97" width="4" height="12" fill="#78350f"/>`;
  } else if (eq.pet === 'pet_wand') {
    petSvg = `<line x1="94" y1="108" x2="100" y2="75" stroke="#92400e" stroke-width="3.5" stroke-linecap="round"/><polygon points="100,63 103,70 110,70 104,74 106,81 100,77 94,81 96,74 90,70 97,70" fill="#facc15"/>`;
  } else if (eq.pet === 'pet_rocket') {
    petSvg = `<path d="M 96 68 C 103 77, 103 93, 100 98 L 92 98 C 89 93, 89 77, 96 68 Z" fill="#ef4444" stroke="#fff" stroke-width="1.5"/><circle cx="96" cy="83" r="3.5" fill="#38bdf8"/><polygon points="92,98 100,98 96,109" fill="#facc15"/>`;
  } else if (eq.pet === 'pet_dragon') {
    petSvg = `<path d="M 84 94 Q 76 80 88 83 Z" fill="#f97316"/><ellipse cx="97" cy="98" rx="11" ry="12" fill="#22c55e"/><circle cx="97" cy="82" r="9" fill="#4ade80"/><polygon points="91,74 93,67 96,74" fill="#facc15"/><polygon points="99,74 102,67 104,74" fill="#facc15"/><circle cx="94" cy="81" r="1.8" fill="#0f172a"/><circle cx="100" cy="81" r="1.8" fill="#0f172a"/>`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 120 120" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
      <defs><clipPath id="avc-${uid}"><circle cx="60" cy="60" r="56"/></clipPath></defs>
      <g clip-path="url(#avc-${uid})">${bgSvg}${backCape}${outfitSvg}${headSvg}${glassesSvg}${hatSvg}${petSvg}</g>
      <circle cx="60" cy="60" r="56" fill="none" stroke="${borderCol}" stroke-width="4"/>
    </svg>
  `;
}

function _renderAvatarShop(main, bSubj, bGroup) {
  if (bSubj) { bSubj.style.display = "flex"; bSubj.innerText = "👕 Šatník panáčka"; }
  if (bGroup) bGroup.style.display = "none";

  const coins = getUserCoins(currentUser.name);
  const owned = getUserAvatarItems(currentUser.name);
  const realEquip = getUserAvatarEquip(currentUser.name);
  const displayEquip = avatarPreviewEquip || realEquip;
  const activeTab = typeof avatarShopTab !== 'undefined' ? avatarShopTab : 'hat';

  const catItems = AVATAR_ITEMS.filter(it => it.slot === activeTab);
  const canRemove = ['hat', 'glasses', 'pet'].includes(activeTab);

  main.innerHTML = `
    <div style="padding:4px;">
      <div style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:12px; padding:12px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; gap:12px;">
        ${renderAvatarSVG(currentUser.name, 108, displayEquip)}
        <div style="flex:1;">
          <h2 style="color:var(--col-active-tab); font-size:18px; margin-bottom:4px;">${currentUser.name}</h2>
          <p style="font-size:15px; color:var(--col-yellow); font-weight:bold; margin-bottom:6px;">Máš: ${coins} 🪙</p>
          ${avatarPreviewEquip ? `<p style="font-size:12px; color:var(--col-orange); font-weight:bold;">👁️ Režim náhledu</p>` : `<p style="font-size:12px; color:var(--col-text-muted);">Vyber kategorii a nakombinuj styl!</p>`}
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; margin-bottom:12px;">
        ${AVATAR_CATEGORIES.map(c => `
          <button class="toggle-btn ${activeTab === c.id ? 'on' : ''}" style="padding:8px 4px; font-size:12px;" onclick="avatarShopTab='${c.id}'; renderScreen();">${c.label}</button>
        `).join('')}
      </div>

      <div class="grid-2" style="margin-bottom:12px;">
        ${canRemove ? `
          <div class="tile" style="${!realEquip[activeTab] ? 'border-color:var(--col-green);' : ''}" onclick="equipAvatarItem('${activeTab}', '')">
            <h2 style="font-size:15px;">🚫 Sundat</h2>
            <p>${!realEquip[activeTab] ? '✅ Sundáno' : 'Nasadit nic'}</p>
          </div>
        ` : ''}
        ${catItems.map(it => {
          const isOwned = owned.includes(it.id);
          const isEquipped = realEquip[it.slot] === it.id;
          const isPreview = avatarPreviewEquip && avatarPreviewEquip[it.slot] === it.id;
          return `
            <div class="tile" style="${isEquipped ? 'border-color:var(--col-green);' : (isPreview ? 'border-color:var(--col-yellow);' : '')}">
              <h2 style="font-size:15px; color:var(--col-yellow);">${it.name}</h2>
              <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; justify-content:center;">
                ${isEquipped ? `<span style="color:var(--col-green); font-size:12px; font-weight:bold;">✅ Nasazeno</span>`
                  : isOwned ? `<button class="toggle-btn on" style="font-size:12px;" onclick="equipAvatarItem('${it.slot}', '${it.id}')">Nasadit</button>`
                  : `
                    <button class="toggle-btn" style="font-size:12px;" onclick="previewAvatarItem('${it.slot}', '${it.id}')">👁️ Zkusit</button>
                    <button class="toggle-btn on" style="font-size:12px; ${coins < it.cost ? 'opacity:0.4;' : ''}" onclick="buyAvatarItem('${it.id}')">Koupit (${it.cost} 🪙)</button>
                  `}
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <div class="action-btn" onclick="cancelAvatarPreview(); setScreen('SHOP');">◀️ Zpět do Obchodu a Profilu</div>
    </div>
  `;
}
