/**
 * MODUL PRO VYKRESLOVÁNÍ UŽIVATELSKÉHO ROZHRANÍ (UI RENDERER)
 */

function renderScreen() {
  try {
    if (typeof updateFooter === 'function') updateFooter(); 
    if (typeof updateStudyTimerUI === 'function') updateStudyTimerUI(); 
    if (typeof updateTTSBtnUI === "function") updateTTSBtnUI();
    
    const main = document.getElementById("main-content");
    const bUser = document.getElementById("badge-user"); const bSubj = document.getElementById("badge-subj"); const bGroup = document.getElementById("badge-group");
    if (bUser) bUser.innerText = currentUser ? currentUser.name : "Uživatel";

    // 1. VÝBĚR UŽIVATELE
    if (currentScreen === "SELECT_USER" || !currentUser) {
      if(bSubj) bSubj.style.display = "none"; if(bGroup) bGroup.style.display = "none";
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
                  💰 ${coins} | 🧊 ${freezes}x
                  ${unlockedSkins ? `<br>🎨 ${unlockedSkins}` : ''}
                </p>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    // 2. VÝBĚR PŘEDMĚTU + OBCHOD
    else if (currentScreen === "SELECT_SUBJECT") {
      if(bSubj) bSubj.style.display = "none"; if(bGroup) bGroup.style.display = "none";
      const userG = parseInt(currentUser.grade) || 2;
      const subjs = {};
      (appData.items || []).forEach(it => { if (typeof isItemAllowedForGrade === 'function' && isItemAllowedForGrade(it, userG)) subjs[it.subject] = (subjs[it.subject] || 0) + 1; });

      const coins = typeof getUserCoins === 'function' ? getUserCoins(currentUser.name) : 0;
      const freezes = typeof getUserItemCount === 'function' ? getUserItemCount(currentUser.name, "Zmrazeni") : 0;
      const unlocked = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(currentUser.name) : [];
      const skinCount = unlocked.length;

      let html = `
        <div class="filter-bar">
          <span>Filtr: ${typeof filterExactGradeOnly !== 'undefined' && filterExactGradeOnly ? 'Jen ' + userG + '. třída' : 'Všechny ročníky'}</span>
          <button class="toggle-btn ${typeof filterExactGradeOnly !== 'undefined' && filterExactGradeOnly ? 'on' : ''}" onclick="if(typeof filterExactGradeOnly !== 'undefined') { filterExactGradeOnly=!filterExactGradeOnly; renderScreen(); }">
            ${typeof filterExactGradeOnly !== 'undefined' && filterExactGradeOnly ? 'Jen má třída' : 'Všechny ročníky'}
          </button>
        </div>

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
          <div class="tile" style="border-color:var(--col-active-tab);" onclick="if(typeof openMathOperationSelect === 'function') openMathOperationSelect()">
            <h2 style="color:var(--col-active-tab);">🔢 Matematika</h2><p>Výběr operací a dril</p>
          </div>
      `;
      Object.keys(subjs).forEach(s => {
        const sLow = s.toLowerCase();
        const isCesta = sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn");
        const stl = isCesta ? 'border-color:var(--col-green);' : '';
        const ikn = isCesta ? '🚀 ' : '';
        html += `<div class="tile" style="${stl}" onclick="if(typeof chooseSubject==='function') chooseSubject('${s.replace(/'/g, "\\'")}')"><h2>${ikn}${s}</h2><p>${subjs[s]} úloh</p></div>`;
      });
      html += `</div>`;
      main.innerHTML = html;
    }

    // 3. SPOLEČNÝ OBCHOD
    else if (currentScreen === "SHOP") {
      if(bSubj) { bSubj.style.display = "flex"; bSubj.innerText = "🛒 Obchod"; }
      if(bGroup) bGroup.style.display = "none";
      const freezes = typeof getUserItemCount === 'function' ? getUserItemCount(currentUser.name, "Zmrazeni") : 0;
      const unlockedThemes = typeof getUserUnlockedThemes === 'function' ? getUserUnlockedThemes(currentUser.name) : []; 
      const activeTheme = typeof getUserActiveTheme === 'function' ? getUserActiveTheme(currentUser.name) : 'default';
      
      const uKey = currentUser.name.toLowerCase().trim();
      const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
      const hasPin = !!(u && u.pin) || !!localStorage.getItem(`user_pin_${uKey}`);

      main.innerHTML = `
        <div style="padding:4px;">
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

    // 4 + 5. VÝBĚR SKUPINY (LEKCE / TÉMATA) A MATEMATIKY
    else if (currentScreen === "SELECT_GROUP" || currentScreen === "SELECT_MATH_OP") {
      if(bSubj) { bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; }
      if(bGroup) bGroup.style.display = "none";
      
      let html = "";

      // Pokud jsme v Matematice, vykreslíme nejprve procedurální generátor
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
          <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Nekonečný trénink:</h2>
          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
            ${ops.map(o => `
              <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left; ${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC'||o.id==='FRACTIONS_STEP' ? 'border-color:var(--col-green); background:rgba(34,197,94,0.1);' : ''}" onclick="if(typeof startMathPractice==='function') startMathPractice('${o.id}', '${o.title}')">
                <div><h2 style="${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC'||o.id==='FRACTIONS_STEP' ? 'color:var(--col-green);' : 'color:var(--col-text);'}">${o.title}</h2><p style="color:var(--col-text-muted);">${o.desc}</p></div>
                <span style="color:var(--col-active-tab);font-weight:bold;font-size:20px;">➔</span>
              </div>
            `).join('')}
          </div>
        `;
      }

      // Následně vykreslíme běžné lekce/témata z tabulky
      const groupsMap = {};
      if (activeItems && activeItems.length > 0) {
        activeItems.forEach(it => {
          const k = (typeof viewMode !== 'undefined' && viewMode === "LESSONS") ? it.lesson : it.topic;
          if (!k) return; if (!groupsMap[k]) groupsMap[k] = { name: k, count: 0, raw: [] };
          groupsMap[k].count++; groupsMap[k].raw.push(it);
        });

        html += `
          <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">${selectedSubject === "Matematika" ? "Úlohy z tabulky:" : "Výběr úloh:"}</h2>
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
         html += `<div style="text-align:center;padding:20px;color:var(--col-text-muted);">V tomto předmětu zatím nejsou žádné úlohy pro tvůj ročník.</div>`;
      }

      main.innerHTML = html;
    }

    // 6. KAMPAŇ HUB (S PŘÍBĚHY A CEFR)
    else if (currentScreen === "CAMPAIGN_HUB") {
      if(bSubj) { bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; }
      if(bGroup) bGroup.style.display = "none";
      
      const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
      let lessons = [...new Set(vItems.map(it => it.lesson))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      const subjNorm = selectedSubject.toLowerCase().replace(/[^a-z]/g, ""); let userMinLvl = 1;
      if (currentUser && currentUser.startLevels) {
        for (let k in currentUser.startLevels) { if (subjNorm.includes(k) || k.includes(subjNorm)) { userMinLvl = Number(currentUser.startLevels[k]) || 1; break; } }
      }

      let currentLesson = lessons[0] || "Level 1";
      for (let l of lessons) {
        let num = parseInt(l.replace(/\D/g, '')) || 1; if (num < userMinLvl) continue;
        let lItems = vItems.filter(it => it.lesson === l);
        let pct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(lItems, selectedSubject) : 0;
        if (pct < 95) { currentLesson = l; break; }
      }

      if (typeof selectedGroupKey !== 'undefined') selectedGroupKey = currentLesson; 
      let curItems = vItems.filter(it => it.lesson === currentLesson);
      let currentPct = (typeof getGroupMasteryPercent === "function") ? getGroupMasteryPercent(curItems, selectedSubject) : 0;

      let cefrHtml = "";
      if (subjNorm.includes("angli")) {
         const curIndex = lessons.indexOf(currentLesson);
         const cefrPct = Math.min(100, Math.max(0, Math.round((curIndex / Math.max(1, lessons.length - 1)) * 100)));
         cefrHtml = `
           <div style="margin-top:20px; background:var(--col-card); padding:10px 14px; border-radius:10px; border:1px solid var(--col-card-border);">
             <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:6px;">
                <span style="font-weight:${cefrPct<25?'bold':'normal'}; color:${cefrPct<25?'inherit':'var(--col-text-muted)'};">A1</span>
                <span style="font-weight:${cefrPct>=25&&cefrPct<50?'bold':'normal'}; color:${cefrPct>=25&&cefrPct<50?'inherit':'var(--col-text-muted)'};">A2</span>
                <span style="font-weight:${cefrPct>=50&&cefrPct<75?'bold':'normal'}; color:${cefrPct>=50&&cefrPct<75?'inherit':'var(--col-text-muted)'};">B1</span>
                <span style="font-weight:${cefrPct>=75?'bold':'normal'}; color:${cefrPct>=75?'inherit':'var(--col-text-muted)'};">B2</span>
             </div>
             <div class="bargraph-track" style="height:12px; position:relative; border-radius:6px; overflow:hidden;">
               <div class="bargraph-fill" style="width:${cefrPct}%; background:linear-gradient(90deg, #3b82f6, #8b5cf6);"></div>
               <div style="position:absolute; left:25%; top:0; bottom:0; width:2px; background:var(--col-bg);"></div>
               <div style="position:absolute; left:50%; top:0; bottom:0; width:2px; background:var(--col-bg);"></div>
               <div style="position:absolute; left:75%; top:0; bottom:0; width:2px; background:var(--col-bg);"></div>
             </div>
             <div style="text-align:center; font-size:11px; color:var(--col-text-muted); margin-top:8px;">Evropský referenční rámec (CEFR)</div>
           </div>
         `;
      }

      let curIndex = lessons.indexOf(currentLesson);
      let currentLessonNum = parseInt(String(currentLesson).replace(/\D/g, '')) || 1;

      let storiesGroups = {};
      const userG = parseInt(currentUser.grade) || 2;
      let allSubjectItems = (appData.items || []).filter(it => it.subject === selectedSubject && (typeof isItemAllowedForGrade==='function' ? isItemAllowedForGrade(it, userG) : true));
      
      allSubjectItems.forEach(it => {
          if (it.type && it.type.toUpperCase().includes('PRIBEH')) {
              let isUnlocked = true;
              let storyIndex = lessons.indexOf(it.lesson);
              let storyLessonNum = parseInt(String(it.lesson).replace(/\D/g, ''));
              
              if (storyIndex !== -1 && curIndex !== -1) {
                  isUnlocked = storyIndex <= curIndex;
              } else if (!isNaN(storyLessonNum) && !isNaN(currentLessonNum)) {
                  isUnlocked = storyLessonNum <= currentLessonNum;
              }

              if (isUnlocked) {
                  let t = it.topic || 'Neznámý příběh';
                  if (!storiesGroups[t]) storiesGroups[t] = [];
                  storiesGroups[t].push(it);
              }
          }
      });

      let storiesHtml = "";
      let storyKeys = Object.keys(storiesGroups);
      if (storyKeys.length > 0) {
          storiesHtml += `<div style="margin-top:25px; text-align:left;">`;
          storiesHtml += `<h3 style="color:var(--col-active-tab); font-size:18px; margin-bottom:10px;">📚 Příběhy k přečtení</h3>`;
          storiesHtml += `<div style="display:flex; flex-direction:column; gap:8px;">`;
          storyKeys.forEach(title => {
              let sItems = storiesGroups[title];
              let isDone = (typeof isStoryCompleted === "function") && isStoryCompleted(title, sItems);
              let borderCol = isDone ? "var(--col-green)" : "var(--col-yellow)";
              let badgeText = isDone ? `<span style="color:var(--col-green); font-weight:bold; font-size:14px;">✅ Přečteno</span>` : `<span style="color:var(--col-yellow); font-weight:bold; font-size:15px;">🎁 +10 💰</span>`;

              storiesHtml += `
                <div class="tile" style="flex-direction:row; justify-content:space-between; padding:12px 14px; background:var(--col-card); border-color:${borderCol};" onclick="if(typeof startStory==='function') startStory('${title.replace(/'/g, "\\'")}')">
                  <div style="text-align:left;">
                      <h3 style="color:inherit; font-size:16px;">${isDone ? '📖 ' : '✨ '}${title}</h3>
                      <p style="color:var(--col-text-muted); font-size:12px; margin-top:2px;">${sItems.length} částí příběhu</p>
                  </div>
                  <div style="text-align:right;">
                      ${badgeText}
                  </div>
                </div>
              `;
          });
          storiesHtml += `</div></div>`;
      }

      main.innerHTML = `
        <div style="text-align:center;padding:15px 10px;">
          <h2 style="color:var(--col-active-tab);font-size:26px;margin-bottom:12px;">Spirálová výuka</h2>
          <p style="color:var(--col-text-muted);font-size:16px;margin-bottom:6px;">Aktuální lekce:</p>
          <p style="font-size:28px;font-weight:bold;margin-bottom:10px;">${currentLesson}</p>

          <div class="bargraph-container" style="max-width:280px;margin:0 auto 20px auto;">
            <div class="bargraph-header"><span>Postup lekce</span><span style="color:var(--col-green);">${currentPct} %</span></div>
            <div class="bargraph-track" style="height:8px;"><div class="bargraph-fill" style="width:${currentPct}%;"></div></div>
          </div>

          <div class="action-btn green" style="padding:18px;font-size:20px;box-shadow: 0 6px 15px rgba(34,197,94,0.3);" onclick="if(typeof startCampaign==='function') startCampaign()">
             ▶️ SPUSTIT DNEŠNÍ TRÉNINK
          </div>
          <p style="font-size:13px;color:var(--col-text-muted);margin-top:12px;">Udrž všech 5 ❤️ srdíček pro zisk zlaťáků!</p>

          ${cefrHtml}
          ${storiesHtml}
        </div>
      `;
    }

    // 7. VÝBĚR HRY (KLASICKÝ PŘEDMĚT)
    else if (currentScreen === "SELECT_GAME") {
      if(bSubj) { bSubj.style.display = "flex"; }
      if(bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
      
      const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
      const qItems = typeof getQuizItems === 'function' ? getQuizItems() : [];
      const sItems = typeof getSeqItems === 'function' ? getSeqItems() : [];
      const quickMode = typeof getQuickChoiceMode === 'function' ? getQuickChoiceMode() : null;
      let html = `<div class="grid-2">`;
      
      if (vItems.length > 0) {
        html += `
          <div class="tile" onclick="if(typeof startGame==='function') startGame('CARDS')"><h2>1. Karty</h2><p>Čtení (${vItems.length})</p></div>
          <div class="tile" style="border-color:var(--col-green);" onclick="if(typeof startGame==='function') startGame('ADAPTIVE')">
            <h2 style="color:var(--col-green);">2. Zkoušení</h2><p>${typeof testingDirection!=='undefined' && testingDirection==='DIR_OUT'?'🇨🇿 ➔ Cizí':'Cizí ➔ 🇨🇿'}</p>
          </div>
          <div class="tile" onclick="if(typeof startGame==='function') startGame('SCRAMBLE')"><h2>3. Skládání</h2><p>Pravopis</p></div>
          <div class="tile" onclick="if(typeof setScreen==='function') setScreen('SELECT_PEXESO_SIZE')"><h2>🃏 Pexeso</h2><p>Hledání dvojic</p></div>
          <div class="tile" style="border-color:var(--col-green);" onclick="if(typeof startSnakeGame === 'function') startSnakeGame()">
            <h2 style="color:var(--col-green);">🐍 Had</h2><p>Pravopis na čas</p>
          </div>
        `;
      }
      if (quickMode) {
        html += `
          <div class="tile" style="border-color:var(--col-orange);grid-column: span 2;" onclick="if(typeof startArcadeGame==='function') startArcadeGame()">
            <h2 style="color:var(--col-orange);">☄️ Padající slova (${quickMode.replace(/_/g, ' ')})</h2><p>Arkáda: 3 životy!</p>
          </div>
        `;
      }
      if (qItems.length > 0) {
        html += `<div class="tile" style="border-color:var(--col-green);" onclick="if(typeof startGame==='function') startGame('QUIZ')"><h2 style="color:var(--col-green);">📝 Kvíz</h2><p>${qItems.length} otázek</p></div>`;
      }
      if (sItems.length > 0) {
        html += `<div class="tile" style="border-color:var(--col-yellow);" onclick="if(typeof openSequenceMenu==='function') openSequenceMenu()"><h2 style="color:var(--col-yellow);">⏱️ Řada na čas</h2><p>${sItems.length} úloh</p></div>`;
      }
      if (vItems.length === 0 && qItems.length === 0 && sItems.length === 0) {
        html += `<div style="grid-column:span 2;text-align:center;padding:20px;color:var(--col-text-muted);">V této lekci nejsou žádná data ke hraní.</div>`;
      }
      html += `</div>`;
      main.innerHTML = html;
    }

    // 8. VÝBĚR ŘADY (MEZIKROK)
    else if (currentScreen === "SELECT_SEQ_ITEM") {
      if(bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
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

    // 9. VELIKOST PEXESA
    else if (currentScreen === "SELECT_PEXESO_SIZE") {
      if(bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
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

    // 10. AKTIVNÍ HRA
    else if (currentScreen === "PLAYING") {
      if(bSubj) { bSubj.style.display = "flex"; bSubj.innerText = selectedSubject; }
      if(bGroup) { bGroup.style.display = "flex"; bGroup.innerText = selectedGroupKey; }
      if (typeof renderActiveGame === "function") renderActiveGame();
    }
  } catch (err) {
    console.error("Kritická chyba v renderScreen:", err);
    document.getElementById("main-content").innerHTML = `<div style="text-align:center;padding:30px;color:red;">Kritická chyba zobrazení.<br><br>${err.message}</div>`;
  }
}

// -------------------------------------------------------------
// VYKRESLOVÁNÍ AKTIVNÍCH HER A MÓDŮ
// -------------------------------------------------------------
function renderActiveGame() {
  const main = document.getElementById("main-content");
  if (!main) return;
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
  const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
  const sItems = typeof getSeqItems === 'function' ? getSeqItems() : [];

  if (selectedGame === "CARDS") {
    const w = vItems[typeof vCardIdx!=='undefined'?vCardIdx:0];
    const pct = Math.round((( (typeof vCardIdx!=='undefined'?vCardIdx:0) + 1) / vItems.length) * 100);
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Karty: ${(typeof vCardIdx!=='undefined'?vCardIdx:0) + 1} z ${vItems.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}">
        ${w?w.question:''} <span class="audio-btn" onclick="if(typeof speakCurrentCard==='function') speakCurrentCard()">🔊</span>
      </div>
      <div class="prompt-box" style="color:inherit;">${w?(typeof cleanCzechTranslation==='function'?cleanCzechTranslation(w.answer):w.answer):''}</div>
      ${w&&w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:12px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
      <div class="grid-2">
        <div class="action-btn" onclick="if(typeof vCardPrev==='function') vCardPrev()">Předchozí</div>
        <div class="action-btn" onclick="if(typeof vCardNext==='function') vCardNext()">Další ➔</div>
      </div>
    `;
  }

  else if (selectedGame === "ADAPTIVE") {
    const stats = typeof getMasteryStats==='function' ? getMasteryStats() : {current:0,total:1,masteredCount:0,totalWords:1};
    const pct = Math.round((stats.current / stats.total) * 100);
    const isDirOut = typeof testingDirection!=='undefined' && testingDirection === "DIR_OUT";

    if (stats.masteredCount >= stats.totalWords) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">${typeof isAdaptiveBatchMode!=='undefined' && isAdaptiveBatchMode ? 'BLOK ZVLÁDNUT! 🎉' : 'KOMPLETNĚ ZVLÁDNUTO! 🎉'}</h2>
          <p style="color:inherit;margin-bottom:15px;">Všech ${stats.totalWords} položek bloku umíš na 2 ★!</p>
          <div class="action-btn" onclick="if(typeof startScrambleFromAdaptiveBatch==='function') startScrambleFromAdaptiveBatch()">SKLÁDAT TĚCHTO ${stats.totalWords} SLOV 🧩</div>
          ${typeof isAdaptiveBatchMode!=='undefined' && isAdaptiveBatchMode ? `<div class="action-btn green" onclick="if(typeof initGameState==='function') { initGameState(); renderActiveGame(); }">DALŠÍ BLOK (15 SLOV) ➔</div>` : ''}
          <div class="action-btn" onclick="if(typeof toggleTestingDirection==='function') toggleTestingDirection()">PŘEPNOUT SMĚR (${isDirOut ? 'Cizí ➔ 🇨🇿' : '🇨🇿 ➔ Cizí'}) ⇄</div>
          <div class="action-btn" onclick="if(typeof setScreen==='function') setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const w = vItems[typeof vCurrentWord!=='undefined'?vCurrentWord:0];
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>${typeof isAdaptiveBatchMode!=='undefined' && isAdaptiveBatchMode ? 'Blok: ' + stats.masteredCount + ' z ' + stats.totalWords + ' (2 ★)' : 'Zvládnuto: ' + stats.masteredCount + ' z ' + stats.totalWords}</span>
          <span style="color:var(--col-green);">${pct} % (${stats.current}/${stats.total} b.)</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:4px;">
        <span>Slovo: ${typeof vMastery!=='undefined' && typeof vCurrentWord!=='undefined' ? (vMastery[vCurrentWord]||0) : 0}/2 ★</span>
        <button class="toggle-btn on" onclick="if(typeof toggleTestingDirection==='function') toggleTestingDirection()">${isDirOut?'🇨🇿 ➔ Cizí':'Cizí ➔ 🇨🇿'}</button>
      </div>
      <div class="prompt-box" style="color:inherit;">
        ${w ? (isDirOut ? (typeof cleanCzechTranslation==='function'?cleanCzechTranslation(w.answer):w.answer) : w.question) : ''}
        ${!isDirOut ? `<span class="audio-btn" onclick="if(typeof speakAdaptiveCurrent==='function') speakAdaptiveCurrent()">🔊</span>` : ''}
      </div>
      <div class="prompt-box ${(!isDirOut && isHebrew) ? 'hebrew-text' : (isDirOut && isHebrew && (typeof vQuizRevealed!=='undefined'&&vQuizRevealed) ? 'hebrew-text' : '')}" style="color:${(typeof vQuizRevealed!=='undefined'&&vQuizRevealed)?'var(--col-yellow)' : 'var(--col-text-muted)'};">
        ${(typeof vQuizRevealed!=='undefined'&&vQuizRevealed) ? (isDirOut ? (w?w.question:'') : (w?(typeof cleanCzechTranslation==='function'?cleanCzechTranslation(w.answer):w.answer):'')) : '[ ? ? ? ]'}
        ${((typeof vQuizRevealed!=='undefined'&&vQuizRevealed) && isDirOut) ? `<span class="audio-btn" onclick="if(typeof speakAdaptiveCurrent==='function') speakAdaptiveCurrent()">🔊</span>` : ''}
      </div>
      ${(typeof vQuizRevealed!=='undefined'&&vQuizRevealed) ? `
        ${w&&w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:10px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
        <div class="grid-2">
          <div class="action-btn red" onclick="if(typeof answerAdaptive==='function') answerAdaptive(false)">Nevěděl jsem (0 ★)</div>
          <div class="action-btn green" onclick="if(typeof answerAdaptive==='function') answerAdaptive(true)">Věděl jsem (+1 ★)</div>
        </div>
      ` : `<div class="action-btn" onclick="if(typeof revealAdaptiveQuiz==='function') revealAdaptiveQuiz()">ZKONTROLOVAT</div>`}
    `;
  }

  else if (selectedGame === "SCRAMBLE") {
    const w = vItems[typeof vCurrentWord!=='undefined'?vCurrentWord:0];
    const totalWords = (typeof isAdaptiveBatchMode!=='undefined' && isAdaptiveBatchMode && typeof adaptiveBatchIndices!=='undefined' && adaptiveBatchIndices.length > 0) ? adaptiveBatchIndices.length : vItems.length;
    const pct = Math.min(100, Math.round(((typeof scrambleSolvedCount!=='undefined'?scrambleSolvedCount:0) / totalWords) * 100));

    if ((typeof scrambleSolvedCount!=='undefined'?scrambleSolvedCount:0) >= totalWords && (typeof scrambleDone!=='undefined'&&scrambleDone)) {
        main.innerHTML = `
          <div style="text-align:center;padding:30px;">
            <h2 style="color:var(--col-green);font-size:28px;margin-bottom:10px;">SKLÁDÁNÍ DOKONČENO! 🎉</h2>
            <p style="font-size:18px;color:inherit;margin-bottom:20px;">Složil jsi všech ${totalWords} slov!</p>
            <div class="action-btn green" onclick="if(typeof setScreen==='function') setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
          </div>
        `;
        return;
    }

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Složeno: ${(typeof scrambleSolvedCount!=='undefined'?scrambleSolvedCount:0)} z ${totalWords}</span>
          <span style="color:var(--col-yellow);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="color:inherit;">Slož: <b>${w?(typeof cleanCzechTranslation==='function'?cleanCzechTranslation(w.answer):w.answer):''}</b></div>
      <div class="slots-row ${isHebrew ? 'hebrew-text' : ''}">
        ${(typeof scrambleTiles!=='undefined'?scrambleTiles:[]).map((t, i) => `<div class="letter-slot ${(typeof scrambleIsWordMode!=='undefined'&&scrambleIsWordMode)?'word-slot':''} ${i<(typeof scramblePlaced!=='undefined'?scramblePlaced.length:0)?'filled':''}">${i<(typeof scramblePlaced!=='undefined'?scramblePlaced.length:0)?scramblePlaced[i]:'_'}</div>`).join('')}
      </div>
      ${!(typeof scrambleDone!=='undefined'&&scrambleDone) ? `
        <div class="letters-row">
          ${(typeof scrambleTiles!=='undefined'?scrambleTiles:[]).map((t, idx) => `<div class="letter-tile ${(typeof scrambleIsWordMode!=='undefined'&&scrambleIsWordMode)?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''}" onpointerdown="event.preventDefault(); if(typeof clickScrambleTile==='function') clickScrambleTile(${idx})">${t.text}</div>`).join('')}
        </div>
      ` : `
        ${w&&w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:8px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
        <div class="action-btn ${(typeof scrambleHadMistake!=='undefined'&&scrambleHadMistake)?'red':'green'}" onclick="if(typeof initScramble==='function') { initScramble(); renderActiveGame(); }">
          ${(typeof scrambleHadMistake!=='undefined'&&scrambleHadMistake) ? 'DOKONČENO S CHYBOU ➔ DALŠÍ' : 'SPRÁVNĚ! ➔ DALŠÍ SLOVO'}
        </div>
      `}
    `;
  }

  else if (selectedGame === "ARCADE") {
    let btns = [];
    if (typeof arcadeMode !== 'undefined') {
        if (arcadeMode === "TRANSLATE") btns = arcadeCurrentOptions;
        else if (arcadeMode.includes("DER_DIE_DAS") || arcadeMode === "ARTICLES") btns = ['DER', 'DIE', 'DAS'];
        else if (arcadeMode.includes("A_AN")) btns = ['A', 'AN'];
        else btns = ['I / Í', 'Y / Ý'];
    }

    if (typeof arcadeState !== 'undefined' && arcadeState === "GAMEOVER") {
      if (typeof isCampaignMinigame !== 'undefined' && isCampaignMinigame) {
          let bonusCoins = Math.floor(arcadeScore / 10);
          main.innerHTML = `
            <div style="text-align:center;padding:35px;">
              <h2 style="color:var(--col-green);font-size:28px;">TRÉNINK DOKONČEN! 🎉</h2>
              <p style="font-size:20px;color:inherit;margin:10px 0;">Sestřeleno: <b>${arcadeScore} slov</b> (Bonus: +${bonusCoins} 💰)</p>
              <div class="action-btn green" onclick="if(typeof finishCampaign==='function') finishCampaign(${campaignMinigameCoins + bonusCoins})">DOKONČIT A ZPĚT</div>
            </div>
          `;
      } else {
          main.innerHTML = `
            <div style="text-align:center;padding:35px;">
              <h2 style="color:var(--col-red);font-size:32px;font-weight:bold;">GAME OVER! 💔</h2>
              <p style="font-size:20px;color:inherit;margin:10px 0;">Sestřeleno: <b>${arcadeScore} slov</b> (LVL ${arcadeLevel})</p>
              <div class="action-btn green" onclick="if(typeof startArcadeGame==='function') startArcadeGame()">HRÁT ZNOVU ➔</div>
              <div class="action-btn" onclick="if(typeof setScreen==='function') setScreen('SELECT_GAME')">ZPĚT</div>
            </div>
          `;
      }
      return;
    }

    let disp = "", subDisp = "";
    if (typeof arcadeCurrent !== 'undefined' && arcadeCurrent) {
        if (typeof arcadeMode!=='undefined' && arcadeMode === "TRANSLATE") {
            disp = typeof cleanCzechTranslation==='function'?cleanCzechTranslation(arcadeCurrent.answer):arcadeCurrent.answer;
        } else if (typeof arcadeMode!=='undefined' && (arcadeMode.includes("DER_DIE_DAS") || arcadeMode === "ARTICLES" || arcadeMode.includes("A_AN"))) {
            disp = arcadeCurrent.question.replace(/^(der|die|das|a|an)\s+/i, '');
            subDisp = typeof cleanCzechTranslation==='function'?cleanCzechTranslation(arcadeCurrent.answer):arcadeCurrent.answer;
        } else {
            disp = arcadeCurrent.question;
            subDisp = typeof cleanCzechTranslation==='function'?cleanCzechTranslation(arcadeCurrent.answer):arcadeCurrent.answer;
        }
    }

    main.innerHTML = `
      <div class="arcade-arena">
        <div class="arcade-top-bar">
          <span>${"❤️".repeat(typeof arcadeLives !== 'undefined' ? arcadeLives : 0)}</span>
          <span style="color:var(--col-yellow);">LVL ${typeof arcadeLevel !== 'undefined' ? arcadeLevel : 1}</span>
          <span style="color:var(--col-active-tab);">Body: ${typeof arcadeScore !== 'undefined' ? arcadeScore : 0}</span>
        </div>
        <div class="arcade-playfield" id="arcade-field">
          ${typeof arcadeCurrent !== 'undefined' && arcadeCurrent ? `<div id="arcade-falling-elem" class="falling-item" style="top:${typeof arcadeY!=='undefined'?arcadeY:0}px; left:${typeof arcadeX!=='undefined'?arcadeX:50}%;"><div class="falling-main-word">${disp}</div>${subDisp ? `<div class="falling-sub-word">${subDisp}</div>` : ''}</div>` : ''}
          <div class="arcade-danger-line"></div>
        </div>
        <div class="arcade-bottom-bar" style="${typeof arcadeMode!=='undefined'&&arcadeMode==='TRANSLATE'?'flex-wrap:wrap;justify-content:center;':''}">
          ${btns.map(b => `<div class="arcade-btn" style="${typeof arcadeMode!=='undefined'&&arcadeMode==='TRANSLATE'?'font-size:16px;min-width:30%;padding:10px 5px;height:auto;margin:2px;':''}" onclick="if(typeof clickArcadeChoice==='function') clickArcadeChoice('${b.replace(/'/g,"\\'")}')">${b}</div>`).join('')}
        </div>
      </div>
    `;
  }

  else if (selectedGame === "PEXESO") {
    const totalPairs = Math.min(typeof pexesoPairCount!=='undefined'?pexesoPairCount:4, (typeof pexesoCards!=='undefined'?pexesoCards.length:0) / 2);
    const isDone = (typeof pexesoMatched!=='undefined'?pexesoMatched.length:0) === totalPairs;
    
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Pexeso: ${(typeof pexesoMatched!=='undefined'?pexesoMatched.length:0)} / ${totalPairs} dvojic</span>
          <span style="color:var(--col-yellow);">Pokusy: ${typeof pexesoAttempts!=='undefined'?pexesoAttempts:0}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${((typeof pexesoMatched!=='undefined'?pexesoMatched.length:0) / totalPairs) * 100}%;"></div></div>
      </div>
      ${!isDone ? `
        <div class="pexeso-grid" style="grid-template-columns: repeat(4, 1fr);">
          ${(typeof pexesoCards!=='undefined'?pexesoCards:[]).map((c, i) => {
            const m = (typeof pexesoMatched!=='undefined'?pexesoMatched:[]).includes(c.wordIdx), f = (typeof pexesoFlipped!=='undefined'?pexesoFlipped:[]).includes(i);
            return `<div class="pexeso-card ${m?'matched':(f?'flipped':'hidden')}" style="${(m||f) && c.text.length>10?'font-size:12px;':''}" onclick="if(typeof clickPexesoCard==='function') clickPexesoCard(${i})">${m||f?c.text:'❓'}</div>`;
          }).join('')}
        </div>
      ` : (typeof isCampaignMinigame!=='undefined'&&isCampaignMinigame ? `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);">TRÉNINK DOKONČEN! 🎉</h2>
          <p style="font-size:18px;color:inherit;margin:10px 0;">Pexeso zvládnuto za <b>${typeof pexesoAttempts!=='undefined'?pexesoAttempts:0} pokusů</b>.</p>
          <div class="action-btn green" onclick="if(typeof finishCampaign==='function') finishCampaign(${campaignMinigameCoins + ((typeof pexesoAttempts!=='undefined'?pexesoAttempts:0) <= 12 ? 3 : ((typeof pexesoAttempts!=='undefined'?pexesoAttempts:0) <= 16 ? 2 : 1))})">DOKONČIT A ZPĚT</div>
        </div>
      ` : `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);">HOTOVO ZA ${typeof pexesoAttempts!=='undefined'?pexesoAttempts:0} POKUSŮ! 🎉</h2>
          <div class="action-btn green" onclick="if(typeof startPexesoGame==='function') startPexesoGame(typeof pexesoPairCount!=='undefined'?pexesoPairCount:4)">HRÁT ZNOVU</div>
          <div class="action-btn" onclick="if(typeof setScreen==='function') setScreen('SELECT_PEXESO_SIZE')">ZMĚNIT VELIKOST</div>
        </div>
      `)}
    `;
  }

  else if (selectedGame === "QUIZ") {
    if ((typeof qActiveList!=='undefined'?qActiveList:[]).length === 0) {
      main.innerHTML = `<div style="text-align:center;padding:30px;"><h2>V této lekci není žádný kvíz.</h2><div class="action-btn" onclick="if(typeof setScreen==='function') setScreen('SELECT_GAME')">ZPĚT</div></div>`;
      return;
    }

    if ((typeof qCurStep!=='undefined'?qCurStep:0) >= qActiveList.length) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">KVÍZ DOKONČEN! 🎉</h2>
          <p style="color:inherit;margin-bottom:15px;">Zvládl jsi všech ${qActiveList.length} otázek!</p>
          <div class="action-btn green" onclick="if(typeof setScreen==='function') setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const q = qActiveList[typeof qCurStep!=='undefined'?qCurStep:0];
    const pct = Math.round((((typeof qCurStep!=='undefined'?qCurStep:0) + 1) / qActiveList.length) * 100);

    let promptDisplay = typeof formatPromptText==='function'?formatPromptText(q.question):q.question;
    if (typeof qAnswered!=='undefined'&&qAnswered) {
      const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${q.answer}</span>`;
      if (q.question.includes('___')) {
        promptDisplay = typeof formatPromptText==='function'?formatPromptText(q.question.replace(/___+/g, fillHtml)):q.question.replace(/___+/g, fillHtml);
      } else {
        promptDisplay = (typeof formatPromptText==='function'?formatPromptText(q.question):q.question) + " " + fillHtml;
      }
    }

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Kvíz: Otázka ${(typeof qCurStep!=='undefined'?qCurStep:0) + 1} z ${qActiveList.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:22px;color:inherit;margin:15px 0;">
        ${promptDisplay}
        ${((typeof qAnswered!=='undefined'&&qAnswered) && typeof getTargetLang==='function' && getTargetLang(selectedSubject) !== 'cs-CZ') ? `<span class="audio-btn" onclick="if(typeof speakWord==='function') speakWord('${(q.question.includes('___') ? q.question.replace(/___+/g, q.answer) : q.question + ' ' + q.answer).replace(/[*_]/g, '')}', '${selectedSubject}')">🔊</span>` : ''}
      </div>
      <div class="grid-2">
        ${q.options.map((opt, optIdx) => {
          let btnCls = "";
          if (typeof qAnswered!=='undefined'&&qAnswered) {
            if (opt === q.answer) btnCls = "correct";
            else if (opt === (typeof qChosenOpt!=='undefined'?qChosenOpt:null)) btnCls = "wrong";
          }
          return `<div class="opt-btn ${btnCls}" onclick="if(typeof clickQuizOpt==='function') clickQuizOpt(${optIdx})">${opt}</div>`;
        }).join('')}
      </div>
      ${(typeof qAnswered!=='undefined'&&qAnswered) ? `
        ${q.help ? `<div style="text-align:center;color:var(--col-yellow);margin:10px 0;font-size:16px;font-weight:bold;">[ ${q.help} ]</div>` : ''}
        <div class="action-btn green" style="margin-top:12px;" onclick="if(typeof nextQuizStep==='function') nextQuizStep()">DALŠÍ OTÁZKA ➔</div>
      ` : ''}
    `;
  }

  // PŘÍBĚHY (INTERAKTIVNÍ ČTENÍ S HISTORIÍ)
  // PŘÍBĚHY (INTERAKTIVNÍ ČTENÍ S HISTORIÍ BEZ BUBLIN A PEVNÝM TLAČÍTKEM DOLE)
  else if (selectedGame === "STORY") {
    if (typeof storyStep === 'undefined' || typeof storyList === 'undefined') return;
    
    if (storyStep >= storyList.length) {
      const alreadyDone = (typeof isStoryCompleted === "function") && isStoryCompleted(selectedGroupKey, storyList);
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);font-size:28px;margin-bottom:10px;">PŘÍBĚH DOKONČEN! 🎉</h2>
          <p style="font-size:18px;color:inherit;margin-bottom:20px;">Skvělá práce při čtení příběhu <b>${selectedGroupKey}</b>.</p>
          ${!alreadyDone ? `
            <p style="font-size:24px;color:var(--col-yellow);font-weight:bold;margin-bottom:25px;">Získáváš odměnu: +10 💰</p>
          ` : `
            <p style="font-size:16px;color:var(--col-text-muted);margin-bottom:25px;">Tento příběh už máš splněný (odměna již byla vyplacena).</p>
          `}
          <div class="action-btn green" onclick="if(typeof finishStory==='function') finishStory()">${!alreadyDone ? 'VYINKASOVAT 10 💰 A ZPĚT' : 'ZPĚT NA CESTU'}</div>
        </div>
      `;
      return;
    }

    const item = storyList[storyStep];
    const pct = Math.round(((storyStep + 1) / storyList.length) * 100);
    const hasOpts = item.options && item.options.length > 0;
    const isCzechQuestion = hasOpts && !item.question.includes('___');

    // Historie předchozích vět: čistý dialog pod sebou, bez bublin a bez českého překladu
    let historyHtml = "";
    for (let i = 0; i < storyStep; i++) {
      const hItem = storyList[i];
      const hHasOpts = hItem.options && hItem.options.length > 0;
      const hIsCzQuiz = hHasOpts && !hItem.question.includes('___');
      if (hIsCzQuiz) continue;

      let hText = hItem.question.includes('___')
        ? hItem.question.replace(/___+/g, `<b style="color:var(--col-green);">${hItem.answer}</b>`)
        : hItem.question;
      hText = typeof formatPromptText === 'function' ? formatPromptText(hText) : hText;
      const hSpeech = (hItem.question.includes('___') ? hItem.question.replace(/___+/g, hItem.answer) : hItem.question).replace(/[*_]/g, '').replace(/'/g, "\\'");

      historyHtml += `
        <div style="padding:5px 0; font-size:17px; line-height:1.4; color:var(--col-text); opacity:0.78; border-bottom:1px dashed rgba(148,163,184,0.18); display:flex; justify-content:space-between; align-items: baseline; gap:8px;">
          <span>${hText}</span>
          <span style="cursor:pointer; font-size:15px; opacity:0.7; flex-shrink:0;" onclick="if(typeof speakWord==='function') speakWord('${hSpeech}', '${selectedSubject}')">🔊</span>
        </div>
      `;
    }

    let promptDisplay = typeof formatPromptText==='function'?formatPromptText(item.question):item.question;
    if (hasOpts && typeof storyAnswered!=='undefined'&&storyAnswered && item.question.includes('___')) {
      const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${item.answer}</span>`;
      promptDisplay = typeof formatPromptText==='function'?formatPromptText(item.question.replace(/___+/g, fillHtml)):item.question.replace(/___+/g, fillHtml);
    }

    const sentenceToRead = (item.question.includes('___') && (!hasOpts || (typeof storyAnswered!=='undefined'&&storyAnswered)))
      ? item.question.replace(/___+/g, item.answer).replace(/[*_]/g, '').replace(/'/g, "\\'")
      : item.question.replace(/[*_]/g, '').replace(/'/g, "\\'");

    main.innerHTML = `
      <div style="display:flex; flex-direction:column; height:100%; overflow:hidden;">
        <div class="bargraph-container" style="flex-shrink:0; margin-bottom:6px;">
          <div class="bargraph-header">
            <span>📖 ${selectedGroupKey} (${storyStep + 1} / ${storyList.length})</span>
            <span style="color:var(--col-active-tab);">${pct} %</span>
          </div>
          <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
        </div>

        <!-- SCROLLOVACÍ ČÁST S DIALOGEM A AKTUÁLNÍ VĚTOU -->
        <div id="story-scroll-wrap" style="flex:1; overflow-y:auto; background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:10px 14px; margin-bottom:8px;">
          ${historyHtml}

          <div id="story-current-line" style="padding:10px 0 4px 0; font-size:21px; font-weight:bold; line-height:1.45; color:var(--col-yellow); display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
            <span>${promptDisplay}</span>
            ${!isCzechQuestion ? `<span style="cursor:pointer; font-size:20px; flex-shrink:0;" onclick="if(typeof speakWord==='function') speakWord('${sentenceToRead}', '${selectedSubject}')">🔊</span>` : ''}
          </div>
        </div>

        <!-- PEVNÝ SPODNÍ PANEL S PŘEKLADEM / MOŽNOSTMI A TLAČÍTKEM POKRAČOVAT -->
        <div style="flex-shrink:0;">
          ${!hasOpts ? `
            ${item.answer ? `
              <div class="prompt-box" style="font-size:16px; margin-bottom:8px; padding:10px; color:var(--col-text-muted); cursor:pointer;" onclick="if(typeof storyShowTrans!=='undefined') storyShowTrans=!storyShowTrans; renderActiveGame();">
                ${(typeof storyShowTrans!=='undefined'&&storyShowTrans) ? '🇨🇿 ' + (typeof cleanCzechTranslation==='function'?cleanCzechTranslation(item.answer):item.answer) : '🇨🇿 Klikni pro zobrazení překladu'}
              </div>
            ` : ''}
            <div class="action-btn green" style="margin-top:0;" onclick="if(typeof nextStoryStep==='function') nextStoryStep()">POKRAČOVAT ➔</div>
          ` : `
            <div class="grid-2" style="margin-bottom:6px;">
              ${item.options.map((opt, idx) => {
                let btnCls = "";
                if (typeof storyAnswered!=='undefined'&&storyAnswered) {
                  if (opt === item.answer) btnCls = "correct";
                  else if (opt === (typeof storyChosenOpt!=='undefined'?storyChosenOpt:null)) btnCls = "wrong";
                }
                return `<div class="opt-btn ${btnCls}" style="padding:10px 6px; font-size:16px;" onclick="if(typeof clickStoryOpt==='function') clickStoryOpt(${idx})">${opt}</div>`;
              }).join('')}
            </div>
            ${(typeof storyAnswered!=='undefined'&&storyAnswered) ? `
              ${item.help ? `<div style="text-align:center;color:var(--col-yellow);margin:4px 0 6px 0;font-size:15px;font-weight:bold;">🇨🇿 ${item.help}</div>` : ''}
              <div class="action-btn green" style="margin-top:0;" onclick="if(typeof nextStoryStep==='function') nextStoryStep()">POKRAČOVAT ➔</div>
            ` : ''}
          `}
        </div>
      </div>
    `;

    // Automatické odrolování dialogu na nejnovější větu
    setTimeout(() => {
      const wrap = document.getElementById("story-scroll-wrap");
      if (wrap) wrap.scrollTop = wrap.scrollHeight;
    }, 20);
  }

  // --- MATEMATIKA ---
  else if (selectedGame === "PROCEDURAL_MATH") {
    if (typeof mathTask === 'undefined') return;
    
    const displayMathOpt = (opt) => {
        if (typeof opt === 'string' && opt.includes('/')) {
            let [n, d] = opt.split('/');
            return `<span style="display:inline-flex; flex-direction:column; text-align:center; vertical-align:middle; line-height:1.1; font-size:0.7em;">
                      <span style="border-bottom:2px solid currentColor; padding:0 3px;">${n}</span>
                      <span style="padding:0 3px;">${d}</span>
                    </span>`;
        }
        return opt;
    };

    if (mathTask.type === "STEP_EQ" || mathTask.type === "BUILD_EXPR" || mathTask.type === "FRAC_STEP") {
        const isDone = mathTask.isDone === true;
        
        let placeholderText = "Zadej úpravu... např. /2, -3x";
        if (mathTask.type === "BUILD_EXPR") placeholderText = "Zadej tvar... např. (x-5)*(x-5)";
        if (mathTask.type === "FRAC_STEP") placeholderText = "Zadej mezikrok... např. 4/12+3/12";
        
        let controlsHtml = "";
        if (!isDone) {
            controlsHtml = `
              <div id="math-keyboard-input" style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:10px; margin-bottom:12px; text-align:center; font-size:32px; font-family:monospace; color:var(--col-yellow); min-height:65px; display:flex; align-items:center; justify-content:center; letter-spacing:2px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.2); overflow:hidden;">
                  ${mathTask.input ? mathTask.input : `<span style="color:var(--col-text-muted); font-size:14px; letter-spacing:normal;">${placeholderText}</span>`}
              </div>
              <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; max-width:480px; margin: 0 auto;">
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('+')">+</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('7')">7</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('8')">8</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('9')">9</div>
                  <div class="opt-btn" style="height:60px; font-size:26px; background:#1e293b; color:#38bdf8; border-color:#0284c7;" onclick="if(typeof clickMathKey==='function') clickMathKey('x')">x</div>

                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('-')">-</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('4')">4</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('5')">5</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('6')">6</div>
                  <div class="opt-btn" style="height:60px; font-size:24px; background:#1e293b; color:#c084fc; border-color:#9333ea;" onclick="if(typeof clickMathKey==='function') clickMathKey('x²')">x²</div>

                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('*')">*</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('1')">1</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('2')">2</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('3')">3</div>
                  <div class="opt-btn" style="height:60px; font-size:24px; background:#b45309; color:#fff; border-color:#d97706;" onclick="if(typeof clickMathKey==='function') clickMathKey('⌫')">⌫</div>

                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('/')">/</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('(')">(</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey(')')">)</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="if(typeof clickMathKey==='function') clickMathKey('0')">0</div>
                  <div class="opt-btn green" style="height:60px; font-size:20px; display:flex; align-items:center; justify-content:center;" onclick="if(typeof submitMathKey==='function') submitMathKey()">OK</div>
              </div>
            `;
        } else {
            controlsHtml = `<div class="action-btn green" style="padding:18px; font-size:22px; width:100%;" onclick="if(typeof generateMathTask==='function') generateMathTask();renderActiveGame();">VÝBORNĚ! DALŠÍ ➔</div>`;
        }

        main.innerHTML = `
          <div style="display:flex; flex-direction:column; min-height:100%; position:relative;">
              <div class="bargraph-container" style="flex-shrink:0;">
                <div class="bargraph-header">
                  <span>Série správně: ${typeof mathStreak !== "undefined" ? mathStreak : 0} 🔥</span>
                  <span style="color:var(--col-active-tab);">${selectedGroupKey}</span>
                </div>
                <div class="bargraph-track"><div class="bargraph-fill" style="width:${Math.min(100, (typeof mathStreak !== "undefined" ? mathStreak : 0) * 10)}%;"></div></div>
              </div>
              
              ${mathTask.q ? `<div style="text-align:center; font-size:28px; font-weight:bold; color:inherit; margin-top:12px; margin-bottom:4px; letter-spacing:1px;">${mathTask.q}</div>` : ''}

              <div id="eq-history-container" style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:15px; margin:10px 0; max-height:38vh; overflow-y:auto; flex-shrink:0;">
                 ${(mathTask.history||[]).map((step, i) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:${i<mathTask.history.length-1 ? '1px solid var(--col-card-border)' : 'none'}; padding-bottom:${i<mathTask.history.length-1 ? '10px' : '0'}; margin-bottom:${i<mathTask.history.length-1 ? '10px' : '0'};">
                       <div style="font-size:26px; color:${i===mathTask.history.length-1 && isDone ? 'var(--col-green)' : 'inherit'}; font-weight:bold;">${step.eq}</div>
                       ${step.op ? `<div style="background:var(--col-bg); padding:6px 12px; border-radius:6px; font-weight:bold; font-family:monospace; font-size:16px; border: 1px solid var(--col-card-border);">${step.op}</div>` : ''}
                    </div>
                 `).join('')}
              </div>
              
              <div style="flex:1;"></div>
              
              <div style="position:sticky; bottom:-12px; background:var(--col-bg); margin:0 -12px; padding:10px 12px 12px 12px; border-top:2px solid var(--col-card-border); z-index:10;">
                ${controlsHtml}
              </div>
          </div>
        `;

        setTimeout(() => {
            const histEl = document.getElementById("eq-history-container");
            if (histEl) histEl.scrollTop = histEl.scrollHeight;
            const mainEl = document.getElementById("main-content");
            if (mainEl) mainEl.scrollTop = mainEl.scrollHeight;
        }, 50);

    } else {
        const isAns = (typeof mathChosenAnswer !== "undefined" && mathChosenAnswer !== null);
        main.innerHTML = `
          <div class="bargraph-container">
            <div class="bargraph-header">
              <span>Série správně: ${typeof mathStreak !== "undefined" ? mathStreak : 0} 🔥</span>
              <span style="color:var(--col-active-tab);">${selectedGroupKey}</span>
            </div>
            <div class="bargraph-track"><div class="bargraph-fill" style="width:${Math.min(100, (typeof mathStreak !== "undefined" ? mathStreak : 0) * 10)}%;"></div></div>
          </div>
          <div class="prompt-box" style="font-size:36px; color:inherit; margin:20px 0; letter-spacing: 2px;">${mathTask.q}</div>
          <div class="grid-2">
            ${(mathTask.opts||[]).map(opt => `
              <div class="opt-btn ${isAns ? (String(opt)===String(mathTask.ans)?'correct':(opt===mathChosenAnswer?'wrong':'')) : ''}" style="height:70px;font-size:32px;font-weight:bold;" onclick="if(typeof clickMathChoice==='function') clickMathChoice('${opt}')">${displayMathOpt(opt)}</div>
            `).join('')}
          </div>
          ${isAns ? `<div class="action-btn ${String(mathChosenAnswer)===String(mathTask.ans)?'green':'red'}" onclick="if(typeof generateMathTask==='function') generateMathTask();renderActiveGame();">DALŠÍ PŘÍKLAD ➔</div>` : ''}
        `;
    }
  }

  else if (selectedGame === "SEQ") {
    if (sItems.length === 0) return;
    const seqConfig = sItems[typeof selectedSeqIndex!=='undefined'?selectedSeqIndex:0] || sItems[0];
    const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);
    const isFinished = (typeof seqTargetIdx!=='undefined'?seqTargetIdx:0) >= itemsList.length;
    const targetWord = itemsList[(typeof seqTargetIdx!=='undefined'?seqTargetIdx:0)];
    const pct = Math.round(((typeof seqTargetIdx!=='undefined'?seqTargetIdx:0) / itemsList.length) * 100);

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Položka ${Math.min((typeof seqTargetIdx!=='undefined'?seqTargetIdx:0) + 1, itemsList.length)} z ${itemsList.length} ${(typeof seqHintActive!=='undefined'&&seqHintActive) ? '<b style="color:var(--col-yellow);">[NÁPOVĚDA]</b>' : ''}</span>
          <span id="seq-timer" style="color:var(--col-yellow);font-weight:bold;">0.0 s</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}" style="margin:8px 0;min-height:56px;color:inherit;font-size:22px;">
        ${itemsList.slice(0, (typeof seqTargetIdx!=='undefined'?seqTargetIdx:0)).join(' ')} 
        <span style="color:var(--col-yellow);">${(typeof seqHintActive!=='undefined'&&seqHintActive) ? `[ ${targetWord}! ]` : '[ ??? ]'}</span>
      </div>
      ${!isFinished ? `
        <div class="grid-2">
          ${(typeof seqSlots!=='undefined'?seqSlots:[]).map((itemIdx, slot) => {
            const isHintSlot = ((typeof seqHintActive!=='undefined'&&seqHintActive) && itemIdx === (typeof seqTargetIdx!=='undefined'?seqTargetIdx:0));
            return `<div id="seq-btn-${slot}" class="opt-btn ${isHebrew ? 'hebrew' : ''} ${isHintSlot ? 'hint' : ''}" onclick="if(typeof clickSeqSlot==='function') clickSeqSlot(${slot})">${itemIdx !== -1 ? itemsList[itemIdx] : ''}</div>`;
          }).join('')}
        </div>
      ` : `<div class="action-btn green" onclick="if(typeof initSequence==='function') { initSequence(); renderActiveGame(); }">DOKONČENO! HRÁT ZNOVU</div>`}
    `;
  }

  else if (selectedGame === "SNAKE") {
    if (typeof snakeState === "undefined") {
      main.innerHTML = `<div style="text-align:center;padding:30px;color:var(--col-red);">Chyba: Soubor game_snake.js chybí!</div>`;
      return;
    }

    const isGameOver = (snakeState === "GAMEOVER");
    const canBuyShield = !isGameOver && (typeof snakeLives!=='undefined'?snakeLives:0) > 1 && (typeof snakeShieldLetters!=='undefined'?snakeShieldLetters:0) <= 0;
    const coins = typeof getUserCoins === 'function' && typeof currentUser !== 'undefined' && currentUser ? getUserCoins(currentUser.name) : 0;
    const canBuyShieldCoins = !isGameOver && (typeof snakeLives!=='undefined'?snakeLives:0) === 1 && (typeof snakeShieldLetters!=='undefined'?snakeShieldLetters:0) <= 0 && coins >= 15;
    const bonusCoins = Math.floor((typeof snakeScore!=='undefined'?snakeScore:0) / 2);

    main.innerHTML = `
      <div class="snake-container">
        <div class="snake-header-box">
          <div class="snake-stats">
            <span>${isGameOver ? '💔 GAME OVER' : "❤️".repeat(typeof snakeLives!=='undefined'?snakeLives:0)}</span>
            
            ${(typeof snakeShieldLetters!=='undefined'?snakeShieldLetters:0) > 0 ? `
              <span id="snake-shield-indicator" class="snake-shield-btn active">🛡️ Štít: ${snakeShieldLetters} p.</span>
            ` : (canBuyShield ? `
              <button class="snake-shield-btn" ontouchstart="if(typeof buySnakeShieldInGame === 'function') buySnakeShieldInGame(event)" onclick="if(typeof buySnakeShieldInGame === 'function') buySnakeShieldInGame(event)">
                🛡️ Koupit štít (-1 ❤️)
              </button>
            ` : (canBuyShieldCoins ? `
              <button class="snake-shield-btn" style="border-color:var(--col-yellow);color:var(--col-yellow);" ontouchstart="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)" onclick="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)">
                🛡️ Štít (15 💰)
              </button>
            ` : `
              <span class="snake-shield-btn" style="opacity:0.4;">🛡️ Štít</span>
            `))}

            <span style="color:var(--col-active-tab);">Slova: ${typeof snakeScore!=='undefined'?snakeScore:0} | Délka: ${typeof snakeBody!=='undefined'?snakeBody.length:3}</span>
          </div>

          ${typeof snakeCurrentWord!=='undefined' && snakeCurrentWord ? `
            <div class="snake-prompt-cz">${snakeCurrentWord.czech}</div>
            <div id="snake-slots-wrap" class="snake-slots-row">
              ${(typeof snakeTargetLetters!=='undefined'?snakeTargetLetters:[]).map((ch, idx) => `
                <div class="snake-slot ${idx < (typeof snakeCurrentIdx!=='undefined'?snakeCurrentIdx:0) ? 'done' : (idx === (typeof snakeCurrentIdx!=='undefined'?snakeCurrentIdx:0) ? 'active' : '')}">
                  ${idx < (typeof snakeCurrentIdx!=='undefined'?snakeCurrentIdx:0) ? ch : (idx === (typeof snakeCurrentIdx!=='undefined'?snakeCurrentIdx:0) ? ch : '_')}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div class="snake-status-bar" style="color:${(typeof snakeState!=='undefined' && (snakeState==='PAUSED_SHIELD' || snakeState==='WAITING'))?'var(--col-yellow)':'var(--col-red)'};">
            ${typeof snakeStatusMsg!=='undefined'?snakeStatusMsg:''}
          </div>
        </div>

        <div class="snake-canvas-wrap">
          <canvas id="snake-canvas" width="400" height="400"></canvas>

          ${typeof snakeState!=='undefined' && snakeState === "SHIELD_EXPIRED_PAUSE" ? `
            <div class="snake-overlay">
              <h3 style="color:var(--col-yellow);font-size:22px;margin-bottom:6px;">🛡️ ŠTÍT VYPRŠEL!</h3>
              <p style="font-size:13px;color:#fff;margin-bottom:14px;">Dál už tě zdi ani tvůj ocas neochrání.</p>
              ${canBuyShield ? `
                <button class="action-btn" style="background:#4338ca;border-color:#818cf8;width:100%;max-width:250px;margin-bottom:8px;padding:9px;font-size:14px;" 
                        ontouchstart="if(typeof buySnakeShieldInGame === 'function') buySnakeShieldInGame(event)" onclick="if(typeof buySnakeShieldInGame === 'function') buySnakeShieldInGame(event)">
                  Koupit další štít (-1 ❤️ / 20 p.)
                </button>
              ` : (canBuyShieldCoins ? `
                <button class="action-btn" style="background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);width:100%;max-width:250px;margin-bottom:8px;padding:9px;font-size:14px;" 
                        ontouchstart="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)" onclick="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)">
                  Koupit štít za 15 💰 (20 p.)
                </button>
              ` : '')}
              <button class="action-btn green" style="width:100%;max-width:250px;padding:9px;font-size:14px;" 
                      ontouchstart="if(typeof resumeSnakeWithoutShield === 'function') resumeSnakeWithoutShield(event)" onclick="if(typeof resumeSnakeWithoutShield === 'function') resumeSnakeWithoutShield(event)">
                Pokračovat bez štítu ▶️
              </button>
            </div>
          ` : ''}
        </div>

        ${isGameOver ? `
          <div style="width:100%; text-align:center; padding:8px 0;">
            ${typeof isCampaignMinigame !== 'undefined' && isCampaignMinigame ? `
              <p style="font-size:16px;color:var(--col-yellow);font-weight:bold;margin-bottom:6px;">Složeno: ${snakeScore} slov (Bonus: +${bonusCoins} 💰)</p>
              <div class="action-btn green" onclick="if(typeof finishCampaign === 'function') finishCampaign(${(typeof campaignMinigameCoins!=='undefined'?campaignMinigameCoins:0) + bonusCoins})">DOKONČIT TRÉNINK ➔</div>
            ` : `
              <div class="grid-2" style="width:100%;">
                <div class="action-btn green" style="margin-top:0;" onclick="if(typeof startSnakeGame === 'function') startSnakeGame()">HRÁT ZNOVU ➔</div>
                <div class="action-btn" style="margin-top:0;" onclick="if(typeof setScreen === 'function') setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
              </div>
            `}
          </div>
        ` : `
          <div class="snake-dpad">
            <div class="dpad-row">
              <button class="dpad-btn" ontouchstart="event.preventDefault(); if(typeof setSnakeDirection === 'function') setSnakeDirection(0, -1);" onclick="if(typeof setSnakeDirection === 'function') setSnakeDirection(0, -1)">▲</button>
            </div>
            <div class="dpad-row">
              <button class="dpad-btn" ontouchstart="event.preventDefault(); if(typeof setSnakeDirection === 'function') setSnakeDirection(-1, 0);" onclick="if(typeof setSnakeDirection === 'function') setSnakeDirection(-1, 0)">◄</button>
              <button class="dpad-btn" ontouchstart="event.preventDefault(); if(typeof setSnakeDirection === 'function') setSnakeDirection(0, 1);" onclick="if(typeof setSnakeDirection === 'function') setSnakeDirection(0, 1)">▼</button>
              <button class="dpad-btn" ontouchstart="event.preventDefault(); if(typeof setSnakeDirection === 'function') setSnakeDirection(1, 0);" onclick="if(typeof setSnakeDirection === 'function') setSnakeDirection(1, 0)">►</button>
            </div>
          </div>
        `}
      </div>
    `;
    
    setTimeout(() => {
       if (typeof resizeSnakeCanvas === "function") resizeSnakeCanvas();
       if (typeof drawSnake === "function") drawSnake();
       if (typeof attachSnakeTouchHandlers === "function") attachSnakeTouchHandlers();
    }, 20);
  }

  else if (selectedGame === "CAMPAIGN") {
    if (typeof cmpIdx === 'undefined' || typeof cmpQueue === 'undefined' || cmpIdx >= cmpQueue.length) {
      if (typeof launchCampaignMinigame === 'function') launchCampaignMinigame();
      return;
    }

    const task = cmpQueue[cmpIdx];
    const pct = Math.round((cmpIdx / cmpQueue.length) * 100);
    const heartsHtml = "❤️".repeat(typeof cmpHearts!=='undefined'?cmpHearts:0) + "🖤".repeat(Math.max(0, 5 - (typeof cmpHearts!=='undefined'?cmpHearts:0)));

    let html = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Trénink: Úkol ${cmpIdx + 1} z ${cmpQueue.length}</span>
          <span style="font-size:14px;">${heartsHtml}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
    `;

    if (task.type === 'KVIZ' || task.type.startsWith('QUIZ')) {
      const isEval = (typeof cmpState !== 'undefined' && cmpState === 'EVAL');
      let promptDisplay = typeof formatPromptText==='function' ? formatPromptText(task.prompt) : task.prompt;

      if (isEval && task.type === 'KVIZ') {
        const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${task.correctAns}</span>`;
        if (task.data.question.includes('___')) {
          promptDisplay = typeof formatPromptText==='function' ? formatPromptText(task.data.question.replace(/___+/g, fillHtml)) : task.data.question.replace(/___+/g, fillHtml);
        } else {
          promptDisplay = (typeof formatPromptText==='function' ? formatPromptText(task.data.question) : task.data.question) + " " + fillHtml;
        }
      }

      html += `<div class="prompt-box" style="font-size:24px;color:inherit;margin:20px 0;">
                 ${promptDisplay}
                 ${(isEval && typeof getTargetLang==='function' && getTargetLang(selectedSubject) !== 'cs-CZ' && task.type !== 'QUIZ_IN') ? `<span class="audio-btn" onclick="if(typeof speakWord==='function') speakWord('${(task.type==='KVIZ' && task.data.question.includes('___') ? task.data.question.replace(/___+/g, task.data.answer) : task.data.question).replace(/[*_]/g, '').replace(/'/g, "\\'")}', '${selectedSubject}')">🔊</span>` : ''}
               </div>`;
      
      html += `<div class="grid-2">`;
      (task.opts||[]).forEach(opt => {
        let btnCls = "";
        if (isEval) {
          if (opt === task.correctAns) btnCls = "correct";
          else if (opt === (typeof cmpChosenOpt!=='undefined'?cmpChosenOpt:null)) btnCls = "wrong";
        }
        html += `<div class="opt-btn ${btnCls}" onclick="if(typeof clickCmpQuizOpt==='function') clickCmpQuizOpt('${String(opt).replace(/'/g, "\\'")}')">${opt}</div>`;
      });
      html += `</div>`;

      if (isEval) {
        if (task.data.help) html += `<div style="text-align:center;color:var(--col-yellow);margin:12px 0;font-weight:bold;">[ ${task.data.help} ]</div>`;
        html += `<div class="action-btn green" style="margin-top:15px;" onclick="if(typeof nextCmpTask==='function') nextCmpTask()">DALŠÍ ➔</div>`;
      }
    }
    else if (task.type === 'SCRAMBLE') {
      html += `
        <div class="prompt-box" style="color:inherit;">Slož: <b>${typeof cleanCzechTranslation==='function'?cleanCzechTranslation(task.data.answer):task.data.answer}</b></div>
        <div class="slots-row ${isHebrew ? 'hebrew-text' : ''}">
          ${(task.tiles||[]).map((t, i) => `<div class="letter-slot ${task.isWordMode?'word-slot':''} ${i<(task.placed?task.placed.length:0)?'filled':''}">${i<(task.placed?task.placed.length:0)?task.placed[i]:'_'}</div>`).join('')}
        </div>
      `;
      if (typeof cmpState !== 'undefined' && cmpState !== 'EVAL') {
        html += `<div class="letters-row">${(task.tiles||[]).map((t, i) => `<div class="letter-tile ${task.isWordMode?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''}" onpointerdown="event.preventDefault(); if(typeof clickCmpScrambleTile==='function') clickCmpScrambleTile(${i})">${t.text}</div>`).join('')}</div>`;
      } else {
        if (task.data.help) html += `<div style="text-align:center;color:var(--col-active-tab);font-weight:bold;margin:10px 0;">[ ${task.data.help} ]</div>`;
        html += `<div class="action-btn green" style="margin-top:15px;" onclick="if(typeof nextCmpTask==='function') nextCmpTask()">DALŠÍ ➔</div>`;
      }
    }
    main.innerHTML = html;
  }
}
