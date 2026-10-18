import { ACH, achUnlock, achCount, openAchievements, stats, bump } from "./ach.js";
import { confetti, floatEmoji, throwEffect, flyTo, floatText } from "./fx.js";
import { T, lang, langSwitchHTML, bindLangSwitch } from "./i18n.js";
import { initAccount, accountChipHTML, bindAccountChip, promoHTML } from "./ourgames.js";

// Единый вход наших игр: если уже вошёл в «Странах мира» или «Дебютах» — подхватываем Telegram-аккаунт.
const acc = initAccount({ lang, meUrl: "/acct/me", onChange: () => refreshAccount() });

const $app = document.getElementById("app");

const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const rid = (n) => {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint8Array(n)), (x) => a[x % a.length]).join("");
};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmt = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const initial = (name) => (String(name || "?").trim()[0] || "?").toUpperCase();
const plural = (n, one, few, many) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many;
};
const isEmojiOnly = (t) => /^(\p{Extended_Pictographic}|️|‍){1,3}$/u.test(t);

// ?as=имя — ещё один игрок в том же браузере (для проверки на одном устройстве).
const asParam = new URLSearchParams(location.search).get("as");
let pid = asParam || store.get("sd-pid");
if (!pid) { pid = rid(10); store.set("sd-pid", pid); }
const nameKey = asParam ? `sd-name-${asParam}` : "sd-name";
const myName = () => store.get(nameKey) || (acc.user?.name || "").split(" ")[0] || "";

const MAX_MISTAKES = 3;
const MAX_PLAYERS = 10;
// Сложность — число 0..100 (как на сервере): 0 → 46 подсказок, 100 → 22.
const cluesFor = (l) => Math.round(46 - Math.max(0, Math.min(100, l)) * 0.24);
const LEVELS = [
  { name: T.levels[0], color: "#28a745" },
  { name: T.levels[1], color: "#b38f00" },
  { name: T.levels[2], color: "#e07800" },
  { name: T.levels[3], color: "#ff3b30" },
];
const levelIdx = (l) => Math.min(3, Math.floor(l / 25));
const PALETTE = ["#0071e3", "#ff9500", "#34c759", "#af52de", "#ff2d55", "#30b0c7", "#d4a300", "#5856d6", "#a2845e", "#ff6b3d"];
const MEDALS = ["🥇", "🥈", "🥉"];
const medal = (place) => MEDALS[place - 1] || `${place}`;

const THROWS = [
  { key: "tomato", emoji: "🍅", name: T.throws.tomato },
  { key: "chicken", emoji: "🐔", name: T.throws.chicken },
  { key: "bubbles", emoji: "🫧", name: T.throws.bubbles },
  { key: "party", emoji: "🎉", name: T.throws.party },
];
const THROW_COOLDOWN = 12000;

const ICON = {
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>`,
  send: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>`,
};

let toastTimer;
function toast(html, ms = 2400) {
  document.querySelector(".toast")?.remove();
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = html;
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), ms);
}

function refreshAccount() {
  const row = document.getElementById("accRow");
  if (row) {
    row.innerHTML = `${langSwitchHTML()}${accountChipHTML(acc, lang)}`;
    bindAccountChip(row, acc, lang);
    bindLangSwitch(row);
  }
  const nm = document.getElementById("nm");
  if (nm && !nm.value && myName()) nm.value = myName();
}

/* ================= главная ================= */
function home() {
  $app.className = "app";
  $app.innerHTML = `
    <div class="acc-row" id="accRow"></div>
    <div class="card hero">
      <div class="mark">${[5, "", 3, "", 9, "", 7, "", 1].map((v, k) => `<i class="${k === 4 ? "a" : k === 8 ? "b" : ""}">${v}</i>`).join("")}</div>
      <h1>${T.title}</h1>
      <p>${T.tagline}</p>
      <div class="name-field">
        <label for="nm">${T.yourName}</label>
        <input class="name-input" id="nm" maxlength="20" autocomplete="given-name" placeholder="${T.namePh}" value="${esc(myName())}">
      </div>
      <button class="btn" id="create">${T.create}</button>
    </div>
    <div class="card">
      <ul class="rules">
        ${T.rules(MAX_PLAYERS).map((r, k) => `<li><b>${k + 1}</b>${r}</li>`).join("")}
      </ul>
    </div>
    <div class="home-foot"><button class="ach-link" id="achBtn">${T.achLink(achCount(), ACH.length)}</button></div>
    ${promoHTML("sudoku", lang)}`;
  bindLangSwitch($app);
  refreshAccount();
  const nm = $app.querySelector("#nm");
  const go = () => {
    if (!nm.value.trim()) { nm.focus(); return toast(T.needName); }
    store.set(nameKey, nm.value.trim());
    history.pushState(null, "", `/r/${rid(8)}${location.search}`);
    route();
  };
  $app.querySelector("#create").onclick = go;
  $app.querySelector("#achBtn").onclick = openAchievements;
  nm.onkeydown = (e) => { if (e.key === "Enter") go(); };
}

/* ================= комната ================= */
let R = null;

async function api(method, body) {
  const t0 = Date.now();
  const url = method === "GET"
    ? `/api/room?id=${R.id}&pid=${pid}&have=${R.puzzle?.round || 0}&chat=${R.chatSeq}`
    : "/api/room";
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify({ id: R.id, pid, ...body }) : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || res.status);
  const t1 = Date.now();
  // Смещение часов клиента относительно сервера: для общего старта и таймера.
  if (j.now && t1 - t0 < 1500) R.offset = j.now - (t0 + t1) / 2;
  return j;
}
const serverNow = () => Date.now() + (R?.offset || 0);

function room(id) {
  R = {
    id, room: null, puzzle: null, offset: 0, view: null, game: null, pending: false, alive: true,
    chat: [], chatSeq: 0, unread: 0, chatReady: false, lastThrow: 0,
    level: null, levelLock: 0, levelTimer: null,
  };
  $app.className = "app";
  $app.innerHTML = `<div class="center"><h2>${T.entering}</h2></div>`;
  enter();
}

async function enter() {
  let j;
  try { j = await api("GET"); }
  catch (e) { return failScreen(e); }
  apply(j, false);
  R.chatReady = true;
  const rm = R.room;
  if (rm.members.includes(pid)) return join(myName());
  if (rm.members.length >= MAX_PLAYERS) return fullScreen();
  // Комната пустая и имя уже есть — это создатель, заходим сразу.
  if (!rm.members.length && myName()) return join(myName());
  gate();
}

function failScreen(e) {
  $app.innerHTML = `<div class="center"><h2>${T.fail}</h2><p>${esc(e.message)}</p><button class="btn secondary" style="max-width:240px" onclick="location.reload()">${T.retry}</button></div>`;
}

function fullScreen() {
  R.alive = false;
  $app.innerHTML = `<div class="center"><h2>${T.full}</h2><p>${T.fullText(MAX_PLAYERS)}</p><a class="btn" href="/" style="text-decoration:none;max-width:280px">${T.createOwn}</a></div>`;
}

