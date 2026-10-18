// Ачивки: хранятся в браузере, всплывают цветной карточкой сверху, список — в отдельной панели.
import { confetti } from "./fx.js";
import { lang, T } from "./i18n.js";

export const ACH = [
  { id: "first_game", e: "🧩", t: "Первый блин", d: "Сыграть первый раунд", h: 210 },
  { id: "first_win", e: "🏆", t: "Первая кровь", d: "Занять первое место против живых людей", h: 45 },
  { id: "streak3", e: "🎩", t: "Хет-трик", d: "Три победы подряд", h: 280 },
  { id: "wins10", e: "👑", t: "Король стола", d: "Десять побед", h: 50 },
  { id: "bot_win", e: "🤖", t: "Восстание машин отменяется", d: "Обыграть бота", h: 200 },
  { id: "bot_lose", e: "🥲", t: "Кожаный мешок", d: "Проиграть боту", h: 0 },
  { id: "flawless", e: "💎", t: "Без единой помарки", d: "Решить без ошибок", h: 190 },
  { id: "edge", e: "🫣", t: "На волоске", d: "Решить с двумя ошибками", h: 15 },
  { id: "fast3", e: "⚡", t: "Молния", d: "Решить быстрее трёх минут", h: 55 },
  { id: "fast90", e: "🚀", t: "Гиперзвук", d: "Решить быстрее полутора минут", h: 260 },
  { id: "easy", e: "🌱", t: "Разминка", d: "Решить лёгкий уровень", h: 130 },
  { id: "expert", e: "🧠", t: "Гроссмейстер", d: "Решить уровень «Эксперт»", h: 300 },
  { id: "photo", e: "📸", t: "Фотофиниш", d: "Выиграть с отрывом меньше 5 секунд", h: 330 },
  { id: "comeback", e: "🔄", t: "Камбэк", d: "Победить, отставая на четверть поля", h: 20 },
  { id: "podium", e: "🥉", t: "Пьедестал", d: "Попасть в тройку, когда игроков трое и больше", h: 35 },
  { id: "last", e: "🐢", t: "Последний, но гордый", d: "Дорешать последним в компании", h: 100 },
  { id: "party3", e: "🎈", t: "Тусовка", d: "Сыграть втроём или больше", h: 320 },
  { id: "party6", e: "🏟️", t: "Аншлаг", d: "Сыграть вшестером или больше", h: 240 },
  { id: "out", e: "💥", t: "Три страйка", d: "Вылететь за три ошибки", h: 5 },
  { id: "resign", e: "🏳️", t: "Белый флаг", d: "Сдаться", h: 220 },
  { id: "combo10", e: "🔥", t: "Комбо ×10", d: "Десять верных ходов подряд без пауз", h: 25 },
  { id: "pencil", e: "✏️", t: "Карандашник", d: "Поставить 30 заметок за раунд", h: 40 },
  { id: "chatty", e: "💬", t: "Болтун", d: "Написать 20 сообщений", h: 195 },
  { id: "gg", e: "🤝", t: "Джентльмен", d: "Написать GG", h: 150 },
  { id: "mic", e: "🎙️", t: "В эфире", d: "Включить микрофон", h: 140 },
  { id: "first_throw", e: "🍅", t: "Хулиган", d: "Кинуть чем-нибудь в соперника", h: 0 },
  { id: "sniper", e: "🎯", t: "Помидорный снайпер", d: "Кинуть 10 помидоров", h: 355 },
  { id: "target", e: "🫠", t: "Мишень", d: "Получить 10 бросков", h: 30 },
  { id: "hit", e: "🛡️", t: "Под обстрелом", d: "Получить 3 броска за раунд и всё равно дорешать", h: 210 },
  { id: "night", e: "🦉", t: "Сова", d: "Играть между полуночью и пятью утра", h: 250 },
  { id: "collector", e: "🗝️", t: "Коллекционер", d: "Открыть 20 ачивок", h: 45 },
];

