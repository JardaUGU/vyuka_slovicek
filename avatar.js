/**
 * MODUL PRO AVATARA (ŠATNÍK PANÁČKA A GENERÁTOR SVG)
 */

const AVATAR_CATEGORIES = [
  { id: 'base', label: '🧑 Postava' },
  { id: 'hat', label: '👑 Čepice' },
  { id: 'glasses', label: '😎 Brýle' },
  { id: 'outfit', label: '🦸 Oblek' },
  { id: 'pet', label: '🐉 Doplněk' },
  { id: 'bg', label: '🌌 Pozadí' }
];

const AVATAR_ITEMS = [
  { id: 'base_boy', slot: 'base', name: 'Kluk', cost: 0 },
  { id: 'base_girl', slot: 'base', name: 'Holka', cost: 0 },
  { id: 'base_cat', slot: 'base', name: 'Kočka 🐱', cost: 30 },
  { id: 'base_robot', slot: 'base', name: 'Robot 🤖', cost: 45 },
  { id: 'base_alien', slot: 'base', name: 'Mimozemšťan 👾', cost: 55 },
  { id: 'hat_cap', slot: 'hat', name: 'Kšiltovka 🧢', cost: 20 },
  { id: 'hat_headphones', slot: 'hat', name: 'Sluchátka 🎧', cost: 30 },
  { id: 'hat_viking', slot: 'hat', name: 'Vikingská helma', cost: 45 },
  { id: 'hat_wizard', slot: 'hat', name: 'Čaroděj 🧙', cost: 55 },
  { id: 'hat_crown', slot: 'hat', name: 'Zlatá koruna 👑', cost: 80 },
  { id: 'gl_nerd', slot: 'glasses', name: 'Chytré brýle 🤓', cost: 15 },
  { id: 'gl_sun', slot: 'glasses', name: 'Sluneční 😎', cost: 25 },
  { id: 'gl_pirate', slot: 'glasses', name: 'Pirátská páska 🏴‍☠️', cost: 30 },
  { id: 'gl_visor', slot: 'glasses', name: 'Kyber-vizor', cost: 50 },
  { id: 'outfit_tee', slot: 'outfit', name: 'Modré triko', cost: 0 },
  { id: 'outfit_bolt', slot: 'outfit', name: 'Triko Blesk ⚡', cost: 20 },
  { id: 'outfit_hoodie', slot: 'outfit', name: 'Zelená mikina', cost: 25 },
  { id: 'outfit_armor', slot: 'outfit', name: 'Rytířské brnění', cost: 50 },
  { id: 'outfit_cape', slot: 'outfit', name: 'Superhrdina 🦸', cost: 60 },
  { id: 'pet_ball', slot: 'pet', name: 'Fotbalový míč ⚽', cost: 20 },
  { id: 'pet_sword', slot: 'pet', name: 'Rytířský meč ⚔️', cost: 35 },
  { id: 'pet_wand', slot: 'pet', name: 'Kouzelná hůlka ✨', cost: 40 },
  { id: 'pet_rocket', slot: 'pet', name: 'Mini-raketa 🚀', cost: 50 },
  { id: 'pet_dragon', slot: 'pet', name: 'Mini-drak 🐉', cost: 75 },
  { id: 'bg_space', slot: 'bg', name: 'Noční vesmír', cost: 0 },
  { id: 'bg_forest', slot: 'bg', name: 'Zelený les', cost: 15 },
  { id: 'bg_lava', slot: 'bg', name: 'Sopečná láva', cost: 30 },
  { id: 'bg_gold', slot: 'bg', name: 'Zlatá záře', cost: 60 }
];

let avatarShopTab = 'hat';
let avatarPreviewEquip = null;
let _avSvgUid = 0;

function parseAvatarEquipStr(str) {
  const res = { base: 'base_boy', bg: 'bg_space', outfit: 'outfit_tee', hat: '', glasses: '', pet: '' };
  if (!str) return res;
  String(str).split(';').forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) {
      const k = pair.slice(0, idx).trim();
      const v = pair.slice(idx + 1).trim();
      if (k in res) res[k] = v;
    }
  });
  return res;
}

function serializeAvatarEquip(obj) {
  return ['base', 'bg', 'outfit', 'hat', 'glasses', 'pet']
    .map(k => `${k}=${(obj && obj[k]) ? obj[k] : ''}`)
    .join(';');
}

