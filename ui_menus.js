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
      _renderSelectUser(main, bSubj, bGroup);
    }
    else if (currentScreen === "SELECT_SUBJECT") {
      _renderSelectSubject(main, bSubj, bGroup);
    }
    else if (currentScreen === "SHOP") {
      _renderShop(main, bSubj, bGroup);
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
        const streakDays = (u.streak !== undefined) ? u.streak : (typeof getUserStreak === 'function' ? getUserStreak(u.name) : 0);
        const coins = Number(u.coins || 0); const freezes = typeof getUserItemCount === 'function' ? getUserItemCount(u.name, "Zmrazeni") : 0;
        const hasPin = !!(u.pin || localStorage.getItem(`user_pin_${u.name.toLowerCase().trim()}`));
        let themesArr = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(u.name) : [];
        const unlockedSkins = themesArr.filter(t => t !== 'default').map(t => { const s = typeof APP_SKINS !== 'undefined' ? APP_SKINS.find(x => x.id === t) : null; return s ? s.name.split(' ')[0] : t; }).join(' ');

        return `
          <div class="tile" style="${isDone ? 'border-color:var(--col-yellow);' : ''} position:relative;" onclick="if(typeof selectUser === 'function') selectUser('${u.name.replace(/'/g, "\\'")}', ${g}, ${targetM})">
            ${hasPin ? `<div style="position:absolute; top:8px; right:8px; font-size:16px;">🔒</div>` : ''}
            <h2>${u.name}</h2><p>${g >= 10 && g < 90 ? `${g-9}. ročník SŠ` : (g<=9 ? `${g}. tř.` : 'Dospělý')}</p>
            <p style="color:var(--col-orange);margin-top:4px;">🔥 Série: ${streakDays} dní</p>
            <p style="color:${isDone ? 'var(--col-yellow)' : 'var(--col-text-muted)'};margin-top:2px;font-weight:bold;">⏱️ Dnes: ${uMin}/${targetM} min ${isDone?'★':''}</p>
            <p style="color:var(--col-text-muted);margin-top:4px;font-size:12px;background:rgba(0,0,0,0.2);padding:2px 6px;border-radius:6px;min-height:22px;">
              💰 ${coins} | 🧊 ${freezes}x | 🐍 ${u.maxSnake || 0}
              ${unlockedSkins ? `<br>🎨 ${unlockedSkins}` : ''}
            </p>
          </div>
        `;
      }).join('')}
    </div>
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
          <div style="color:var(--col-yellow);font-size:18px;font-weight:bold;">${coins} 💰</div>
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

      <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;display:flex;justify-content:space-between;align-items:center;">
         <div><b style="font-size:16px;">🔐 Ochrana profilu</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">Zamez ostatním ve vstupu do tvého účtu.</p></div>
         <button class="action-btn" style="margin:0;padding:8px 12px;font-size:14px;" onclick="if(typeof setUserPIN==='function') setUserPIN()">${hasPin ? 'Změnit PIN' : 'Nastavit PIN'}</button>
      </div>

      <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:12px;padding:14px;margin-bottom:15px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div><b style="font-size:16px;">🧊 Zmrazení série</b><p style="font-size:12px;color:var(--col-text-muted);margin-top:2px;">Ochrání tvou sérii, když vynecháš den.</p></div>
          <span style="font-size:15px;color:var(--col-active-tab);font-weight:bold;margin-left:8px;">Máš: ${freezes}x</span>
        </div>
        <button class="action-btn" style="padding:10px;font-size:15px;width:100%;margin-top:6px;" onclick="if(typeof buyFreeze==='function') buyFreeze()">Koupit zmrazení (Cena: 20 💰)</button>
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
                                      <button class="toggle-btn on" style="font-size:13px;padding:6px 10px;" onclick="if(typeof buySkin==='function') buySkin('${skin.id}', ${skin.cost})">Koupit (${skin.cost} 💰)</button>` 
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
  const subjNorm = selectedSubject.toLowerCase().replace(/[^a-z]/g, ""); 
  if (currentUser && currentUser.startLevels) {
    for (let k in currentUser.startLevels) { if (subjNorm.includes(k) || k.includes(subjNorm)) { userMinLvl = Number(currentUser.startLevels[k]) || 1; break; } }
  }

  let currentLessonIndex = 0;
  for (let i = 0; i < lessons.length; i++) {
    let num = parseInt(lessons[i].replace(/\D/g, '')) || 1;
    if (num <= userMinLvl) currentLessonIndex = i;
  }

  for (let i = currentLessonIndex; i < lessons.length; i++) {
    let lItems = activeItems.filter(it => it.lesson === lessons[i]);
    let pct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(lItems, selectedSubject) : 0;
    
    // Lekce je považována za dokončenou až při zvládnutí na 85 %!
    if (pct < 85) {
        currentLessonIndex = i;
        break;
    }
    currentLessonIndex = i;
  }
  
  let cefrHtml = "";
  if (/angli|nemc|spanel|franc|ital/i.test(subjNorm)) {
     const cefrPct = Math.min(100, Math.max(0, Math.round((currentLessonIndex / Math.max(1, lessons.length - 1)) * 100)));
     cefrHtml = `
       <div style="width: 100%; max-width: 320px; margin: 5px auto 25px auto;">
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
    
    let cx = CENTER_X + offsetsX[i % offsetsX.length]; let cy = nodeYPositions[i];
    let cmd = i === 0 ? "M" : "L";
    pathStringAll += `${cmd} ${cx} ${cy} `;
    if (i <= currentLessonIndex) pathStringDone += `${cmd} ${cx} ${cy} `;
    
    let nodeClass = isActive ? "active" : (isCompleted ? "completed" : "locked");
    let icon = isActive ? "▶️" : (isCompleted ? "⭐" : "🔒");
    
    let storyHtml = "";
    if (storiesByLesson[l]) {
       storiesByLesson[l].forEach((story, sIdx) => {
           let isDone = (typeof isStoryCompleted === "function") && isStoryCompleted(story.title, story.items);
           let storyClass = isDone ? "done" : ""; let storyIcon = isDone ? "📖" : "🎁";
           let storySide = cx <= CENTER_X ? `left: 100%; margin-left: 14px;` : `right: 100%; margin-right: 14px;`;
           // OPRAVA (Bod 4): event.stopPropagation() zabrání spuštění lekce pod příběhem!
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
         <div class="map-label ${isActive ? 'active' : ''}">${l}</div>${icon}${storyHtml}
      </div>`;
  });

  main.innerHTML = `
    <div style="text-align:center; padding:15px 10px 0 10px;"><h2 style="color:var(--col-active-tab);font-size:26px;margin-bottom:8px;">Cesta k mistrovství</h2>${cefrHtml}</div>
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
