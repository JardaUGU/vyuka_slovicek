/**
 * MODUL PRO ZVUKOVÉ EFEKTY A SYNTÉZU ŘEČI (TTS)
 * Čistá, stabilní verze s opraveným WebAudio cinkáním pro iPhone SE i 14 Pro
 */

let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];
let speakTimeoutId = null;

// Globální reference zabraňuje smazání přehrávaného slova pamětí v Safari
window._activeUtterance = null;

function updateVoices() {
  if ('speechSynthesis' in window) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedVoices = v;
  }
}
if ('speechSynthesis' in window) {
  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

function toggleAutoTTS() {
  isAutoTTS = !isAutoTTS;
  localStorage.setItem("auto_tts", isAutoTTS);
  updateTTSBtnUI();
}

function updateTTSBtnUI() {
  const btn = document.getElementById("btn-tts-auto");
  if (btn) {
    btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn";
    btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp";
  }
}

function getTargetLang(subjectName) {
  const s = (subjectName || (typeof selectedSubject !== 'undefined' ? selectedSubject : '') || '')
    .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes('angli') || s === 'en' || s.includes('inteligentn')) return 'en-GB';
  if (s.includes('nemc') || s === 'de') return 'de-DE';
  if (s.includes('hebr') || s === 'he') return 'he-IL';
  if (s.includes('spanel') || s === 'es') return 'es-ES';
  return 'cs-CZ';
}

function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window) || !text) return;
  if (subjectName === "Matematika") return;

  if (speakTimeoutId) {
    clearTimeout(speakTimeoutId);
    speakTimeoutId = null;
  }

  try {
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (e) {}

  speakTimeoutId = setTimeout(() => {
    let toSpeak = String(text).trim();

    toSpeak = toSpeak.replace(/^[^:]{1,30}:\s*/, ''); // Odstranění jmen postav
    toSpeak = toSpeak.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(); // Odstranění smajlíků
    toSpeak = toSpeak.replace(/\s*\([^)]*\)/g, ''); // Odstranění závorek

    toSpeak = toSpeak.replace(/\bNo\b/g, 'no').replace(/\bOh no\b/gi, 'oh nou');

    // Oprava hebrejštiny (Boží jméno Adonaj + koncovka -av místo -aju u slov jako Elohav)
    const regexLadonaj = /\u05DC[\u0591-\u05C7]*\u05D9[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D5[\u0591-\u05C7]*\u05D4/g;
    const regexAdonaj = /\u05D9[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D5[\u0591-\u05C7]*\u05D4/g;
    toSpeak = toSpeak.replace(regexLadonaj, 'לַאדֹנָי').replace(regexAdonaj, 'אֲדֹנָי');
    toSpeak = toSpeak.replace(/([\u05B7\u05B8])\u05D9\u05D5(?=\s|$)/g, '$1\u05D5');
    toSpeak = toSpeak.replace(/l'?(jahve|jahveh|yahweh|yahwe|jehova|jhvh|yhwh|jhwh|jvhv)/gi, "Ladonaj");
    toSpeak = toSpeak.replace(/(jahve|jahveh|yahweh|yahwe|jehova|jhvh|yhwh|jhwh|jvhv)/gi, "Adonaj");

    if (/read\s*-\s*read\s*-\s*read/i.test(toSpeak)) toSpeak = "read, red, red";
    else toSpeak = toSpeak.replace(/\//g, ' or ').replace(/\s*-\s*/g, ', ');
    if (/^\s*I\s*[.!?]?\s*$/i.test(toSpeak)) toSpeak = "eye";

    if (!toSpeak) return;

    const u = new SpeechSynthesisUtterance(toSpeak);
    window._activeUtterance = u;

    const targetLang = getTargetLang(subjectName);
    const langPrefix = targetLang.split('-')[0];
    u.lang = targetLang;
    u.rate = 0.88;
    u.volume = 1.0;

    if (cachedVoices.length === 0) updateVoices();
    let voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();

    const playVoice = () => {
      if (voices && voices.length > 0) {
        const isTarget = v => (v.lang || '').toLowerCase().replace('_', '-') === targetLang.toLowerCase() || (v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix);
        let match = voices.find(v => isTarget(v) && /(enhanced|premium|natural|pro)/i.test(v.name));
        if (!match) {
          let bestNames = [];
          if (targetLang === 'en-GB') bestNames = ['daniel', 'oliver', 'serena', 'stephanie', 'arthur', 'martha', 'kate'];
          else if (targetLang === 'de-DE') bestNames = ['anna', 'petra', 'markus', 'yannick', 'helena', 'martin'];
          else if (targetLang === 'cs-CZ') bestNames = ['iveta', 'zuzana'];
          else if (targetLang === 'es-ES') bestNames = ['jorge', 'monica', 'carmen', 'diego'];
          else if (targetLang === 'he-IL') bestNames = ['carmit'];
          else if (targetLang === 'en-US') bestNames = ['samantha', 'alex', 'karen', 'ava', 'tom'];
          for (let name of bestNames) {
            match = voices.find(v => isTarget(v) && v.name.toLowerCase().includes(name));
            if (match) break;
          }
        }
        if (!match) match = voices.find(v => isTarget(v) && /siri/i.test(v.name));
        if (!match) match = voices.find(v => isTarget(v) && !/compact/i.test(v.name));
        if (!match) match = voices.find(isTarget);
        if (match) {
          u.voice = match;
          u.lang = match.lang;
        }
      }
      u.onend = () => { window._activeUtterance = null; };
      u.onerror = () => { window._activeUtterance = null; };
      window.speechSynthesis.speak(u);
    };

    if ((!voices || voices.length === 0) && 'speechSynthesis' in window) {
      setTimeout(() => {
        updateVoices();
        voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();
        playVoice();
      }, 50);
    } else {
      playVoice();
    }
  }, 40);
}

// =========================================================================
// OPRAVENÉ WEB AUDIO API CINKÁNÍ PRO iOS (iPhone 14 Pro i iPhone SE)
// =========================================================================
let audioCtx = null;
let isAudioUnlocked = false;

function getAudioCtx() {
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  return audioCtx;
}

// Volá se při jakémkoliv dotyku na obrazovku (odemkne zvukový čip v iPhonu)
function unlockAudioForiOS() {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state !== "running") {
      ctx.resume().catch(() => {});
    }
    if (!isAudioUnlocked && ctx.state === "running") {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      isAudioUnlocked = true;
    }
  } catch (e) {}
}

function playTone(freq, type, duration) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;

    const startOscillator = () => {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        // Mírně vyšší hlasitost (0.18), aby bylo cinknutí na iPhonu jasně slyšet
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    };

    // KRITICKÁ OPRAVA PRO iPHONE 14 PRO & SE:
    // Pokud je AudioContext uspaný (suspended/interrupted), musíme počkat na dokončení resume()!
    if (ctx.state !== "running") {
      ctx.resume().then(startOscillator).catch(() => {});
    } else {
      startOscillator();
    }
  } catch (e) {}
}

function sndOk(showStar = true) {
  if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) {}
  playTone(880, 'sine', 0.08);
  setTimeout(() => playTone(1320, 'sine', 0.12), 80);
}

function sndErr() {
  if (navigator.vibrate) try { navigator.vibrate([40, 40, 60]); } catch (e) {}
  playTone(220, 'square', 0.16);
}

function sndFanfare() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.12), i * 110));
  if (typeof triggerConfetti === 'function') triggerConfetti();
}
