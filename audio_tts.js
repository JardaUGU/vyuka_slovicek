/**
 * MODUL PRO ZVUKOVÉ EFEKTY A SYNTÉZU ŘEČI (TTS)
 * Optimalizováno pro iOS Safari (iPhone SE / 14 Pro fix)
 */

let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];
let audioCtx = null;
let iosAudioUnlocked = false;

// Globální úložiště pro Utterance (zabraňuje smazání zvuku Garbage Collectorem na iOS!)
window._activeUtterance = null;

function getAudioCtx() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) audioCtx = new AudioContextClass();
  }
  return audioCtx;
}

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

// SPECIÁLNÍ ODEMYKAČ ZVUKU PRO iPHONE / iPAD (Spustí se při prvním klepnutí v aplikaci)
function unlockAudioForiOS() {
  // 1. Odemknutí a probuzení Web Audio API (pípání)
  try {
    const ctx = getAudioCtx();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      if (!iosAudioUnlocked) {
        const buffer = ctx.createBuffer(1, 1, 22050);
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        source.start(0);
      }
    }
  } catch (e) {}

  // 2. Odemknutí a předehřátí TTS (čtení slov) v iOS Safari
  if ('speechSynthesis' in window) {
    updateVoices();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    if (!iosAudioUnlocked) {
      try {
        const warmUp = new SpeechSynthesisUtterance(" ");
        warmUp.volume = 0; // Neslyšitelné, ale probudí hlasový engine v iOS
        warmUp.rate = 1;
        window.speechSynthesis.speak(warmUp);
      } catch (e) {}
    }
  }
  iosAudioUnlocked = true;
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

  try {
    // Zrušíme předchozí čtení a probudíme případně zaseknutou frontu v iOS
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    let toSpeak = String(text).trim();
    toSpeak = toSpeak.replace(/^[^:]{1,30}:\s*/, ''); // Odstranění jmen postav před dvojtečkou
    toSpeak = toSpeak.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(); // Odstranění smajlíků
    toSpeak = toSpeak.replace(/\s*\([^)]*\)/g, ''); // Odstranění závorek

    toSpeak = toSpeak.replace(/\bNo\b/g, 'no').replace(/\bOh no\b/gi, 'oh nou');

    // Oprava hebrejštiny (Jméno Boží -> Adonaj)
    const regexLadonaj = /\u05DC[\u0591-\u05C7]*\u05D9[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D5[\u0591-\u05C7]*\u05D4/g;
    const regexAdonaj = /\u05D9[\u0591-\u05C7]*\u05D4[\u0591-\u05C7]*\u05D5[\u0591-\u05C7]*\u05D4/g;
    toSpeak = toSpeak.replace(regexLadonaj, 'לַאדֹנָי').replace(regexAdonaj, 'אֲדֹנָי');
    toSpeak = toSpeak.replace(/l'?(jahve|jahveh|yahweh|yahwe|jehova|jhvh|yhwh|jhwh|jvhv)/gi, "Ladonaj");
    toSpeak = toSpeak.replace(/(jahve|jahveh|yahweh|yahwe|jehova|jhvh|yhwh|jhwh|jvhv)/gi, "Adonaj");

    if (/read\s*-\s*read\s*-\s*read/i.test(toSpeak)) toSpeak = "read, red, red";
    else toSpeak = toSpeak.replace(/\//g, ' or ').replace(/\s*-\s*/g, ', ');
    if (/^\s*I\s*[.!?]?\s*$/i.test(toSpeak)) toSpeak = "eye";

    if (!toSpeak) return;

    const u = new SpeechSynthesisUtterance(toSpeak);
    window._activeUtterance = u; // Udržení v globální paměti kvůli iPhone SE!

    const targetLang = getTargetLang(subjectName);
    const langPrefix = targetLang.split('-')[0];
    u.lang = targetLang;
    u.rate = 0.88;
    u.volume = 1;

    if (cachedVoices.length === 0) updateVoices();
    const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();

    if (voices && voices.length > 0) {
      const isTarget = v => {
        const vLang = (v.lang || '').toLowerCase().replace('_', '-');
        return vLang === targetLang.toLowerCase() || vLang.startsWith(langPrefix);
      };

      // Na iOS preferujeme lokálně stažené hlasy (localService === true), které nemají výpadek u prvních 4 slov!
      let match = voices.find(v => isTarget(v) && v.localService && /(daniel|anna|zuzana|iveta|samantha|carmit|jorge)/i.test(v.name));
      if (!match) match = voices.find(v => isTarget(v) && /(enhanced|premium|natural|pro)/i.test(v.name));
      if (!match) {
        let bestNames = [];
        if (targetLang === 'en-GB') bestNames = ['daniel', 'oliver', 'serena', 'stephanie', 'arthur', 'martha', 'kate'];
        else if (targetLang === 'de-DE') bestNames = ['anna', 'petra', 'markus', 'yannick', 'helena', 'martin'];
        else if (targetLang === 'cs-CZ') bestNames = ['zuzana', 'iveta'];
        else if (targetLang === 'es-ES') bestNames = ['jorge', 'monica', 'carmen', 'diego'];
        else if (targetLang === 'he-IL') bestNames = ['carmit'];
        for (let name of bestNames) {
          match = voices.find(v => isTarget(v) && v.name.toLowerCase().includes(name));
          if (match) break;
        }
      }
      if (!match) match = voices.find(v => isTarget(v) && v.localService);
      if (!match) match = voices.find(isTarget);

      if (match) {
        u.voice = match;
        u.lang = match.lang;
      }
    }

    u.onend = () => { window._activeUtterance = null; };
    u.onerror = () => { window._activeUtterance = null; };

    // DŮLEŽITÉ PRO iOS: Voláme synchronně IHNED (žádný setTimeout!), aby Safari neztratilo user-gesture token
    window.speechSynthesis.speak(u);

    // Pojistka pro iOS, pokud by fronta zůstala viset v pauze
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
  } catch (e) {
    console.warn("TTS chyba:", e);
  }
}

function playTone(freq, type, duration) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {}
}

function sndOk(showStar = true) {
  if (navigator.vibrate) try { navigator.vibrate(18); } catch (e) {}
  playTone(880, 'sine', 0.08);
  setTimeout(() => playTone(1320, 'sine', 0.1), 80);
  if (showStar && typeof showFloatingPoint === 'function') showFloatingPoint();
}

function sndErr() {
  if (navigator.vibrate) try { navigator.vibrate([40, 40, 60]); } catch (e) {}
  playTone(220, 'square', 0.15);
}

function sndFanfare() {
  [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.1), i * 110));
  if (typeof triggerConfetti === 'function') triggerConfetti();
}