// Экран входа по ссылке: крупно, кто зовёт, и крупное поле для своего имени.
function gate() {
  const rm = R.room;
  const host = rm.members[0] && rm.players[rm.members[0]];
  const count = rm.members.length;
  $app.innerHTML = `
    <div class="card hero">
      ${host ? `
        <div class="ava" style="margin:6px auto 14px;width:84px;height:84px;font-size:34px;background:${PALETTE[0]}">${esc(initial(host.name))}</div>
        <div class="invite-name">${esc(host.name || T.friend)}</div>
        <div class="invite-sub">${T.invites(count)}</div>` : `
        <h1>${T.title}</h1><p>${T.tagline}</p>`}
      <div class="name-field">
        <label for="nm">${T.yourName}</label>
        <input class="name-input" id="nm" maxlength="20" autocomplete="given-name" placeholder="${T.yourNamePh}" value="${esc(myName())}">
      </div>
      <button class="btn" id="go">${host ? T.accept : T.enter}</button>
    </div>
    <div class="home-foot">${langSwitchHTML()}
    </div>`;
  bindLangSwitch($app);
  const nm = $app.querySelector("#nm");
  if (!nm.value) setTimeout(() => nm.focus(), 50);
  const go = () => {
    if (!nm.value.trim()) { nm.focus(); return toast(T.needName2); }
    store.set(nameKey, nm.value.trim());
    join(nm.value.trim());
  };
  $app.querySelector("#go").onclick = go;
  nm.onkeydown = (e) => { if (e.key === "Enter") go(); };
}

async function join(name) {
  try { apply(await api("POST", { action: "join", name })); }
  catch (e) { return e.message === "full" ? fullScreen() : failScreen(e); }
  if (new Date().getHours() < 5) achUnlock("night");
  poll();
}

async function poll() {
  if (!R?.alive) return;
  try {
    if (!R.pending) apply(await api("GET"));
  } catch {}
  const delay = document.hidden ? 4000 : R.room?.online.length > 1 ? 900 : 1600;
  setTimeout(poll, delay);
}

function apply(j, draw = true) {
  if (!R) return;
  if (j.puzzle) R.puzzle = j.puzzle;
  if (j.room) R.room = j.room;
  if (j.chat?.length) addMessages(j.chat);
  if (j.signals) j.signals.forEach(onSignal);
  if (draw && R.room.members.includes(pid)) render();
}

/* ---------------- кто есть кто ---------------- */
const P = (id) => R.room.players[id] || {};
const me = () => P(pid);
const colorOf = (id) => (id === "bot" ? "#8e8e93" : PALETTE[Math.max(0, R.room.members.indexOf(id)) % PALETTE.length]);
const nameOf = (id) => (id === "bot" ? T.bot : id === pid ? T.you : P(id).name || T.player);
const isOnline = (id) => R.room.online.includes(id);
const others = () => R.room.members.filter((m) => m !== pid);
const onlineOthers = () => others().filter(isOnline);
const curPuzzle = () => (R.puzzle?.round === R.room.round ? R.puzzle : null);
const avaHTML = (id) => id === "bot"
  ? `<div class="ava sm" style="background:${colorOf(id)}">🤖</div>`
  : `<div class="ava sm" data-ava="${id}" style="background:${colorOf(id)}">${esc(initial(P(id).name))}${P(id).voice ? `<span class="mic">${ICON.mic}</span>` : ""}</div>`;

function render() {
  const rm = R.room, pz = curPuzzle();
  const active = rm.round && !rm.over && pz;
  const m = me();
  const playing = active && pz.players.includes(pid) && !m.place && !m.out;
  if (!R.shell) buildShell();
  if (playing) {
    if (R.view !== "game" || R.game?.round !== rm.round) startGame();
    else updateHud();
  } else {
    if (R.view === "game") finishGame();
    if (R.view !== "lobby") buildLobby();
    updateLobby();
  }
  roundEvents();
  updateTopbar();
  voiceSync();
  updateVoiceUI();
}

/* ---------------- каркас: шапка, основная колонка, чат сбоку ---------------- */
function buildShell() {
  R.shell = true;
  $app.className = "app wide";
  $app.innerHTML = `
    <div class="topbar" id="topbar" hidden>
      <div class="chips"><button class="chip chat-btn" id="chatBtn">${ICON.chat}<span>${T.chat}</span></button></div>
    </div>
    <div class="layout with-side">
      <div class="main" id="main"></div>
      <div class="side">${chatHTML()}</div>
    </div>`;
  bindChat($app.querySelector(".side .chat"));
  $app.querySelector("#chatBtn").onclick = openSheet;
}

function updateTopbar() {
  const cb = document.getElementById("chatBtn");
  if (!cb) return;
  const hide = R.view !== "game";
  cb.hidden = hide;
  document.getElementById("topbar").hidden = hide;
  // Пока микрофон включён, кнопка чата зелёная — видно, что тебя слышат.
  cb.className = `chip chat-btn${V.mic ? " live" : ""}`;
  cb.innerHTML = `${V.mic ? ICON.mic : ICON.chat}<span>${V.mic ? T.heardYou : T.chat}</span>${R.unread ? `<span class="badge">${R.unread}</span>` : ""}`;
}

/* ---------------- лобби ---------------- */
function buildLobby() {
  R.view = "lobby";
  R.lobbySig = "";
  const main = document.getElementById("main");
  main.innerHTML = `
    <div class="acc-row" id="accRow"></div>
    <div class="card standings" id="standings" hidden></div>
    <div class="card">
      <div class="card-title"><span id="playersTitle">${T.playersTitle}</span><span class="title-tools"><button class="ach-chip" id="achBtn"></button></span></div>
      <div class="plist" id="players"></div>
    </div>
    <div class="card" id="shareCard">
      <div class="card-title">${T.invite}</div>
      <div class="share"><code id="link"></code><button id="share">${navigator.share ? T.send : T.copy}</button></div>
    </div>
    <div class="card">
      <div class="card-title"><span>${T.difficulty}</span><span class="diff-clues" id="diffClues"></span></div>
      <div class="diff-head"><span class="diff-name" id="diffName"></span></div>
      <div class="slider" id="slider">
        <div class="track"></div>
        <div class="meet" id="meet"></div>
        <div id="thumbsOther"></div>
        <div class="thumb me" id="thumbMe"></div>
        <div class="ticks">${LEVELS.map((l) => `<span>${l.name}</span>`).join("")}</div>
      </div>
      <div class="diff-note" id="diffNote"></div>
    </div>
    <div class="foot">
      <div class="hint" id="hint"></div>
      <button class="btn" id="ready"></button>
    </div>
    <div class="card chat chat-inline">${chatInner()}</div>
    ${promoHTML("sudoku", lang)}`;
  bindChat(main.querySelector(".chat-inline"));
  refreshAccount();
  renderMsgs(true);

  const link = `${location.origin}/r/${R.id}`;
  main.querySelector("#link").textContent = link.replace(/^https?:\/\//, "");
  main.querySelector("#share").onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: T.title, text: T.shareText(myName() || T.friend), url: link }); } catch {}
    } else {
      await navigator.clipboard.writeText(link).catch(() => {});
      toast(T.copied);
    }
  };
  main.querySelector("#achBtn").onclick = openAchievements;
  bindLangSwitch(main);

  const readyBtn = main.querySelector("#ready");
  readyBtn.onclick = async () => {
    const rm = R.room, pz = curPuzzle(), m = me();
    readyBtn.disabled = true;
    R.pending = true;
    try {
      if (!rm.over && pz) {
        // Раунд ещё идёт: решившие могут его закончить.
        apply(await api("POST", { action: "end" }));
      } else if (!onlineOthers().length) {
        apply(await api("POST", { action: "ready", ready: true, bot: true }));
      } else {
        apply(await api("POST", { action: "ready", ready: m.readyFor !== rm.round + 1 }));
      }
    } finally { R.pending = false; readyBtn.disabled = false; render(); }
  };

  main.querySelector("#players").addEventListener("click", (e) => {
    const row = e.target.closest("[data-row]");
    if (!row) return;
    if (row.dataset.row === pid) return renameMe();
    if (isOnline(row.dataset.row)) throwMenu(row.dataset.row, row.querySelector(".ava") || row);
  });

  bindSlider(main.querySelector("#slider"));
}

