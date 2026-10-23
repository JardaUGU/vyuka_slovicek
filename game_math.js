/**
 * PROCEDURÁLNÍ MATEMATIKA A ALGEBRAICKÝ ENGINE (ROVNICE, VÝRAZY, ZLOMKY)
 */
let mathOperation = "MIX";
let mathTask = { type: "NORMAL", q: "2 + 2 = ?", ans: 4, opts: [2, 3, 4, 5] };
let mathStreak = 0;
let mathChosenAnswer = null;

// --- POMOCNÉ FUNKCE PRO ZLOMKY A ALGEBRU ---
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

// Zobrazení pro "skládání výrazů" (např. x² + 6x + 9)
function formatExprState(s) {
    let parts = [];
    if (s.x2 !== 0) {
        if (s.x2 === 1) parts.push("x²");
        else if (s.x2 === -1) parts.push("-x²");
        else parts.push(`${s.x2}x²`);
    }
    if (s.x !== 0) {
        let absX = Math.abs(s.x);
        let xStr = (absX === 1) ? "x" : `${absX}x`;
        if (parts.length > 0) parts.push(s.x > 0 ? `+ ${xStr}` : `- ${xStr}`);
        else parts.push(s.x > 0 ? `${xStr}` : `-${xStr}`);
    }
    if (s.n !== 0) {
        if (parts.length > 0) parts.push(s.n > 0 ? `+ ${s.n}` : `- ${Math.abs(s.n)}`);
        else parts.push(`${s.n}`);
    }
    if (parts.length === 0) return "0";
    return parts.join(" ");
}

// --- HLAVNÍ LOGIKA ---
function openMathOperationSelect() { selectedSubject = "Matematika"; setScreen("SELECT_MATH_OP"); }

