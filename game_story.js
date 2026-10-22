// ==========================================
// HERNÍ MÓD: PŘÍBĚHY (DUOLINGO STORIES)
// ==========================================

let storyItems = [];
let storyStepIdx = 0;
let storyHistory = [];
let storyWaitingForQuiz = false;
let storyQuizAnswered = false;
let storyChosenOpt = null;
let storyMistakes = 0;
let currentStoryTitle = "";

// Pomocná funkce pro získání položek příběhu v aktuální lekci
function getStoryItems(lessonName) {
  const targetLesson = lessonName || selectedGroupKey;
  return (appData.items || []).filter(it => 
    it.subject === selectedSubject && 
    it.lesson === targetLesson && 
    it.type && it.type.toUpperCase().startsWith("PRIBEH")
  );
}

// Zjistí, zda je příběh v dané lekci už přečtený
function isStoryCompleted(lessonName) {
  if (!currentUser) return false;
  const key = `story_done_${currentUser.name.toLowerCase().trim()}_${selectedSubject}_${lessonName}`;
  return localStorage.getItem(key) === "true";
}

function markStoryCompleted(lessonName) {
  if (!currentUser) return;
  const key = `story_done_${currentUser.name.toLowerCase().trim()}_${selectedSubject}_${lessonName}`;
  localStorage.setItem(key, "true");
}

// Spuštění příběhu
function startStoryGame(lessonName) {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();

  if (lessonName) selectedGroupKey = lessonName;
  storyItems = getStoryItems(selectedGroupKey);

  if (storyItems.length === 0) {
    alert("V této lekci zatím není připravený žádný příběh.");
    return;
  }

  currentStoryTitle = storyItems[0].topic || "Příběh";
  storyStepIdx = 0;
  storyHistory = [];
  storyWaitingForQuiz = false;
  storyQuizAnswered = false;
  storyChosenOpt = null;
  storyMistakes = 0;

  selectedGame = "STORY";
  setScreen("PLAYING");
  advanceStoryStep();
}

// Rozdělí text "👦 Tom: Hello!" na mluvčího a samotnou větu
function parseSpeakerAndText(rawQuestion) {
  const idx = rawQuestion.indexOf(":");
  if (idx !== -1 && idx < 25) {
    return {
      speaker: rawQuestion.slice(0, idx).trim(),
      text: rawQuestion.slice(idx + 1).trim()
    };
  }
  return { speaker: "📖 Vypravěč", text: rawQuestion.trim() };
}

// Přehraje větu s mírnou úpravou výšky hlasu podle postavy
function speakStoryLine(text, speaker) {
  if (!('speechSynthesis' in window)) return;
  const cleanText = text.replace(/___+/g, '...').replace(/[*_]/g, '').trim();
  
  // Využijeme existující speakWord, ale můžeme upravit pitch, pokud chceme
  speakWord(cleanText, selectedSubject);
}

// Posun na další bublinu v příběhu
function advanceStoryStep() {
  if (storyStepIdx >= storyItems.length) {
    renderActiveGame();
    return;
  }

  const currentItem = storyItems[storyStepIdx];
  const type = currentItem.type.toUpperCase().trim();

  // Pokud jde o interaktivní úkol (DOPLN nebo KVIZ), čekáme na odpověď
  if (type === "PRIBEH_DOPLN" || type === "PRIBEH_KVIZ") {
    storyWaitingForQuiz = true;
    storyQuizAnswered = false;
    storyChosenOpt = null;

    // Pokud v tabulce nejsou možnosti oddělené |, vytvoříme je
    if (!currentItem.options || currentItem.options.length === 0) {
      currentItem.options = [currentItem.answer];
    }
  } else {
    // Běžná replika PRIBEH
    storyWaitingForQuiz = false;
    const parsed = parseSpeakerAndText(currentItem.question);
    storyHistory.push({
      speaker: parsed.speaker,
      text: parsed.text,
      translation: currentItem.answer,
      showTranslation: false
    });

    if (isAutoTTS) {
      speakStoryLine(parsed.text, parsed.speaker);
    }
  }

  renderActiveGame();
  scrollToStoryBottom();
}