async function renameMe() {
  const v = prompt(T.renamePrompt, me().name || "");
  if (v && v.trim()) { store.set(nameKey, v.trim()); apply(await api("POST", { action: "join", name: v.trim() })); }
}

// Таблица раунда: места по финишу, у остальных — прогресс или причина вылета.
function standingsRows() {
  const rm = R.room, pz = curPuzzle();
  if (!pz) return [];
  const rows = pz.players.map((id) => ({ id, ...P(id) }));
  if (pz.bot) {
    const br = rm.botResult;
    rows.push({ id: "bot", place: br?.place || null, ms: br?.ms, filled: R.botState?.filled || 0, total: R.botState?.total || 1 });
  }
  const rank = (r) => (r.place ? r.place : r.out ? 1000 : 100 - (r.filled || 0) / (r.total || 1));
  return rows.sort((a, b) => rank(a) - rank(b));
}

function updateStandings() {
  const rm = R.room, pz = curPuzzle();
  const el = document.getElementById("standings");
  const mine = pz?.players.includes(pid);
  // Партию с ботом видит только тот, кто её играл.
  const show = Boolean(rm.round && pz && (mine || !pz.bot));
  el.hidden = !show;
  if (!show) return;
  const m = me();
  const n = pz.players.length + (pz.bot ? 1 : 0);
  let head;
  if (!mine) head = `<div class="st-head"><div class="emoji">👀</div><h2>${rm.over ? T.roundOver : T.roundOn}</h2><p>${T.nextRoundYou}</p></div>`;
  else if (m.place === 1) head = `<div class="st-head win"><div class="emoji">🏆</div><h2>${T.victory}</h2><p>${T.solvedIn(fmt(m.ms))}</p></div>`;
  else if (m.place) head = `<div class="st-head"><div class="emoji">${medal(m.place)}</div><h2>${T.placeN(m.place)}</h2><p>${T.ofN(n, fmt(m.ms))}</p></div>`;
  else if (m.out === "mistakes") head = `<div class="st-head lose"><div class="emoji">💥</div><h2>${T.threeMistakes}</h2><p>${T.outOfRound}</p></div>`;
  else if (m.out === "resign") head = `<div class="st-head lose"><div class="emoji">🏳️</div><h2>${T.youResigned}</h2><p>${T.happens}</p></div>`;
  else head = `<div class="st-head"><div class="emoji">⏱️</div><h2>${T.tooLate}</h2><p>${T.endedWithout}</p></div>`;

  const rows = standingsRows().map((r) => {
    let right;
    if (r.place) right = `<span class="time">${fmt(r.ms)}</span>`;
    else if (r.out === "mistakes") right = `<span class="out">${T.m3}</span>`;
    else if (r.out === "resign") right = `<span class="out">${T.resigned}</span>`;
    else if (rm.over) right = `<span class="out">${T.unfinished}</span>`;
    else {
      const pct = Math.round(((r.filled || 0) / (r.total || 1)) * 100);
      right = `<span class="mini-bar"><i style="width:${pct}%;background:${colorOf(r.id)}"></i></span><span class="pct">${pct}%</span>`;
    }
    return `<div class="srow${r.id === pid ? " me" : ""}"><span class="place">${r.place ? medal(r.place) : "—"}</span>${avaHTML(r.id)}<span class="nm">${esc(nameOf(r.id))}</span>${right}</div>`;
  }).join("");
  el.innerHTML = `${head}<div class="srows">${rows}</div>${rm.over ? "" : `<div class="st-live"><span class="dot"></span>${T.liveRound(fmt(serverNow() - pz.startAt))}</div>`}`;
}

function updateLobby() {
  const rm = R.room, pz = curPuzzle();
  const m = me();
  const next = rm.round + 1;
  const active = Boolean(rm.round && !rm.over && pz);
  updateStandings();

  // Игроки: у каждого цвет, статус и число побед
  const list = [pid, ...others()];
  const solo = !onlineOthers().length;
  const winsTable = solo ? rm.botWins : rm.wins;
  const sig = JSON.stringify([list.map((id) => [P(id).name, P(id).voice, P(id).readyFor === next, isOnline(id), winsTable[id]]), achCount(), active, solo, rm.botWins.bot]);
  if (R.lobbySig !== sig) {
    R.lobbySig = sig;
    document.getElementById("playersTitle").textContent = T.players(rm.members.length, MAX_PLAYERS);
    document.getElementById("achBtn").textContent = `🏆 ${achCount()}/${ACH.length}`;
    const rows = list.map((id) => {
      const p = P(id);
      const ready = p.readyFor === next;
      const st = !isOnline(id) ? `<span class="st off">${T.wentAway}</span>`
        : active ? "" : ready ? `<span class="st ready">${T.ready}</span>` : `<span class="st">${T.notReady}</span>`;
      const w = winsTable[id] || 0;
      return `<button class="prow${id === pid ? " me" : ""}${isOnline(id) ? "" : " off"}" data-row="${id}">
        ${avaHTML(id)}<span class="nm">${esc(p.name || T.player)}${id === pid ? ` <em>${T.youTag}</em>` : ""}</span>
        ${w ? `<span class="wins">🏆 ${w}</span>` : ""}${st}</button>`;
    });
    if (solo && (rm.botWins.bot || rm.botWins[pid])) {
      rows.push(`<div class="prow">${avaHTML("bot")}<span class="nm">${T.bot}</span>${rm.botWins.bot ? `<span class="wins">🏆 ${rm.botWins.bot}</span>` : ""}</div>`);
    }
    document.getElementById("players").innerHTML = rows.join("") +
      (solo ? "" : `<div class="plist-hint">${T.throwHint}</div>`);
  }

  document.getElementById("shareCard").hidden = rm.members.length >= MAX_PLAYERS;

  // Сложность: свою держим локально, пока тянем ползунок и пока сервер не подтвердил
  if (R.level == null || Date.now() > R.levelLock) R.level = m.level ?? 40;
  drawSlider();

  const notReady = onlineOthers().filter((id) => P(id).readyFor !== next).map((id) => P(id).name || T.player);
  const meReady = m.readyFor === next;
  const rb = document.getElementById("ready");
  let hint = "", label, cls = "btn";
  if (active) {
    const done = pz.players.includes(pid) && (m.place || m.out);
    label = done ? T.endRound : T.roundGoing;
    cls += " secondary";
    rb.disabled = !done;
    hint = done ? T.waitOthers : T.watch;
  } else {
    rb.disabled = false;
    if (solo) {
      label = T.playBot;
      hint = T.botHint;
    } else {
      label = meReady ? T.notReady : Object.keys(rm.wins).length ? T.oneMore : T.ready;
      if (meReady) cls += " secondary";
      if (notReady.length) hint = `${meReady ? T.waiting : T.notReadyList}: ${notReady.map(esc).join(", ")}`;
      else if (!meReady) hint = T.allReady;
    }
  }
  rb.textContent = label;
  rb.className = cls;
  document.getElementById("hint").innerHTML = hint;
}