function renderMathOpSelection() {
  const main = document.getElementById("main-content");
  
  let ops = [
    { id: "EQ_KEYBOARD", title: "Krokové rovnice 🔥", desc: "Řeš oboustrannými úpravami pomocí klávesnice." },
    { id: "EQ_FRACTIONS", title: "Rovnice se zlomky", desc: "Nácvik odstranění zlomku z rovnice." },
    { id: "EXPR_QUADRATIC", title: "Algebraické výrazy", desc: "Roznásobování výrazů (x+a)² z klávesnice." },
    { id: "EQ_STEP", title: "Rovnice (Nácvik)", desc: "Jednodušší mód s nabídkou 4 možností úprav." },
    { id: "FRACTIONS", title: "Zlomky (+ a -)", desc: "Sčítání a odčítání zlomků" },
    { id: "PERCENTAGES", title: "Procenta", desc: "Výpočet procentové části z celku" }
  ];

  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber matematiku:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ops.map(o => `
        <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left; ${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC' ? 'border-color:var(--col-green); background:#112a1f;' : ''}" onclick="startMathPractice('${o.id}', '${o.title}')">
          <div><h2 style="${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC' ? 'color:var(--col-green);' : ''}">${o.title}</h2><p>${o.desc}</p></div>
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
  
  if (mathOperation === "EXPR_QUADRATIC") {
      let a = Math.floor(Math.random() * 5) + 1; 
      let isPlus = Math.random() > 0.5;
      let signStr = isPlus ? '+' : '-';
      mathTask = {
          type: "BUILD_EXPR",
          q: `(x ${signStr} ${a})² = ?`,
          ans: { x2: 1, x: isPlus ? 2*a : -2*a, n: a*a },
          state: { x2: 0, x: 0, n: 0 },
          input: "",
          isDone: false,
          history: [{ eq: "0", op: null }]
      };
      return;
  }

  if (mathOperation === "EQ_FRACTIONS") {
      let denoms = [2, 3, 4, 5, 6];
      let d1 = denoms[Math.floor(Math.random()*denoms.length)];
      let d2 = denoms[Math.floor(Math.random()*denoms.length)];
      let xAns = Math.floor(Math.random()*6)+1; 
      let lx = frac(1, d1);
      let ln = frac(Math.floor(Math.random()*d2)+1, d2);
      if (Math.random() > 0.5) ln.n *= -1;
      
      let xFrac = frac(xAns, 1);
      let term1 = fMul(lx, xFrac);
      let rn = fAdd(term1, ln);
      
      mathTask = {
          type: "STEP_EQ", mode: "KEYBOARD", input: "", ans: xAns, isDone: false,
          eqState: { lx: lx, ln: ln, rx: frac(0), rn: rn },
          history: [], opts: []
      };
      mathTask.history.push({ eq: formatEq(mathTask.eqState), op: null });
      return;
  }

  if (mathOperation === "EQ_STEP" || mathOperation === "EQ_KEYBOARD") {
      let a = Math.floor(Math.random() * 5) + 2; 
      let x = Math.floor(Math.random() * 9) + 1; 
      let b = (Math.floor(Math.random() * 15) + 1) * (Math.random() > 0.5 ? 1 : -1);
      let c = (a * x) + b;

      mathTask = {
          type: "STEP_EQ",
          mode: mathOperation === "EQ_KEYBOARD" ? "KEYBOARD" : "CHOICE",
          input: "", ans: x, isDone: false,
          eqState: { lx: frac(a), ln: frac(b), rx: frac(0), rn: frac(c) },
          history: [], opts: []
      };
      mathTask.history.push({ eq: formatEq(mathTask.eqState), op: null });
      if (mathTask.mode === "CHOICE") generateEqStepOptions();
      return;
  }

  // BĚŽNÁ MATEMATIKA (Zlomky, procenta...)
  let a, b, ans;
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
  }
}

function generateEqStepOptions() {
    let pool = new Set();
    let s = mathTask.eqState;
    let optimalOp = "";
    
    let fracToOpStr = (f, isX, invert) => {
        let n = f.n; if (invert) n = -n;
        let sign = n < 0 ? "- " : "+ ";
        n = Math.abs(n);
        let dStr = (f.d === 1) ? `${n}` : `${n}/${f.d}`;
        if (isX) dStr = (dStr === "1" ? "x" : dStr + "x");
        return sign + dStr;
    };

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

window.clickMathKey = function(k) {
    if (mathTask.isDone) return;
    if (k === 'C') mathTask.input = "";
    else mathTask.input = (mathTask.input || "") + k;
    if (typeof renderActiveGame === 'function') renderActiveGame();
};

window.submitMathKey = function() {
    if (!mathTask.input) return;
    let opt = mathTask.input;
    mathTask.input = "";
    handleEqStepChoice(opt);
};

window.handleEqStepChoice = function(opt) {
    if (mathTask.isDone) return;
    let cleanOpt = opt.replace(/\s+/g, '');
    
    // ZPRACOVÁNÍ VÝRAZŮ (x² + 6x + 9)
    if (mathTask.type === "BUILD_EXPR") {
        let match = cleanOpt.match(/^([+\-])?(\d*)(x²|x2|x)?$/i);
        if (match) {
            let op = match[1] || '+';
            let numStr = match[2];
            let typeStr = (match[3] || '').toLowerCase();
            let num = 1;
            if (numStr) num = parseInt(numStr);
            else if (!typeStr) { sndErr(); alert("Neplatný zápis! Zadej např. +x²"); return; }
            if (op === '-') num *= -1;
            
            let s = { ...mathTask.state };
            if (typeStr === 'x²' || typeStr === 'x2') s.x2 += num;
            else if (typeStr === 'x') s.x += num;
            else s.n += num;
            
            let opDisplay = `${op} ${numStr}${typeStr === 'x2' ? 'x²' : typeStr}`;
            mathTask.history[mathTask.history.length - 1].op = opDisplay;
            mathTask.state = s;
            mathTask.history.push({ eq: formatExprState(s), op: null });
            
            if (s.x2 === mathTask.ans.x2 && s.x === mathTask.ans.x && s.n === mathTask.ans.n) {
                sndOk(); mathTask.isDone = true; mathStreak++; addReward(2, "Výrazy");
            } else { playTone(500, 'sine', 0.05); }
            if (typeof renderActiveGame === 'function') renderActiveGame();
            return;
        } else {
            sndErr(); alert("Zadej platný člen (např. +x², -6x, +9)"); return;
        }
    }

    // ZPRACOVÁNÍ ROVNIC
    let match = cleanOpt.match(/^([+\-*/])(-?)(\d*)(\/\d+)?(x?)$/i);
    if (match) {
        let op = match[1];
        let isNeg = match[2] === '-';
        let numStr = match[3];
        let denStr = match[4];
        let isX = match[5].toLowerCase() === 'x';
        
        let num = 1;
        if (numStr) num = parseInt(numStr);
        else if (!isX) { sndErr(); alert("Zadej znaménko a číslo (např. +5, /2)"); return; }
        num *= (isNeg ? -1 : 1);
        let den = denStr ? parseInt(denStr.substring(1)) : 1;
        let valF = frac(num, den);
        
        if ((op === '*' || op === '/') && isX) { sndErr(); alert("Násobení/dělení neznámou 'x' zatím není podporováno."); return; }
        if (op === '/' && valF.n === 0) { sndErr(); alert("Nulou nelze dělit!"); return; }

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
            sndOk(); mathTask.isDone = true; mathStreak++; addReward(2, "Rovnice"); 
        } else {
            playTone(500, 'sine', 0.05); 
            if (mathTask.mode === "CHOICE") generateEqStepOptions();
        }
        if(typeof renderActiveGame === 'function') renderActiveGame();
    } else {
        sndErr(); alert("Nerozumím zápisu. (Zkus např. +5, /2, -3x, +x²)");
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
