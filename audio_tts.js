/**
 * MODUL PRO ZVUKOVÉ EFEKTY A SYNTÉZU ŘEČI (TTS)
 * Verze s ochranou proti zamrznutí iOS Safari + Cloud Audio Fallback
 */

let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];
let audioCtx = null;
let iosAudioUnlocked = false;
let fallbackAudioEl = null; // Záložní HTML5 Audio přehrávač pro iPhone SE

window._activeUtterance = null;

// Detekce iOS (iPhone / iPad)
const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

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

// Odemknutí zvuku při prvním dotyku (BEZ volání speechSynthesis.speak, aby se nepobil s klikem na 🔊!)
function unlockAudioForiOS() {
  if (iosAudioUnlocked) return;
  try {
    const ctx = getAudioCtx();
    if (ctx) {
      if (ctx.state === "suspended") ctx.resume();
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
    }
    // Připravíme záložní HTML5 Audio element během gesta uživatele
    if (!fallbackAudioEl) {
      fallbackAudioEl = new Audio();
      fallbackAudioEl.volume = 1.0;
    }
    iosAudioUnlocked = true;
  } catch (e) {}
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

// Záložní přehrání řeči přes HTML5 Audio (když na iPhonu SE selže nebo chybí systémový hlas)
function playCloudFallbackTTS(text, langCode) {
  try {
    if (!fallbackAudioEl) fallbackAudioEl = new Audio();
    const shortLang = langCode.split('-')[0]; // např. 'he', 'de', 'en', 'cs'
    const url = `https://translate.googleapis.com/translate_tts?client=gtx&ie=UTF-8&tl=${encodeURIComponent(shortLang)}&q=${encodeURIComponent(text)}`;
    fallbackAudioEl.src = url;
    fallbackAudioEl.play().catch(err => console.warn("Fallback TTS blokován:", err));
  } catch (e) {}
}

function speakWord(text, subjectName) {
  if (!text || subjectName === "Matematika") return;

  let toSpeak = String(text).trim();
  toSpeak = toSpeak.replace(/^[^:]{1,30}:\s*/, ''); // Odstranění jmen postav před dvojtečkou
  toSpeak = toSpeak.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(); // Odstranění smajlíků
  toSpeak = toSpeak.replace(/\s*\([^)]*\)/g, ''); // Odstranění závorek

  toSpeak = toSpeak.replace(/\bNo\b/g, 'no').replace(/\bOh no\b/gi, 'oh nou');

  // Oprava hebrejštiny (Jméno Boží -> Adonaj + koncovka -av místo -aju)
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

  const targetLang = getTargetLang(subjectName);
  const langPrefix = targetLang.split('-')[0];

  if (!('speechSynthesis' in window)) {
    playCloudFallbackTTS(toSpeak, targetLang);
    return;
  }

  try {
    // KRITICKÁ OPRAVA PRO iOS: cancel() voláme POUZE pokud čtečka zrovna skutečně mluví!
    // Jinak cancel() v iOS Safari okamžitě zabije i nově spouštěné slovo.
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    const u = new SpeechSynthesisUtterance(toSpeak);
    window._activeUtterance = u;
    u.lang = targetLang;
    u.rate = 0.88;
    u.volume = 1.0;

    if (cachedVoices.length === 0) updateVoices();
    const voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices();

    const isTarget = v => {
      const vLang = (v.lang || '').toLowerCase().replace('_', '-');
      return vLang === targetLang.toLowerCase() || vLang.startsWith(langPrefix);
    };

    const hasSystemVoiceForLang = voices && voices.some(isTarget);

    // Pokud iPhone vůbec nemá v systému nainstalovaný hlas pro daný jazyk (často hebrejština),
    // rovnou přehrajeme zvuk přes záložní Cloud MP3!
    if (isIOSDevice && voices && voices.length > 0 && !hasSystemVoiceForLang) {
      playCloudFallbackTTS(toSpeak, targetLang);
      return;
    }

    // Na PC/Androidu vybereme nejlepší hlas; na iOS necháme výběr na u.lang (zabrání chybě tichého hlasu na SE)
    if (!isIOSDevice && voices && voices.length > 0) {
      let match = voices.find(v => isTarget(v) && /(enhanced|premium|natural|pro)/i.test(v.name));
      if (!match) match = voices.find(isTarget);
      if (match) {
        u.voice = match;
        u.lang = match.lang;
      }
    }

    let startedSpeaking = false;
    u.onstart = () => { startedSpeaking = true; };
    u.onend = () => { window._activeUtterance = null; };
    u.onerror = () => {
      window._activeUtterance = null;
      // Pokud systémové TTS hodí chybu, zachrání to Cloud MP3
      if (!startedSpeaking) playCloudFallbackTTS(toSpeak, targetLang);
    };

    window.speechSynthesis.speak(u);

    // Pojistka pro iPhone SE: Pokud se do 350 ms čtečka vůbec nerozjede (zamrzlý iOS speechsynthesisd),
    // automaticky přehrajeme slovo přes Cloud Audio!
    if (isIOSDevice) {
      setTimeout(() => {
        if (!startedSpeaking && !window.speechSynthesis.speaking) {
          playCloudFallbackTTS(toSpeak, targetLang);
        }
      }, 350);
    }
  } catch (e) {
    playCloudFallbackTTS(toSpeak, targetLang);
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
