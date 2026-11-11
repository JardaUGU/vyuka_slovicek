// -------------------------------------------------------------
// VYKRESLOVÁNÍ AKTIVNÍCH HER A MÓDŮ (SMĚROVAČ PRO HRY)
// -------------------------------------------------------------
function renderActiveGame() {
  const main = document.getElementById("main-content");
  if (!main) return;
  
  if (selectedGame === "CARDS") _renderGameCards(main);
  else if (selectedGame === "ADAPTIVE") _renderGameAdaptive(main);
  else if (selectedGame === "SCRAMBLE") _renderGameScramble(main);
  else if (selectedGame === "ARCADE") _renderGameArcade(main);
  else if (selectedGame === "PEXESO") _renderGamePexeso(main);
  else if (selectedGame === "QUIZ") _renderGameQuiz(main);
  else if (selectedGame === "STORY") _renderGameStory(main);
  else if (selectedGame === "PROCEDURAL_MATH") _renderGameMath(main);
  else if (selectedGame === "SEQ") _renderGameSeq(main);
  else if (selectedGame === "SNAKE") _renderGameSnake(main);
  else if (selectedGame === "CAMPAIGN") _renderGameCampaign(main);
  else if (selectedGame === "TARGET") _renderGameTarget(main);
}

// -------------------------------------------------------------
// LOGIKA VYKRESLENÍ JEDNOTLIVÝCH HER
// -------------------------------------------------------------

