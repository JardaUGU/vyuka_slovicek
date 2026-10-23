/**
 * PROCEDURÁLNÍ MATEMATIKA A KROKOVÉ ROVNICE
 */
let mathOperation = "MIX";
let mathTask = { type: "NORMAL", q: "2 + 2 = ?", ans: 4, opts: [2, 3, 4, 5] };
let mathStreak = 0;
let mathChosenAnswer = null;

function openMathOperationSelect() { 
  selectedSubject = "Matematika"; 
  setScreen("SELECT_MATH_OP"); 
}

function renderMathOpSelection() {
  const main = document.getElementById("main-content");
  const g = parseInt(currentUser.grade) || 2;
  
  let ops = [
    { id: "EQ_STEP", title: "Krokové rovnice (Novinka!)", desc: "Klikáním na operace postupně řeš rovnici oboustrannou úpravou." },
    { id: "ADD_SUB_20_NO", title: "+ a - do 20 bez přechodu", desc: "12 + 5, 17 - 4" },
    { id: "ADD_SUB_20_YES", title: "+ a - do 20 s přechodem", desc: "8 + 7, 15 - 9" },
    { id: "MUL_SMALL", title: "Malá násobilka", desc: "Základy násobení" },
    { id: "FRACTIONS", title: "Zlomky (+ a -)", desc: "Sčítání a odčítání zlomků" },
    { id: "PERCENTAGES", title: "Procenta", desc: "Výpočet procentové části z celku" }
  ];

  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber matematiku:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ops.map(o => `
        <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left; ${o.id==='EQ_STEP' ? 'border-color:var(--col-green); background:#112a1f;' : ''}" onclick="startMathPractice('${o.id}', '${o.title}')">
          <div><h2 style="${o.id==='EQ_STEP' ? 'color:var(--col-green);' : ''}">${o.title}</h2><p>${o.desc}</p></div>
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
  
  // --- NOVINKA: KROKOVÉ ROVNICE ---
  if (mathOperation === "EQ_STEP") {
      // Rovnice tvaru: ax + b = c
      let a = Math.floor(Math.random() * 5) + 2; // Koeficient 2 až 6
      let x = Math.floor(Math.random() * 9) + 1; // Neznámá x = 1 až 9
      let b = (Math.floor(Math.random() * 15) + 1) * (Math.random() > 0.5 ? 1 : -1);
      let c = (a * x) + b;

      mathTask = {
          type: "STEP_EQ",
          a: a, b: b, c: c, ans: x,
          stepPhase: 0, // 0 = odstranit b, 1 = izolovat x (vydělit a), 2 = hotovo
          history: [{ eq: `${a}x ${b > 0 ? '+' : '-'} ${Math.abs(b)} = ${c}`, op: null }],
          opts: []
      };
      generateEqStepOptions();
      return;
  }

  // --- STANDARDNÍ MATEMATIKA ---
  let a, b, qStr, ans;
  if (mathOperation === "FRACTIONS") {
      let d = [2, 3, 4, 5, 8][Math.floor(Math.random() * 5)];
      a = Math.floor(Math.random() * d) + 1; b = Math.floor(Math.random() * d) + 1;
      let isAdd = Math.random() > 0.5;
      if (!isAdd && a < b) { let t = a; a = b; b = t; } 
      ans = isAdd ? (a + b) : (a - b);
      let cStr = `${ans}/${d}`; if (ans === 0) cStr = "0"; if (ans === d) cStr = "1";
      
      let optSet = new Set([cStr]);
      while (optSet.size < 4) {
         let fake = ans + Math.floor(Math.random() * 5) - 2;
         if (fake < 0) fake += 3;
         let fStr = `${fake}/${d}`; if (fake === 0) fStr = "0"; if (fake === d) fStr = "1";
         optSet.add(fStr);
      }
      mathTask = { type: "NORMAL", q: `${a}/${d} ${isAdd ? '+' : '-'} ${b}/${d} = ?`, ans: cStr, opts: Array.from(optSet).sort(()=>Math.random()-0.5) };
  } else if (mathOperation === "PERCENTAGES") {
      let p = [10, 20, 25, 50, 75][Math.floor(Math.random() * 5)];
      let base = [100, 200, 400, 50, 150][Math.floor(Math.random() * 5)];
      ans = (p / 100) * base;
      mathTask = { type: "NORMAL", q: `${p}% z ${base} = ?`, ans: ans, opts: makeNumOpts(ans, base > 100 ? 10 : 5) };
  } else {
      a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * 9) + 2;
      mathTask = { type: "NORMAL", q: `${a} · ${b} = ?`, ans: a * b, opts: makeNumOpts(a * b) };
  }
}

// LOGIKA PRO GENEROVÁNÍ TLAČÍTEK ÚPRAV
function generateEqStepOptions() {
    let pool = new Set();
    
    if (mathTask.stepPhase === 0) {
        // Cíl: Odstranit "b" převedením na druhou stranu
        let correctOp = mathTask.b > 0 ? `- ${mathTask.b}` : `+ ${Math.abs(mathTask.b)}`;
        mathTask.correctStep = correctOp;
        pool.add(correctOp);
        // Falešné možnosti
        pool.add(mathTask.b > 0 ? `+ ${mathTask.b}` : `- ${Math.abs(mathTask.b)}`);
        pool.add(`/ ${mathTask.a}`);
        pool.add(`- ${mathTask.a}x`);
    } else if (mathTask.stepPhase === 1) {
        // Cíl: Získat "x" vydělením rovnice koeficientem "a"
        let correctOp = `/ ${mathTask.a}`;
        mathTask.correctStep = correctOp;
        pool.add(correctOp);
        // Falešné možnosti
        pool.add(`* ${mathTask.a}`);
        pool.add(`- ${mathTask.a}`);
        pool.add(`+ ${mathTask.c}`); // c už je upravené
    }
    
    // Doplnění poolu, pokud je málo možností
    while(pool.size < 4) {
       let r = Math.floor(Math.random()*10)+1;
       pool.add((Math.random()>0.5?'+':'-') + ` ${r}`);
    }
    
    mathTask.opts = Array.from(pool).sort(() => Math.random() - 0.5);
}

// ZPRACOVÁNÍ KLIKNUTÍ NA KROK U ROVNICE
function handleEqStepChoice(opt) {
    if (mathTask.stepPhase >= 2) return;
    
    if (opt === mathTask.correctStep) {
        sndOk();
        // Zapsání co hráč provedl k předchozí rovnici (ukáže se šipka vpravo)
        mathTask.history[mathTask.history.length - 1].op = opt;
        
        // Aplikace úpravy na rovnici
        if (mathTask.stepPhase === 0) {
            // b bylo odstraněno
            mathTask.c = mathTask.c - mathTask.b; 
            mathTask.b = 0;
            mathTask.history.push({ eq: `${mathTask.a}x = ${mathTask.c}`, op: null });
            mathTask.stepPhase = 1;
            generateEqStepOptions();
        } else if (mathTask.stepPhase === 1) {
            // a bylo vyděleno
            mathTask.history.push({ eq: `x = ${mathTask.ans}`, op: null });
            mathTask.stepPhase = 2; // Hotovo!
            mathStreak++; 
            addReward(2, "Matematika Rovnice"); // Bonus za těžší věc
        }
    } else {
        sndErr();
        mathStreak = 0;
        alert("Tudy cesta nevede. Zkus to jinak!"); // Nebo jen zvuk chyby
    }
    renderActiveGame();
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
  } else { sndErr(); mathStreak = 0; }
  renderActiveGame();
}
