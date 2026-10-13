/**
 * PROCEDURÁLNÍ MATEMATICKÝ ENGINE S VÝBĚREM OPERACÍ A FIXACÍ ODPOVĚDI
 */
let mathOperation = "MIX";
let mathTask = null;
let mathStreak = 0;
let mathChosenAnswer = null;

function openMathOperationSelect() {
  selectedSubject = "Matematika";
  setScreen("SELECT_MATH_OP");
}

function renderMathOpSelection() {
  const main = document.getElementById("main-content");
  const g = parseInt(currentUser.grade) || 2;

  let ops = [];
  if (g <= 2) {
    ops = [
      { id: "ADD_SUB_20_NO_CARRY", title: "+ a - do 20 bez přechodu", desc: "Např. 12 + 5, 17 - 4" },
      { id: "ADD_SUB_20_CARRY",    title: "+ a - do 20 s přechodem", desc: "Např. 8 + 7, 15 - 9" },
      { id: "TENS_100",            title: "Desítky do 100", desc: "Např. 30 + 40, 90 - 50" },
      { id: "MUL_SMALL",           title: "Malá násobilka (2, 3, 4, 5)", desc: "Základy násobení" },
      { id: "COMPARE",             title: "Porovnávání čísel (<, =, >)", desc: "Např. 48 ... 84" },
      { id: "MIX_G2",              title: "★ Mix pro 2. třídu", desc: "Všechny operace dohromady" }
    ];
  } else if (g <= 5) {
    ops = [
      { id: "MUL_FULL",   title: "Kompletní násobilka (1–10)", desc: "Např. 7 · 8, 9 · 6" },
      { id: "DIV_EXACT",  title: "Dělení beze zbytku", desc: "Např. 56 : 7, 72 : 9" },
      { id: "ADD_1000",   title: "+ a - do 1 000", desc: "Např. 350 + 280, 840 - 190" },
      { id: "ROUND_100",  title: "Zaokrouhlování na desítky a stovky", desc: "Např. 348 ➔ 350" },
      { id: "MIX_G5",     title: "★ Mix pro 5. třídu", desc: "Všechny operace dohromady" }
    ];
  } else {
    ops = [
      { id: "NEG_ARITH", title: "Kladná a záporná čísla", desc: "Např. (-5) + 8, (-4) · (-3)" },
      { id: "EQUATION",  title: "Lineární rovnice (x)", desc: "Např. 3x + 4 = 19" },
      { id: "SQUARE",    title: "Mocniny a odmocniny", desc: "Např. 12², √144" },
      { id: "MIX_ADV",   title: "★ Mix vyšší stupeň", desc: "Rovnice, mocniny i celá čísla" }
    ];
  }

  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber matematickou disciplínu:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ops.map(o => `
        <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left;" onclick="startMathPractice('${o.id}', '${o.title}')">
          <div>
            <h2>${o.title}</h2>
            <p>${o.desc}</p>
          </div>
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
  let op = mathOperation;

  // Mix řešení
  if (op === "MIX_G2") {
    const list = ["ADD_SUB_20_NO_CARRY", "ADD_SUB_20_CARRY", "TENS_100", "MUL_SMALL", "COMPARE"];
    op = list[Math.floor(Math.random() * list.length)];
  } else if (op === "MIX_G5") {
    const list = ["MUL_FULL", "DIV_EXACT", "ADD_1000", "ROUND_100"];
    op = list[Math.floor(Math.random() * list.length)];
  } else if (op === "MIX_ADV") {
    const list = ["NEG_ARITH", "EQUATION", "SQUARE"];
    op = list[Math.floor(Math.random() * list.length)];
  }

  if (op === "ADD_SUB_20_NO_CARRY") {
    const isAdd = Math.random() < 0.5;
    if (isAdd) {
      const a = 10 + Math.floor(Math.random() * 8);
      const b = Math.floor(Math.random() * (19 - a)) + 1;
      mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b) };
    } else {
      const a = 11 + Math.floor(Math.random() * 9);
      const b = Math.floor(Math.random() * (a - 10));
      mathTask = { q: `${a} - ${b} = ?`, ans: a - b, opts: makeNumOpts(a - b) };
    }
  } else if (op === "ADD_SUB_20_CARRY") {
    const isAdd = Math.random() < 0.5;
    if (isAdd) {
      const a = Math.floor(Math.random() * 6) + 5; // 5..9
      const b = Math.floor(Math.random() * 6) + (11 - a); // tak aby a+b > 10 a <= 20
      mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b) };
    } else {
      const ans = Math.floor(Math.random() * 7) + 3;
      const b = Math.floor(Math.random() * 7) + 4;
      const a = ans + b;
      mathTask = { q: `${a} - ${b} = ?`, ans: ans, opts: makeNumOpts(ans) };
    }
  } else if (op === "TENS_100") {
    const a = (Math.floor(Math.random() * 8) + 1) * 10;
    const b = (Math.floor(Math.random() * (9 - a / 10)) + 1) * 10;
    mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b, 10) };
  } else if (op === "MUL_SMALL") {
    const a = Math.floor(Math.random() * 4) + 2; // 2..5
    const b = Math.floor(Math.random() * 10) + 1;
    mathTask = { q: `${a} · ${b} = ?`, ans: a * b, opts: makeNumOpts(a * b) };
  } else if (op === "COMPARE") {
    const a = Math.floor(Math.random() * 90) + 10;
    const b = Math.random() < 0.25 ? a : Math.floor(Math.random() * 90) + 10;
    const ans = a < b ? "<" : (a > b ? ">" : "=");
    mathTask = { q: `${a}  ___  ${b}`, ans: ans, opts: ["<", "=", ">"] };
  } else if (op === "MUL_FULL") {
    const a = Math.floor(Math.random() * 9) + 2;
    const b = Math.floor(Math.random() * 9) + 2;
    mathTask = { q: `${a} · ${b} = ?`, ans: a * b, opts: makeNumOpts(a * b) };
  } else if (op === "DIV_EXACT") {
    const b = Math.floor(Math.random() * 8) + 2;
    const ans = Math.floor(Math.random() * 9) + 2;
    const a = b * ans;
    mathTask = { q: `${a} : ${b} = ?`, ans: ans, opts: makeNumOpts(ans) };
  } else if (op === "ADD_1000") {
    const a = Math.floor(Math.random() * 400) + 50;
    const b = Math.floor(Math.random() * 400) + 50;
    mathTask = { q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b, 10) };
  } else if (op === "ROUND_100") {
    const val = Math.floor(Math.random() * 800) + 100;
    const rounded = Math.round(val / 10) * 10;
    mathTask = { q: `Zaokrouhli na desítky: ${val} ≐ ?`, ans: rounded, opts: makeNumOpts(rounded, 10) };
  } else if (op === "NEG_ARITH") {
    const a = Math.floor(Math.random() * 20) - 10;
    const b = Math.floor(Math.random() * 20) - 10;
    mathTask = { q: `(${a}) + (${b}) = ?`, ans: a + b, opts: makeNumOpts(a + b) };
  } else if (op === "EQUATION") {
    const a = Math.floor(Math.random() * 4) + 2;
    const x = Math.floor(Math.random() * 10) + 1;
    const b = Math.floor(Math.random() * 10) + 1;
    const c = a * x + b;
    mathTask = { q: `${a}x + ${b} = ${c}  (x = ?)`, ans: x, opts: makeNumOpts(x) };
  } else if (op === "SQUARE") {
    const x = Math.floor(Math.random() * 14) + 2;
    mathTask = { q: `${x}² = ?`, ans: x * x, opts: makeNumOpts(x * x) };
  }
}

function makeNumOpts(correct, step = 1) {
  const opts = [correct];
  while (opts.length < 4) {
    const delta = (Math.floor(Math.random() * 5) - 2) * step;
    const fake = correct + (delta === 0 ? step : delta);
    if (!opts.includes(fake)) opts.push(fake);
  }
  return opts.sort(() => Math.random() - 0.5);
}

// FIXACE ODPOVĚDI: Zůstane svítit a čeká na stisk "DALŠÍ PŘÍKLAD"
function clickMathChoice(opt) {
  if (mathChosenAnswer !== null) return;
  mathChosenAnswer = opt;

  const isCorrect = String(opt) === String(mathTask.ans);
  if (isCorrect) {
    sndOk();
    mathStreak++;
    addReward(1, "Matematika");
    if (mathStreak % 5 === 0) sndFanfare();
  } else {
    sndErr();
    mathStreak = 0;
  }
  renderActiveGame();
}

function nextMathStep() {
  generateMathTask();
  renderActiveGame();
}
