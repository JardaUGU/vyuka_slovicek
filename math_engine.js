/**
 * PROCEDURÁLNÍ MATEMATIKA S VÝBĚREM OPERACÍ
 */
let mathOperation = "MIX_G2";
let mathTask = { q: "2 + 2 = ?", ans: 4, opts: [2, 3, 4, 5] };
let mathStreak = 0;
let mathChosenAnswer = null;

function openMathOperationSelect() { 
  selectedSubject = "Matematika"; 
  setScreen("SELECT_MATH_OP"); 
}

function renderMathOpSelection() {
  const main = document.getElementById("main-content");
  const g = parseInt(currentUser.grade) || 2;
  let ops = (g <= 2) ? [
    { id: "ADD_SUB_20_NO", title: "+ a - do 20 bez přechodu", desc: "12 + 5, 17 - 4" },
    { id: "ADD_SUB_20_YES", title: "+ a - do 20 s přechodem", desc: "8 + 7, 15 - 9" },
    { id: "TENS_100", title: "Desítky do 100", desc: "30 + 40, 90 - 50" },
    { id: "MUL_SMALL", title: "Malá násobilka (2, 3, 4, 5)", desc: "Základy násobení" },
    { id: "COMPARE", title: "Porovnávání čísel (<, =, >)", desc: "48 ... 84" }
  ] : [
    { id: "MUL_FULL", title: "Kompletní násobilka (1–10)", desc: "7 · 8, 9 · 6" },
    { id: "DIV_EXACT", title: "Dělení beze zbytku", desc: "56 : 7, 72 : 9" },
    { id: "ADD_1000", title: "+ a - do 1 000", desc: "350 + 280" }
  ];

  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber matematiku:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ops.map(o => `
        <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left;" onclick="startMathPractice('${o.id}', '${o.title}')">
          <div><h2>${o.title}</h2><p>${o.desc}</p></div>
          <span style="color:var(--col-active-tab);font-weight:bold;font-size:20px;">➔</span>
        </div>
      `).join('')}
    </div>
  `;
}

function startMathPractice(opId, opTitle) {
  mathOperation = opId;
  selectedGroupKey = opTitle;
  selectedGame = "PROCEDURAL_MATH";
  mathStreak = 0;
  generateMathTask();
  setScreen("PLAYING");
}

function generateMathTask() {
  mathChosenAnswer = null;
  let a, b, ans;
  if (mathOperation === "ADD_SUB_20_NO") {
    a = 10 + Math.floor(Math.random() * 8); b = Math.floor(Math.random() * (19 - a)) + 1;
    mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b) };
  } else if (mathOperation === "ADD_SUB_20_YES") {
    a = Math.floor(Math.random() * 5) + 6; b = Math.floor(Math.random() * 5) + 5;
    mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b) };
  } else if (mathOperation === "TENS_100") {
    a = (Math.floor(Math.random() * 7) + 1) * 10; b = (Math.floor(Math.random() * (9 - a/10)) + 1) * 10;
    mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b, 10) };
  } else if (mathOperation === "MUL_SMALL") {
    a = Math.floor(Math.random() * 4) + 2; b = Math.floor(Math.random() * 10) + 1;
    mathTask = { q: `${a} · ${b} = ?`, ans: a * b, opts: makeNumOpts(a * b) };
  } else if (mathOperation === "COMPARE") {
    a = Math.floor(Math.random() * 90) + 10; b = Math.floor(Math.random() * 90) + 10;
    ans = a < b ? "<" : (a > b ? ">" : "=");
    mathTask = { q: `${a}  ___  ${b}`, ans: ans, opts: ["<", "=", ">"] };
  } else if (mathOperation === "DIV_EXACT") {
    b = Math.floor(Math.random() * 8) + 2; ans = Math.floor(Math.random() * 9) + 2;
    mathTask = { q: `${b * ans} : ${b} = ?`, ans: ans, opts: makeNumOpts(ans) };
  } else {
    a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * 9) + 2;
    mathTask = { q: `${a} · ${b} = ?`, ans: a * b, opts: makeNumOpts(a * b) };
  }
}

function makeNumOpts(correct, step = 1) {
  const opts = [correct];
  while (opts.length < 4) {
    const delta = (Math.floor(Math.random() * 5) - 2) * step;
    const fake = correct + (delta === 0 ? step : delta);
    if (!opts.includes(fake) && fake >= 0) opts.push(fake);
  }
  return opts.sort(() => Math.random() - 0.5);
}

function clickMathChoice(opt) {
  if (mathChosenAnswer !== null) return;
  mathChosenAnswer = opt;
  if (String(opt) === String(mathTask.ans)) {
    sndOk(); mathStreak++; addReward(1, "Matematika");
  } else {
    sndErr(); mathStreak = 0;
  }
  renderActiveGame();
}
