/**
 * MODUL PRO ZVUKOVÉ EFEKTY A SYNTÉZU ŘEČI (TTS)
 */

let isAutoTTS = localStorage.getItem("auto_tts") !== "false";
let cachedVoices = [];

function updateVoices() {
  if ('speechSynthesis' in window) {
    const v = window.speechSynthesis.getVoices();
    if (v && v.length > 0) cachedVoices = v;
  }
}
if ('speechSynthesis' in window) { updateVoices(); window.speechSynthesis.onvoiceschanged = updateVoices; }

function toggleAutoTTS() { isAutoTTS = !isAutoTTS; localStorage.setItem("auto_tts", isAutoTTS); updateTTSBtnUI(); }

function updateTTSBtnUI() {
  const btn = document.getElementById("btn-tts-auto");
  if (btn) { btn.className = isAutoTTS ? "tts-toggle-btn active" : "tts-toggle-btn"; btn.innerText = isAutoTTS ? "🔊 Auto" : "🔇 Vyp"; }
}

function getTargetLang(subjectName) {
  const s = (subjectName || selectedSubject || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (s.includes('angli') || s === 'en' || s.includes('inteligentn')) return 'en-GB';
  if (s.includes('nemc') || s === 'de') return 'de-DE';
  if (s.includes('hebr') || s === 'he') return 'he-IL';
  if (s.includes('spanel') || s === 'es') return 'es-ES';
  return 'cs-CZ';
}

// DŮLEŽITÉ (BUGFIX): Nečte závorky, jména postav ani emotikony.
function speakWord(text, subjectName) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  
  setTimeout(() => {
    let toSpeak = text.trim();

    toSpeak = toSpeak.replace(/^[^:]{1,30}:\s*/, ''); // Odstranění jmen postav
    toSpeak = toSpeak.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(); // Odstranění smajlíků
    toSpeak = toSpeak.replace(/\s*\([^)]*\)/g, ''); // Odstranění závorek z výslovnosti

    // Zabrání čtení velkého "No" jako "Number" a u "Oh no" vylepší intonaci
    toSpeak = toSpeak.replace(/\bNo\b/g, 'no').replace(/\bOh no\b/gi, 'oh nou');

    toSpeak = toSpeak.replace(/ליהוה/g, 'לַאדֹנָי').replace(/יהוה/g, 'אֲדֹנָי').replace(/L'?(Jahve|Jahveh|Yahweh|Yahwe|Jehova|JHVH|YHWH|JVHV)/gi, "L'Adonaj");
    if (/read\s*-\s*read\s*-\s*read/i.test(toSpeak)) toSpeak = "read, red, red";
    else toSpeak = toSpeak.replace(/\//g, ' or ').replace(/\s*-\s*/g, ', ');
    if (/^\s*I\s*[.!?]?\s*$/i.test(toSpeak)) toSpeak = "eye";

    const u = new SpeechSynthesisUtterance(toSpeak);
    const targetLang = getTargetLang(subjectName);
    const langPrefix = targetLang.split('-')[0];
    u.lang = targetLang; u.rate = 0.88;

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
            else if (targetLang === 'en-US') bestNames = ['samantha', 'alex', 'karen', 'ava', 'tom'];
            for (let name of bestNames) { match = voices.find(v => isTarget(v) && v.name.toLowerCase().includes(name)); if (match) break; }
        }
        if (!match) match = voices.find(v => isTarget(v) && /siri/i.test(v.name));
        if (!match) match = voices.find(v => isTarget(v) && !/compact/i.test(v.name));
        if (!match) match = voices.find(isTarget);
        if (match) { u.voice = match; u.lang = match.lang; }
      }
      window.speechSynthesis.speak(u);
    };

    if ((!voices || voices.length === 0) && 'speechSynthesis' in window) {
      setTimeout(() => { updateVoices(); voices = cachedVoices.length ? cachedVoices : window.speechSynthesis.getVoices(); playVoice(); }, 50);
    } else { playVoice(); }
  }, 40);
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
  try {
    const osc = audioCtx.createOscillator(); const gain = audioCtx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
  } catch(e) {}
}
function sndOk() { 
  if (navigator.vibrate) try { navigator.vibrate(18); } catch(e) {}
  playTone(880, 'sine', 0.08); 
  setTimeout(() => playTone(1320, 'sine', 0.1), 80); 
}
function sndErr() { 
  if (navigator.vibrate) try { navigator.vibrate([40, 40, 60]); } catch(e) {}
  playTone(220, 'square', 0.15); 
}
function sndFanfare() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => playTone(f, 'triangle', 0.1), i * 110)); }