// Сербские названия и описания
const SR = {"first_game": {"t": "Prvi put", "d": "Odigraj prvu rundu"}, "first_win": {"t": "Prva krv", "d": "Osvoji prvo mesto protiv živih ljudi"}, "streak3": {"t": "Het-trik", "d": "Tri pobede zaredom"}, "wins10": {"t": "Kralj stola", "d": "Deset pobeda"}, "bot_win": {"t": "Ustanak mašina otkazan", "d": "Pobedi bota"}, "bot_lose": {"t": "Vreća od kože", "d": "Izgubi od bota"}, "flawless": {"t": "Bez ijedne mrlje", "d": "Reši bez greške"}, "edge": {"t": "Na dlaku", "d": "Reši sa dve greške"}, "fast3": {"t": "Munja", "d": "Reši za manje od tri minuta"}, "fast90": {"t": "Hiperzvuk", "d": "Reši za manje od minut i po"}, "easy": {"t": "Zagrevanje", "d": "Reši lak nivo"}, "expert": {"t": "Velemajstor", "d": "Reši nivo „Ekspert“"}, "photo": {"t": "Foto-finiš", "d": "Pobedi sa razlikom manjom od 5 sekundi"}, "comeback": {"t": "Povratak", "d": "Pobedi iako si zaostajao četvrtinu polja"}, "podium": {"t": "Postolje", "d": "Uđi u prva tri kad igra troje ili više"}, "last": {"t": "Poslednji, ali ponosan", "d": "Završi poslednji u društvu"}, "party3": {"t": "Žurka", "d": "Igraj u troje ili više"}, "party6": {"t": "Puna sala", "d": "Igraj u šestoro ili više"}, "out": {"t": "Tri strajka", "d": "Ispadni zbog tri greške"}, "resign": {"t": "Bela zastava", "d": "Predaj se"}, "combo10": {"t": "Kombo ×10", "d": "Deset tačnih poteza zaredom bez pauze"}, "pencil": {"t": "Olovkaš", "d": "Stavi 30 beleški u jednoj rundi"}, "chatty": {"t": "Brbljivac", "d": "Pošalji 20 poruka"}, "gg": {"t": "Džentlmen", "d": "Napiši GG"}, "mic": {"t": "U etru", "d": "Uključi mikrofon"}, "first_throw": {"t": "Huligan", "d": "Gađaj protivnika nečim"}, "sniper": {"t": "Paradajz-snajperista", "d": "Baci 10 paradajza"}, "target": {"t": "Meta", "d": "Primi 10 pogodaka"}, "hit": {"t": "Pod paljbom", "d": "Primi 3 pogotka u rundi i ipak reši"}, "night": {"t": "Sova", "d": "Igraj između ponoći i pet ujutru"}, "collector": {"t": "Kolekcionar", "d": "Otvori 20 dostignuća"}};
// Английские названия и описания
const EN = {"first_game": {"t": "First steps", "d": "Play your first round"}, "first_win": {"t": "First blood", "d": "Take first place against real people"}, "streak3": {"t": "Hat trick", "d": "Three wins in a row"}, "wins10": {"t": "King of the table", "d": "Ten wins"}, "bot_win": {"t": "Robot uprising cancelled", "d": "Beat the bot"}, "bot_lose": {"t": "Meatbag", "d": "Lose to the bot"}, "flawless": {"t": "Spotless", "d": "Solve without a single mistake"}, "edge": {"t": "By a hair", "d": "Solve with two mistakes"}, "fast3": {"t": "Lightning", "d": "Solve in under three minutes"}, "fast90": {"t": "Hypersonic", "d": "Solve in under ninety seconds"}, "easy": {"t": "Warm-up", "d": "Solve an Easy grid"}, "expert": {"t": "Grandmaster", "d": "Solve an Expert grid"}, "photo": {"t": "Photo finish", "d": "Win by less than 5 seconds"}, "comeback": {"t": "Comeback", "d": "Win after trailing by a quarter of the grid"}, "podium": {"t": "Podium", "d": "Finish top three with three or more players"}, "last": {"t": "Last but proud", "d": "Finish last in a group"}, "party3": {"t": "Party", "d": "Play with three or more people"}, "party6": {"t": "Full house", "d": "Play with six or more people"}, "out": {"t": "Three strikes", "d": "Get knocked out by three mistakes"}, "resign": {"t": "White flag", "d": "Give up"}, "combo10": {"t": "Combo ×10", "d": "Ten correct moves in a row without pausing"}, "pencil": {"t": "Pencil pusher", "d": "Place 30 notes in one round"}, "chatty": {"t": "Chatterbox", "d": "Send 20 messages"}, "gg": {"t": "Gentleman", "d": "Type GG"}, "mic": {"t": "On air", "d": "Turn on your microphone"}, "first_throw": {"t": "Troublemaker", "d": "Throw something at an opponent"}, "sniper": {"t": "Tomato sniper", "d": "Throw 10 tomatoes"}, "target": {"t": "Target", "d": "Get hit 10 times"}, "hit": {"t": "Under fire", "d": "Get hit 3 times in a round and still finish"}, "night": {"t": "Night owl", "d": "Play between midnight and 5 a.m."}, "collector": {"t": "Collector", "d": "Unlock 20 achievements"}};
if (lang === "sr") for (const a of ACH) Object.assign(a, SR[a.id] || {});
if (lang === "en") for (const a of ACH) Object.assign(a, EN[a.id] || {});

