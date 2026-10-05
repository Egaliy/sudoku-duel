// Генератор судоку с единственным решением. Сетка — строка из 81 символа, "0" — пустая клетка.
const ROW = [], COL = [], BOX = [];
for (let i = 0; i < 81; i++) {
  ROW[i] = (i / 9) | 0;
  COL[i] = i % 9;
  BOX[i] = ((ROW[i] / 3) | 0) * 3 + ((COL[i] / 3) | 0);
}
const ALL = 0x3fe; // биты 1..9

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Считает решения (до limit). При random=true перебирает цифры в случайном порядке и оставляет решение в g.
function solve(g, limit = 2, random = false) {
  const r = new Int16Array(9), c = new Int16Array(9), b = new Int16Array(9);
  for (let i = 0; i < 81; i++) if (g[i]) {
    const m = 1 << g[i];
    r[ROW[i]] |= m; c[COL[i]] |= m; b[BOX[i]] |= m;
  }
  let count = 0;
  const rec = () => {
    let best = -1, bestMask = 0, bestN = 10;
    for (let i = 0; i < 81; i++) if (!g[i]) {
      const mask = ALL & ~(r[ROW[i]] | c[COL[i]] | b[BOX[i]]);
      let n = 0;
      for (let m = mask; m; m &= m - 1) n++;
      if (n < bestN) { best = i; bestMask = mask; bestN = n; if (n <= 1) break; }
    }
    if (best < 0) { count++; return count >= limit; }
    if (!bestN) return false;
    let digits = [];
    for (let d = 1; d <= 9; d++) if (bestMask & (1 << d)) digits.push(d);
    if (random) shuffle(digits);
    for (const d of digits) {
      const m = 1 << d;
      g[best] = d; r[ROW[best]] |= m; c[COL[best]] |= m; b[BOX[best]] |= m;
      if (rec()) return true;
      g[best] = 0; r[ROW[best]] &= ~m; c[COL[best]] &= ~m; b[BOX[best]] &= ~m;
    }
    return false;
  };
  rec();
  return count;
}

// Сложность — число 0..100: 0 даёт 46 подсказок, 100 — 22.
export const cluesFor = (level) => Math.round(46 - Math.max(0, Math.min(100, level)) * 0.24);

export function generate(target = 32) {
  let best = null;
  // Несколько попыток: для «эксперта» не каждая раскладка позволяет дойти до 23 подсказок.
  for (let attempt = 0; attempt < 6; attempt++) {
    const sol = new Int8Array(81);
    solve(sol, 1, true);
    const puz = Int8Array.from(sol);
    let clues = 81;
    // Убираем клетки парами симметрично центру — так поле выглядит аккуратно.
    for (const i of shuffle([...Array(41).keys()])) {
      if (clues <= target) break;
      const j = 80 - i;
      const a = puz[i], bb = puz[j];
      puz[i] = 0; puz[j] = 0;
      if (solve(Int8Array.from(puz)) === 1) clues -= i === j ? 1 : 2;
      else { puz[i] = a; puz[j] = bb; }
    }
    if (!best || clues < best.clues) best = { puzzle: puz.join(""), solution: sol.join(""), clues };
    if (clues <= target + 1) break;
  }
  return best;
}
