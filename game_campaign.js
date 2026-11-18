function startCampaign() {
  if (typeof stopArcadeLoop === "function") stopArcadeLoop();
  if (typeof stopSnakeLoop === "function") stopSnakeLoop();
  if (typeof stopTargetTimer === "function") stopTargetTimer();

  cmpCapOneLevelPerSession = true;
  cmpSessionAdvanced = new Set();

  let q = [];
  let allVItems = getVocabItems();
  let allQItems = getQuizItems();

  // Zjistíme startovní lekci uživatele (Start_...) a seřadíme lekce od nejstarší
  const subjNorm = selectedSubject.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
  let userMinLvl = 1;
  if (currentUser && currentUser.startLevels) {
    for (let k in currentUser.startLevels) {
      if (subjNorm.includes(k) || k.includes(subjNorm)) {
        userMinLvl = Number(currentUser.startLevels[k]) || 1;
        break;
      }
    }
  }

  const allLessonsSorted = [...new Set(allVItems.map(it => it.lesson))].sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  );
  let startLessonIdx = 0;
  for (let i = 0; i < allLessonsSorted.length; i++) {
    let num = parseInt(allLessonsSorted[i].replace(/\D/g, '')) || 1;
    if (num <= userMinLvl) startLessonIdx = i;
  }
  const curLessonIdx = allLessonsSorted.indexOf(selectedGroupKey);
  const olderLessonNames = (curLessonIdx > startLessonIdx)
    ? allLessonsSorted.slice(startLessonIdx, curLessonIdx)
    : [];

  let currentVItems = allVItems.filter(it => it.lesson === selectedGroupKey);
  let olderVItems = allVItems.filter(it => olderLessonNames.includes(it.lesson));
  let currentQItems = allQItems.filter(it => it.lesson === selectedGroupKey);
  let olderQItems = allQItems.filter(it => olderLessonNames.includes(it.lesson));

  let qRevision = []; let qNewPassive = []; let qNewActive = []; let qGrammar = []; let qSentences = [];

  // 1. DOČIŠŤOVÁNÍ STARŠÍCH LEKCÍ OD NEJSTARŠÍ (< 100 %)
  let unmasteredOlderTasks = [];
  for (let lName of olderLessonNames) {
    if (unmasteredOlderTasks.length >= 8) break;

    const lWords = olderVItems.filter(it => it.lesson === lName);
    const lQuizzes = olderQItems.filter(it => it.lesson === lName);

    for (let it of lWords) {
      if (unmasteredOlderTasks.length >= 8) break;
      const mIn = getSavedMastery(it.question, 'DIR_IN');
      const mOut = getSavedMastery(it.question, 'DIR_OUT');
      if (mIn < 2 || mOut < 2) {
        const isMulti = it.question.trim().includes(' ') || it.question.trim().includes('-');
        let taskType = 'QUIZ_IN';
        if (isMulti) {
          taskType = 'SCRAMBLE';
        } else if (mOut < 2 && mIn >= 2) {
          taskType = Math.random() < 0.5 ? 'QUIZ_OUT' : 'SCRAMBLE';
        } else if (mIn < 2 && mOut >= 2) {
          taskType = 'QUIZ_IN';
        } else {
          taskType = Math.random() < 0.5 ? 'QUIZ_IN' : 'QUIZ_OUT';
        }
        unmasteredOlderTasks.push({ type: taskType, data: it, wave: 1 });
      }
    }

    for (let qIt of lQuizzes) {
      if (unmasteredOlderTasks.length >= 8) break;
      if (getSavedMastery(qIt.question, 'DIR_OUT') < 2) {
        unmasteredOlderTasks.push({ type: 'KVIZ', data: qIt, wave: 1 });
      }
    }
  }

  if (unmasteredOlderTasks.length > 0) {
    qRevision = unmasteredOlderTasks;
  } else if (olderVItems.length > 0) {
    // Všechny starší lekce jsou na 100 % -> jen lehké udržovací opakování
    let shuffledOlder = [...olderVItems].sort(() => Math.random() - 0.5).slice(0, 3);
    shuffledOlder.forEach(it => {
      if (it.question.trim().includes(' ') || it.question.trim().includes('-')) {
        qRevision.push({ type: 'SCRAMBLE', data: it, wave: 1 });
      } else {
        qRevision.push({ type: 'QUIZ_IN', data: it, wave: 1 });
      }
    });
  }

  // 2. AKTUÁLNÍ LEKCE (max 8 slov, přednost mají 0 ★ před 1 ★)
  let unmasteredVItems = currentVItems.filter(it => 
    getSavedMastery(it.question, 'DIR_IN') < 2 || getSavedMastery(it.question, 'DIR_OUT') < 2
  );

  unmasteredVItems.sort((a, b) => {
    const scoreA = getSavedMastery(a.question, 'DIR_IN') + getSavedMastery(a.question, 'DIR_OUT');
    const scoreB = getSavedMastery(b.question, 'DIR_IN') + getSavedMastery(b.question, 'DIR_OUT');
    if (scoreA !== scoreB) return scoreA - scoreB;
    return Math.random() - 0.5;
  });

  let targetVItems = [...unmasteredVItems];
  if (targetVItems.length < 8) {
    let masteredVItems = currentVItems.filter(it => !unmasteredVItems.includes(it)).sort(() => Math.random() - 0.5);
    targetVItems = [...targetVItems, ...masteredVItems];
  }
  targetVItems = targetVItems.slice(0, 8);

  targetVItems.forEach(it => {
      let forceTest = (getSavedMastery(it.question, 'DIR_IN') === 2 && getSavedMastery(it.question, 'DIR_OUT') === 2);
      
      if (it.question.trim().includes(' ') || it.question.trim().includes('-')) {
          qSentences.push({ type: 'SCRAMBLE', data: it, wave: 3 });
      } else {
          if (getSavedMastery(it.question, 'DIR_IN') < 2 || forceTest) qNewPassive.push({ type: 'QUIZ_IN', data: it, wave: 1 });
          if (getSavedMastery(it.question, 'DIR_OUT') < 2 || forceTest) qNewActive.push({ type: 'QUIZ_OUT', data: it, wave: 2 });
          qSentences.push({ type: 'SCRAMBLE', data: it, wave: 3 });
      }
  });

  // U kvízů aktuální lekce mají přednost nedokončené (< 2 ★), max 6
  const sortedQuizzes = [...currentQItems].sort((a, b) => {
    const ma = getSavedMastery(a.question, 'DIR_OUT');
    const mb = getSavedMastery(b.question, 'DIR_OUT');
    if (ma !== mb) return ma - mb;
    return Math.random() - 0.5;
  }).slice(0, 6);
  sortedQuizzes.forEach(it => qGrammar.push({ type: 'KVIZ', data: it, wave: 2 }));

  qRevision.sort(() => Math.random() - 0.5); qNewPassive.sort(() => Math.random() - 0.5); 
  qNewActive.sort(() => Math.random() - 0.5); qGrammar.sort(() => Math.random() - 0.5); qSentences.sort(() => Math.random() - 0.5);

  q = [...qRevision, ...qNewPassive, ...qNewActive, ...qGrammar, ...qSentences];
  if (q.length > 40) q = q.slice(0, 40);

  q.forEach(task => {
    if (task.type === 'QUIZ_OUT' || task.type === 'QUIZ_IN') {
       const isOut = task.type === 'QUIZ_OUT';
       const correctAns = isOut ? task.data.question : cleanCzechTranslation(task.data.answer);
       let localItems = [...currentVItems, ...olderVItems];
       
       let shortItems = localItems.filter(i => {
         const qWords = i.question.replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const aWords = cleanCzechTranslation(i.answer).replace(/\s*\([^)]*\)/g, '').trim().split(/\s+/).length;
         const isSentence = /[.?!]$/.test(i.question.trim());
         return qWords <= 2 && aWords <= 3 && !isSentence;
       });
       if (shortItems.length < 4) shortItems = localItems;

       let pool = [...new Set(shortItems.map(i => isOut ? i.question : cleanCzechTranslation(i.answer)))].filter(ans => ans !== correctAns);
       
       if (selectedSubject === "Matematika") {
         pool = generateMathDistractors(correctAns, pool);
       } else if (pool.length > 0) {
         while (pool.length < 3) pool.push(pool[Math.floor(Math.random() * pool.length)]);
       } else {
         pool = ["...", "...", "..."];
       }
       
       pool.sort(() => Math.random() - 0.5);
       task.opts = [correctAns, ...pool.slice(0, 3)].sort(() => Math.random() - 0.5);
       task.correctAns = correctAns;
       task.prompt = isOut ? cleanCzechTranslation(task.data.answer) : task.data.question;

       if (task.type === 'QUIZ_IN' && selectedSubject !== "Matematika" && typeof isAutoTTS !== "undefined" && isAutoTTS && getTargetLang(selectedSubject) !== 'cs-CZ') {
         if (Math.random() < 0.35) task.isAudioOnly = true;
       }

    } else if (task.type === 'SCRAMBLE') {
       const raw = task.data.question.replace(/\s*\([^)]*\)/g, '').trim();
       const isWordMode = (raw.split(/\s+/).length >= 3 || raw.length > 15);
       const tokens = isWordMode ? (raw.includes('-') ? raw.split('-').map(s=>s.trim()) : raw.split(/\s+/)) : getGraphemes(raw);
       task.tokens = tokens;
       task.tiles = tokens.map((t, i) => ({ text: t, used: false, id: i })).sort(() => Math.random() - 0.5);
       task.placed = []; task.isWordMode = isWordMode; task.hadMistake = false;
    } else if (task.type === 'KVIZ') {
       task.opts = task.data.options; task.correctAns = task.data.answer; task.prompt = formatPromptText(task.data.question);
    }
  });

  cmpQueue = q; cmpIdx = 0; cmpHearts = 5; cmpState = 'PLAYING'; cmpChosenOpt = null; isCampaignMinigame = false;
  cmpMistakes = []; cmpSummaryShown = false;
  selectedGame = 'CAMPAIGN'; setScreen('PLAYING');
  if (typeof isAutoTTS !== "undefined" && isAutoTTS && cmpQueue[0] && cmpQueue[0].type === 'QUIZ_IN') {
    speakWord(cmpQueue[0].data.question, selectedSubject);
  }
}