const KEY = "sd-ach-v1";
const STATS = "sd-stats-v1";
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const stats = {
  get: (k) => read(STATS)[k] || 0,
  set: (k, v) => { const s = read(STATS); s[k] = v; write(STATS, s); },
};
export const bump = (k) => { const v = stats.get(k) + 1; stats.set(k, v); return v; };

export const achCount = () => Object.keys(read(KEY)).length;

const queue = [];
let showing = false;

export function achUnlock(id) {
  const have = read(KEY);
  if (have[id]) return;
  const a = ACH.find((x) => x.id === id);
  if (!a) return;
  have[id] = Date.now();
  write(KEY, have);
  queue.push(a);
  pump();
  if (id !== "collector" && Object.keys(have).length >= 20) achUnlock("collector");
}

function pump() {
  if (showing || !queue.length) return;
  showing = true;
  const a = queue.shift();
  const el = document.createElement("div");
  el.className = "ach-pop";
  el.style.setProperty("--h", a.h);
  el.innerHTML = `<div class="ach-emoji">${a.e}</div><div><div class="ach-kicker">${T.achNew}</div><div class="ach-title">${a.t}</div><div class="ach-desc">${a.d}</div></div>`;
  document.body.append(el);
  navigator.vibrate?.([12, 30, 12]);
  const r = el.getBoundingClientRect();
  confetti({ count: 40, x: r.left + 36, y: r.top + r.height / 2, spread: 1.2, power: 0.7, colors: [`hsl(${a.h} 90% 60%)`, "#ffd60a", "#fff"] });
  el.onclick = () => close();
  const t = setTimeout(close, 4200);
  function close() {
    clearTimeout(t);
    el.classList.add("out");
    setTimeout(() => { el.remove(); showing = false; pump(); }, 350);
  }
}

export function openAchievements() {
  const have = read(KEY);
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = `<div class="card ach-sheet">
    <div class="chat-head"><span>${T.achTitle(Object.keys(have).length, ACH.length)}</span><button class="close" style="color:var(--accent);font-weight:600">${T.done}</button></div>
    <div class="ach-grid">${ACH.map((a) => `
      <div class="ach-item${have[a.id] ? " got" : ""}" style="--h:${a.h}">
        <div class="ach-emoji">${have[a.id] ? a.e : "🔒"}</div>
        <div><div class="ach-title">${a.t}</div><div class="ach-desc">${a.d}</div></div>
      </div>`).join("")}</div></div>`;
  const close = () => wrap.remove();
  wrap.onclick = (e) => { if (e.target === wrap) close(); };
  wrap.querySelector(".close").onclick = close;
  document.body.append(wrap);
}
