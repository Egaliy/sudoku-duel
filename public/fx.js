import { T } from "./i18n.js";

// Эффекты: конфетти, летящие эмодзи-реакции, броски в игроков и всплывающие надписи.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// Конфетти на канвасе поверх всего; сам себя убирает, когда частицы упали.
export function confetti({ count = 120, x, y, spread = 1, power = 1, colors } = {}) {
  if (reduced()) return;
  const c = document.createElement("canvas");
  c.className = "fx-canvas";
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = innerWidth * dpr;
  c.height = innerHeight * dpr;
  document.body.append(c);
  const ctx = c.getContext("2d");
  ctx.scale(dpr, dpr);
  const pal = colors || ["#0071e3", "#ff9500", "#34c759", "#ff2d55", "#af52de", "#ffd60a", "#30b0c7"];
  const ox = x ?? innerWidth / 2, oy = y ?? innerHeight * 0.35;
  const parts = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * spread;
    const v = (6 + Math.random() * 9) * power;
    return {
      x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 6 + Math.random() * 6, h: 8 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
      c: pal[(Math.random() * pal.length) | 0], life: 0,
    };
  });
  let frame = 0;
  const step = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    let alive = 0;
    for (const p of parts) {
      p.vy += 0.32; p.vx *= 0.985; p.vy *= 0.985;
      p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      if (p.y > innerHeight + 40) continue;
      alive++;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.scale(1, Math.cos(p.life * 0.15));
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (alive && frame++ < 400) requestAnimationFrame(step);
    else c.remove();
  };
  requestAnimationFrame(step);
}

// Реакция эмодзи — несколько штук всплывают снизу вверх, как в FaceTime.
export function floatEmoji(text) {
  if (reduced()) return;
  for (let k = 0; k < 6; k++) {
    const el = document.createElement("div");
    el.className = "fx-float";
    el.textContent = text;
    el.style.left = `${10 + Math.random() * 80}%`;
    el.style.setProperty("--dx", `${(Math.random() - 0.5) * 120}px`);
    el.style.setProperty("--s", (0.8 + Math.random() * 0.8).toFixed(2));
    el.style.animationDelay = `${k * 120}ms`;
    document.body.append(el);
    setTimeout(() => el.remove(), 2600 + k * 120);
  }
}

// Летящий предмет: от низа экрана к аватарке цели (или от цели — если бросили не в нас).
export function flyTo(emoji, target, fromSide) {
  if (reduced() || !target) return;
  const r = target.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = "fx-fly";
  el.textContent = emoji;
  const sx = fromSide ? (Math.random() < 0.5 ? -40 : innerWidth + 40) : innerWidth / 2;
  const sy = fromSide ? r.top + 60 : innerHeight - 60;
  el.style.left = `${sx}px`;
  el.style.top = `${sy}px`;
  document.body.append(el);
  el.animate([
    { transform: "translate(-50%, -50%) scale(.6) rotate(0deg)" },
    { transform: `translate(calc(-50% + ${(r.left + r.width / 2 - sx) / 2}px), calc(-50% + ${(r.top + r.height / 2 - sy) / 2 - 120}px)) scale(1.4) rotate(220deg)`, offset: 0.5 },
    { transform: `translate(calc(-50% + ${r.left + r.width / 2 - sx}px), calc(-50% + ${r.top + r.height / 2 - sy}px)) scale(1) rotate(440deg)` },
  ], { duration: 650, easing: "cubic-bezier(.3,.6,.4,1)" }).onfinish = () => {
    el.remove();
    target.animate([{ transform: "scale(1)" }, { transform: "scale(1.25) rotate(-8deg)" }, { transform: "scale(1)" }], { duration: 300 });
  };
}

// Что происходит у того, в кого бросили.
export function throwEffect(kind, host) {
  if (!host) return;
  let r = host.getBoundingClientRect();
  // Вне игры (длинная колонка лобби) бьём в квадрат по центру экрана.
  if (r.height > r.width * 1.2 || r.bottom < 0 || r.top > innerHeight) {
    const size = Math.min(innerWidth - 24, innerHeight * 0.7, 520);
    r = { left: (innerWidth - size) / 2, top: (innerHeight - size) / 2, width: size, height: size };
  }
  const layer = document.createElement("div");
  layer.className = `fx-hit fx-${kind}`;
  Object.assign(layer.style, { left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px` });
  document.body.append(layer);
  navigator.vibrate?.([40, 30, 60]);
  if (kind === "tomato") {
    // Клякса с потёками закрывает кусок поля на пару секунд.
    const cx = 25 + Math.random() * 50, cy = 25 + Math.random() * 40;
    layer.innerHTML = `<svg viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%">
      <g fill="#e0301e" opacity=".92">
        <circle cx="${cx}" cy="${cy}" r="17"/>
        ${Array.from({ length: 9 }, () => `<circle cx="${cx + (Math.random() - 0.5) * 44}" cy="${cy + (Math.random() - 0.5) * 40}" r="${2 + Math.random() * 6}"/>`).join("")}
        ${Array.from({ length: 4 }, () => { const x = cx + (Math.random() - 0.5) * 24; return `<rect class="drip" x="${x}" y="${cy}" width="${2 + Math.random() * 2.5}" height="${18 + Math.random() * 22}" rx="1.5"/>`; }).join("")}
      </g>
      <circle cx="${cx - 5}" cy="${cy - 6}" r="4" fill="#fff" opacity=".35"/></svg>`;
    setTimeout(() => layer.classList.add("fade"), 2600);
    setTimeout(() => layer.remove(), 3400);
  } else if (kind === "bubbles") {
    layer.innerHTML = Array.from({ length: 16 }, () => {
      const s = 20 + Math.random() * 46;
      return `<i style="left:${Math.random() * 90}%;width:${s}px;height:${s}px;animation-delay:${Math.random() * 1.4}s;animation-duration:${2.4 + Math.random() * 1.6}s"></i>`;
    }).join("");
    setTimeout(() => layer.remove(), 4800);
  } else if (kind === "chicken") {
    layer.innerHTML = `<div class="chick">🐔</div><div class="chick-say">${T.kukareku}</div>`;
    setTimeout(() => layer.remove(), 2600);
  } else if (kind === "party") {
    layer.remove();
    confetti({ count: 90, x: r.left + r.width / 2, y: r.top + r.height * 0.6, power: 0.9 });
  }
}

// Всплывающая надпись над элементом (комбо, галочка у закрытой цифры).
export function floatText(text, anchor, cls = "") {
  if (!anchor) return;
  const r = anchor.getBoundingClientRect();
  const el = document.createElement("div");
  el.className = `fx-text ${cls}`;
  el.textContent = text;
  el.style.left = `${r.left + r.width / 2}px`;
  el.style.top = `${r.top}px`;
  document.body.append(el);
  setTimeout(() => el.remove(), 900);
}