function _renderGameCards(main) {
  const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
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

function _renderGameAdaptive(main) {
  const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
  const stats = typeof getMasteryStats==='function' ? getMasteryStats() : {current:0,total:1,masteredCount:0,totalWords:1};
  const pct = Math.round((stats.current / stats.total) * 100);
  const isDirOut = typeof testingDirection!=='undefined' && testingDirection === "DIR_OUT";

  if (stats.masteredCount >= stats.totalWords) {
    main.innerHTML = `
      <div style="text-align:center;padding:20px;">
        <h2 style="color:var(--col-green);margin-bottom:6px;">${typeof isAdaptiveBatchMode!=='undefined' && isAdaptiveBatchMode ? 'BLOK ZVLÁDNUT! 🎉' : 'KOMPLETNĚ ZVLÁDNUTO! 🎉'}</h2>
        <p style="color:inherit;margin-bottom:14px;">Všech ${stats.totalWords} položek bloku umíš na 2 ★! Procvič si je ve hře:</p>
        
        <div class="action-btn" onclick="if(typeof startScrambleFromAdaptiveBatch==='function') startScrambleFromAdaptiveBatch()">🧩 SKLÁDAT TĚCHTO ${stats.totalWords} SLOV</div>
        <div class="grid-2" style="margin-top:8px;">
          <div class="action-btn" style="margin-top:0;background:#0284c7;" onclick="if(typeof startTargetFromAdaptiveBatch==='function') startTargetFromAdaptiveBatch()">🎯 STŘELBA</div>
          <div class="action-btn" style="margin-top:0;background:#7c3aed;" onclick="if(typeof startPexesoFromAdaptiveBatch==='function') startPexesoFromAdaptiveBatch()">🃏 PEXESO</div>
        </div>

        ${typeof isAdaptiveBatchMode!=='undefined' && isAdaptiveBatchMode ? `<div class="action-btn green" style="margin-top:14px;" onclick="if(typeof initGameState==='function') { initGameState(); renderActiveGame(); }">DALŠÍ BLOK (15 SLOV) ➔</div>` : ''}
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

function _renderGameScramble(main) {
  const vItems = typeof getVocabItems === 'function' ? getVocabItems() : [];
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
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
        ${(typeof scrambleTiles!=='undefined'?scrambleTiles:[]).map((t, idx) => `<div class="letter-tile ${(typeof scrambleIsWordMode!=='undefined'&&scrambleIsWordMode)?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''} ${t.isWrong?'wrong-temporary':''}" onpointerdown="event.preventDefault(); if(typeof clickScrambleTile==='function') clickScrambleTile(${idx})">${t.text}</div>`).join('')}
      </div>
    ` : `
      ${w&&w.help ? `<div style="text-align:center;color:var(--col-active-tab);font-size:18px;margin-bottom:8px;font-weight:bold;">[ ${w.help} ]</div>` : ''}
      <div class="action-btn ${(typeof scrambleHadMistake!=='undefined'&&scrambleHadMistake)?'red':'green'}" onclick="if(typeof initScramble==='function') { initScramble(); renderActiveGame(); }">
        ${(typeof scrambleHadMistake!=='undefined'&&scrambleHadMistake) ? 'DOKONČENO S CHYBOU ➔ DALŠÍ' : 'SPRÁVNĚ! ➔ DALŠÍ SLOVO'}
      </div>
    `}
  `;
}

function _renderGameArcade(main) {
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
          subDisp = ""; // Skrytý český překlad
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

function _renderGamePexeso(main) {
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

function _renderGameQuiz(main) {
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
        if (/[\u0590-\u05FF]/.test(opt)) btnCls += " hebrew-text";
        let displayOpt = typeof formatPromptText === 'function' ? formatPromptText(String(opt)) : opt;
        
        return `<div class="opt-btn ${btnCls.trim()}" onclick="if(typeof clickQuizOpt==='function') clickQuizOpt(${optIdx})">${displayOpt}</div>`;
      }).join('')}
    </div>
    ${(typeof qAnswered!=='undefined'&&qAnswered) ? `
      ${q.help ? `<div style="text-align:center;color:var(--col-yellow);margin:10px 0;font-size:16px;font-weight:bold;">[ ${q.help} ]</div>` : ''}
      <div class="action-btn green" style="margin-top:12px;" onclick="if(typeof nextQuizStep==='function') nextQuizStep()">DALŠÍ OTÁZKA ➔</div>
    ` : ''}
  `;
}

function _renderGameStory(main) {
  if (typeof storyStep === 'undefined' || typeof storyList === 'undefined') return;
  
  if (storyStep >= storyList.length) {
    const alreadyDone = (typeof isStoryCompleted === "function") && isStoryCompleted(selectedGroupKey, storyList);
    const rewardCoins = typeof storyHearts !== 'undefined' ? storyHearts : 0; 

    main.innerHTML = `
      <div style="text-align:center;padding:30px;">
        <h2 style="color:var(--col-green);font-size:28px;margin-bottom:10px;">PŘÍBĚH DOKONČEN! 🎉</h2>
        <p style="font-size:18px;color:inherit;margin-bottom:20px;">Skvělá práce při čtení příběhu <b>${selectedGroupKey}</b>.</p>
        ${!alreadyDone ? `
          <p style="font-size:24px;color:var(--col-yellow);font-weight:bold;margin-bottom:25px;">Získáváš odměnu: +${rewardCoins} 💰</p>
        ` : `
          <p style="font-size:16px;color:var(--col-text-muted);margin-bottom:25px;">Tento příběh už máš splněný (odměna již byla vyplacena).</p>
        `}
        <div class="action-btn green" onclick="if(typeof finishStory==='function') finishStory()">${!alreadyDone ? 'VYINKASOVAT ' + rewardCoins + ' 💰 A ZPĚT' : 'ZPĚT NA CESTU'}</div>
      </div>
    `;
    return;
  }

  const item = storyList[storyStep];
  const pct = Math.round(((storyStep + 1) / storyList.length) * 100);
  const hasOpts = item.options && item.options.length > 0;
  const isCzechQuestion = hasOpts && !item.question.includes('___'); 
  const heartsHtml = "❤️".repeat(typeof storyHearts !== 'undefined' ? storyHearts : 0) + "🖤".repeat(Math.max(0, (typeof storyMaxHearts !== 'undefined' ? storyMaxHearts : 0) - (typeof storyHearts !== 'undefined' ? storyHearts : 0)));

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
          <span style="color:var(--col-active-tab);">${heartsHtml} &nbsp; ${pct} %</span>
        </div>
        <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      </div>

      <div id="story-scroll-wrap" style="flex:1; overflow-y:auto; background:var(--col-card); border:1px solid var(--col-card-border); border-radius:10px; padding:10px 14px; margin-bottom:8px;">
        ${historyHtml}
        <div id="story-current-line" style="padding:10px 0 4px 0; font-size:21px; font-weight:bold; line-height:1.45; color:var(--col-yellow); display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
          <span>${promptDisplay}</span>
          ${!isCzechQuestion ? `<span style="cursor:pointer; font-size:20px; flex-shrink:0;" onclick="if(typeof speakWord==='function') speakWord('${sentenceToRead}', '${selectedSubject}')">🔊</span>` : ''}
        </div>
      </div>

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

  setTimeout(() => {
    const wrap = document.getElementById("story-scroll-wrap");
    if (wrap) wrap.scrollTop = wrap.scrollHeight;
  }, 20);
}

function _renderGameMath(main) {
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

function _renderGameSeq(main) {
  const sItems = typeof getSeqItems === 'function' ? getSeqItems() : [];
  if (sItems.length === 0) return;
  const seqConfig = sItems[typeof selectedSeqIndex!=='undefined'?selectedSeqIndex:0] || sItems[0];
  const itemsList = seqConfig.answer.split('|').map(s => s.trim()).filter(Boolean);
  const isFinished = (typeof seqTargetIdx!=='undefined'?seqTargetIdx:0) >= itemsList.length;
  const targetWord = itemsList[(typeof seqTargetIdx!=='undefined'?seqTargetIdx:0)];
  const pct = Math.round(((typeof seqTargetIdx!=='undefined'?seqTargetIdx:0) / itemsList.length) * 100);
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';

  const diffFromPrev = (seqPrevBestTime && seqLastFinalTime) ? (seqPrevBestTime - seqLastFinalTime) : 0;

  main.innerHTML = `
    <div class="bargraph-container">
      <div class="bargraph-header">
        <span>Položka ${Math.min((typeof seqTargetIdx!=='undefined'?seqTargetIdx:0) + 1, itemsList.length)} z ${itemsList.length} ${(typeof seqHintActive!=='undefined'&&seqHintActive) ? '<b style="color:var(--col-yellow);">[NÁPOVĚDA]</b>' : ''}</span>
        <span>
          <span id="seq-pace-text" style="margin-right:8px;font-size:12px;font-weight:bold;"></span>
          <span id="seq-timer" style="color:var(--col-yellow);font-weight:bold;">${isFinished && seqLastFinalTime ? seqLastFinalTime + ' s' : '0.0 s'}</span>
          ${seqPrevBestTime ? `<span style="color:var(--col-text-muted);font-size:11px;margin-left:5px;">(🏆 ${seqPrevBestTime}s)</span>` : ''}
        </span>
      </div>
      <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      ${seqPrevBestTime && !isFinished ? `
        <div class="pace-meter-track">
          <div class="pace-meter-center"></div>
          <div id="seq-pace-bar" class="pace-meter-fill"></div>
        </div>
      ` : ''}
    </div>
    <div class="prompt-box ${isHebrew ? 'hebrew-text' : ''}" style="margin:8px 0;min-height:56px;color:inherit;font-size:22px;">
      ${itemsList.slice(0, (typeof seqTargetIdx!=='undefined'?seqTargetIdx:0)).join(' ')} 
      ${!isFinished ? `<span style="color:var(--col-yellow);">${(typeof seqHintActive!=='undefined'&&seqHintActive) ? `[ ${targetWord}! ]` : '[ ??? ]'}</span>` : ''}
    </div>
    ${!isFinished ? `
      <div class="grid-2">
        ${(typeof seqSlots!=='undefined'?seqSlots:[]).map((itemIdx, slot) => {
          const isHintSlot = ((typeof seqHintActive!=='undefined'&&seqHintActive) && itemIdx === (typeof seqTargetIdx!=='undefined'?seqTargetIdx:0));
          return `<div id="seq-btn-${slot}" class="opt-btn ${isHebrew ? 'hebrew-text' : ''} ${isHintSlot ? 'hint' : ''}" onclick="if(typeof clickSeqSlot==='function') clickSeqSlot(${slot})">${itemIdx !== -1 ? itemsList[itemIdx] : ''}</div>`;
        }).join('')}
      </div>
    ` : `
      <div style="text-align:center;padding:15px;">
        <h2 style="color:var(--col-green);margin-bottom:6px;">${seqIsNewRecord ? '🏆 NOVÝ REKORD! (+1 💰)' : 'DOKONČENO! 🎉'}</h2>
        <p style="font-size:18px;margin-bottom:6px;">Tvůj čas: <b style="color:var(--col-yellow);">${seqLastFinalTime} s</b> &nbsp;|&nbsp; Rekord: <b>${seqBestTime} s</b></p>
        ${seqPrevBestTime ? `
          <p style="font-size:15px;font-weight:bold;color:${diffFromPrev >= 0 ? 'var(--col-green)' : 'var(--col-red)'};margin-bottom:14px;">
            ${diffFromPrev >= 0 ? `⚡ Zlepšení oproti minule o ${diffFromPrev.toFixed(1)} s!` : `🐢 O ${Math.abs(diffFromPrev).toFixed(1)} s pomalejší než rekord`}
          </p>
        ` : ''}
        <div class="action-btn green" onclick="if(typeof initSequence==='function') { initSequence(); renderActiveGame(); }">ZKUSIT ZNOVU A PŘEKONAT ČAS ➔</div>
      </div>
    `}
  `;
  if (!isFinished && typeof renderSeqSplitPace === 'function') renderSeqSplitPace();
}

function _renderGameSnake(main) {
  if (typeof snakeState === "undefined") {
    main.innerHTML = `<div style="text-align:center;padding:30px;color:var(--col-red);">Chyba: Soubor game_snake.js chybí!</div>`;
    return;
  }

  const isGameOver = (snakeState === "GAMEOVER");
  const isPreStart = (snakeState === "PRE_START");
  const isShieldPause = (snakeState === "SHIELD_EXPIRED_PAUSE");
  
  const canBuyShieldHeart = !isGameOver && (typeof snakeLives!=='undefined'?snakeLives:0) > 1 && (typeof snakeShieldLetters!=='undefined'?snakeShieldLetters:0) <= 0;
  const coins = typeof getUserCoins === 'function' && typeof currentUser !== 'undefined' && currentUser ? getUserCoins(currentUser.name) : 0;
  const canBuyWithOneCoin = !isGameOver && coins >= 1;
  const canBuyShieldCoins = canBuyWithOneCoin && (typeof snakeShieldLetters!=='undefined'?snakeShieldLetters:0) <= 0;
  const bonusCoins = Math.floor((typeof snakeScore!=='undefined'?snakeScore:0) / 2);
  const isPureRun = !(typeof snakeUsedBoosts !== 'undefined' && snakeUsedBoosts);

  main.innerHTML = `
    <div class="snake-container">
      <div class="snake-header-box">
        <div class="snake-stats">
          <span>${isGameOver ? '💔 GAME OVER' : "❤️".repeat(Math.min(10, typeof snakeLives!=='undefined'?snakeLives:0)) + (snakeLives > 10 ? ` (${snakeLives})` : '')}</span>
          ${(typeof snakeShieldLetters!=='undefined'?snakeShieldLetters:0) > 0 ? `
            <span id="snake-shield-indicator" class="snake-shield-btn active">🛡️ Štít: ${snakeShieldLetters} p.</span>
          ` : (canBuyShieldCoins ? `
            <button class="snake-shield-btn" style="border-color:var(--col-yellow);color:var(--col-yellow);" ontouchstart="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)" onclick="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)">
              🛡️ Štít (1 💰)
            </button>
          ` : (canBuyShieldHeart ? `
            <button class="snake-shield-btn" ontouchstart="if(typeof buySnakeShieldInGame === 'function') buySnakeShieldInGame(event)" onclick="if(typeof buySnakeShieldInGame === 'function') buySnakeShieldInGame(event)">
              🛡️ Štít (-1 ❤️)
            </button>
          ` : `
            <span class="snake-shield-btn" style="opacity:0.4;">🛡️ Štít</span>
          `))}
          <span style="color:var(--col-active-tab);" title="${isPureRun ? 'Čistá hra – počítá se do rekordu!' : 'Hra s vylepšením – nepočítá se do rekordu'}">
            Slova: ${typeof snakeScore!=='undefined'?snakeScore:0} | Délka: <span id="snake-length-ui">${typeof snakeBody!=='undefined'?snakeBody.length:3}</span> ${isPureRun ? '🏆' : '⚡'}
          </span>
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

        ${(isPreStart || isShieldPause) ? `
          <div class="snake-overlay">
            <h3 style="color:var(--col-yellow);font-size:21px;margin-bottom:4px;">
              ${isPreStart ? '🐍 PŘIPRAVEN KE STARTU?' : '🛡️ ŠTÍT VYPRŠEL!'}
            </h3>
            <p style="font-size:12px;color:var(--col-text-muted);margin-bottom:12px;">
              ${isPreStart ? 'Máš <b>' + coins + ' 💰</b>. Rekord délky 🏆 platí jen pro hru bez nákupů.' : 'Dál už tě tvůj ocas ani špatná písmena neochrání.'}
            </p>

            <button class="action-btn" style="background:#be123c;border-color:#fda4af;width:100%;max-width:270px;margin:0 0 8px 0;padding:10px;font-size:14px;${!canBuyWithOneCoin ? 'opacity:0.4;' : ''}" 
                    ontouchstart="if(typeof buySnakeExtraLife === 'function') buySnakeExtraLife(event)" onclick="if(typeof buySnakeExtraLife === 'function') buySnakeExtraLife(event)">
              ❤️ Koupit +1 život (1 💰)
            </button>

            <button class="action-btn" style="background:#2d2605;border-color:var(--col-yellow);color:var(--col-yellow);width:100%;max-width:270px;margin:0 0 10px 0;padding:10px;font-size:14px;${!canBuyShieldCoins ? 'opacity:0.4;' : ''}" 
                    ontouchstart="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)" onclick="if(typeof buySnakeShieldWithCoins === 'function') buySnakeShieldWithCoins(event)">
              🛡️ Koupit štít na 20 písmen (1 💰)
            </button>

            <button class="action-btn green" style="width:100%;max-width:270px;margin:0;padding:10px;font-size:15px;" 
                    ontouchstart="if(typeof resumeSnakeWithoutShield === 'function') resumeSnakeWithoutShield(event)" onclick="if(typeof resumeSnakeWithoutShield === 'function') resumeSnakeWithoutShield(event)">
              ${isPreStart ? 'Hrát bez pomoci (pro rekord 🏆) ▶️' : 'Pokračovat bez štítu ▶️'}
            </button>
          </div>
        ` : ''}

        ${isGameOver ? `
          <div class="snake-overlay">
            <h3 style="color:var(--col-red);font-size:24px;margin-bottom:4px;">💔 DOŠLY ŽIVOTY!</h3>
            <p style="font-size:14px;color:#fff;margin-bottom:12px;">Délka hada: <b>${snakeBody.length}</b> | Složeno: <b>${snakeScore} slov</b></p>
            
            <div style="background:rgba(255,255,255,0.06);border:1px solid var(--col-card-border);border-radius:10px;padding:10px;width:100%;max-width:270px;margin-bottom:10px;">
              <div style="font-size:12px;color:var(--col-yellow);margin-bottom:8px;font-weight:bold;">Pokračovat v jízdě? (Máš ${coins} 💰)</div>
              <button class="action-btn" style="background:#be123c;border-color:#fda4af;width:100%;margin:0 0 6px 0;padding:8px;font-size:14px;${coins < 1 ? 'opacity:0.4;' : ''}"
                      onclick="if(typeof buySnakeRevive === 'function') buySnakeRevive(1, 1, event)">
                ❤️ Koupit +1 život (1 💰)
              </button>
              <button class="action-btn" style="background:#9333ea;border-color:#e9d5ff;width:100%;margin:0;padding:8px;font-size:14px;${coins < 3 ? 'opacity:0.4;' : ''}"
                      onclick="if(typeof buySnakeRevive === 'function') buySnakeRevive(5, 3, event)">
                ❤️❤️❤️❤️❤️ Koupit +5 životů (3 💰)
              </button>
            </div>
          </div>
        ` : ''}
      </div>

      ${isGameOver ? `
        <div style="width:100%; text-align:center; padding:8px 0;">
          ${typeof isCampaignMinigame !== 'undefined' && isCampaignMinigame ? `
            <p style="font-size:16px;color:var(--col-yellow);font-weight:bold;margin-bottom:6px;">Složeno: ${snakeScore} slov (Bonus: +${bonusCoins} 💰)</p>
            <div class="action-btn green" onclick="if(typeof finishCampaign === 'function') finishCampaign(${(typeof campaignMinigameCoins!=='undefined'?campaignMinigameCoins:0) + bonusCoins})">UKONČIT A VZÍT ODMĚNU ➔</div>
          ` : `
            <div class="grid-2" style="width:100%;">
              <div class="action-btn green" style="margin-top:0;" onclick="if(typeof startSnakeGame === 'function') startSnakeGame()">OD ZAČÁTKU (NA REKORD 🏆)</div>
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

function _renderGameCampaign(main) {
  if (typeof cmpIdx === 'undefined' || typeof cmpQueue === 'undefined' || cmpIdx >= cmpQueue.length) {
    // BOD 1: Pokud žák udělal chyby, ukážeme mu před minihrou rekapitulaci "Dnešní chytáky"
    if (typeof cmpMistakes !== 'undefined' && cmpMistakes.length > 0 && !cmpSummaryShown) {
      main.innerHTML = `
        <div style="padding:15px;">
          <h2 style="color:var(--col-yellow);text-align:center;margin-bottom:6px;">📝 Dnešní chytáky (${cmpMistakes.length})</h2>
          <p style="text-align:center;font-size:13px;color:var(--col-text-muted);margin-bottom:14px;">Tato slovíčka ti dnes dala zabrat. Ještě jednou si je prohlédni:</p>
          <div style="display:flex;flex-direction:column;gap:8px;max-height:55vh;overflow-y:auto;margin-bottom:15px;">
            ${cmpMistakes.map(m => `
              <div style="background:var(--col-card);border:1px solid var(--col-card-border);border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <b style="color:var(--col-yellow);font-size:17px;">${m.question}</b>
                  <div style="color:var(--col-text);font-size:14px;margin-top:2px;">🇨🇿 ${cleanCzechTranslation(m.answer)}</div>
                </div>
                ${selectedSubject !== 'Matematika' ? `<span style="font-size:22px;cursor:pointer;" onclick="speakWord('${m.question.replace(/'/g, "\\'")}', '${selectedSubject}')">🔊</span>` : ''}
              </div>
            `).join('')}
          </div>
          <div class="action-btn green" onclick="cmpSummaryShown = true; renderActiveGame();">POKRAČOVAT DO MINIHRY 🎮 ➔</div>
        </div>
      `;
      return;
    }

    if (typeof launchCampaignMinigame === 'function') launchCampaignMinigame();
    return;
  }

  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';
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

    // BOD 3: Audio poslechová úloha (skryje psané slovo, dokud žák neodpoví)
    if (task.isAudioOnly && !isEval) {
      promptDisplay = `
        <div style="cursor:pointer;padding:10px;" onclick="speakWord('${task.data.question.replace(/'/g, "\\'")}', '${selectedSubject}')">
          <div style="font-size:42px;margin-bottom:4px;">🎧 🔊</div>
          <div style="font-size:15px;color:var(--col-active-tab);">Poslouchej a vyber správný překlad (Klikni pro přehrání)</div>
        </div>
      `;
    } else if (isEval && task.type === 'KVIZ') {
      const fillHtml = `<span style="color:var(--col-green);font-weight:bold;text-decoration:underline;">${task.correctAns}</span>`;
      if (task.data.question.includes('___')) {
        promptDisplay = typeof formatPromptText==='function' ? formatPromptText(task.data.question.replace(/___+/g, fillHtml)) : task.data.question.replace(/___+/g, fillHtml);
      } else {
        promptDisplay = (typeof formatPromptText==='function' ? formatPromptText(task.data.question) : task.data.question) + " " + fillHtml;
      }
    }

    html += `<div class="prompt-box" style="font-size:24px;color:inherit;margin:20px 0;">
               ${promptDisplay}
               ${((isEval || (task.type === 'QUIZ_IN' && !task.isAudioOnly)) && typeof getTargetLang==='function' && getTargetLang(selectedSubject) !== 'cs-CZ') ? `<span class="audio-btn" onclick="if(typeof speakWord==='function') speakWord('${(task.type==='KVIZ' && task.data.question.includes('___') ? task.data.question.replace(/___+/g, task.data.answer) : task.data.question).replace(/[*_]/g, '').replace(/'/g, "\\'")}', '${selectedSubject}')">🔊</span>` : ''}
             </div>`;
    
    html += `<div class="grid-2">`;
    (task.opts||[]).forEach(opt => {
      let btnCls = "";
      if (isEval) {
        if (opt === task.correctAns) btnCls = "correct";
        else if (opt === (typeof cmpChosenOpt!=='undefined'?cmpChosenOpt:null)) btnCls = "wrong";
      }
      if (/[\u0590-\u05FF]/.test(opt)) btnCls += " hebrew-text";
      let displayOpt = typeof formatPromptText === 'function' ? formatPromptText(String(opt)) : opt;
      html += `<div class="opt-btn ${btnCls.trim()}" onclick="if(typeof clickCmpQuizOpt==='function') clickCmpQuizOpt('${String(opt).replace(/'/g, "\\'")}')">${displayOpt}</div>`;
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
      html += `<div class="letters-row">${(task.tiles||[]).map((t, i) => `<div class="letter-tile ${task.isWordMode?'word-tile':''} ${isHebrew ? 'hebrew' : ''} ${t.used?'used':''} ${t.isWrong?'wrong-temporary':''}" onpointerdown="event.preventDefault(); if(typeof clickCmpScrambleTile==='function') clickCmpScrambleTile(${i})">${t.text}</div>`).join('')}</div>`;
    } else {
      if (task.data.help) html += `<div style="text-align:center;color:var(--col-active-tab);font-weight:bold;margin:10px 0;">[ ${task.data.help} ]</div>`;
      html += `<div class="action-btn green" style="margin-top:15px;" onclick="if(typeof nextCmpTask==='function') nextCmpTask()">DALŠÍ ➔</div>`;
    }
  }
  main.innerHTML = html;
}

