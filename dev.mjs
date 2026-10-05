// Локальный сервер: статика из public/ + /api/room на памяти процесса.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import room from "./api/room.js";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" };
const port = Number(process.env.PORT || 5230);

http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname === "/api/room") {
    res.status = (c) => ((res.statusCode = c), res);
    res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
    return room(req, res);
  }
  let p = url.pathname.startsWith("/r/") || url.pathname === "/" ? "/index.html" : url.pathname;
  try {
    const data = await readFile(join("public", p));
    res.setHeader("Content-Type", TYPES[extname(p)] || "application/octet-stream");
    res.end(data);
  } catch {
    res.statusCode = 404;
    res.end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`http://127.0.0.1:${port}`));
