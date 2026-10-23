let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];

function updateVoices() {
  if ('speechSynthesis' in window) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedVoices = v;
  }
}
if ('speechSynthesis' in window) { updateVoices(); window.speechSynthesis.onvoiceschanged = updateVoices; }

function toggleAutoTTS() { isAutoTTS = !isAutoTTS; localStorage.setItem("auto_tts", isAutoTTS); updateTTSBtnUI(); }

function updateTTSBtnUI() {
  const btn = document.getElementById("btn-tts-auto");
  if (btn) { btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn"; btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp"; }
}

function getTargetLang(subjectName) {
  const s = (subjectName || selectedSubject || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes('angli') || s === 'en' || s.includes('inteligentn')) return 'en-GB';
  if (s.includes('nemc') || s === 'de') return 'de-DE';
  if (s.includes('hebr') || s === 'he') return 'he-IL';
  if (s.includes('spanel') || s === 'es') return 'es-ES';
  return 'cs-CZ';
}

function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  setTimeout(() => {
    // Odstranil jsem stripování závorek - závorky budou zachovány
    let toSpeak = text.trim();
    toSpeak = toSpeak.replace(/ליהוה/g, 'לַאדֹנָי').replace(/יהוה/g, 'אֲדֹנָי').replace(/L'?(Jahve|Jahveh|Yahweh|Yahwe|Jehova|JHVH|YHWH|JVHV)/gi, "L'Adonaj");
    if (/read\s*-\s*read\s*-\s*read/i.test(toSpeak)) toSpeak = "read, red, red";
    else toSpeak = toSpeak.replace(/\//g, ' or ').replace(/\s*-\s*/g, ', ');
    if (/^\s*I\s*[.!?]?\s*$/i.test(toSpeak)) toSpeak = "eye";

    const u = new SpeechSynthesisUtterance(toSpeak);
    const targetLang = getTargetLang(subjectName);
    const langPrefix = targetLang.split('-')[0];
    u.lang = targetLang; u.rate = 0.88;

    if (cachedVoices.length === 0) updateVoices();
    let voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();

    const playVoice = () => {
      if (voices && voices.length > 0) {
        const isTarget = v => (v.lang || '').toLowerCase().replace('_', '-') === targetLang.toLowerCase() || (v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix);
        let match = voices.find(v => isTarget(v) && /(enhanced|premium|natural|pro)/i.test(v.name));
        if (!match) {
            let bestNames = [];
            if (targetLang === 'en-GB') bestNames = ['daniel', 'oliver', 'serena', 'stephanie', 'arthur', 'martha', 'kate'];
            else if (targetLang === 'de-DE') bestNames = ['anna', 'petra', 'markus', 'yannick', 'helena', 'martin'];
            else if (targetLang === 'cs-CZ') bestNames = ['iveta', 'zuzana'];
            else if (targetLang === 'es-ES') bestNames = ['jorge', 'monica', 'carmen', 'diego'];
            else if (targetLang === 'en-US') bestNames = ['samantha', 'alex', 'karen', 'ava', 'tom'];
            for (let name of bestNames) { match = voices.find(v => isTarget(v) && v.name.toLowerCase().includes(name)); if (match) break; }
        }
        if (!match) match = voices.find(v => isTarget(v) && /siri/i.test(v.name));
        if (!match) match = voices.find(v => isTarget(v) && !/compact/i.test(v.name));
        if (!match) match = voices.find(isTarget);
        if (match) { u.voice = match; u.lang = match.lang; }
      }
      window.speechSynthesis.speak(u);
    };

    if ((!voices || voices.length === 0) && 'speechSynthesis' in window) {
      setTimeout(() => { updateVoices(); voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices(); playVoice(); }, 50);
    } else { playVoice(); }
  }, 40);
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
  if(typeof updateFooter === 'function') updateFooter();
  try {
    const fd = new URLSearchParams();
    fd.append("action", "log_activity"); fd.append("user", currentUser.name);
    fd.append("subject", selectedSubject); fd.append("section", section);
    fd.append("stars", count); fd.append("minutes", (todaySecondsStudied / 60).toFixed(1));
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
  vList.forEach(it => { points += getSavedMastery(it.question, "DIR_OUT") + getSavedMastery(it.question, "DIR_IN"); });
  return Math.min(100, Math.round((points / (vList.length * 4)) * 100));
}

function goBack() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof sendTimeHeartbeatToGoogle === "function") sendTimeHeartbeatToGoogle();

  if (currentScreen === "PLAYING" && selectedGame === "PEXESO") setScreen("SELECT_PEXESO_SIZE");
  else if (currentScreen === "PLAYING" && selectedGame === "SEQ" && getSeqItems().length > 1) setScreen("SELECT_SEQ_ITEM");
  else if (currentScreen === "SELECT_PEXESO_SIZE" || currentScreen === "SELECT_SEQ_ITEM") setScreen("SELECT_GAME");
  else if (currentScreen === "PLAYING") {
    if (selectedGame === "CAMPAIGN") setScreen("CAMPAIGN_HUB");
    else if (selectedSubject === "Matematika") setScreen("SELECT_MATH_OP");
    else setScreen("SELECT_GAME");
  }
  else if (currentScreen === "SHOP") {
    cancelPreview();
    setScreen("SELECT_SUBJECT");
  }
  else if (currentScreen === "CAMPAIGN_HUB") setScreen("SELECT_SUBJECT"); 
  else if (currentScreen === "SELECT_MATH_OP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_GAME") setScreen("SELECT_GROUP");
  else if (currentScreen === "SELECT_GROUP") setScreen("SELECT_SUBJECT");
  else if (currentScreen === "SELECT_SUBJECT") setScreen("SELECT_USER");
}