function drawSlider() {
  const mine = R.level;
  const ids = onlineOthers();
  const levels = [mine, ...ids.map((id) => P(id).level ?? 40)];
  const result = Math.round(levels.reduce((a, b) => a + b, 0) / levels.length);
  const L = LEVELS[levelIdx(result)];
  const meEl = document.getElementById("thumbMe");
  meEl.style.left = `${mine}%`;
  meEl.textContent = initial(me().name);
  meEl.style.setProperty("--c", colorOf(pid));
  // Ползунки остальных — над шкалой; совпадающие раздвигаем по высоте.
  const used = {};
  document.getElementById("thumbsOther").innerHTML = ids.map((id) => {
    const lv = P(id).level ?? 40;
    const bucket = Math.round(lv / 7);
    const lift = (used[bucket] = (used[bucket] ?? -1) + 1);
    return `<div class="thumb opp" style="left:${lv}%;--c:${colorOf(id)};top:${18 - Math.min(lift, 2) * 9}px;z-index:${2 + lift}">${esc(initial(P(id).name))}</div>`;
  }).join("");
  const meet = document.getElementById("meet");
  meet.style.opacity = ids.length && levels.some((l) => Math.abs(l - result) > 3) ? 1 : 0;
  meet.style.left = `${result}%`;
  const nameEl = document.getElementById("diffName");
  nameEl.textContent = L.name;
  nameEl.style.color = L.color;
  const c = cluesFor(result);
  document.getElementById("diffClues").textContent = `${T.clues(c)} ${T.onBoard}`;
  document.querySelectorAll("#slider .ticks span").forEach((s, k) => s.classList.toggle("on", k === levelIdx(result)));
  document.getElementById("diffNote").innerHTML = !ids.length ? T.diffSolo
    : levels.every((l) => Math.abs(l - result) <= 3) ? T.diffSame : T.diffAvg;
}

function bindSlider(el) {
  let dragging = false, lastIdx = -1;
  const setFrom = (x) => {
    if (R.room.round && !R.room.over) return;
    const r = el.getBoundingClientRect();
    const v = Math.round(Math.max(0, Math.min(1, (x - r.left) / r.width)) * 100);
    if (v === R.level) return;
    R.level = v;
    R.levelLock = Date.now() + 2500;
    const idx = levelIdx(v);
    if (idx !== lastIdx) { if (lastIdx >= 0) navigator.vibrate?.(8); lastIdx = idx; }
    drawSlider();
    clearTimeout(R.levelTimer);
    R.levelTimer = setTimeout(async () => {
      R.levelLock = Date.now() + 2500;
      apply(await api("POST", { action: "level", level: R.level }).catch(() => ({})));
    }, 220);
  };
  el.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastIdx = levelIdx(R.level);
    el.classList.add("drag");
    el.setPointerCapture(e.pointerId);
    setFrom(e.clientX);
  });
  el.addEventListener("pointermove", (e) => { if (dragging) setFrom(e.clientX); });
  const end = () => { dragging = false; el.classList.remove("drag"); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}

/* ---------------- события раунда: финиши других, ачивки ---------------- */
function roundEvents() {
  const rm = R.room, pz = curPuzzle();
  if (!pz) return;
  // Тосты, когда кто-то финишировал (у себя — свой праздник).
  if (R.seenPlaces?.round !== rm.round) {
    R.seenPlaces = { round: rm.round, ids: new Set(pz.players.filter((id) => P(id).place)) };
    if (rm.botResult) R.seenPlaces.ids.add("bot");
  }
  for (const id of pz.players) {
    const p = P(id);
    if (p.place && !R.seenPlaces.ids.has(id)) {
      R.seenPlaces.ids.add(id);
      if (id !== pid) toast(`${medal(p.place)} ${T.finished(esc(p.name || T.player), fmt(p.ms))}`, 3000);
    }
  }
  if (pz.bot && rm.botResult && !R.seenPlaces.ids.has("bot")) {
    R.seenPlaces.ids.add("bot");
    if (!me().place) toast(`🤖 ${T.finished(T.bot, fmt(rm.botResult.ms))}`, 3000);
  }
  // Итоги раунда для ачивок — один раз, когда раунд закончился.
  const doneKey = `sd-achr:${R.id}:${pid}`;
  if (rm.over && pz.players.includes(pid) && store.get(doneKey) !== String(rm.round)) {
    store.set(doneKey, String(rm.round));
    roundAchievements(pz);
  }
}

function roundAchievements(pz) {
  const rm = R.room, m = me();
  const n = pz.players.length + (pz.bot ? 1 : 0);
  const g = R.game?.round === rm.round ? R.game : null;
  achUnlock("first_game");
  if (pz.players.length >= 3) achUnlock("party3");
  if (pz.players.length >= 6) achUnlock("party6");
  if (m.place) {
    if (!m.mistakes) achUnlock("flawless");
    if (m.mistakes === 2) achUnlock("edge");
    if (m.ms < 180000) achUnlock("fast3");
    if (m.ms < 90000) achUnlock("fast90");
    if (pz.level >= 75) achUnlock("expert");
    if (pz.level < 25) achUnlock("easy");
    if (n >= 3 && m.place <= 3) achUnlock("podium");
    if (n >= 3 && m.place === n) achUnlock("last");
    if ((g?.hits || 0) >= 3) achUnlock("hit");
  }
  if (pz.bot) {
    if (m.place === 1) achUnlock("bot_win");
    if (rm.botResult?.place === 1) achUnlock("bot_lose");
  } else if (m.place === 1) {
    achUnlock("first_win");
    if (bump("streak") >= 3) achUnlock("streak3");
    if (bump("wins") >= 10) achUnlock("wins10");
    const second = pz.players.map((id) => P(id)).find((p) => p.place === 2);
    if (second && second.ms - m.ms < 5000) achUnlock("photo");
    if ((g?.maxBehind || 0) >= 0.25) achUnlock("comeback");
  } else stats.set("streak", 0);
  if (m.out === "mistakes") achUnlock("out");
  if (m.out === "resign") achUnlock("resign");
}

/* ---------------- приколы: бросить чем-нибудь в игрока ---------------- */
function throwMenu(target, anchor) {
  document.querySelector(".throw-menu")?.remove();
  const menu = document.createElement("div");
  menu.className = "throw-menu";
  menu.innerHTML = `<div class="tm-title">${T.throwAt(esc(P(target).name || T.player))}</div>
    <div class="tm-items">${THROWS.map((t) => `<button data-k="${t.key}"><span>${t.emoji}</span>${t.name}</button>`).join("")}</div>`;
  document.body.append(menu);
  const r = anchor.getBoundingClientRect();
  const w = menu.offsetWidth;
  menu.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  menu.style.top = `${Math.max(8, Math.min(innerHeight - menu.offsetHeight - 8, r.bottom + 8))}px`;
  const close = (e) => {
    if (e && menu.contains(e.target)) return;
    menu.remove();
    document.removeEventListener("pointerdown", close, true);
  };
  setTimeout(() => document.addEventListener("pointerdown", close, true));
  menu.querySelectorAll("button").forEach((b) => (b.onclick = () => {
    close();
    sendThrow(target, b.dataset.k, anchor);
  }));
}

async function sendThrow(target, key, anchor) {
  const wait = R.lastThrow + THROW_COOLDOWN - Date.now();
  if (wait > 0) return toast(T.cooldown(Math.ceil(wait / 1000)));
  R.lastThrow = Date.now();
  const t = THROWS.find((x) => x.key === key);
  flyTo(t.emoji, anchor);
  achUnlock("first_throw");
  if (key === "tomato" && bump("tomatoes") >= 10) achUnlock("sniper");
  apply(await api("POST", { action: "chat", kind: "throw", text: key, to: target }).catch(() => ({})));
}

