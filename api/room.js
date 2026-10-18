import { pipeline } from "../server/redis.js";
import { generate, cluesFor } from "../server/sudoku.js";

// Комната — хеш sd:room:<id>:
//   round, chatSeq, p:<pid> (JSON игрока), placeN:<round> (счётчик мест),
//   w:<round> (JSON победителя раунда), over:<round>, bot:<round>, start:<round>, botres:<round>.
// Пазл раунда — sd:puz:<id>:<round>, чат — sd:chat:<id>, кто онлайн — хеш sd:seen:<id>,
// сигналы WebRTC — очередь sd:sig:<id>:<pid>, «приколы» (помидоры и т. п.) идут через чат.
const TTL = 60 * 60 * 24 * 3;
const roomKey = (id) => `sd:room:${id}`;
const puzKey = (id, n) => `sd:puz:${id}:${n}`;
const chatKey = (id) => `sd:chat:${id}`;
const seenKey = (id) => `sd:seen:${id}`;
const sigKey = (id, pid) => `sd:sig:${id}:${pid}`;
const START_DELAY = 3500;
const MAX_MISTAKES = 3;
const MAX_PLAYERS = 10;
const ONLINE_MS = 15000;
const DEFAULT_LEVEL = 40;

const okId = (s) => typeof s === "string" && /^[a-z0-9]{4,16}$/i.test(s);
const clampLevel = (v) => Math.max(0, Math.min(100, Math.round(Number(v)))) || 0;

function parseHash(arr) {
  const h = {};
  for (let i = 0; i < (arr?.length || 0); i += 2) h[arr[i]] = arr[i + 1];
  return h;
}

async function load(id) {
  const [arr, seen] = await pipeline([["HGETALL", roomKey(id)], ["HGETALL", seenKey(id)]]);
  return { h: parseHash(arr), seen: parseHash(seen) };
}

const playersOf = (h) => {
  const out = {};
  for (const [k, v] of Object.entries(h)) if (k.startsWith("p:")) out[k.slice(2)] = JSON.parse(v);
  return out;
};
const onlineOf = (h, seen, now = Date.now()) =>
  Object.keys(playersOf(h)).filter((p) => now - Number(seen[p] || 0) < ONLINE_MS);

function view(h, seen, id) {
  const players = playersOf(h);
  const wins = {}, botWins = {};
  for (const [k, v] of Object.entries(h)) {
    if (!k.startsWith("w:")) continue;
    const w = JSON.parse(v);
    // Партии с ботом считаем отдельно от общего счёта.
    const t = w.bot ? botWins : wins;
    t[w.pid] = (t[w.pid] || 0) + 1;
  }
  const round = Number(h.round || 0);
  return {
    id,
    round,
    over: !round || Boolean(h[`over:${round}`]),
    chatSeq: Number(h.chatSeq || 0),
    members: Object.keys(players).sort((a, b) => players[a].joinedAt - players[b].joinedAt),
    online: onlineOf(h, seen),
    players,
    wins,
    botWins,
    winner: round && h[`w:${round}`] ? JSON.parse(h[`w:${round}`]) : null,
    botResult: round && h[`botres:${round}`] ? JSON.parse(h[`botres:${round}`]) : null,
  };
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  let s = "";
  for await (const chunk of req) s += chunk;
  return JSON.parse(s || "{}");
}

