// ==========================================
// 8. HRA HAD (RESPONZIVNÍ, BEZ ODPOČTU, S POJISTKAMI)
// ==========================================
let isSnakeWaitingForInput = true;

function stopSnakeLoop() {
  if (snakeInterval) { clearInterval(snakeInterval); snakeInterval = null; }
}

function resizeSnakeCanvas() {
  const wrap = document.querySelector(".snake-canvas-wrap");
  const cvs = document.getElementById("snake-canvas");
  if (wrap && cvs) {
    cvs.width = wrap.clientWidth;
    cvs.height = wrap.clientWidth; // Udržení čtverce
    snakeCellSize = cvs.width / snakeGridSize;
    drawSnake();
  }
}

function startSnakeGame() {
  stopArcadeLoop();
  stopSnakeLoop();
  
  const vItems = getVocabItems();
  snakeDeck = vItems.filter(it => {
    let clean = it.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim();
    return clean.split(/\s+/).length === 1 && clean.length >= 2 && clean.length <= 10 && !clean.includes('.');
  }).sort(() => Math.random() - 0.5);

  if (snakeDeck.length === 0) {
    alert("V této lekci nejsou žádná vhodná jednoslovná slovíčka pro hada.");
    return;
  }

  snakeLives = 3;
  snakeScore = 0;
  snakeLevel = 1;
  snakeSpeed = 220;
  snakeShieldLetters = 0;
  selectedGame = "SNAKE";
  setScreen("PLAYING");

  setupNextSnakeWord();
  resetSnakeToWait();
  
  // Přidáme listener pro responzivitu
  window.addEventListener('resize', resizeSnakeCanvas);
  setTimeout(() => {
    resizeSnakeCanvas();
    attachSnakeTouchHandlers();
  }, 50);
}

function startCampaignSnake() {
  stopArcadeLoop();
  stopSnakeLoop();
  isCampaignMinigame = true;

  snakeDeck = campaignMinigamePool.filter(it => {
    let clean = it.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim();
    return clean.split(/\s+/).length === 1 && clean.length >= 2 && clean.length <= 10 && !clean.includes('.');
  }).sort(() => Math.random() - 0.5);

  if (snakeDeck.length === 0) {
    startCampaignPexeso();
    return;
  }

  snakeLives = 3;
  snakeScore = 0;
  snakeLevel = 1;
  snakeSpeed = 220;
  snakeShieldLetters = 0;
  selectedGame = "SNAKE";
  setScreen("PLAYING");

  setupNextSnakeWord();
  resetSnakeToWait();
  
  window.addEventListener('resize', resizeSnakeCanvas);
  setTimeout(() => {
    resizeSnakeCanvas();
    attachSnakeTouchHandlers();
  }, 50);
}

function resetSnakeToWait(msg = "Potáhni pro start!") {
  snakeBody = [
    { x: Math.floor(snakeGridSize/2), y: Math.floor(snakeGridSize/2) },
    { x: Math.floor(snakeGridSize/2) - 1, y: Math.floor(snakeGridSize/2) },
    { x: Math.floor(snakeGridSize/2) - 2, y: Math.floor(snakeGridSize/2) }
  ];
  snakeDir = { x: 0, y: 0 };
  snakeNextDir = { x: 0, y: 0 };
  isSnakeWaitingForInput = true;
  snakeState = "WAITING";
  snakeStatusMsg = msg;
  renderActiveGame();
  setTimeout(resizeSnakeCanvas, 10);
  runSnakeLoop();
}

function buySnakeShieldInGame(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (snakeLives > 1 && snakeShieldLetters <= 0) {
    snakeLives--;
    snakeShieldLetters = 20;
    sndFanfare();
    snakeStatusMsg = "🛡️ Štít aktivován! (20 písmen)";
    renderActiveGame();
    setTimeout(resizeSnakeCanvas, 10);
  } else if (snakeLives <= 1) {
    alert("Nemůžeš obětovat své poslední srdíčko! ❤️");
  }
}