// Kliknutí na tlačítko "Pokračovat"
function nextStoryLine() {
  if (storyWaitingForQuiz && !storyQuizAnswered) return;
  storyStepIdx++;
  advanceStoryStep();
}

// Kliknutí na odpověď v příběhovém úkolu
function clickStoryOption(opt) {
  if (storyQuizAnswered) return;
  const currentItem = storyItems[storyStepIdx];
  const type = currentItem.type.toUpperCase().trim();
  storyChosenOpt = opt;

  if (opt.trim() === currentItem.answer.trim()) {
    sndOk();
    storyQuizAnswered = true;

    if (type === "PRIBEH_DOPLN") {
      const parsed = parseSpeakerAndText(currentItem.question);
      const completedText = parsed.text.replace(/___+/g, `<b style="color:var(--col-green);text-decoration:underline;">${currentItem.answer}</b>`);
      const cleanForSpeech = parsed.text.replace(/___+/g, currentItem.answer);

      storyHistory.push({
        speaker: parsed.speaker,
        text: completedText,
        cleanText: cleanForSpeech,
        translation: currentItem.help || "",
        showTranslation: false
      });

      if (isAutoTTS) speakStoryLine(cleanForSpeech, parsed.speaker);
    }
  } else {
    sndErr();
    storyMistakes++;
  }

  renderActiveGame();
  scrollToStoryBottom();
}

// Zobrazení / skrytí českého překladu po kliknutí na bublinu
function toggleStoryTranslation(histIdx) {
  if (storyHistory[histIdx]) {
    storyHistory[histIdx].showTranslation = !storyHistory[histIdx].showTranslation;
    renderActiveGame();
  }
}

// Dokončení příběhu a připsání odměny
function finishStory() {
  const alreadyDone = isStoryCompleted(selectedGroupKey);
  const rewardCoins = alreadyDone ? 2 : Math.max(5, 15 - (storyMistakes * 2));

  markStoryCompleted(selectedGroupKey);
  addCoins(currentUser.name, rewardCoins);
  addReward(3, "Příběh: " + currentStoryTitle);
  sndFanfare();

  const sLow = selectedSubject.toLowerCase();
  if (sLow.includes("cesta") || sLow.includes("postupn") || sLow.includes("inteligentn")) {
    setScreen("CAMPAIGN_HUB");
  } else {
    setScreen("SELECT_GAME");
  }
}

function scrollToStoryBottom() {
  setTimeout(() => {
    const chatBox = document.getElementById("story-chat-box");
    if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
  }, 60);
}