// Раунд окончен, когда каждый участник решил или выбыл.
async function checkOver(id, round) {
  const key = roomKey(id);
  const [arr, raw] = await pipeline([["HGETALL", key], ["GET", puzKey(id, round)]]);
  const h = parseHash(arr);
  if (!raw || h[`over:${round}`]) return;
  const puz = JSON.parse(raw);
  const all = puz.players.every((p) => {
    const r = h[`p:${p}`] && JSON.parse(h[`p:${p}`]);
    return !r || r.place || r.out;
  });
  if (all) await pipeline([["HSET", key, `over:${round}`, "1"]]);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const url = new URL(req.url, "http://x");
      const id = url.searchParams.get("id");
      const pid = url.searchParams.get("pid");
      if (!okId(id)) return res.status(400).json({ error: "bad id" });
      const since = Number(url.searchParams.get("chat") || 0);
      const cmds = [["HGETALL", roomKey(id)], ["HGETALL", seenKey(id)], ["LRANGE", chatKey(id), -50, -1]];
      if (okId(pid)) cmds.push(["LPOP", sigKey(id, pid), 30], ["HSET", seenKey(id), pid, String(Date.now())], ["EXPIRE", seenKey(id), TTL]);
      const [arr, seenArr, chat, sig] = await pipeline(cmds);
      const h = parseHash(arr), seen = parseHash(seenArr);
      if (okId(pid)) seen[pid] = String(Date.now());
      const room = view(h, seen, id);
      const out = { now: Date.now(), room };
      // Чат — только новые сообщения; сигналы голосового чата забираем из очереди.
      if (room.chatSeq > since) out.chat = (chat || []).map((x) => JSON.parse(x)).filter((m) => m.seq > since);
      if (sig) out.signals = (Array.isArray(sig) ? sig : [sig]).map((x) => JSON.parse(x));
      // Пазл отдаём, только если у клиента его ещё нет.
      const have = Number(url.searchParams.get("have") || 0);
      if (room.round && have !== room.round) {
        const [p] = await pipeline([["GET", puzKey(id, room.round)]]);
        out.puzzle = p ? JSON.parse(p) : null;
      }
      return res.status(200).json(out);
    }

    if (req.method !== "POST") return res.status(405).end();
    const body = await readBody(req);
    const { id, pid, action } = body;
    if (!okId(id) || !okId(pid)) return res.status(400).json({ error: "bad id" });
    const key = roomKey(id);
    await pipeline([["HSET", seenKey(id), pid, String(Date.now())], ["EXPIRE", seenKey(id), TTL]]);
    let { h, seen } = await load(id);
    const me = h[`p:${pid}`] ? JSON.parse(h[`p:${pid}`]) : null;
    const round = Number(h.round || 0);
    const savePlayer = (p) => ["HSET", key, `p:${pid}`, JSON.stringify(p)];
    const between = !round || Boolean(h[`over:${round}`]);
    const isBot = Boolean(h[`bot:${round}`]);

    if (action === "join") {
      const name = String(body.name || "").trim().slice(0, 20) || null;
      if (!me && Object.keys(playersOf(h)).length >= MAX_PLAYERS) return res.status(403).json({ error: "full" });
      await pipeline([
        ["HSETNX", key, "round", "0"],
        savePlayer({ ...(me || { joinedAt: Date.now(), readyFor: 0, level: clampLevel(body.level ?? DEFAULT_LEVEL), voice: false }), name }),
        ["EXPIRE", key, TTL],
      ]);
    } else if (!me) {
      return res.status(403).json({ error: "not a player" });
    } else if (action === "level") {
      // Сложность у каждого своя, меняется только между раундами и снимает «Готов».
      if (between) await pipeline([savePlayer({ ...me, level: clampLevel(body.level), readyFor: 0 })]);
    } else if (action === "ready") {
      const next = round + 1;
      const p = { ...me, readyFor: body.ready ? next : 0 };
      await pipeline([savePlayer(p)]);
      h[`p:${pid}`] = JSON.stringify(p);
      const all = playersOf(h);
      const online = onlineOf(h, seen);
      const solo = body.bot && online.length <= 1;
      const go = between && body.ready && (solo || (online.length >= 2 && online.every((q) => all[q].readyFor === next)));
      if (go) {
        // HSETNX защищает от двойного старта, если все нажали одновременно.
        const [won] = await pipeline([["HSETNX", key, `start:${next}`, "1"]]);
        if (won) {
          const players = solo ? [pid] : online;
          // Сложность раунда — среднее по выбору всех участников.
          const level = Math.round(players.reduce((s, q) => s + (all[q].level ?? DEFAULT_LEVEL), 0) / players.length);
          const g = generate(cluesFor(level));
          const puzzle = { round: next, level, bot: solo, players, startAt: Date.now() + START_DELAY, ...g };
          const resets = players.map((q) => ["HSET", key, `p:${q}`, JSON.stringify({
            ...all[q], readyFor: 0, filled: 0, total: 81 - g.clues, mask: "", mistakes: 0, place: null, ms: null, out: null,
          })]);
          const flags = ["HSET", key, "round", String(next)];
          if (solo) flags.push(`bot:${next}`, "1");
          await pipeline([["SET", puzKey(id, next), JSON.stringify(puzzle), "EX", TTL], ...resets, flags, ["EXPIRE", key, TTL]]);
        }
      }
    } else if (action === "progress") {
      if (Number(body.round) !== round || h[`over:${round}`] || me.place || me.out) return res.status(200).json({ ok: false });
      const [raw] = await pipeline([["GET", puzKey(id, round)]]);
      const puz = JSON.parse(raw);
      if (!puz.players.includes(pid) || Date.now() < puz.startAt - 500) return res.status(200).json({ ok: false });
      const grid = String(body.grid || "");
      // Прогресс считаем на сервере по присланной сетке — так нельзя накрутить.
      let filled = 0, mask = "";
      for (let i = 0; i < 81; i++) {
        const okCell = puz.puzzle[i] === "0" && grid[i] === puz.solution[i];
        if (okCell) filled++;
        mask += puz.puzzle[i] !== "0" ? "g" : okCell ? "1" : "0";
      }
      const mistakes = Math.min(MAX_MISTAKES, Math.max(me.mistakes || 0, Number(body.mistakes) || 0));
      const total = 81 - puz.clues;
      const ms = Date.now() - puz.startAt;
      const p = { ...me, filled, total, mask, mistakes };
      if (filled === total) {
        const [place] = await pipeline([["HINCRBY", key, `placeN:${round}`, 1]]);
        Object.assign(p, { place, ms });
        const cmds = [savePlayer(p)];
        if (place === 1) cmds.push(["HSETNX", key, `w:${round}`, JSON.stringify({ pid, ms, bot: isBot })]);
        await pipeline(cmds);
      } else if (mistakes >= MAX_MISTAKES) {
        Object.assign(p, { out: "mistakes", ms });
        await pipeline([savePlayer(p)]);
      } else {
        await pipeline([savePlayer(p)]);
      }
      if (p.place || p.out) await checkOver(id, round);
    } else if (action === "resign") {
      if (round && !h[`over:${round}`] && !me.place && !me.out) {
        await pipeline([savePlayer({ ...me, out: "resign" })]);
        await checkOver(id, round);
      }
    } else if (action === "botwin") {
      if (round && isBot && !h[`botres:${round}`]) {
        const [raw] = await pipeline([["GET", puzKey(id, round)]]);
        const puz = JSON.parse(raw);
        const [place] = await pipeline([["HINCRBY", key, `placeN:${round}`, 1]]);
        const ms = Date.now() - puz.startAt;
        const cmds = [["HSET", key, `botres:${round}`, JSON.stringify({ place, ms })]];
        if (place === 1) cmds.push(["HSETNX", key, `w:${round}`, JSON.stringify({ pid: "bot", ms, bot: true })]);
        await pipeline(cmds);
      }
    } else if (action === "end") {
      // Кто-то завис или ушёл — решившие могут закончить раунд.
      if (round && !h[`over:${round}`] && (me.place || me.out)) await pipeline([["HSET", key, `over:${round}`, "1"]]);
    } else if (action === "chat") {
      const text = String(body.text || "").trim().slice(0, 300);
      const kind = ["text", "throw"].includes(body.kind) ? body.kind : "text";
      if (!text) return res.status(400).json({ error: "empty" });
      const msg = { pid, text, kind, at: Date.now() };
      if (kind === "throw" && okId(body.to)) msg.to = body.to;
      const [seq] = await pipeline([["HINCRBY", key, "chatSeq", 1]]);
      await pipeline([
        ["RPUSH", chatKey(id), JSON.stringify({ seq, ...msg })],
        ["LTRIM", chatKey(id), -100, -1],
        ["EXPIRE", chatKey(id), TTL],
      ]);
    } else if (action === "voice") {
      await pipeline([savePlayer({ ...me, voice: Boolean(body.on) })]);
    } else if (action === "signal") {
      const to = body.to;
      const data = body.data && typeof body.data === "object" ? body.data : null;
      if (!okId(to) || !h[`p:${to}`] || to === pid) return res.status(200).json({ ok: false });
      if (!data || JSON.stringify(data).length > 20000) return res.status(400).json({ error: "bad signal" });
      await pipeline([
        ["RPUSH", sigKey(id, to), JSON.stringify({ ...data, from: pid })],
        ["LTRIM", sigKey(id, to), -30, -1],
        ["EXPIRE", sigKey(id, to), 120],
      ]);
      return res.status(200).json({ ok: true });
    } else {
      return res.status(400).json({ error: "bad action" });
    }

    ({ h, seen } = await load(id));
    return res.status(200).json({ now: Date.now(), room: view(h, seen, id) });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}
