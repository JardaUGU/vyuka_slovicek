/**
 * PROCEDURÁLNÍ MATEMATIKA A ALGEBRAICKÝ ENGINE
 */
let mathOperation = "MIX";
let mathTask = { type: "NORMAL", q: "2 + 2 = ?", ans: 4, opts: [2, 3, 4, 5] };
let mathStreak = 0;
let mathChosenAnswer = null;

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
    let absN = Math.abs(f.n);
    let signStr = f.n < 0 ? (isFirst ? "-" : " - ") : (isFirst ? "" : " + ");
    if (f.d === 1) {
        let numStr = (absN === 1 && isX) ? "" : `${absN}`;
        return signStr + numStr + (isX ? "x" : "");
    } else {
        let xStr = isX ? `<span style="margin-left:3px; font-size:1.1em;">x</span>` : "";
        let numStr = (isX && absN === 1) ? "1" : absN;
        let fracHtml = `<span style="display:inline-flex; align-items:center; vertical-align:middle; line-height:1.1; margin: 0 2px; white-space:nowrap;">
                          <span style="display:inline-flex; flex-direction:column; text-align:center; font-size:0.75em;">
                             <span style="border-bottom:2px solid currentColor; padding:0 3px;">${numStr}</span>
                             <span style="padding:0 3px;">${f.d}</span>
                          </span>
                          ${xStr}
                        </span>`;
        return signStr + fracHtml;
    }
}

// DŮLEŽITÉ: Přidáno white-space: nowrap proti rozsypání na víc řádků
function renderSimpleFrac(n, d) {
    return `<span style="display:inline-flex; flex-direction:column; text-align:center; vertical-align:middle; line-height:1.1; font-size:0.75em; margin: 0 4px; white-space:nowrap;">
               <span style="border-bottom:2px solid currentColor; padding:0 3px;">${n}</span>
               <span style="padding:0 3px;">${d}</span>
            </span>`;
}

function formatSide(fx, fn) {
    if (fx.n === 0 && fn.n === 0) return "0";
    let res = ""; let hasFirst = false;
    if (fx.n !== 0) { res += formatFrac(fx, true, true); hasFirst = true; }
    if (fn.n !== 0) { res += formatFrac(fn, false, !hasFirst); }
    return res;
}

function formatEq(state) { return `${formatSide(state.lx, state.ln)} &nbsp;=&nbsp; ${formatSide(state.rx, state.rn)}`; }

function formatExprState(s) {
    let parts = [];
    if (s.x2 !== 0) { if (s.x2 === 1) parts.push("x²"); else if (s.x2 === -1) parts.push("-x²"); else parts.push(`${s.x2}x²`); }
    if (s.x !== 0) { let absX = Math.abs(s.x); let xStr = (absX === 1) ? "x" : `${absX}x`; if (parts.length > 0) parts.push(s.x > 0 ? `+ ${xStr}` : `- ${xStr}`); else parts.push(s.x > 0 ? `${xStr}` : `-${xStr}`); }
    if (s.n !== 0) { if (parts.length > 0) parts.push(s.n > 0 ? `+ ${s.n}` : `- ${Math.abs(s.n)}`); else parts.push(`${s.n}`); }
    if (parts.length === 0) return "0";
    return parts.join(" ");
}

function evalExpr(str, xVal) {
    let s = str.replace(/x²/g, `(${xVal}*${xVal})`).replace(/(\d)x/g, `$1*${xVal}`).replace(/x/g, `(${xVal})`);
    try { return new Function('return ' + s)(); } catch(e) { return null; }
}

function openMathOperationSelect() { selectedSubject = "Matematika"; setScreen("SELECT_MATH_OP"); }