// Vykreslení příběhu (volá se z renderActiveGame)
function renderStoryGame(main, colorWhite) {
  const totalSteps = storyItems.length;
  const pct = Math.min(100, Math.round((storyStepIdx / totalSteps) * 100));
  const isFinished = storyStepIdx >= totalSteps;

  if (isFinished) {
    const alreadyDone = isStoryCompleted(selectedGroupKey);
    const rewardCoins = alreadyDone ? 2 : Math.max(5, 15 - (storyMistakes * 2));

    main.innerHTML = `
      <div style="text-align:center;padding:30px 15px;">
        <div style="font-size:52px;margin-bottom:10px;">📖🎉</div>
        <h2 style="color:var(--col-green);font-size:26px;margin-bottom:8px;">PŘÍBĚH DOKONČEN!</h2>
        <p style="font-size:18px;color:${colorWhite};margin-bottom:6px;"><b>${currentStoryTitle}</b></p>
        <p style="font-size:14px;color:var(--col-text-muted);margin-bottom:18px;">Počet chybiček: ${storyMistakes}</p>
        <p style="font-size:24px;color:var(--col-yellow);font-weight:bold;margin-bottom:25px;">Odměna: +${rewardCoins} 💰 a +3 ★</p>
        <div class="action-btn green" onclick="finishStory()">VYBRAT ODMĚNU A POKRAČOVAT ➔</div>
      </div>
    `;
    return;
  }

  const currentItem = storyItems[storyStepIdx];
  const type = currentItem.type.toUpperCase().trim();

  let html = `
    <div class="bargraph-container">
      <div class="bargraph-header">
        <span>📖 ${currentStoryTitle}</span>
        <span style="color:var(--col-yellow);">${pct} %</span>
      </div>
      <div class="bargraph-track"><div class="bargraph-fill" style="width:${pct}%;"></div></div>
    </div>
    <div style="font-size:11px;text-align:center;color:var(--col-text-muted);margin-bottom:6px;">
      💡 Tip: Klikni na větu pro český překlad
    </div>

    <div id="story-chat-box" class="story-chat-container">
      ${storyHistory.map((h, i) => `
        <div class="story-bubble" onclick="toggleStoryTranslation(${i})">
          <div class="story-speaker">
            <span>${h.speaker}</span>
            <span class="story-audio-icon" onclick="event.stopPropagation(); speakStoryLine('${(h.cleanText || h.text).replace(/<[^>]*>/g, '').replace(/'/g, "\\'")}', '${h.speaker}')">🔊</span>
          </div>
          <div class="story-text" style="color:${colorWhite};">${h.text}</div>
          ${(h.showTranslation && h.translation) ? `<div class="story-translation">🇨🇿 ${h.translation}</div>` : ''}
        </div>
      `).join('')}
  `;

  // Pokud právě čekáme na doplnění nebo kvíz, vykreslíme aktivní kartu dole v chatu
  if (storyWaitingForQuiz && !storyQuizAnswered) {
    if (type === "PRIBEH_DOPLN") {
      const parsed = parseSpeakerAndText(currentItem.question);
      html += `
        <div class="story-bubble active-quiz">
          <div class="story-speaker"><span>${parsed.speaker}</span></div>
          <div class="story-text" style="color:var(--col-yellow);">${parsed.text.replace(/___+/g, '[ ___ ]')}</div>
          ${currentItem.help ? `<div style="font-size:12px;color:var(--col-text-muted);margin-top:4px;">Nápověda: ${currentItem.help}</div>` : ''}
        </div>
      `;
    } else if (type === "PRIBEH_KVIZ") {
      html += `
        <div class="story-quiz-box">
          <div style="font-size:13px;color:var(--col-yellow);font-weight:bold;margin-bottom:4px;">❓ OTÁZKA K PŘÍBĚHU:</div>
          <div style="font-size:17px;color:${colorWhite};font-weight:bold;">${currentItem.question}</div>
        </div>
      `;
    }
  } else if (storyWaitingForQuiz && storyQuizAnswered && type === "PRIBEH_KVIZ") {
    html += `
      <div class="story-quiz-box" style="border-color:var(--col-green);">
        <div style="font-size:14px;color:var(--col-green);font-weight:bold;">✅ Správně: ${currentItem.answer}</div>
      </div>
    `;
  }

  html += `</div>`; // Konec #story-chat-box

  // Spodní ovládací panel (buď možnosti kvízu, nebo tlačítko Pokračovat)
  if (storyWaitingForQuiz && !storyQuizAnswered) {
    html += `
      <div class="story-controls">
        <div class="grid-2">
          ${currentItem.options.map(opt => `
            <div class="opt-btn ${storyChosenOpt === opt ? 'wrong' : ''}" style="padding:10px;font-size:16px;" onclick="clickStoryOption('${opt.replace(/'/g, "\\'")}')">
              ${opt}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else {
    html += `
      <div class="story-controls">
        <div class="action-btn green" style="margin-top:0;" onclick="nextStoryLine()">POKRAČOVAT ➔</div>
      </div>
    `;
  }

  main.innerHTML = html;
}
