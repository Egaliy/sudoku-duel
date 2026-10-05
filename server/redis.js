// Upstash Redis REST без зависимостей. Без переменных окружения (локально) — память процесса.
const URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const configured = Boolean(URL && TOKEN);

export async function pipeline(cmds) {
  if (!cmds.length) return [];
  if (!configured) {
    if (process.env.VERCEL) throw new Error("Redis не подключён: нужны KV_REST_API_URL и KV_REST_API_TOKEN");
    return cmds.map(memory);
  }
  const r = await fetch(`${URL}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(j.error || "pipeline failed");
  return j.map((x) => x.result);
}

export const redis = async (...cmd) => (await pipeline([cmd]))[0];

// Минимальная эмуляция нужных команд для локальной разработки.
const mem = new Map();
function memory([cmd, key, ...a]) {
  switch (cmd.toUpperCase()) {
    case "GET": return mem.get(key) ?? null;
    case "SET": mem.set(key, a[0]); return "OK";
    case "EXPIRE": return 1;
    case "DEL": return mem.delete(key) ? 1 : 0;
    case "RPUSH": {
      const l = mem.get(key) || [];
      l.push(...a);
      mem.set(key, l);
      return l.length;
    }
    case "LTRIM": {
      const l = mem.get(key) || [];
      const start = Number(a[0]) < 0 ? Math.max(0, l.length + Number(a[0])) : Number(a[0]);
      mem.set(key, l.slice(start));
      return "OK";
    }
    case "LRANGE": {
      const l = mem.get(key) || [];
      const start = Number(a[0]) < 0 ? Math.max(0, l.length + Number(a[0])) : Number(a[0]);
      return l.slice(start);
    }
    case "LPOP": {
      const l = mem.get(key) || [];
      const out = l.splice(0, Number(a[0] || 1));
      return out.length ? out : null;
    }
    case "HINCRBY": {
      const h = mem.get(key) || {};
      h[a[0]] = String(Number(h[a[0]] || 0) + Number(a[1]));
      mem.set(key, h);
      return Number(h[a[0]]);
    }
    case "HGETALL": {
      const h = mem.get(key);
      return h ? Object.entries(h).flat() : [];
    }
    case "HGET": return mem.get(key)?.[a[0]] ?? null;
    case "HSET": {
      const h = mem.get(key) || {};
      for (let i = 0; i < a.length; i += 2) h[a[i]] = a[i + 1];
      mem.set(key, h);
      return a.length / 2;
    }
    case "HSETNX": {
      const h = mem.get(key) || {};
      if (a[0] in h) return 0;
      h[a[0]] = a[1];
      mem.set(key, h);
      return 1;
    }
    default: throw new Error(`mem: ${cmd} не поддерживается`);
  }
}