function renderMathOpSelection() {
  const main = document.getElementById("main-content");
  let ops = [
    { id: "FRACTIONS_STEP", title: "Zlomky (Krokově)", desc: "Sčítání a odčítání formou řešení na papíře." },
    { id: "EXPR_QUADRATIC", title: "Algebraické výrazy", desc: "Zadávej libovolné mezikroky roznásobení (x+a)²." },
    { id: "EQ_KEYBOARD", title: "Rovnice (Klávesnice)", desc: "Upravuj libovolně obě strany rovnice přes klávesnici." },
    { id: "EQ_FRACTIONS", title: "Rovnice se zlomky", desc: "Nácvik odstranění zlomku z rovnice." },
    { id: "ADD_SUB_20_NO", title: "+ a - do 20", desc: "12 + 5, 17 - 4" },
    { id: "MUL_SMALL", title: "Malá násobilka", desc: "Základy násobení" }
  ];
  main.innerHTML = `
    <h2 style="font-size:18px;margin-bottom:12px;text-align:center;color:var(--col-yellow);">Vyber matematiku:</h2>
    <div style="display:flex;flex-direction:column;gap:8px;">
      ${ops.map(o => `
        <div class="tile" style="flex-direction:row;justify-content:space-between;padding:12px;text-align:left; ${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC'||o.id==='FRACTIONS_STEP' ? 'border-color:var(--col-green); background:#112a1f;' : ''}" onclick="startMathPractice('${o.id}', '${o.title}')">
          <div><h2 style="${o.id.startsWith('EQ_')||o.id==='EXPR_QUADRATIC'||o.id==='FRACTIONS_STEP' ? 'color:var(--col-green);' : ''}">${o.title}</h2><p>${o.desc}</p></div>
          <span style="color:var(--col-active-tab);font-weight:bold;font-size:20px;">➔</span>
        </div>
      `).join('')}
    </div>
  `;
}

function startMathPractice(opId, opTitle) {
  mathOperation = opId; selectedGroupKey = opTitle; selectedGame = "PROCEDURAL_MATH"; mathStreak = 0; 
  if (typeof isCampaignMinigame !== "undefined") isCampaignMinigame = false; // OPRAVA: Reset kampaně, aby nás tlačítko Zpět nevracelo na Cestu!
  generateMathTask(); setScreen("PLAYING");
}

function generateMathTask() {
  mathChosenAnswer = null;
  if (mathOperation === "FRACTIONS_STEP") {
      let denoms = [2, 3, 4, 5, 6, 8, 10];
      let d1 = denoms[Math.floor(Math.random() * denoms.length)];
      let d2; do { d2 = denoms[Math.floor(Math.random() * denoms.length)]; } while (d1 === d2);
      let a = Math.floor(Math.random() * (d1 - 1)) + 1;
      let b = Math.floor(Math.random() * (d2 - 1)) + 1;
      let isAdd = Math.random() > 0.5;
      let targetVal = isAdd ? (a/d1 + b/d2) : (a/d1 - b/d2);
      mathTask = {
          type: "FRAC_STEP", q: `${renderSimpleFrac(a, d1)} ${isAdd ? '+' : '-'} ${renderSimpleFrac(b, d2)} &nbsp;=&nbsp; ?`,
          targetVal: targetVal, input: "", isDone: false, history: [{ eq: `${renderSimpleFrac(a, d1)} ${isAdd ? '+' : '-'} ${renderSimpleFrac(b, d2)}`, op: null }]
      };
      return;
  }
  
  if (mathOperation === "EXPR_QUADRATIC") {
      let a = Math.floor(Math.random() * 6) + 1; let isPlus = Math.random() > 0.5;
      let b = isPlus ? 2*a : -2*a; let c = a*a; let targetCanonical = `x²${b>0?'+':''}${b}x+${c}`;
      mathTask = {
          type: "BUILD_EXPR", q: `(x ${isPlus ? '+' : '-'} ${a})² &nbsp;=&nbsp; ?`, target: targetCanonical.replace(/\s+/g, ''),
          input: "", isDone: false, history: [{ eq: `(x ${isPlus ? '+' : '-'} ${a})²`, op: null }]
      };
      return;
  }

  if (mathOperation === "EQ_FRACTIONS") {
      let denoms = [2, 3, 4, 5, 6];
      let d1 = denoms[Math.floor(Math.random()*denoms.length)]; let d2 = denoms[Math.floor(Math.random()*denoms.length)];
      let xAns = Math.floor(Math.random()*6)+1; 
      let lx = frac(1, d1); let ln = frac(Math.floor(Math.random()*d2)+1, d2); if (Math.random() > 0.5) ln.n *= -1;
      let rn = fAdd(fMul(lx, frac(xAns)), ln);
      mathTask = {
          type: "STEP_EQ", mode: "KEYBOARD", input: "", ans: xAns, isDone: false,
          eqState: { lx: lx, ln: ln, rx: frac(0), rn: rn }, history: [], opts: []
      };
      mathTask.history.push({ eq: formatEq(mathTask.eqState), op: null }); return;
  }

  if (mathOperation === "EQ_KEYBOARD") {
      let a = Math.floor(Math.random() * 5) + 2; let x = Math.floor(Math.random() * 9) + 1; 
      let b = (Math.floor(Math.random() * 15) + 1) * (Math.random() > 0.5 ? 1 : -1);
      mathTask = {
          type: "STEP_EQ", mode: "KEYBOARD", input: "", ans: x, isDone: false,
          eqState: { lx: frac(a), ln: frac(b), rx: frac(0), rn: frac((a * x) + b) }, history: [], opts: []
      };
      mathTask.history.push({ eq: formatEq(mathTask.eqState), op: null }); return;
  }

  // STANDARD MATEMATIKA
  let a, b, ans;
  if (mathOperation === "ADD_SUB_20_NO") {
      a = 10 + Math.floor(Math.random() * 8); b = Math.floor(Math.random() * (19 - a)) + 1;
      mathTask = { type: "NORMAL", q: `${a} + ${b} = ?`, ans: a + b, opts: makeNumOpts(a + b) };
  } else {
      a = Math.floor(Math.random() * 9) + 2; b = Math.floor(Math.random() * 9) + 2;
      mathTask = { type: "NORMAL", q: `${a} · ${b} = ?`, ans: a * b, opts: makeNumOpts(a * b) };
  }
}