function receiveThrow(msg) {
  const t = THROWS.find((x) => x.key === msg.text);
  if (!t) return;
  if (msg.to === pid) {
    throwEffect(t.key, document.querySelector(".board") || document.getElementById("main"));
    toast(`${t.emoji} ${T.hitBy(esc(P(msg.pid).name || T.somebody), t.name.toLowerCase())}`, 2600);
    if (R.game) R.game.hits = (R.game.hits || 0) + 1;
    if (bump("hitsTotal") >= 10) achUnlock("target");
  } else {
    const anchor = document.querySelector(`[data-ring="${msg.to}"]`) || document.querySelector(`[data-ava="${msg.to}"]`);
    if (anchor) flyTo(t.emoji, anchor, true);
  }
}

/* ---------------- чат ---------------- */
const QUICK = T.quick;
const chatInner = () => `
  <div class="chat-head"><span>${T.chat}</span><span class="chat-status"></span></div>
  <div class="msgs"></div>
  <div class="quick">${QUICK.map((q) => `<button>${q}</button>`).join("")}</div>
  <form class="compose"><button type="button" class="mic-btn" aria-label="${T.micOn}">${ICON.mic}</button><input placeholder="${T.message}" maxlength="300" enterkeyhint="send"><button type="submit" class="send-btn" aria-label="${T.send}">${ICON.send}</button></form>`;
const chatHTML = () => `<div class="card chat">${chatInner()}</div>`;

function bindChat(root) {
  const form = root.querySelector(".compose");
  const input = form.querySelector("input");
  form.onsubmit = (e) => {
    e.preventDefault();
    sendChat(input.value);
    input.value = "";
  };
  root.querySelectorAll(".quick button").forEach((b) => (b.onclick = () => sendChat(b.textContent)));
  root.querySelector(".mic-btn").onclick = micToggle;
  updateVoiceUI();
}

async function sendChat(text) {
  text = text.trim();
  if (!text) return;
  // Сообщение показываем сразу, сервер вернёт его с номером — дубль отсеем.
  R.chat.push({ seq: -Date.now(), pid, text, kind: "text", local: true });
  renderMsgs();
  if (isEmojiOnly(text)) floatEmoji(text);
  if (bump("chats") >= 20) achUnlock("chatty");
  if (/^gg$/i.test(text)) achUnlock("gg");
  try { apply(await api("POST", { action: "chat", text })); }
  catch { toast(T.sendFail); }
}

function addMessages(list) {
  for (const m of list) {
    if (m.seq <= R.chatSeq) continue;
    R.chatSeq = m.seq;
    if (m.pid === pid) {
      const i = R.chat.findIndex((x) => x.local && x.text === m.text);
      if (i >= 0) R.chat.splice(i, 1);
    } else if (R.chatReady) {
      if (m.kind === "throw") receiveThrow(m);
      else {
        if (isEmojiOnly(m.text)) floatEmoji(m.text);
        if (R.shell && !chatVisible()) {
          R.unread++;
          if (!isEmojiOnly(m.text)) toast(`<b>${esc(P(m.pid).name || T.player)}:</b> ${esc(m.text)}`, 3200);
        }
      }
    }
    R.chat.push(m);
  }
  R.chat = R.chat.slice(-100);
  renderMsgs();
}

const chatVisible = () => [...document.querySelectorAll(".msgs")].some((el) => el.offsetParent !== null);

function renderMsgs(force) {
  if (!R.room) return;
  let prev = null;
  const html = R.chat.length
    ? R.chat.map((m) => {
      if (m.kind === "throw") {
        const t = THROWS.find((x) => x.key === m.text);
        prev = null;
        return `<div class="sys">${esc(m.pid === pid ? T.you : P(m.pid).name || "?")} → ${t?.emoji || "❓"} → ${esc(m.to === pid ? T.youObj : P(m.to).name || "?")}</div>`;
      }
      const mine = m.pid === pid;
      const who = !mine && prev !== m.pid ? `<div class="who" style="color:${colorOf(m.pid)}">${esc(P(m.pid).name || T.player)}</div>` : "";
      prev = m.pid;
      return `${who}<div class="msg ${mine ? "me" : "them"}${isEmojiOnly(m.text) ? " big" : ""}">${esc(m.text)}</div>`;
    }).join("")
    : `<div class="empty">${T.chatEmpty}</div>`;
  document.querySelectorAll(".msgs").forEach((el) => {
    if (!force && el.dataset.n === String(R.chat.length) && el.dataset.last === String(R.chat.at(-1)?.seq)) return;
    el.dataset.n = R.chat.length;
    el.dataset.last = R.chat.at(-1)?.seq;
    el.innerHTML = html;
    el.scrollTop = el.scrollHeight;
  });
  if (chatVisible()) R.unread = 0;
  if (R.shell) updateTopbar();
}

function openSheet() {
  const wrap = document.createElement("div");
  wrap.className = "sheet-wrap";
  wrap.innerHTML = chatHTML();
  wrap.onclick = (e) => { if (e.target === wrap) closeSheet(); };
  wrap.querySelector(".chat-status").insertAdjacentHTML("afterend", `<button class="close" style="color:var(--accent);font-weight:600">${T.done}</button>`);
  wrap.querySelector(".close").onclick = closeSheet;
  document.body.append(wrap);
  bindChat(wrap);
  R.unread = 0;
  renderMsgs(true);
}
function closeSheet() { document.querySelector(".sheet-wrap")?.remove(); if (R?.shell) updateTopbar(); }

/* ---------------- голос (WebRTC, сигналы через /api/room) ----------------
   Звук поднимается сам со всеми, кто онлайн: каждый с каждым (до 9 соединений).
   Свой микрофон включается кнопкой в чате — трек подменяется во всех каналах. */
const V = { peers: new Map(), ctx: null, mic: null, helloAt: {} };
const ICE = [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }];

// Браузеры дают играть звук только после касания страницы — разблокируем при любом нажатии.
function unlockAudio() {
  for (const p of V.peers.values()) if (p.audio?.srcObject && p.audio.paused) p.audio.play().catch(() => {});
  try {
    V.ctx = V.ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (V.ctx.state === "suspended") V.ctx.resume();
  } catch {}
}
document.addEventListener("pointerdown", unlockAudio, true);

const senders = () => [...V.peers.values()].map((p) => p.pc.getTransceivers()[0]?.sender).filter(Boolean);

async function micToggle() {
  if (V.mic) return micOff();
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    V.mic = s.getAudioTracks()[0];
  } catch {
    return toast(T.noMic);
  }
  unlockAudio();
  achUnlock("mic");
  senders().forEach((s) => s.replaceTrack(V.mic).catch(() => {}));
  updateVoiceUI();
  apply(await api("POST", { action: "voice", on: true }).catch(() => ({})));
}

async function micOff(silent) {
  senders().forEach((s) => s.replaceTrack(null).catch(() => {}));
  V.mic?.stop();
  V.mic = null;
  updateVoiceUI();
  if (!silent && R) apply(await api("POST", { action: "voice", on: false }).catch(() => ({})));
}

function closePeer(id, sayBye) {
  const p = V.peers.get(id);
  if (!p) return;
  if (sayBye) signal(id, { type: "bye" });
  p.pc.close();
  clearInterval(p.meter);
  p.audio?.remove();
  V.peers.delete(id);
  document.querySelectorAll(`[data-ava="${id}"]`).forEach((el) => el.classList.remove("speaking"));
}
const closeAll = (bye) => [...V.peers.keys()].forEach((id) => closePeer(id, bye));

const signal = (to, data) => api("POST", { action: "signal", to, data }).catch(() => {});