function _renderGameTarget(main) {
  const pct = Math.round((targetSolved / targetTotal) * 100);
  const isHebrew = (selectedSubject || '').toLowerCase().includes('hebr') || selectedSubject === 'HE';

  if (targetSolved >= targetTotal) {
    if (typeof isCampaignMinigame !== 'undefined' && isCampaignMinigame) {
      const bonusCoins = targetPenaltySec === 0 ? 3 : (targetPenaltySec <= 4 ? 2 : 1);
      main.innerHTML = `
        <div style="text-align:center;padding:30px;">
          <h2 style="color:var(--col-green);font-size:28px;margin-bottom:10px;">TRÉNINK DOKONČEN! 🎯</h2>
          <p style="font-size:20px;color:inherit;margin-bottom:15px;">Sestřeleno v čase: <b style="color:var(--col-yellow);">${targetLastFinalTime} s</b> (Bonus: +${bonusCoins} 💰)</p>
          <div class="action-btn green" onclick="if(typeof finishCampaign==='function') finishCampaign(${campaignMinigameCoins + bonusCoins})">DOKONČIT A ZPĚT</div>
        </div>
      `;
      return;
    }

    const totalEligibleInLesson = getVocabItems().filter(it => it.question.replace(/\s*\([^)]*\)/g, '').trim().length <= 18).length;
    const diffFromPrev = (targetPrevBestTime && targetLastFinalTime) ? (targetPrevBestTime - targetLastFinalTime) : 0;

    main.innerHTML = `
      <div style="text-align:center;padding:25px;">
        <h2 style="color:var(--col-green);font-size:28px;margin-bottom:10px;">${targetIsNewRecord ? '🏆 NOVÝ REKORD SADY! (+1 💰)' : 'VŠE SESTŘELENO! 🎯'}</h2>
        <p style="font-size:20px;color:inherit;margin-bottom:6px;">Tvůj výsledný čas: <b style="color:var(--col-yellow);">${targetLastFinalTime} s</b></p>
        <p style="font-size:16px;color:var(--col-active-tab);margin-bottom:8px;">🏆 Rekord této sady slov: <b>${targetBestTime} s</b></p>
        ${targetPrevBestTime ? `
          <p style="font-size:16px;font-weight:bold;color:${diffFromPrev >= 0 ? 'var(--col-green)' : 'var(--col-red)'};margin-bottom:12px;">
            ${diffFromPrev >= 0 ? `⚡ Zlepšil ses o ${diffFromPrev.toFixed(1)} s!` : `🐢 Zaostal jsi o ${Math.abs(diffFromPrev).toFixed(1)} s za rekordem`}
          </p>
        ` : ''}
        ${targetPenaltySec > 0 ? `<p style="font-size:14px;color:var(--col-red);margin-bottom:18px;">(Z toho penalizace za chyby: +${targetPenaltySec} s)</p>` : '<p style="margin-bottom:18px;">Čistá práce bez jediné chyby! 🔥</p>'}
        
        <div class="action-btn green" onclick="startTargetGame(true)">🔄 ZOPAKOVAT STEJNOU SADU (PŘEKONAT ČAS)</div>
        ${totalEligibleInLesson > 12 ? `<div class="action-btn" onclick="startTargetGame(false)">🎲 VYLOSOVAT JINÁ SLOVA Z LEKCE</div>` : ''}
        <div class="action-btn" onclick="setScreen('SELECT_GAME')">ZPĚT DO MENU</div>
      </div>
    `;
    return;
  }

  const positions = [
    { x: 50, y: 12 }, { x: 80, y: 24 }, { x: 84, y: 50 }, { x: 80, y: 76 },
    { x: 50, y: 88 }, { x: 20, y: 76 }, { x: 16, y: 50 }, { x: 20, y: 24 }
  ];

  main.innerHTML = `
    <div class="bargraph-container">
      <div class="bargraph-header">
        <span>🎯 Terče: ${targetSolved} / ${targetTotal}</span>
        <span>
          <span id="target-pace-text" style="margin-right:8px;font-size:12px;font-weight:bold;"></span>
          <span id="target-timer-ui" style="color:var(--col-yellow);font-weight:bold;">0.0 s</span>
          ${targetPrevBestTime ? `<span style="color:var(--col-text-muted);font-size:11px;margin-left:5px;">(🏆 ${targetPrevBestTime}s)</span>` : ''}
        </span>
      </div>
      <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
      ${targetPrevBestTime ? `
        <div class="pace-meter-track">
          <div class="pace-meter-center"></div>
          <div id="target-pace-bar" class="pace-meter-fill"></div>
        </div>
      ` : ''}
    </div>

    <div class="target-arena">
      <svg style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:15;">
        <line id="target-laser-line" x1="50%" y1="50%" x2="50%" y2="50%" stroke="var(--col-yellow)" stroke-width="4" stroke-dasharray="6,6" stroke-linecap="round" style="display:none;opacity:0.85;" />
      </svg>

      ${positions.map((pos, idx) => {
        const item = targetRing[idx];
        if (!item) return '';
        const cleanQ = item.question.replace(/\s*\([^)]*\)/g, '').trim();
        return `
          <div id="target-slot-${idx}" class="target-node ${isHebrew ? 'hebrew-target' : ''}" 
               style="left:${pos.x}%; top:${pos.y}%;" 
               onclick="checkTargetHit(${idx})">
            ${cleanQ}
          </div>
        `;
      }).join('')}

      ${targetCurrent ? `
        <div id="target-center-puck" class="target-puck">
          <div>${cleanCzechTranslation(targetCurrent.answer)}</div>
        </div>
      ` : ''}
    </div>
  `;

  if (typeof renderTargetSplitPace === 'function') renderTargetSplitPace();
  setTimeout(attachTargetDragHandlers, 20);
}