function buySnakeShieldWithCoins(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (!currentUser) return;
  const coins = getUserCoins(currentUser.name);
  if (coins >= 15 && snakeShieldLetters <= 0) {
    addCoins(currentUser.name, -15);
    snakeShieldLetters = 20;
    sndFanfare();
    snakeStatusMsg = "🛡️ Štít koupen za 15 💰! (20 písmen)";
    renderActiveGame();
    setTimeout(resizeSnakeCanvas, 10);
  } else {
    alert("Potřebuješ alespoň 15 zlaťáků! 💰");
  }
}

function resumeSnakeWithoutShield(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  resetSnakeToWait("Hraješ bez štítu. Potáhni!");
}

function setupNextSnakeWord() {
  if (snakeDeck.length === 0) {
    const vItems = getVocabItems();
    snakeDeck = vItems.filter(it => {
      let clean = it.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim();
      return clean.split(/\s+/).length === 1 && clean.length >= 2 && clean.length <= 10;
    }).sort(() => Math.random() - 0.5);
  }

  const rawItem = snakeDeck.pop();
  let cleanForeign = rawItem.question.replace(/^(der|die|das|ein|eine|el|la|un|una)\s+/i, '').trim().toUpperCase();

  snakeCurrentWord = {
    raw: rawItem,
    czech: cleanCzechTranslation(rawItem.answer),
    foreign: rawItem.question,
    cleanForeign: cleanForeign
  };

  snakeTargetLetters = getGraphemes(cleanForeign);
  snakeCurrentIdx = 0;
  spawnSnakeFood();
  updateSnakeSlotsDisplay();
}

function spawnSnakeFood() {
  snakeFoods = [];
  const occupied = new Set();
  snakeBody.forEach(seg => occupied.add(`${seg.x},${seg.y}`));

  for (let i = snakeCurrentIdx; i < snakeTargetLetters.length; i++) {
    const ch = snakeTargetLetters[i];
    let pos = getRandomFreeGridPos(occupied);
    if (pos) {
      occupied.add(`${pos.x},${pos.y}`);
      snakeFoods.push({ x: pos.x, y: pos.y, char: ch, isTarget: (i === snakeCurrentIdx) });
    }
  }

  if (snakeLevel >= 2) {
    const distractorsCount = Math.min(3, snakeLevel - 1);
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let d = 0; d < distractorsCount; d++) {
      let randChar = alphabet[Math.floor(Math.random() * alphabet.length)];
      let pos = getRandomFreeGridPos(occupied);
      if (pos) {
        occupied.add(`${pos.x},${pos.y}`);
        snakeFoods.push({ x: pos.x, y: pos.y, char: randChar, isTarget: false });
      }
    }
  }

  ensureTargetFoodsExist();
}

// POJISTKA PROTI MIZENÍ A SPAWNOVÁNÍ PŘÍMO PŘED HLAVOU
function ensureTargetFoodsExist() {
  if (!snakeTargetLetters || snakeCurrentIdx >= snakeTargetLetters.length) return;

  const neededCount = {};
  for (let i = snakeCurrentIdx; i < snakeTargetLetters.length; i++) {
    const ch = snakeTargetLetters[i];
    neededCount[ch] = (neededCount[ch] || 0) + 1;
  }

  const presentCount = {};
  snakeFoods.forEach(f => {
    presentCount[f.char] = (presentCount[f.char] || 0) + 1;
  });

  const occupied = new Set();
  snakeBody.forEach(seg => occupied.add(`${seg.x},${seg.y}`));
  snakeFoods.forEach(f => occupied.add(`${f.x},${f.y}`));

  for (let ch in neededCount) {
    const missing = neededCount[ch] - (presentCount[ch] || 0);
    for (let m = 0; m < missing; m++) {
      const distractorIdx = snakeFoods.findIndex(f => !neededCount[f.char]);
      if (distractorIdx !== -1) {
        const removed = snakeFoods.splice(distractorIdx, 1)[0];
        occupied.delete(`${removed.x},${removed.y}`);
      }

      let pos = getRandomFreeGridPos(occupied);
      if (pos) {
        occupied.add(`${pos.x},${pos.y}`);
        snakeFoods.push({
          x: pos.x,
          y: pos.y,
          char: ch,
          isTarget: (ch === snakeTargetLetters[snakeCurrentIdx])
        });
      }
    }
  }

  const currentTargetChar = snakeTargetLetters[snakeCurrentIdx];
  let firstTargetMarked = false;
  snakeFoods.forEach(f => {
    if (f.char === currentTargetChar && !firstTargetMarked) {
      f.isTarget = true;
      firstTargetMarked = true;
    } else {
      f.isTarget = false;
    }
  });
}