function newPeer(id) {
  closePeer(id);
  const pc = new RTCPeerConnection({ iceServers: ICE });
  const peer = { pc, session: null, state: "new", offerAt: Date.now(), audio: null, meter: null };
  V.peers.set(id, peer);
  pc.ontrack = (e) => {
    unlockAudio();
    if (!peer.audio) {
      peer.audio = document.body.appendChild(new Audio());
      peer.audio.autoplay = true;
      peer.audio.setAttribute("playsinline", "");
    }
    peer.audio.srcObject = e.streams[0] || new MediaStream([e.track]);
    peer.audio.play().catch(() => {});
    watchSpeaking(id, peer);
  };
  pc.onconnectionstatechange = () => {
    if (V.peers.get(id) !== peer) return;
    peer.state = pc.connectionState;
    if (pc.connectionState === "failed") closePeer(id);
    updateVoiceUI();
  };
  return peer;
}

// Без «трикла»: ждём, пока соберутся ICE-кандидаты, и шлём SDP одним сообщением.
const gathered = (pc) => new Promise((res) => {
  if (pc.iceGatheringState === "complete") return res();
  const t = setTimeout(res, 2500);
  pc.addEventListener("icegatheringstatechange", () => {
    if (pc.iceGatheringState === "complete") { clearTimeout(t); res(); }
  });
});

// В каждой паре звонит тот, кто раньше зашёл в комнату; второй при заходе шлёт «hello».
function voiceSync() {
  if (!window.RTCPeerConnection) return;
  const online = new Set(onlineOthers());
  for (const id of [...V.peers.keys()]) if (!online.has(id)) closePeer(id);
  const myIdx = R.room.members.indexOf(pid);
  for (const id of online) {
    const p = V.peers.get(id);
    const stale = !p || (p.state !== "connected" && Date.now() - p.offerAt > 12000);
    if (!stale) continue;
    if (myIdx < R.room.members.indexOf(id)) makeOffer(id);
    else if (Date.now() - (V.helloAt[id] || 0) > 12000) {
      V.helloAt[id] = Date.now();
      signal(id, { type: "hello" });
    }
  }
}

async function makeOffer(id) {
  const peer = newPeer(id);
  const pc = peer.pc;
  peer.session = rid(6);
  const t = pc.addTransceiver("audio", { direction: "sendrecv" });
  if (V.mic) await t.sender.replaceTrack(V.mic);
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  if (V.peers.get(id) !== peer) return;
  signal(id, { type: "offer", session: peer.session, sdp: pc.localDescription.sdp });
}

async function onSignal(s) {
  const id = s.from;
  if (!R.room.members.includes(id)) return;
  if (s.type === "bye") return closePeer(id);
  if (s.type === "hello") {
    const p = V.peers.get(id);
    if (R.room.members.indexOf(pid) < R.room.members.indexOf(id) && (!p || Date.now() - p.offerAt > 3000)) makeOffer(id);
    return;
  }
  if (s.type === "offer") {
    const peer = newPeer(id);
    const pc = peer.pc;
    peer.session = s.session;
    await pc.setRemoteDescription({ type: "offer", sdp: s.sdp });
    const t = pc.getTransceivers()[0];
    if (t) {
      t.direction = "sendrecv";
      if (V.mic) await t.sender.replaceTrack(V.mic);
    }
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    if (V.peers.get(id) === peer) signal(id, { type: "answer", session: s.session, sdp: pc.localDescription.sdp });
  } else if (s.type === "answer") {
    const p = V.peers.get(id);
    if (p && s.session === p.session && p.pc.signalingState === "have-local-offer") await p.pc.setRemoteDescription({ type: "answer", sdp: s.sdp });
  }
}

// Подсветка аватарки того, кто сейчас говорит.
function watchSpeaking(id, peer) {
  clearInterval(peer.meter);
  if (!V.ctx) return;
  try {
    const an = V.ctx.createAnalyser();
    an.fftSize = 512;
    V.ctx.createMediaStreamSource(peer.audio.srcObject).connect(an);
    const buf = new Uint8Array(an.fftSize);
    peer.meter = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += (v - 128) ** 2;
      const loud = Math.sqrt(sum / buf.length) > 6;
      document.querySelectorAll(`[data-ava="${id}"], [data-ring="${id}"]`).forEach((el) => el.classList.toggle("speaking", loud));
    }, 120);
  } catch {}
}

function updateVoiceUI() {
  if (!R?.room) return;
  const online = onlineOthers();
  const connected = online.filter((id) => V.peers.get(id)?.state === "connected").length;
  const talking = online.filter((id) => P(id).voice).map((id) => P(id).name || T.player);
  const status = !online.length ? ""
    : talking.length ? T.onAir(talking.slice(0, 2).map(esc).join(", "), Math.max(0, talking.length - 2))
      : connected === online.length ? T.soundOk
        : connected ? T.soundPartial(connected, online.length) : T.soundConnecting;
  document.querySelectorAll(".chat-status").forEach((el) => {
    el.textContent = status;
    el.classList.toggle("ok", connected > 0);
  });
  document.querySelectorAll(".mic-btn").forEach((b) => {
    b.classList.toggle("on", !!V.mic);
    b.setAttribute("aria-label", V.mic ? T.micOff : T.micOn);
  });
  document.querySelectorAll(".compose input").forEach((i) => (i.placeholder = V.mic ? T.micLive : T.message));
}

/* ---------------- игра ---------------- */
const saveKey = () => `sd-g:${R.id}:${R.game.round}:${pid}`;
const UNITS = (() => {
  const u = [];
  for (let k = 0; k < 9; k++) {
    u.push(Array.from({ length: 9 }, (_, j) => k * 9 + j));
    u.push(Array.from({ length: 9 }, (_, j) => j * 9 + k));
    const br = Math.floor(k / 3) * 3, bc = (k % 3) * 3;
    u.push(Array.from({ length: 9 }, (_, j) => (br + Math.floor(j / 3)) * 9 + bc + (j % 3)));
  }
  return u;
})();

function startGame() {
  const pz = R.puzzle;
  let saved = null;
  try { saved = JSON.parse(store.get(`sd-g:${R.id}:${pz.round}:${pid}`)); } catch {}
  R.view = "game";
  R.game = {
    round: pz.round,
    given: [...pz.puzzle].map(Number),
    sol: [...pz.solution].map(Number),
    grid: saved?.grid || [...pz.puzzle].map(Number),
    notes: saved?.notes || Array(81).fill(0),
    mistakes: saved?.mistakes || 0,
    sel: saved?.sel ?? 40,
    notesMode: false,
    started: false,
    sendTimer: null,
    lastSent: "",
    combo: 0, lastOk: 0, notesUsed: 0, hits: 0, maxBehind: 0,
  };

  const opps = pz.players.filter((id) => id !== pid);
  if (pz.bot) opps.push("bot");
  document.getElementById("main").innerHTML = `
    <div class="card hud">
      <div class="hud-me">
        <div><div class="lbl">${esc(me().name || T.you)}</div><div class="val" id="clock">0:00</div><div class="hearts" id="myHearts"></div></div>
        <div class="hud-left"><div class="lbl">${T.leftCells}</div><div class="val" id="left">—</div></div>
      </div>
      <div class="bar"><i id="barMe" style="background:${colorOf(pid)}"></i></div>
      <div class="rings" id="rings">${opps.map((id) => `
        <button class="ring" data-ring="${id}" style="--c:${colorOf(id)}">
          <span class="ring-ava"><b>${id === "bot" ? "🤖" : esc(initial(P(id).name))}</b></span>
          <span class="ring-badge"></span>
          <span class="ring-nm">${esc(nameOf(id))}</span>
        </button>`).join("")}</div>
    </div>
    <div class="card board-card"><div class="board" id="board">${Array.from({ length: 81 }, (_, i) =>
      `<div class="cell r${(i / 9) | 0} c${i % 9}" data-i="${i}"></div>`).join("")}</div></div>
    <div class="pad" id="pad">${Array.from({ length: 9 }, (_, k) => `<button data-d="${k + 1}">${k + 1}<small></small></button>`).join("")}</div>
    <div class="tools">
      <button id="notesBtn">${T.notes}</button>
      <button id="eraseBtn">${T.erase}</button>
      <button id="resignBtn" class="danger">${T.resign}</button>
    </div>`;

  document.getElementById("board").addEventListener("pointerdown", (e) => {
    const c = e.target.closest(".cell");
    if (!c) return;
    R.game.sel = Number(c.dataset.i);
    drawBoard();
  });
  bindPad(document.getElementById("pad"));
  document.getElementById("rings").addEventListener("click", (e) => {
    const r = e.target.closest("[data-ring]");
    if (!r) return;
    if (r.dataset.ring === "bot") toast(T.botImmune);
    else throwMenu(r.dataset.ring, r);
  });
  document.getElementById("notesBtn").onclick = toggleNotes;
  document.getElementById("eraseBtn").onclick = erase;
  document.getElementById("resignBtn").onclick = async () => {
    if (!confirm(T.resignConfirm)) return;
    apply(await api("POST", { action: "resign" }));
  };

  tick();
  drawBoard();
  updateHud();
}