window.clickMathKey = function(k) {
    if (mathTask.isDone) return;
    if (k === '⌫') mathTask.input = (mathTask.input || "").slice(0, -1); else mathTask.input = (mathTask.input || "") + k;
    const inputEl = document.getElementById("math-keyboard-input");
    if (inputEl) {
        if (mathTask.input) inputEl.innerHTML = mathTask.input;
        else {
            let placeholder = "Zadej úpravu... např. /2, -3x";
            if (mathTask.type === "BUILD_EXPR") placeholder = "Zadej tvar... např. (x-5)*(x-5)";
            if (mathTask.type === "FRAC_STEP") placeholder = "Zadej mezikrok... např. 4/12+3/12";
            inputEl.innerHTML = `<span style="color:var(--col-text-muted); font-size:14px; letter-spacing:normal;">${placeholder}</span>`;
        }
    }
};

window.submitMathKey = function() { if (!mathTask.input) return; let opt = mathTask.input; mathTask.input = ""; handleEqStepChoice(opt); };

window.handleEqStepChoice = function(opt) {
    if (mathTask.isDone) return;
    let cleanOpt = opt.replace(/\s+/g, '');
    
    // --- 1. ZLOMKY NA PAPÍŘE ---
    if (mathTask.type === "FRAC_STEP") {
        let val = null;
        try { val = new Function('return ' + cleanOpt)(); } catch(e) {}
        
        if (val === null || isNaN(val) || !isFinite(val)) { 
            sndErr(); alert("Neplatný matematický zápis!"); if (typeof renderActiveGame === 'function') renderActiveGame(); return; 
        }

        // OPRAVA: Převedení zadaných čísel 8/10+8/10 na nádherné vertikální zlomky!
        let displayEq = cleanOpt.replace(/(\d+)\/(\d+)/g, (match, n, d) => renderSimpleFrac(n, d))
                                .replace(/\+/g, ' &nbsp;+&nbsp; ')
                                .replace(/-/g, ' &nbsp;-&nbsp; ')
                                .replace(/^ &nbsp;\-&nbsp; /, '-');

        if (Math.abs(val - mathTask.targetVal) < 0.0001) {
            let finalMatch = cleanOpt.match(/^(-?\d+)(?:\/(\d+))?$/);
            if (finalMatch) {
                let num = parseInt(finalMatch[1]); let den = finalMatch[2] ? parseInt(finalMatch[2]) : 1;
                if (gcd(Math.abs(num), Math.abs(den)) === 1) {
                    sndOk(); mathTask.isDone = true; mathStreak++; addReward(2, "Zlomky");
                    mathTask.history.push({ eq: displayEq, op: "<span style='color:var(--col-green);'>✓ Hotovo</span>" });
                } else {
                    playTone(500, 'sine', 0.05);
                    mathTask.history.push({ eq: displayEq, op: "<span style='color:var(--col-orange);'>Zkrať na základní tvar!</span>" });
                }
            } else {
                playTone(500, 'sine', 0.05);
                mathTask.history.push({ eq: displayEq, op: "✓ Správný mezikrok" });
            }
        } else {
            sndErr(); mathTask.history.push({ eq: displayEq, op: "<span style='color:var(--col-red);'>Chyba ve výpočtu</span>" });
        }
        if (typeof renderActiveGame === 'function') renderActiveGame();
        return;
    }
    
    // --- 2. ALGEBRAICKÉ VÝRAZY ---
    if (mathTask.type === "BUILD_EXPR") {
        let val10 = evalExpr(cleanOpt, 10); let valM7 = evalExpr(cleanOpt, -7);
        if (val10 === null) { sndErr(); alert("Neplatný matematický zápis! Zkus to jinak."); if (typeof renderActiveGame === 'function') renderActiveGame(); return; }
        
        let target10 = evalExpr(mathTask.target, 10); let targetM7 = evalExpr(mathTask.target, -7);
        if (Math.abs(val10 - target10) < 0.001 && Math.abs(valM7 - targetM7) < 0.001) {
            if (cleanOpt === mathTask.target) {
                sndOk(); mathTask.isDone = true; mathStreak++; addReward(2, "Výrazy");
                mathTask.history.push({ eq: opt, op: "<span style='color:var(--col-green);'>✓ Hotovo</span>" });
            } else { playTone(500, 'sine', 0.05); mathTask.history.push({ eq: opt, op: "✓ Správný mezikrok" }); }
        } else {
            sndErr(); mathTask.history.push({ eq: opt, op: "<span style='color:var(--col-red);'>Není rovno zadání!</span>" });
        }
        if (typeof renderActiveGame === 'function') renderActiveGame(); return;
    }

    // --- 3. KROKOVÉ ROVNICE ---
    let match = cleanOpt.match(/^([+\-*/])(-?)(\d*)(\/\d+)?(x?)$/i);
    if (match) {
        let op = match[1]; let isNeg = match[2] === '-'; let numStr = match[3]; let denStr = match[4]; let isX = match[5].toLowerCase() === 'x';
        let num = 1; if (numStr) num = parseInt(numStr); else if (!isX) { sndErr(); alert("Zadej znaménko a číslo (např. +5, /2)"); if(typeof renderActiveGame==='function') renderActiveGame(); return; }
        num *= (isNeg ? -1 : 1); let den = denStr ? parseInt(denStr.substring(1)) : 1; let valF = frac(num, den);
        
        if ((op === '*' || op === '/') && isX) { sndErr(); alert("Násobení/dělení neznámou 'x' zatím není povoleno."); if(typeof renderActiveGame==='function') renderActiveGame(); return; }
        if (op === '/' && valF.n === 0) { sndErr(); alert("Nulou nelze dělit!"); if(typeof renderActiveGame==='function') renderActiveGame(); return; }

        let opDisplay = `${op} ${isNeg?'-':''}${numStr}${denStr||''}${isX?'x':''}`;
        mathTask.history[mathTask.history.length - 1].op = opDisplay;
        let s = mathTask.eqState;
        if (op === '+') { if (isX) { s.lx = fAdd(s.lx, valF); s.rx = fAdd(s.rx, valF); } else { s.ln = fAdd(s.ln, valF); s.rn = fAdd(s.rn, valF); } } 
        else if (op === '-') { if (isX) { s.lx = fSub(s.lx, valF); s.rx = fSub(s.rx, valF); } else { s.ln = fSub(s.ln, valF); s.rn = fSub(s.rn, valF); } } 
        else if (op === '*') { s.lx = fMul(s.lx, valF); s.ln = fMul(s.ln, valF); s.rx = fMul(s.rx, valF); s.rn = fMul(s.rn, valF); } 
        else if (op === '/') { s.lx = fDiv(s.lx, valF); s.ln = fDiv(s.ln, valF); s.rx = fDiv(s.rx, valF); s.rn = fDiv(s.rn, valF); }
        
        let isXLeft = (s.lx.n === s.lx.d && s.lx.n !== 0 && s.ln.n === 0 && s.rx.n === 0);
        let isXRight = (s.rx.n === s.rx.d && s.rx.n !== 0 && s.rn.n === 0 && s.lx.n === 0);
        
        mathTask.history.push({ eq: formatEq(s), op: null });
        if (isXLeft || isXRight) { sndOk(); mathTask.isDone = true; mathStreak++; addReward(2, "Rovnice"); } else { playTone(500, 'sine', 0.05); }
        if(typeof renderActiveGame === 'function') renderActiveGame();
    } else { sndErr(); alert("Nerozumím zápisu. (Zkus např. +5, /2, -3x)"); if(typeof renderActiveGame==='function') renderActiveGame(); }
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
  if (String(opt) === String(mathTask.ans)) { sndOk(); mathStreak++; addReward(1, "Matematika"); } 
  else { sndErr(); mathStreak = 0; }
  renderActiveGame();
}