function getRandomFreeGridPos(occupied) {
  const head = snakeBody.length > 0 ? snakeBody[0] : null;
  
  let tries = 0;
  while (tries < 150) {
    let x = Math.floor(Math.random() * (snakeGridSize - 2)) + 1;
    let y = Math.floor(Math.random() * (snakeGridSize - 2)) + 1;
    let key = `${x},${y}`;
    
    // Zabraňuje spawnování jídla ihned před tlamu hada (1 nebo 2 políčka)
    if (head && snakeDir.x !== 0 && snakeDir.y !== 0) {
        if (x === head.x + snakeDir.x && y === head.y + snakeDir.y) { tries++; continue; }
        if (x === head.x + snakeDir.x*2 && y === head.y + snakeDir.y*2) { tries++; continue; }
    }

    if (!occupied.has(key)) return { x, y };
    tries++;
  }
  
  for (let x = 1; x < snakeGridSize - 1; x++) {
    for (let y = 1; y < snakeGridSize - 1; y++) {
      let key = `${x},${y}`;
      if (!occupied.has(key)) return { x, y };
    }
  }
  return null;
}

function runSnakeLoop() {
  stopSnakeLoop();
  snakeInterval = setInterval(() => {
    if (currentScreen !== "PLAYING" || selectedGame !== "SNAKE" || isTimerPaused) return;
    if (!isSnakeWaitingForInput && snakeState === "PLAYING") {
      updateSnake();
    }
    drawSnake();
  }, snakeSpeed);
}

function setSnakeDirection(dx, dy) {
  if (typeof registerUserAction === "function") registerUserAction();
  
  // Zamezení obrácení do sebe
  if (!isSnakeWaitingForInput) {
      if (snakeDir.x !== 0 && snakeDir.x === -dx) return;
      if (snakeDir.y !== 0 && snakeDir.y === -dy) return;
  }
  
  snakeNextDir = { x: dx, y: dy };
  
  // Probuzení hada
  if (isSnakeWaitingForInput && (dx !== 0 || dy !== 0)) {
      isSnakeWaitingForInput = false;
      snakeState = "PLAYING";
      snakeStatusMsg = "";
      renderActiveGame();
      setTimeout(resizeSnakeCanvas, 10);
  }
}

function updateSnakeSlotsDisplay() {
  const container = document.getElementById("snake-slots-wrap");
  if (!container || !snakeTargetLetters) return;
  container.innerHTML = snakeTargetLetters.map((ch, idx) => `
    <div class="snake-slot ${idx < snakeCurrentIdx ? 'done' : (idx === snakeCurrentIdx ? 'active' : '')}">
      ${idx < snakeCurrentIdx ? ch : (idx === snakeCurrentIdx ? ch : '_')}
    </div>
  `).join('');
}