function startGame(game) { 
  if (typeof stopArcadeLoop === "function") stopArcadeLoop(); 
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  selectedGame = game; 
  isCampaignMinigame = false; 
  if (typeof initGameState === "function") initGameState(); 
  setScreen("PLAYING"); 
}

function renderActiveGame() {
  const main = document.getElementById("main-content");
  if (!main) return;
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
  const vItems = getVocabItems();
  const sItems = getSeqItems();

  if (selectedGame === "CARDS") {
    const w = vItems[vCardIdx];
    const pct = Math.round(((vCardIdx + 1) / vItems.length) * 100);
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Karty: ${vCardIdx + 1} z ${vItems.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}">
        ${w.question} <span class="audio-btn" onclick="speakCurrentCard()">🔊</span>
      </div>
      <div class="prompt-box" style="color:#fff;">${cleanCzechTranslation(w.answer)}</div>
      ${w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:12px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
      <div class="grid-2">
        <div class="action-btn" onclick="vCardPrev()">Předchozí</div>
        <div class="action-btn" onclick="vCardNext()">Další ➔</div>
      </div>
    `;
  }

  else if (selectedGame === "ADAPTIVE") {
    const stats = getMasteryStats();
    const pct = Math.round((stats.current / stats.total) * 100);
    const isDirOut = testingDirection === "DIR_OUT";

    if (stats.masteredCount >= stats.totalWords) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">${isAdaptiveBatchMode ? 'BLOK 15 SLOV ZVLÁDNUT! 🎉' : 'KOMPLETNĚ ZVLÁDNUTO! 🎉'}</h2>
          <p style="color:#fff;margin-bottom:15px;">Všech ${stats.totalWords} položek bloku umíš na 2 ★!</p>
          <div class="action-btn" onclick="startScrambleFromAdaptiveBatch()">SKLÁDAT TĚCHTO ${stats.totalWords} SLOV 🧩</div>
          ${isAdaptiveBatchMode ? `<div class="action-btn green" onclick="initGameState();renderActiveGame();">DALŠÍ BLOK (15 SLOV) ➔</div>` : ''}
          <div class="action-btn" onclick="toggleTestingDirection()">PŘEPNOUT SMĚR (${isDirOut ? 'Cizí ➔ 🇨🇿' : '🇨🇿 ➔ Cizí'}) ⇄</div>
          <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const w = vItems[vCurrentWord];
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>${isAdaptiveBatchMode ? 'Blok: ' + stats.masteredCount + ' z ' + stats.totalWords + ' (2 ★)' : 'Zvládnuto: ' + stats.masteredCount + ' z ' + stats.totalWords}</span>
          <span style="color:var(--col-green);">${pct} % (${stats.current}/${stats.total} b.)</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;margin-bottom:4px;">
        <span>Slovo: ${vMastery[vCurrentWord]||0}/2 ★</span>
        <button class="toggle-btn on" onclick="toggleTestingDirection()">${isDirOut?'🇨🇿 ➔ Cizí':'Cizí ➔ 🇨🇿'}</button>
      </div>
      <div class="prompt-box" style="color:#fff;">
        ${isDirOut ? cleanCzechTranslation(w.answer) : w.question}
        ${!isDirOut ? `<span class="audio-btn" onclick="speakAdaptiveCurrent()">🔊</span>` : ''}
      </div>
      <div class="prompt-box ${(!isDirOut && isHebrew) ? 'hebrew-text' : (isDirOut && isHebrew && vQuizRevealed ? 'hebrew-text' : '')}" style="color:${vQuizRevealed?'var(--col-yellow)' : 'var(--col-text-muted)'};">
        ${vQuizRevealed ? (isDirOut ? w.question : cleanCzechTranslation(w.answer)) : '[ ? ? ? ]'}
        ${(vQuizRevealed && isDirOut) ? `<span class="audio-btn" onclick="speakAdaptiveCurrent()">🔊</span>` : ''}
      </div>
      ${vQuizRevealed ? `
        ${w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:10px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
        <div class="grid-2">
          <div class="action-btn red" onclick="answerAdaptive(false)">Nevěděl jsem (0 ★)</div>
          <div class="action-btn green" onclick="answerAdaptive(true)">Věděl jsem (+1 ★)</div>
        </div>
      ` : `<div class="action-btn" onclick="revealAdaptiveQuiz()">ZKONTROLOVAT</div>`}
    `;
  }

  else if (selectedGame === "SCRAMBLE") {
    const w = vItems[vCurrentWord];
    
    // Zde je oprava bugu, aby ukazatel počítal jen se zvolenými slovy (např. s těmi 15, co jsme právě zkoušeli)
    const totalWords = (isAdaptiveBatchMode && adaptiveBatchIndices && adaptiveBatchIndices.length > 0) ? adaptiveBatchIndices.length : vItems.length;
    const pct = Math.min(100, Math.round((scrambleSolvedCount / totalWords) * 100));

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Složeno: ${scrambleSolvedCount} z ${totalWords}</span>
          <span style="color:var(--col-yellow);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box">Slož: <b>${cleanCzechTranslation(w.answer)}</b></div>
      <div class="slots-row ${isHebrew ? 'hebrew-text' : ''}">
        ${scrambleTiles.map((t, i) => `<div class="letter-slot ${scrambleIsWordMode?'word-slot':''} ${i<scramblePlaced.length?'filled':''}">${i<scramblePlaced.length?scramblePlaced[i]:'_'}</div>`).join('')}
      </div>
      ${!scrambleDone ? `
        <div class="letters-row">
          ${scrambleTiles.map((t, idx) => `<div class="letter-tile ${scrambleIsWordMode?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''}" onclick="clickScrambleTile(${idx})">${t.text}</div>`).join('')}
        </div>
      ` : `
        ${w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:8px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
        <div class="action-btn ${scrambleHadMistake?'red':'green'}" onclick="initScramble();renderActiveGame();">
          ${scrambleHadMistake ? 'DOKONČENO S CHYBOU ➔ DALŠÍ' : 'SPRÁVNĚ! ➔ DALŠÍ SLOVO'}
        </div>
      `}
    `;
  }

  else if (selectedGame === "ARCADE") {
    let btns = [];
    if (arcadeMode === "TRANSLATE") btns = arcadeCurrentOptions;
    else if (arcadeMode.includes("DER_DIE_DAS") || arcadeMode === "ARTICLES") btns = ['DER', 'DIE', 'DAS'];
    else if (arcadeMode.includes("A_AN")) btns = ['A', 'AN'];
    else btns = ['I / Í', 'Y / Ý'];

    if (arcadeState === "GAMEOVER") {
      if (isCampaignMinigame) {
          let bonusCoins = Math.floor(arcadeScore / 10);
          main.innerHTML = `
            <div style="text-align:center;padding:35px;">
              <h2 style="color:var(--col-green);font-size:28px;">TRÉNINK DOKONČEN! 🎉</h2>
              <p style="font-size:20px;color:#fff;margin:10px 0;">Sestřeleno: <b>${arcadeScore} slov</b> (Bonus: +${bonusCoins} 💰)</p>
              <p style="font-size:24px;color:var(--col-yellow);margin-bottom:25px;">Celkem získáváš: +${campaignMinigameCoins + bonusCoins} 💰</p>
              <div class="action-btn green" onclick="finishCampaign(${campaignMinigameCoins + bonusCoins})">PŘIPSAT ZLAŤÁKY A ZPĚT</div>
            </div>
          `;
      } else {
          main.innerHTML = `
            <div style="text-align:center;padding:35px;">
              <h2 style="color:var(--col-red);font-size:32px;font-weight:bold;">GAME OVER! 💔</h2>
              <p style="font-size:20px;color:#fff;margin:10px 0;">Sestřeleno: <b>${arcadeScore} slov</b> (LVL ${arcadeLevel})</p>
              <div class="action-btn green" onclick="if(typeof startArcadeGame==='function') startArcadeGame()">HRÁT ZNOVU ➔</div>
              <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT</div>
            </div>
          `;
      }
      return;
    }

    let disp = "", subDisp = "";
    if (arcadeCurrent) {
        if (arcadeMode === "TRANSLATE") {
            disp = cleanCzechTranslation(arcadeCurrent.answer);
        } else if (arcadeMode.includes("DER_DIE_DAS") || arcadeMode === "ARTICLES" || arcadeMode.includes("A_AN")) {
            disp = arcadeCurrent.question.replace(/^(der|die|das|a|an)\s+/i, '');
            subDisp = cleanCzechTranslation(arcadeCurrent.answer);
        } else {
            disp = arcadeCurrent.question;
            subDisp = cleanCzechTranslation(arcadeCurrent.answer);
        }
    }

    main.innerHTML = `
      <div class="arcade-arena">
        <div class="arcade-top-bar">
          <span>${"❤️".repeat(arcadeLives)}</span>
          <span style="color:var(--col-yellow);">LVL ${arcadeLevel}</span>
          <span style="color:var(--col-active-tab);">Body: ${arcadeScore}</span>
        </div>
        <div class="arcade-playfield" id="arcade-field">
          ${arcadeCurrent ? `
            <div id="arcade-falling-elem" class="falling-item" style="top:${arcadeY}px; left:${arcadeX}%; max-width:90vw; white-space:pre-wrap; word-break:break-word;">
              <div class="falling-main-word">${disp}</div>
              ${subDisp ? `<div class="falling-sub-word">${subDisp}</div>` : ''}
            </div>
          ` : ''}
          <div class="arcade-danger-line"></div>
        </div>
        <div class="arcade-bottom-bar" style="${arcadeMode==='TRANSLATE'?'flex-wrap:wrap;justify-content:center;':''}">
          ${btns.map(b => `<div class="arcade-btn" style="${arcadeMode==='TRANSLATE'?'font-size:16px;min-width:30%;padding:10px 5px;height:auto;margin:2px;':''}" onclick="clickArcadeChoice('${b.replace(/'/g,"\\'")}')">${b}</div>`).join('')}
        </div>
      </div>
    `;
  }

  else if (selectedGame === "PEXESO") {
    const totalPairs = Math.min(pexesoPairCount, pexesoCards.length / 2);
    const isDone = pexesoMatched.length === totalPairs;
    
    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Pexeso: ${pexesoMatched.length} / ${totalPairs} dvojic</span>
          <span style="color:var(--col-yellow);">Pokusy: ${pexesoAttempts}</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${(pexesoMatched.length / totalPairs) * 100}%;"></div></div>
      </div>
      ${!isDone ? `
        <div class="pexeso-grid" style="grid-template-columns: repeat(4, 1fr);">
          ${pexesoCards.map((c, i) => {
            const m = pexesoMatched.includes(c.wordIdx), f = pexesoFlipped.includes(i);
            return `<div class="pexeso-card ${m?'matched':(f?'flipped':'hidden')}" style="${(m||f) && c.text.length>10?'font-size:12px;':''}" onclick="clickPexesoCard(${i})">${m||f?c.text:'❓'}</div>`;
          }).join('')}
        </div>
      ` : (isCampaignMinigame ? `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);">TRÉNINK DOKONČEN! 🎉</h2>
          <p style="font-size:18px;color:#fff;margin:10px 0;">Pexeso zvládnuto za <b>${pexesoAttempts} pokusů</b>.</p>
          <p style="font-size:24px;color:var(--col-yellow);margin-bottom:25px;">Celkem získáváš: +${campaignMinigameCoins + (pexesoAttempts <= 12 ? 3 : (pexesoAttempts <= 16 ? 2 : 1))} 💰</p>
          <div class="action-btn green" onclick="finishCampaign(${campaignMinigameCoins + (pexesoAttempts <= 12 ? 3 : (pexesoAttempts <= 16 ? 2 : 1))})">PŘIPSAT ZLAŤÁKY A ZPĚT</div>
        </div>
      ` : `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);">HOTOVO ZA ${pexesoAttempts} POKUSŮ! 🎉</h2>
          <div class="action-btn green" onclick="startPexesoGame(pexesoPairCount)">HRÁT ZNOVU</div>
          <div class="action-btn" onclick="setScreen('SELECT_PEXESO_SIZE')">ZMĚNIT VELIKOST</div>
        </div>
      `)}
    `;
  }

  else if (selectedGame === "QUIZ") {
    if (qActiveList.length === 0) {
      main.innerHTML = `<div style="text-align:center;padding:30px;"><h2>V této lekci není žádný kvíz.</h2><div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT</div></div>`;
      return;
    }

    if (qCurStep >= qActiveList.length) {
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);margin-bottom:10px;">KVÍZ DOKONČEN! 🎉</h2>
          <p style="color:#fff;margin-bottom:15px;">Zvládl jsi všech ${qActiveList.length} otázek!</p>
          <div class="action-btn green" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
        </div>
      `;
      return;
    }

    const q = qActiveList[qCurStep];
    const pct = Math.round(((qCurStep + 1) / qActiveList.length) * 100);

    let promptDisplay = formatPromptText(q.question);
    if (qAnswered) {
      const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${q.answer}</span>`;
      if (q.question.includes('___')) {
        promptDisplay = formatPromptText(q.question.replace(/___+/g, fillHtml));
      } else {
        promptDisplay = formatPromptText(q.question) + " " + fillHtml;
      }
    }

    main.innerHTML = `
      <div class="bargraph-container">
        <div class="bargraph-header">
          <span>Kvíz: Otázka ${qCurStep + 1} z ${qActiveList.length}</span>
          <span style="color:var(--col-active-tab);">${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>
      <div class="prompt-box" style="font-size:22px;color:#fff;margin:15px 0;">
        ${promptDisplay}
        ${(qAnswered && getTargetLang(selectedSubject) !== 'cs-CZ') ? `<span class="audio-btn" onclick="speakWord('${(q.question.includes('___') ? q.question.replace(/___+/g, q.answer) : q.question + ' ' + q.answer).replace(/[*_]/g, '')}', '${selectedSubject}')">🔊</span>` : ''}
      </div>
      <div class="grid-2">
        ${q.options.map((opt, optIdx) => {
          let btnCls = "";
          if (qAnswered) {
            if (opt === q.answer) btnCls = "correct";
            else if (opt === qChosenOpt) btnCls = "wrong";
          }
          return `<div class="opt-btn ${btnCls}" onclick="clickQuizOpt(${optIdx})">${opt}</div>`;
        }).join('')}
      </div>
      ${qAnswered ? `
        ${q.help ? `<div style="text-align:center;color:var(--col-yellow);margin:10px 0;font-size:16px;font-weight:bold;">[ ${q.help} ]</div>` : ''}
        <div class="action-btn green" style="margin-top:12px;" onclick="nextQuizStep()">DALŠÍ OTÁZKA ➔</div>
      ` : ''}
    `;
  }