function finishGame() {
  clearTimeout(R.game?.sendTimer);
  document.querySelector(".overlay")?.remove();
  document.querySelector(".throw-menu")?.remove();
  closeSheet();
  R.view = null;
  const m = me();
  // Финишный праздник
  if (m.place === 1) { confetti({ count: 200 }); navigator.vibrate?.([30, 40, 30]); }
  else if (m.place) confetti({ count: 70 });
}

function tick() {
  if (R?.view !== "game") return;
  const g = R.game;
  const left = R.puzzle.startAt - serverNow();
  let ov = document.querySelector(".overlay");
  if (left > -700) {
    if (!ov) {
      const L = LEVELS[levelIdx(R.puzzle.level ?? 40)];
      const n = R.puzzle.players.length + (R.puzzle.bot ? 1 : 0);
      ov = document.createElement("div");
      ov.className = "overlay";
      ov.innerHTML = `<div class="count"></div><div class="meta">${L.name} · ${T.clues(R.puzzle.clues)} · ${T.playersN(n)}</div>`;
      document.body.append(ov);
    }
    const n = left > 0 ? String(Math.ceil(left / 1000)) : T.start;
    const el = ov.querySelector(".count");
    if (el.textContent !== n) {
      el.textContent = n;
      el.classList.toggle("go", left <= 0);
      el.style.animation = "none"; el.offsetWidth; el.style.animation = "";
      navigator.vibrate?.(left > 0 ? 10 : 40);
    }
    if (left <= 0 && !g.started) { g.started = true; drawBoard(); }
  } else {
    ov?.remove();
    if (!g.started) { g.started = true; drawBoard(); }
    const clock = document.getElementById("clock");
    if (clock) clock.textContent = fmt(-left);
    updateBot();
  }
  setTimeout(tick, 150);
}

// Бот: случайный, но повторяемый порядок клеток и темп по сложности (5–18 с на клетку).
function botPlan(pz) {
  let seed = [...`${R.id}:${pz.round}`].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const order = [...pz.puzzle].map((c, i) => (c === "0" ? i : -1)).filter((i) => i >= 0);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const per = 5 + (pz.level ?? 40) * 0.13;
  let t = 3;
  return { order, times: order.map(() => (t += per * (0.45 + rnd() * 1.1))) };
}

function updateBot() {
  const pz = curPuzzle();
  if (!pz?.bot) return;
  R.bot = R.bot?.round === pz.round ? R.bot : { round: pz.round, plan: botPlan(pz), n: -1, sent: false };
  const sec = (serverNow() - pz.startAt) / 1000;
  const n = R.bot.plan.times.filter((t) => t <= sec).length;
  if (n === R.bot.n) return;
  R.bot.n = n;
  R.botState = { filled: n, total: R.bot.plan.order.length };
  updateHud();
  if (n === R.bot.plan.order.length && !R.room.botResult && !R.bot.sent) {
    R.bot.sent = true;
    api("POST", { action: "botwin" }).then(apply).catch(() => (R.bot.sent = false));
  }
}

const peers = (i) => {
  const r = (i / 9) | 0, c = i % 9, br = r - (r % 3), bc = c - (c % 3);
  const out = [];
  for (let k = 0; k < 9; k++) out.push(r * 9 + k, k * 9 + c, (br + ((k / 3) | 0)) * 9 + bc + (k % 3));
  return out;
};

// Цифры внизу: навёл мышкой или провёл пальцем — на поле подсвечиваются все такие цифры,
// а клетки, куда она уже не встанет (её ряд, столбец, квадрат), затеняются.
// Простое нажатие ставит цифру; если палец уехал на другую кнопку — это просмотр, без ввода.
function bindPad(pad) {
  const digitAt = (x, y) => Number(document.elementFromPoint(x, y)?.closest("#pad button")?.dataset.d || 0);
  const setHover = (d) => {
    if (R.game.hover === d) return;
    R.game.hover = d;
    if (d && R.game.started) navigator.vibrate?.(5);
    drawBoard();
  };
  let press = null;
  pad.addEventListener("pointerdown", (e) => {
    const d = digitAt(e.clientX, e.clientY);
    if (!d) return;
    press = { d, moved: false };
    pad.setPointerCapture(e.pointerId);
    setHover(d);
  });
  pad.addEventListener("pointermove", (e) => {
    const d = digitAt(e.clientX, e.clientY);
    if (press) {
      if (d && d !== press.d) press.moved = true;
      if (d) setHover(d);
    } else if (e.pointerType === "mouse") setHover(d);
  });
  const up = (e, cancel) => {
    if (!press) return;
    const { d, moved } = press;
    press = null;
    if (e.pointerType !== "mouse") setHover(0);
    if (!cancel && !moved) input(d);
  };
  pad.addEventListener("pointerup", (e) => up(e, false));
  pad.addEventListener("pointercancel", (e) => up(e, true));
  pad.addEventListener("pointerleave", (e) => { if (!press && e.pointerType === "mouse") setHover(0); });
}