function updateSnake() {
  snakeDir = { ...snakeNextDir };

  let nextX = snakeBody[0].x + snakeDir.x;
  let nextY = snakeBody[0].y + snakeDir.y;

  if (snakeShieldLetters > 0) {
    if (nextX < 0) nextX = snakeGridSize - 1;
    else if (nextX >= snakeGridSize) nextX = 0;
    if (nextY < 0) nextY = snakeGridSize - 1;
    else if (nextY >= snakeGridSize) nextY = 0;
  } else {
    if (nextX < 0 || nextX >= snakeGridSize || nextY < 0 || nextY >= snakeGridSize) {
      handleSnakeDeath("Náraz do zdi! 💥");
      return;
    }
  }

  const head = { x: nextX, y: nextY };

  if (snakeShieldLetters <= 0) {
    for (let i = 0; i < snakeBody.length - 1; i++) {
      if (snakeBody[i].x === head.x && snakeBody[i].y === head.y) {
        handleSnakeDeath("Kousnutí se do ocasu! 💥");
        return;
      }
    }
  }

  const foodIdx = snakeFoods.findIndex(f => f.x === head.x && f.y === head.y);
  if (foodIdx !== -1) {
    const eaten = snakeFoods[foodIdx];
    const targetChar = snakeTargetLetters[snakeCurrentIdx];

    if (eaten.char === targetChar) {
      sndOk();
      snakeFoods.splice(foodIdx, 1);
      snakeCurrentIdx++;
      snakeBody.unshift(head);

      updateSnakeSlotsDisplay();

      if (snakeShieldLetters > 0) {
        snakeShieldLetters--;
        if (snakeShieldLetters === 0) {
          handleShieldExpired();
          return;
        }
      }

      if (snakeCurrentIdx >= snakeTargetLetters.length) {
        handleSnakeWordComplete();
        return;
      } else {
        ensureTargetFoodsExist();
      }
    } else {
      if (snakeShieldLetters > 0) {
        sndErr();
        snakeStatusMsg = `🛡️ Štít tě ochránil před [ ${eaten.char} ]! Hledej [ ${targetChar} ]`;
        snakeFoods.splice(foodIdx, 1); // sežere špatné písmeno bez smrti
        ensureTargetFoodsExist(); // obnoví písmena
      } else {
        handleSnakeDeath(`Špatné písmeno [ ${eaten.char} ]! Hledáš [ ${targetChar} ]`);
        return;
      }
    }
  } else {
    snakeBody.unshift(head);
    snakeBody.pop();
  }
}

function handleShieldExpired() {
  snakeState = "SHIELD_EXPIRED_PAUSE";
  isSnakeWaitingForInput = true;
  stopSnakeLoop();
  sndErr();
  renderActiveGame();
  setTimeout(resizeSnakeCanvas, 10);
}

function handleSnakeWordComplete() {
  sndFanfare();
  snakeScore++;
  addReward(1, "Had");

  if (isAutoTTS && snakeCurrentWord) speakWord(snakeCurrentWord.foreign, selectedSubject);

  if (snakeScore % 3 === 0) {
    snakeLevel++;
    snakeSpeed = Math.max(110, snakeSpeed - 15);
  }

  // Had pokračuje HNED, ale zůstává zachována jeho délka
  setupNextSnakeWord();
  resetSnakeToWait("Výborně! Další slovo: " + snakeCurrentWord.czech);
}

function handleSnakeDeath(reason) {
  sndErr();
  snakeLives--;
  
  if (snakeLives <= 0) {
    snakeState = "GAMEOVER";
    renderActiveGame();
  } else {
    resetSnakeToWait(reason + " Zkus to znovu!");
  }
}