else if (selectedGame === "PROCEDURAL_MATH") {
    
    // --- VYKRESLENÍ: KROKOVÉ ROVNICE, VÝRAZY, ZLOMKY ---
    if (mathTask.type === "STEP_EQ" || mathTask.type === "BUILD_EXPR" || mathTask.type === "FRAC_STEP") {
        const isDone = mathTask.isDone === true;
        
        let placeholderText = "Zadej úpravu... např. /2, -3x";
        if (mathTask.type === "BUILD_EXPR") placeholderText = "Zadej tvar... např. (x-5)*(x-5)";
        if (mathTask.type === "FRAC_STEP") placeholderText = "Zadej mezikrok... např. 4/12+3/12";
        
        let controlsHtml = "";
        if (!isDone) {
            // UI 5-SLOUPCOVÁ KLÁVESNICE
            controlsHtml = `
              <div id="math-keyboard-input" style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:10px; margin-bottom:12px; text-align:center; font-size:32px; font-family:monospace; color:var(--col-yellow); min-height:65px; display:flex; align-items:center; justify-content:center; letter-spacing:2px; box-shadow: inset 0 2px 5px rgba(0,0,0,0.2); overflow:hidden;">
                  ${mathTask.input ? mathTask.input : `<span style="color:var(--col-text-muted); font-size:14px; letter-spacing:normal;">${placeholderText}</span>`}
              </div>
              <div style="display:grid; grid-template-columns:repeat(5, 1fr); gap:6px; max-width:480px; margin: 0 auto;">
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('+')">+</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('7')">7</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('8')">8</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('9')">9</div>
                  <div class="opt-btn" style="height:60px; font-size:26px; background:#1e293b; color:#38bdf8; border-color:#0284c7;" onclick="clickMathKey('x')">x</div>

                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('-')">-</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('4')">4</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('5')">5</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('6')">6</div>
                  <div class="opt-btn" style="height:60px; font-size:24px; background:#1e293b; color:#c084fc; border-color:#9333ea;" onclick="clickMathKey('x²')">x²</div>

                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('*')">*</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('1')">1</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('2')">2</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('3')">3</div>
                  
                  <!-- Tlačítko BACKSPACE (⌫) -->
                  <div class="opt-btn" style="height:60px; font-size:24px; background:var(--col-orange); border-color:#f97316;" onclick="clickMathKey('⌫')">⌫</div>

                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('/')">/</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('(')">(</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey(')')">)</div>
                  <div class="opt-btn" style="height:60px; font-size:26px;" onclick="clickMathKey('0')">0</div>
                  <div class="opt-btn green" style="height:60px; font-size:20px; display:flex; align-items:center; justify-content:center;" onclick="submitMathKey()">OK</div>
              </div>
            `;
        } else {
            controlsHtml = `<div class="action-btn green" style="padding:18px; font-size:22px; width:100%;" onclick="generateMathTask();renderActiveGame();">VÝBORNĚ! DALŠÍ ➔</div>`;
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
              
              ${mathTask.q ? `<div style="text-align:center; font-size:28px; font-weight:bold; color:var(--col-yellow); margin-top:12px; margin-bottom:4px; letter-spacing:1px;">${mathTask.q}</div>` : ''}

              <div id="eq-history-container" style="background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:15px; margin:10px 0; max-height:38vh; overflow-y:auto; flex-shrink:0;">
                 ${mathTask.history.map((step, i) => `
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:${i<mathTask.history.length-1 ? '1px solid var(--col-card-border)' : 'none'}; padding-bottom:${i<mathTask.history.length-1 ? '10px' : '0'}; margin-bottom:${i<mathTask.history.length-1 ? '10px' : '0'};">
                       <div style="font-size:26px; color:${i===mathTask.history.length-1 && isDone ? 'var(--col-green)' : 'inherit'}; font-weight:bold;">${step.eq}</div>
                       ${step.op ? `<div style="background:var(--col-bg); color:var(--col-yellow); padding:6px 12px; border-radius:6px; font-weight:bold; font-family:monospace; font-size:16px; border: 1px solid var(--col-card-border);">| ${step.op}</div>` : ''}
                    </div>
                 `).join('')}
              </div>
              
              <div style="flex:1;"></div>
              
              <div style="position:sticky; bottom:-12px; background:var(--col-bg); margin:0 -12px; padding:10px 12px 12px 12px; border-top:2px solid var(--col-card-border); z-index:10;">
                ${controlsHtml}
              </div>
          </div>
        `;

        // Automatické scrollování AŽ po kliknutí na OK (kdy se reálně vyrenderuje nová HTML struktura historie)
        setTimeout(() => {
            const histEl = document.getElementById("eq-history-container");
            if (histEl) histEl.scrollTop = histEl.scrollHeight;
            const mainEl = document.getElementById("main-content");
            if (mainEl) mainEl.scrollTop = mainEl.scrollHeight;
        }, 50);

    } 
    
    // --- VYKRESLENÍ: STANDARDNÍ VÝPOČTY (+ a -, Násobilka atd.) ---
    else {
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
            ${mathTask.opts.map(opt => `
              <div class="opt-btn ${isAns ? (String(opt)===String(mathTask.ans)?'correct':(opt===mathChosenAnswer?'wrong':'')) : ''}" style="height:60px;font-size:26px;font-weight:bold;" onclick="clickMathChoice('${opt}')">${opt}</div>
            `).join('')}
          </div>
          ${isAns ? `<div class="action-btn ${String(mathChosenAnswer)===String(mathTask.ans)?'green':'red'}" onclick="generateMathTask();renderActiveGame();">DALŠÍ PŘÍKLAD ➔</div>` : ''}
        `;
    }
  }
}
