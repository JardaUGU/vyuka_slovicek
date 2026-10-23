/**
 * PROCEDURÁLNÍ MATEMATIKA A ALGEBRAICKÝ ENGINE (KROKOVÉ ROVNICE S KLÁVESNICÍ)
 */
let mathOperation = "MIX";
let mathTask = { type: "NORMAL", q: "2 + 2 = ?", ans: 4, opts: [2, 3, 4, 5] };
let mathStreak = 0;
let mathChosenAnswer = null;

// --- POMOCNÉ FUNKCE PRO ZLOMKY (Mini Algebra) ---
function frac(n, d = 1) {
    if (d === 0) return {n: 0, d: 1};
    let sign = (n * d < 0) ? -1 : 1;
    n = Math.abs(n); d = Math.abs(d);
    let g = gcd(n, d);
    return {n: sign * (n / g), d: d / g};
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function fAdd(a, b) { return frac(a.n * b.d + b.n * a.d, a.d * b.d); }
function fSub(a, b) { return frac(a.n * b.d - b.n * a.d, a.d * b.d); }
function fMul(a, b) { return frac(a.n * b.n, a.d * b.d); }
function fDiv(a, b) { return frac(a.n * b.d, a.d * b.n); }

function formatFrac(f, isX, isFirst) {
    if (f.n === 0) return "";
    let s = "";
    let absN = Math.abs(f.n);
    let numStr = (f.d === 1) ? `${absN}` : `${absN}/${f.d}`;
    if (isX) {
        if (numStr === "1") numStr = "x";
        else numStr += "x";
    }
    if (f.n < 0) { s = isFirst ? `-${numStr}` : `- ${numStr}`; } 
    else { s = isFirst ? `${numStr}` : `+ ${numStr}`; }
    return s;
}

function formatSide(fx, fn) {
    if (fx.n === 0 && fn.n === 0) return "0";
    let res = [];
    if (fx.n !== 0) {
        res.push(formatFrac(fx, true, true));
        if (fn.n !== 0) res.push(formatFrac(fn, false, false));
    } else {
        res.push(formatFrac(fn, false, true));
    }
    return res.join(" ");
}

function formatEq(state) {
    return `${formatSide(state.lx, state.ln)} = ${formatSide(state.rx, state.rn)}`;
}

function fracToOpStr(f, isX, invert) {
    let n = f.n;
    if (invert) n = -n;
    let sign = n < 0 ? "- " : "+ ";
    n = Math.abs(n);
    let dStr = (f.d === 1) ? `${n}` : `${n}/${f.d}`;
    if (isX) dStr = (dStr === "1" ? "x" : dStr + "x");
    return sign + dStr;
}

// --- HLAVNÍ LOGIKA ---
function openMathOperationSelect() { 
  selectedSubject = "Matematika"; 
  setScreen("SELECT_MATH_OP"); 
}

function renderMathOpSelection() {
  const main = document.getElementById("main-content");
  const g = parseInt(currentUser.grade) || 2;
  
  let ops = [
    { id: "EQ_KEYBOARD", title: "Krokové rovnice (Klávesnice) 🔥", desc: "Zadávej úpravy ručně a řeš rovnici jako profík!" },
    { id: "EQ_STEP", title: "Krokové rovnice (Výběr)", desc: "Klikáním na 4 možnosti řeš rovnici krok za krokem." },
    { id: "FRACTIONS", title: "Zlomky (+ a -)", desc: "Sčítání a odčítání zlomků" },
    { id: "PERCENTAGES", title: "Procenta", desc: "Výpočet procentové části z celku" },
    { id: "ADD_SUB_20_NO", title: "+ a - do 20 bez přechodu", desc: "12 + 5, 17 - 4" },
    { id: "MUL_SMALL", title: "Malá násobilka", desc: "Základy násobení" }
  ];

  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber matematiku:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ops.map(o => `
        <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left; ${o.id.startsWith('EQ_') ? 'border-color:var(--col-green); background:#112a1f;' : ''}" onclick="startMathPractice('${o.id}', '${o.title}')">
          <div><h2 style="${o.id.startsWith('EQ_') ? 'color:var(--col-green);' : ''}">${o.title}</h2><p>${o.desc}</p></div>
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
  
  if (mathOperation === "EQ_STEP" || mathOperation === "EQ_KEYBOARD") {
      let a = Math.floor(Math.random() * 5) + 2; 
      let x = Math.floor(Math.random() * 9) + 1; 
      let b = (Math.floor(Math.random() * 15) + 1) * (Math.random() > 0.5 ? 1 : -1);
      let c = (a * x) + b;

      mathTask = {
          type: "STEP_EQ",
          mode: mathOperation === "EQ_KEYBOARD" ? "KEYBOARD" : "CHOICE",
          input: "",
          ans: x,
          isDone: false,
          eqState: { lx: frac(a), ln: frac(b), rx: frac(0), rn: frac(c) },
          history: [],
          opts: []
      };
      
      mathTask.history.push({ eq: formatEq(mathTask.eqState), op: null });
      if (mathTask.mode === "CHOICE") generateEqStepOptions();
      return;
  }

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

function generateEqStepOptions() {
    let pool = new Set();
    let s = mathTask.eqState;
    let optimalOp = "";
    
    if (s.rx.n !== 0) optimalOp = fracToOpStr(s.rx, true, true);
    else if (s.ln.n !== 0) optimalOp = fracToOpStr(s.ln, false, true);
    else if (s.lx.n !== 0 && (s.lx.n !== s.lx.d)) {
        let n = Math.abs(s.lx.n); let d = s.lx.d;
        let valStr = d === 1 ? `${n}` : `${n}/${d}`;
        optimalOp = (s.lx.n * s.lx.d < 0 ? "/ -" : "/ ") + valStr;
    } else if (s.lx.n === 0 && s.rx.n === 0) optimalOp = "+ 1x"; 
    
    if (optimalOp) pool.add(optimalOp);
    
    let operators = ['+', '-', '*', '/'];
    while (pool.size < 4) {
        let op = operators[Math.floor(Math.random() * 4)];
        let v = Math.floor(Math.random() * 9) + 1;
        let isX = (op === '+' || op === '-') && Math.random() > 0.5;
        pool.add(`${op} ${v}${isX ? 'x' : ''}`);
    }
    
    mathTask.opts = Array.from(pool).sort(() => Math.random() - 0.5);
}

// LOGIKA PRO KLÁVESNICI
window.clickMathKey = function(k) {
    if (mathTask.isDone) return;
    if (k === 'C') mathTask.input = "";
    else mathTask.input = (mathTask.input || "") + k;
    if (typeof renderActiveGame === 'function') renderActiveGame();
};

window.submitMathKey = function() {
    if (!mathTask.input) return;
    let opt = mathTask.input;
    mathTask.input = ""; // Vyčistit po odeslání
    handleEqStepChoice(opt);
};

// ZPRACOVÁNÍ KROKU (Z VÝBĚRU I Z KLÁVESNICE)
window.handleEqStepChoice = function(opt) {
    if (mathTask.isDone) return;
    
    // Vyčistíme mezery pro snadnější regex (např. "+ 3x" -> "+3x")
    let cleanOpt = opt.replace(/\s+/g, '');
    let match = cleanOpt.match(/^([+\-*/])(-?)(\d*)(\/\d+)?(x?)$/i);
    
    if (match) {
        let op = match[1];
        let isNeg = match[2] === '-';
        let numStr = match[3];
        let denStr = match[4];
        let isX = match[5].toLowerCase() === 'x';
        
        let num = 1;
        if (numStr) num = parseInt(numStr);
        else if (!isX) {
            sndErr(); alert("Neplatný zápis! Zkus např. +5, /2, -3x"); return;
        }
        num *= (isNeg ? -1 : 1);
        let den = denStr ? parseInt(denStr.substring(1)) : 1;
        let valF = frac(num, den);
        
        if ((op === '*' || op === '/') && isX) {
            sndErr(); alert("Násobení/dělení neznámou 'x' zatím není podporováno."); return;
        }
        if (op === '/' && valF.n === 0) {
            sndErr(); alert("Nulou nelze dělit!"); return;
        }

        let opDisplay = `${op} ${isNeg?'-':''}${numStr}${denStr||''}${isX?'x':''}`;
        mathTask.history[mathTask.history.length - 1].op = opDisplay;
        
        let s = mathTask.eqState;
        
        if (op === '+') {
            if (isX) { s.lx = fAdd(s.lx, valF); s.rx = fAdd(s.rx, valF); }
            else     { s.ln = fAdd(s.ln, valF); s.rn = fAdd(s.rn, valF); }
        } else if (op === '-') {
            if (isX) { s.lx = fSub(s.lx, valF); s.rx = fSub(s.rx, valF); }
            else     { s.ln = fSub(s.ln, valF); s.rn = fSub(s.rn, valF); }
        } else if (op === '*') {
            s.lx = fMul(s.lx, valF); s.ln = fMul(s.ln, valF);
            s.rx = fMul(s.rx, valF); s.rn = fMul(s.rn, valF);
        } else if (op === '/') {
            s.lx = fDiv(s.lx, valF); s.ln = fDiv(s.ln, valF);
            s.rx = fDiv(s.rx, valF); s.rn = fDiv(s.rn, valF);
        }
        
        let isXLeft = (s.lx.n === s.lx.d && s.lx.n !== 0 && s.ln.n === 0 && s.rx.n === 0);
        let isXRight = (s.rx.n === s.rx.d && s.rx.n !== 0 && s.rn.n === 0 && s.lx.n === 0);
        
        mathTask.history.push({ eq: formatEq(s), op: null });
        
        if (isXLeft || isXRight) {
            sndOk();
            mathTask.isDone = true;
            mathStreak++;
            addReward(2, "Matematika Rovnice"); 
        } else {
            playTone(500, 'sine', 0.05); 
            if (mathTask.mode === "CHOICE") generateEqStepOptions();
        }
        
        if(typeof renderActiveGame === 'function') renderActiveGame();
    } else {
        sndErr(); alert("Nerozumím zápisu. Musíš zadat znaménko a číslo (např. +5, /2, -3x)");
    }
};

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