function drawSnake() {
  const canvas = document.getElementById("snake-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#08101e";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += snakeCellSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += snakeCellSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  snakeFoods.forEach(f => {
    let px = f.x * snakeCellSize;
    let py = f.y * snakeCellSize;

    ctx.save();
    if (f.isTarget) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.28)";
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 2;
    } else {
      ctx.fillStyle = "rgba(0, 188, 212, 0.15)";
      ctx.strokeStyle = "#00bcd4";
      ctx.lineWidth = 1;
    }
    ctx.beginPath();
    ctx.roundRect(px + 2, py + 2, snakeCellSize - 4, snakeCellSize - 4, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = f.isTarget ? "#facc15" : "#ffffff";
    ctx.font = "bold " + Math.floor(snakeCellSize * 0.65) + "px Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(f.char, px + (snakeCellSize / 2), py + (snakeCellSize / 2) + 1);
    ctx.restore();
  });

  snakeBody.forEach((seg, idx) => {
    let px = seg.x * snakeCellSize;
    let py = seg.y * snakeCellSize;

    ctx.save();
    if (idx === 0) {
      ctx.fillStyle = snakeShieldLetters > 0 ? "#38bdf8" : (isSnakeWaitingForInput ? "#86efac" : "#22c55e");
      ctx.beginPath();
      ctx.roundRect(px + 1, py + 1, snakeCellSize - 2, snakeCellSize - 2, 6);
      ctx.fill();

      // Oči hada
      ctx.fillStyle = "#000000";
      let eyeSize = Math.max(2, snakeCellSize * 0.15);
      let offset1 = snakeCellSize * 0.25;
      let offset2 = snakeCellSize * 0.75;
      
      if (snakeDir.x === 1) {
        ctx.fillRect(px + offset2, py + offset1, eyeSize, eyeSize); ctx.fillRect(px + offset2, py + offset2, eyeSize, eyeSize);
      } else if (snakeDir.x === -1) {
        ctx.fillRect(px + offset1, py + offset1, eyeSize, eyeSize); ctx.fillRect(px + offset1, py + offset2, eyeSize, eyeSize);
      } else if (snakeDir.y === 1) {
        ctx.fillRect(px + offset1, py + offset2, eyeSize, eyeSize); ctx.fillRect(px + offset2, py + offset2, eyeSize, eyeSize);
      } else {
        ctx.fillRect(px + offset1, py + offset1, eyeSize, eyeSize); ctx.fillRect(px + offset2, py + offset1, eyeSize, eyeSize);
      }
    } else {
      if (snakeShieldLetters > 0) {
        ctx.fillStyle = idx % 2 === 0 ? "#0284c7" : "#0369a1";
      } else {
        ctx.fillStyle = idx % 2 === 0 ? "#16a34a" : "#15803d";
      }
      ctx.beginPath();
      ctx.roundRect(px + 2, py + 2, snakeCellSize - 4, snakeCellSize - 4, 4);
      ctx.fill();
    }
    ctx.restore();
  });
}

window.addEventListener("keydown", (e) => {
  if (currentScreen === "PLAYING" && selectedGame === "SNAKE") {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
      e.preventDefault();
    }
    if (e.code === "ArrowUp" || e.key === "w" || e.key === "W") setSnakeDirection(0, -1);
    else if (e.code === "ArrowDown" || e.key === "s" || e.key === "S") setSnakeDirection(0, 1);
    else if (e.code === "ArrowLeft" || e.key === "a" || e.key === "A") setSnakeDirection(-1, 0);
    else if (e.code === "ArrowRight" || e.key === "d" || e.key === "D") setSnakeDirection(1, 0);
  }
});

function attachSnakeTouchHandlers() {
  const wrap = document.querySelector(".snake-canvas-wrap");
  const canvas = document.getElementById("snake-canvas");
  if (!wrap || !canvas) return;

  const preventDefaultTouch = (e) => { if (e.cancelable) e.preventDefault(); };

  wrap.addEventListener("touchstart", (e) => {
    preventDefaultTouch(e);
    if (typeof registerUserAction === "function") registerUserAction();
    if (e.touches && e.touches[0]) {
      snakeTouchStartX = e.touches[0].clientX;
      snakeTouchStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  wrap.addEventListener("touchmove", (e) => {
    preventDefaultTouch(e);
    if (!e.touches || !e.touches[0]) return;
    const dx = e.touches[0].clientX - snakeTouchStartX;
    const dy = e.touches[0].clientY - snakeTouchStartY;
    const threshold = 18;

    if (Math.abs(dx) > threshold || Math.abs(dy) > threshold) {
      if (Math.abs(dx) > Math.abs(dy)) {
        setSnakeDirection(dx > 0 ? 1 : -1, 0);
      } else {
        setSnakeDirection(0, dy > 0 ? 1 : -1);
      }
      snakeTouchStartX = e.touches[0].clientX;
      snakeTouchStartY = e.touches[0].clientY;
    }
  }, { passive: false });

  wrap.addEventListener("touchend", preventDefaultTouch, { passive: false });
}