function getUserAvatarItems(userName) {
  const defaults = ['base_boy', 'base_girl', 'bg_space', 'outfit_tee'];
  if (!userName) return defaults;
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const cloud = (u && Array.isArray(u.avatarItems)) ? u.avatarItems : [];
  let local = [];
  try { local = JSON.parse(localStorage.getItem(`av_items_${uKey}`) || '[]'); } catch(e) {}
  return [...new Set([...defaults, ...cloud, ...local])];
}

function getUserAvatarEquip(userName) {
  if (!userName) return parseAvatarEquipStr('');
  const uKey = userName.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  const localStr = localStorage.getItem(`av_equip_${uKey}`);
  const cloudStr = u ? (u.avatarEquipStr || '') : '';
  return parseAvatarEquipStr(localStr !== null ? localStr : cloudStr);
}

function previewAvatarItem(slot, itemId) {
  if (!currentUser) return;
  const baseEq = avatarPreviewEquip ? { ...avatarPreviewEquip } : getUserAvatarEquip(currentUser.name);
  baseEq[slot] = itemId;
  avatarPreviewEquip = baseEq;
  if (typeof renderScreen === "function") renderScreen();
}

function cancelAvatarPreview() {
  avatarPreviewEquip = null;
}

function equipAvatarItem(slot, itemId) {
  if (!currentUser) return;
  avatarPreviewEquip = null;
  const uKey = currentUser.name.toLowerCase().trim();
  const eq = getUserAvatarEquip(currentUser.name);
  eq[slot] = itemId;
  const eqStr = serializeAvatarEquip(eq);

  localStorage.setItem(`av_equip_${uKey}`, eqStr);
  localStorage.setItem(`av_ts_${uKey}`, String(Date.now()));
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.avatarEquipStr = eqStr;

  try {
    const fd = new URLSearchParams();
    fd.append("action", "equip_avatar");
    fd.append("user", currentUser.name);
    fd.append("equipStr", eqStr);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
  if (typeof renderScreen === "function") renderScreen();
}

function buyAvatarItem(itemId) {
  if (!currentUser) return;
  const item = AVATAR_ITEMS.find(x => x.id === itemId);
  if (!item) return;

  const coins = getUserCoins(currentUser.name);
  if (coins < item.cost) { alert("Nemáš dostatek mincí!"); return; }

  const uKey = currentUser.name.toLowerCase().trim();
  const u = (appData.users || []).find(x => x.name.toLowerCase().trim() === uKey);
  if (u) u.coins = Math.max(0, Number(u.coins || 0) - item.cost);
  currentUser.coins = u ? u.coins : Math.max(0, coins - item.cost);
  localStorage.setItem(`coins_${uKey}`, String(currentUser.coins));

  const owned = getUserAvatarItems(currentUser.name);
  if (!owned.includes(item.id)) owned.push(item.id);
  localStorage.setItem(`av_items_${uKey}`, JSON.stringify(owned));
  if (u) u.avatarItems = owned;

  avatarPreviewEquip = null;
  const eq = getUserAvatarEquip(currentUser.name);
  eq[item.slot] = item.id;
  const eqStr = serializeAvatarEquip(eq);
  localStorage.setItem(`av_equip_${uKey}`, eqStr);
  localStorage.setItem(`av_ts_${uKey}`, String(Date.now()));
  if (u) u.avatarEquipStr = eqStr;
  localStorage.setItem("cur_user", JSON.stringify(currentUser));

  if (typeof sndFanfare === "function") sndFanfare();
  try {
    const fd = new URLSearchParams();
    fd.append("action", "buy_avatar_item");
    fd.append("user", currentUser.name);
    fd.append("itemId", item.id);
    fd.append("cost", item.cost);
    fd.append("equipStr", eqStr);
    fetch(API_URL, { method: "POST", mode: "no-cors", body: fd });
  } catch(e) {}
  if (typeof renderScreen === "function") renderScreen();
}

function renderAvatarSVG(userName, size = 72, overrideEquip = null) {
  const eq = overrideEquip || getUserAvatarEquip(userName);
  const uid = ++_avSvgUid;

  let bgSvg = `<rect width="120" height="120" fill="#0f172a"/><circle cx="24" cy="26" r="1.5" fill="#facc15"/><circle cx="95" cy="28" r="1.8" fill="#fff"/><circle cx="88" cy="65" r="1.2" fill="#93c5fd"/><circle cx="22" cy="72" r="1.2" fill="#fff"/>`;
  let borderCol = '#38bdf8';
  if (eq.bg === 'bg_forest') {
    bgSvg = `<rect width="120" height="120" fill="#064e3b"/><circle cx="60" cy="128" r="58" fill="#15803d"/><circle cx="20" cy="115" r="35" fill="#166534"/>`;
    borderCol = '#4ade80';
  } else if (eq.bg === 'bg_lava') {
    bgSvg = `<rect width="120" height="120" fill="#450a0a"/><circle cx="60" cy="125" r="55" fill="#991b1b"/><circle cx="30" cy="30" r="2" fill="#fb923c"/><circle cx="92" cy="45" r="2.2" fill="#facc15"/>`;
    borderCol = '#f97316';
  } else if (eq.bg === 'bg_gold') {
    bgSvg = `<rect width="120" height="120" fill="#422006"/><circle cx="60" cy="60" r="46" fill="#713f12"/><circle cx="26" cy="26" r="2.5" fill="#fef08a"/><circle cx="94" cy="30" r="2" fill="#fde047"/>`;
    borderCol = '#facc15';
  }

  const backCape = (eq.outfit === 'outfit_cape') ? `<path d="M 34 74 L 14 120 L 106 120 L 86 74 Z" fill="#dc2626"/>` : '';

  let outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#0284c7"/><path d="M 48 74 Q 60 84 72 74" fill="none" stroke="#bae6fd" stroke-width="3"/>`;
  if (eq.outfit === 'outfit_bolt') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#1e293b"/><polygon points="62,82 52,99 60,99 56,113 69,95 61,95" fill="#facc15"/>`;
  } else if (eq.outfit === 'outfit_hoodie') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#16a34a"/><path d="M 44 75 Q 60 88 76 75" fill="none" stroke="#86efac" stroke-width="4"/><line x1="53" y1="81" x2="53" y2="96" stroke="#fff" stroke-width="2"/><line x1="67" y1="81" x2="67" y2="96" stroke="#fff" stroke-width="2"/>`;
  } else if (eq.outfit === 'outfit_armor') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#64748b"/><circle cx="34" cy="85" r="10" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/><circle cx="86" cy="85" r="10" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/><path d="M 44 76 L 60 94 L 76 76" fill="none" stroke="#facc15" stroke-width="2.5"/>`;
  } else if (eq.outfit === 'outfit_cape') {
    outfitSvg = `<path d="M 30 120 C 30 82, 38 74, 60 74 C 82 74, 90 82, 90 120 Z" fill="#2563eb"/><polygon points="60,83 63,91 71,91 65,96 67,104 60,99 53,104 55,96 49,91 57,91" fill="#facc15"/>`;
  }

  let headSvg = '';
  if (eq.base === 'base_girl') {
    headSvg = `
      <rect x="53" y="64" width="14" height="13" fill="#fdba74"/>
      <path d="M 33 48 C 33 22, 87 22, 87 48 L 89 76 L 76 76 L 76 56 L 44 56 L 44 76 L 31 76 Z" fill="#92400e"/>
      <circle cx="60" cy="48" r="22" fill="#fed7aa"/>
      <path d="M 38 42 Q 48 25 62 32 Q 74 25 82 42 Q 72 20 46 24 Z" fill="#92400e"/>
      <circle cx="51" cy="47" r="3" fill="#0f172a"/><circle cx="69" cy="47" r="3" fill="#0f172a"/>
      <circle cx="52" cy="46" r="1" fill="#fff"/><circle cx="70" cy="46" r="1" fill="#fff"/>
      <path d="M 52 57 Q 60 63 68 57" fill="none" stroke="#9a3412" stroke-width="2.5" stroke-linecap="round"/>
    `;
  } else if (eq.base === 'base_cat') {
    headSvg = `
      <rect x="53" y="64" width="14" height="13" fill="#fb923c"/>
      <polygon points="39,38 40,17 54,29" fill="#fb923c"/><polygon points="42,35 43,22 51,29" fill="#fda4af"/>
      <polygon points="81,38 80,17 66,29" fill="#fb923c"/><polygon points="78,35 77,22 69,29" fill="#fda4af"/>
      <circle cx="60" cy="48" r="22" fill="#fb923c"/>
      <circle cx="51" cy="47" r="3.2" fill="#0f172a"/><circle cx="69" cy="47" r="3.2" fill="#0f172a"/>
      <polygon points="57,52 63,52 60,56" fill="#be123c"/>
      <path d="M 54 58 Q 60 62 66 58" fill="none" stroke="#7c2d12" stroke-width="2" stroke-linecap="round"/>
      <line x1="34" y1="50" x2="45" y2="52" stroke="#7c2d12" stroke-width="1.5"/><line x1="34" y1="56" x2="45" y2="55" stroke="#7c2d12" stroke-width="1.5"/>
      <line x1="86" y1="50" x2="75" y2="52" stroke="#7c2d12" stroke-width="1.5"/><line x1="86" y1="56" x2="75" y2="55" stroke="#7c2d12" stroke-width="1.5"/>
    `;
  } else if (eq.base === 'base_robot') {
    headSvg = `
      <rect x="54" y="65" width="12" height="12" fill="#64748b"/>
      <line x1="60" y1="13" x2="60" y2="26" stroke="#cbd5e1" stroke-width="3"/><circle cx="60" cy="12" r="4" fill="#38bdf8"/>
      <rect x="36" y="25" width="48" height="44" rx="10" fill="#94a3b8" stroke="#cbd5e1" stroke-width="2"/>
      <rect x="43" y="39" width="34" height="15" rx="5" fill="#0f172a"/>
      <circle cx="51" cy="47" r="3.5" fill="#38bdf8"/><circle cx="69" cy="47" r="3.5" fill="#38bdf8"/>
      <rect x="49" y="59" width="22" height="5" rx="2" fill="#475569"/>
    `;
  } else if (eq.base === 'base_alien') {
    headSvg = `
      <rect x="54" y="65" width="12" height="12" fill="#22c55e"/>
      <line x1="47" y1="29" x2="41" y2="15" stroke="#4ade80" stroke-width="3"/><circle cx="40" cy="14" r="4" fill="#a855f7"/>
      <line x1="73" y1="29" x2="79" y2="15" stroke="#4ade80" stroke-width="3"/><circle cx="80" cy="14" r="4" fill="#a855f7"/>
      <circle cx="60" cy="48" r="22" fill="#4ade80"/>
      <ellipse cx="51" cy="47" rx="4.5" ry="6" fill="#0f172a"/><ellipse cx="69" cy="47" rx="4.5" ry="6" fill="#0f172a"/>
      <circle cx="52" cy="45" r="1.5" fill="#fff"/><circle cx="70" cy="45" r="1.5" fill="#fff"/>
      <path d="M 54 59 Q 60 63 66 59" fill="none" stroke="#14532d" stroke-width="2" stroke-linecap="round"/>
    `;
  } else {
    headSvg = `
      <rect x="53" y="64" width="14" height="13" fill="#fdba74"/>
      <circle cx="60" cy="48" r="22" fill="#fed7aa"/>
      <path d="M 38 42 C 38 22, 82 22, 82 42 Q 70 31 60 34 Q 49 31 38 42 Z" fill="#78350f"/>
      <circle cx="51" cy="47" r="3" fill="#0f172a"/><circle cx="69" cy="47" r="3" fill="#0f172a"/>
      <circle cx="52" cy="46" r="1" fill="#fff"/><circle cx="70" cy="46" r="1" fill="#fff"/>
      <path d="M 52 57 Q 60 63 68 57" fill="none" stroke="#9a3412" stroke-width="2.5" stroke-linecap="round"/>
    `;
  }

  let glassesSvg = '';
  if (eq.glasses === 'gl_nerd') {
    glassesSvg = `<circle cx="51" cy="47" r="7" fill="rgba(255,255,255,0.2)" stroke="#1e293b" stroke-width="2.2"/><circle cx="69" cy="47" r="7" fill="rgba(255,255,255,0.2)" stroke="#1e293b" stroke-width="2.2"/><line x1="58" y1="47" x2="62" y2="47" stroke="#1e293b" stroke-width="2.2"/>`;
  } else if (eq.glasses === 'gl_sun') {
    glassesSvg = `<rect x="42" y="42" width="16" height="11" rx="3" fill="#09090b"/><rect x="62" y="42" width="16" height="11" rx="3" fill="#09090b"/><line x1="58" y1="46" x2="62" y2="46" stroke="#09090b" stroke-width="2.5"/><line x1="45" y1="44" x2="49" y2="50" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/><line x1="65" y1="44" x2="69" y2="50" stroke="rgba(255,255,255,0.45)" stroke-width="1.8"/>`;
  } else if (eq.glasses === 'gl_pirate') {
    glassesSvg = `<line x1="38" y1="38" x2="82" y2="52" stroke="#09090b" stroke-width="2.2"/><circle cx="51" cy="47" r="7.5" fill="#09090b" stroke="#475569" stroke-width="1.5"/>`;
  } else if (eq.glasses === 'gl_visor') {
    glassesSvg = `<rect x="40" y="42" width="40" height="10" rx="4" fill="rgba(6,182,212,0.8)" stroke="#f43f5e" stroke-width="2"/>`;
  }

  let hatSvg = '';
  if (eq.hat === 'hat_cap') {
    hatSvg = `<path d="M 37 33 C 37 15, 83 15, 83 33 Z" fill="#ef4444"/><path d="M 55 30 L 92 32 L 84 36 L 55 34 Z" fill="#b91c1c"/>`;
  } else if (eq.hat === 'hat_headphones') {
    hatSvg = `<path d="M 35 47 C 35 16, 85 16, 85 47" fill="none" stroke="#1e293b" stroke-width="5"/><rect x="30" y="40" width="8" height="15" rx="4" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5"/><rect x="82" y="40" width="8" height="15" rx="4" fill="#38bdf8" stroke="#0f172a" stroke-width="1.5"/>`;
  } else if (eq.hat === 'hat_viking') {
    hatSvg = `<path d="M 38 33 C 38 15, 82 15, 82 33 Z" fill="#94a3b8"/><rect x="37" y="29" width="46" height="5" rx="2" fill="#facc15"/><path d="M 38 28 Q 22 20 26 7 Q 32 17 42 23 Z" fill="#f8fafc"/><path d="M 82 28 Q 98 20 94 7 Q 88 17 78 23 Z" fill="#f8fafc"/>`;
  } else if (eq.hat === 'hat_wizard') {
    hatSvg = `<ellipse cx="60" cy="31" rx="30" ry="6" fill="#581c87"/><polygon points="41,30 79,30 62,3" fill="#7e22ce"/><polygon points="60,13 62,18 67,18 63,21 64,26 60,23 56,26 57,21 53,18 58,18" fill="#facc15"/>`;
  } else if (eq.hat === 'hat_crown') {
    hatSvg = `<path d="M 40 29 L 38 11 L 50 20 L 60 7 L 70 20 L 82 11 L 80 29 Z" fill="#facc15" stroke="#b45309" stroke-width="1.5"/><circle cx="60" cy="21" r="2.5" fill="#ef4444"/><circle cx="48" cy="23" r="2" fill="#3b82f6"/><circle cx="72" cy="23" r="2" fill="#3b82f6"/>`;
  }

  let petSvg = '';
  if (eq.pet === 'pet_ball') {
    petSvg = `<circle cx="96" cy="96" r="13" fill="#fff" stroke="#0f172a" stroke-width="2"/><polygon points="96,90 101,94 99,100 93,100 91,94" fill="#0f172a"/>`;
  } else if (eq.pet === 'pet_sword') {
    petSvg = `<polygon points="96,55 101,62 101,94 91,94 91,62" fill="#e2e8f0" stroke="#475569" stroke-width="1.5"/><rect x="86" y="93" width="20" height="4" rx="2" fill="#facc15"/><rect x="94" y="97" width="4" height="12" fill="#78350f"/>`;
  } else if (eq.pet === 'pet_wand') {
    petSvg = `<line x1="94" y1="108" x2="100" y2="75" stroke="#92400e" stroke-width="3.5" stroke-linecap="round"/><polygon points="100,63 103,70 110,70 104,74 106,81 100,77 94,81 96,74 90,70 97,70" fill="#facc15"/>`;
  } else if (eq.pet === 'pet_rocket') {
    petSvg = `<path d="M 96 68 C 103 77, 103 93, 100 98 L 92 98 C 89 93, 89 77, 96 68 Z" fill="#ef4444" stroke="#fff" stroke-width="1.5"/><circle cx="96" cy="83" r="3.5" fill="#38bdf8"/><polygon points="92,98 100,98 96,109" fill="#facc15"/>`;
  } else if (eq.pet === 'pet_dragon') {
    petSvg = `<path d="M 84 94 Q 76 80 88 83 Z" fill="#f97316"/><ellipse cx="97" cy="98" rx="11" ry="12" fill="#22c55e"/><circle cx="97" cy="82" r="9" fill="#4ade80"/><polygon points="91,74 93,67 96,74" fill="#facc15"/><polygon points="99,74 102,67 104,74" fill="#facc15"/><circle cx="94" cy="81" r="1.8" fill="#0f172a"/><circle cx="100" cy="81" r="1.8" fill="#0f172a"/>`;
  }

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 120 120" style="display:inline-block; vertical-align:middle; flex-shrink:0;">
      <defs><clipPath id="avc-${uid}"><circle cx="60" cy="60" r="56"/></clipPath></defs>
      <g clip-path="url(#avc-${uid})">${bgSvg}${backCape}${outfitSvg}${headSvg}${glassesSvg}${hatSvg}${petSvg}</g>
      <circle cx="60" cy="60" r="56" fill="none" stroke="${borderCol}" stroke-width="4"/>
    </svg>
  `;
}