function drawBoard(popIndex = -1) {
  const g = R.game;
  const cells = document.querySelectorAll(".cell");
  if (!cells.length) return;
  const hover = g.started ? g.hover || 0 : 0;
  const blocked = new Set();
  if (hover) for (let i = 0; i < 81; i++) if (g.grid[i] === hover) peers(i).forEach((p) => blocked.add(p));
  const selVal = g.started ? g.grid[g.sel] : 0;
  const peerSet = new Set(peers(g.sel));
  const counts = Array(10).fill(0);
  for (let i = 0; i < 81; i++) if (g.grid[i] && g.grid[i] === g.sol[i]) counts[g.grid[i]]++;

  cells.forEach((el, i) => {
    const v = g.started ? g.grid[i] : 0;
    const bad = v && v !== g.sol[i];
    const keep = el.classList.contains("wave") ? " wave" : "";
    el.className = `cell r${(i / 9) | 0} c${i % 9}` +
      (g.given[i] ? " given" : "") + (bad ? " bad" : "") +
      (hover
        ? (v === hover ? " lit" : blocked.has(i) || v ? " blocked" : "")
        : i === g.sel ? " sel" : selVal && v === selVal ? " same" : peerSet.has(i) ? " peer" : "") +
      (i === popIndex ? " pop" : "") + keep;
    if (v) el.textContent = v;
    else if (g.started && g.notes[i]) {
      el.innerHTML = `<div class="notes">${Array.from({ length: 9 }, (_, k) =>
        `<span>${g.notes[i] & (1 << (k + 1)) ? k + 1 : ""}</span>`).join("")}</div>`;
    } else el.textContent = "";
  });

  document.querySelectorAll("#pad button").forEach((b) => {
    const d = Number(b.dataset.d);
    b.classList.toggle("done", counts[d] >= 9);
    b.classList.toggle("hover", d === hover);
    b.querySelector("small").textContent = 9 - counts[d] || "";
  });
  document.getElementById("pad").classList.toggle("notes-on", g.notesMode);
  document.getElementById("notesBtn").classList.toggle("on", g.notesMode);

  const total = g.given.filter((x) => !x).length;
  const mine = g.grid.filter((v, i) => !g.given[i] && v === g.sol[i]).length;
  document.getElementById("left").textContent = total - mine;
  document.getElementById("barMe").style.width = `${(mine / total) * 100}%`;
  document.getElementById("myHearts").innerHTML = Array.from({ length: MAX_MISTAKES }, (_, k) =>
    `<i class="${k < g.mistakes ? "lost" : ""}"></i>`).join("");
}

function updateHud() {
  const pz = curPuzzle();
  if (!pz || !document.getElementById("rings")) return;
  const g = R.game;
  const total = g.given.filter((x) => !x).length;
  const mine = g.grid.filter((v, i) => !g.given[i] && v === g.sol[i]).length / total;
  let best = 0;
  document.querySelectorAll("[data-ring]").forEach((el) => {
    const id = el.dataset.ring;
    const r = id === "bot"
      ? { filled: R.botState?.filled || 0, total: R.botState?.total || total, place: R.room.botResult?.place }
      : P(id);
    const pct = (r.filled || 0) / (r.total || total);
    best = Math.max(best, pct);
    el.style.setProperty("--p", `${Math.round(pct * 100)}%`);
    el.classList.toggle("out", !!r.out);
    el.classList.toggle("placed", !!r.place);
    el.querySelector(".ring-badge").textContent = r.place ? medal(r.place) : r.out ? "✖" : `${Math.round(pct * 100)}%`;
  });
  g.maxBehind = Math.max(g.maxBehind, best - mine);
}

const locked = (i) => R.game.given[i] || (R.game.grid[i] && R.game.grid[i] === R.game.sol[i]);
const canPlay = () => R.game.started && R.game.mistakes < MAX_MISTAKES && !R.room.over;

function input(d) {
  const g = R.game;
  if (!canPlay() || locked(g.sel)) return;
  const i = g.sel;
  if (g.notesMode) {
    if (g.grid[i]) return;
    g.notes[i] ^= 1 << d;
    if (++g.notesUsed >= 30) achUnlock("pencil");
    persist();
    return drawBoard();
  }
  if (g.grid[i] === d) return;
  g.grid[i] = d;
  g.notes[i] = 0;
  if (d !== g.sol[i]) {
    g.mistakes++;
    g.combo = 0;
    navigator.vibrate?.(80);
    const board = document.getElementById("board");
    board.classList.remove("shake"); board.offsetWidth; board.classList.add("shake");
    if (g.mistakes >= MAX_MISTAKES) toast(T.outToast);
  } else {
    for (const p of peers(i)) g.notes[p] &= ~(1 << d);
    // Комбо: верные ходы подряд, каждый не дольше 6 секунд после прошлого.
    const now = Date.now();
    g.combo = now - g.lastOk < 6000 ? g.combo + 1 : 1;
    g.lastOk = now;
    const cell = document.querySelector(`.cell[data-i="${i}"]`);
    if (g.combo >= 3) floatText(`×${g.combo}`, cell, g.combo >= 8 ? "hot" : "");
    if (g.combo >= 10) achUnlock("combo10");
    celebrateUnits(i, d);
  }
  persist();
  drawBoard(i);
  const done = g.grid.every((v, k) => v === g.sol[k]);
  send(done || g.mistakes >= MAX_MISTAKES);
}

// Закрыл ряд, столбец или квадрат — по нему пробегает волна; все девять цифр — галочка над кнопкой.
function celebrateUnits(i, d) {
  const g = R.game;
  const ok = (k) => g.grid[k] && g.grid[k] === g.sol[k];
  const cells = document.querySelectorAll(".cell");
  for (const u of UNITS) {
    if (!u.includes(i) || !u.every(ok)) continue;
    u.forEach((k, j) => {
      const el = cells[k];
      el.classList.remove("wave");
      el.style.animationDelay = `${j * 35}ms`;
      void el.offsetWidth;
      el.classList.add("wave");
      setTimeout(() => el.classList.remove("wave"), 900 + j * 35);
    });
  }
  if (g.grid.filter((v, k) => v === d && v === g.sol[k]).length === 9) {
    const b = document.querySelector(`#pad button[data-d="${d}"]`);
    if (b) floatText("✓", b, "done");
  }
}

function erase() {
  const g = R.game;
  if (!canPlay() || locked(g.sel)) return;
  g.grid[g.sel] = 0;
  g.notes[g.sel] = 0;
  persist();
  drawBoard();
}

function toggleNotes() {
  R.game.notesMode = !R.game.notesMode;
  drawBoard();
}

function persist() {
  const g = R.game;
  store.set(saveKey(), JSON.stringify({ grid: g.grid, notes: g.notes, mistakes: g.mistakes, sel: g.sel }));
}

// Прогресс уходит на сервер не чаще раза в 0,6 с; финиш и третья ошибка — сразу.
function send(now = false) {
  const g = R.game;
  clearTimeout(g.sendTimer);
  const go = async () => {
    const body = { action: "progress", round: g.round, grid: g.grid.join(""), mistakes: g.mistakes };
    const sig = body.grid + body.mistakes;
    if (sig === g.lastSent) return;
    g.lastSent = sig;
    try { apply(await api("POST", body)); }
    catch { g.lastSent = ""; g.sendTimer = setTimeout(go, 1000); }
  };
  if (now) go();
  else g.sendTimer = setTimeout(go, 600);
}

document.addEventListener("keydown", (e) => {
  if (R?.view !== "game" || e.target.tagName === "INPUT") return;
  const g = R.game;
  if (/^[1-9]$/.test(e.key)) return input(Number(e.key));
  if (["Backspace", "Delete", "0"].includes(e.key)) return erase();
  if (["n", "N", "т", "Т"].includes(e.key)) return toggleNotes();
  const mv = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (mv) {
    e.preventDefault();
    const r = (g.sel / 9) | 0, c = g.sel % 9;
    if (mv === -1) g.sel = r * 9 + ((c + 8) % 9);
    else if (mv === 1) g.sel = r * 9 + ((c + 1) % 9);
    else g.sel = (g.sel + mv + 81) % 81;
    drawBoard();
  }
});

/* ================= маршрутизация ================= */
function route() {
  if (R) { R.alive = false; micOff(true); closeAll(true); }
  R = null;
  document.querySelector(".overlay")?.remove();
  document.querySelector(".sheet-wrap")?.remove();
  const m = location.pathname.match(/^\/r\/([a-z0-9]{4,16})$/i);
  if (m) room(m[1]);
  else home();
}
window.addEventListener("popstate", route);
if (!acc.redirecting) route();
