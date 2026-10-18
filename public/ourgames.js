// Общий модуль наших игр: единый вход (через /sso.html «Стран мира») и блок «Наши игры».
// Один и тот же файл лежит в трёх проектах: countries-game, chess-openings, sudoku-duel — правится во всех сразу.

export const GAMES = [
  { id: "countries", url: "https://countries-game-khaki.vercel.app", emoji: "🌍", hue: 211,
    ru: { t: "Страны мира", d: "Вспомни все 196 стран, флаги и столицы" },
    sr: { t: "Zemlje sveta", d: "Seti se svih 196 zemalja, zastava i glavnih gradova" },
    en: { t: "Countries of the World", d: "Name all 196 countries, flags and capitals" } },
  { id: "chess", url: "https://chess-openings-lemon.vercel.app", emoji: "♟️", hue: 28,
    ru: { t: "Дебюты", d: "Выучи шахматные дебюты на память" },
    sr: { t: "Otvaranja", d: "Nauči šahovska otvaranja napamet" },
    en: { t: "Chess Openings", d: "Learn chess openings by heart" } },
  { id: "sudoku", url: "https://sudoku-duel-rosy.vercel.app", emoji: "🧩", hue: 145,
    ru: { t: "Судоку-батл", d: "Одно поле, кто первый решит — до 10 друзей" },
    sr: { t: "Sudoku duel", d: "Isto polje, ko prvi reši — do 10 drugara" },
    en: { t: "Sudoku Battle", d: "Same grid, first to solve wins — up to 10 friends" } },
];

const AUTH = "https://countries-game-khaki.vercel.app";
const KEY = "our-games-session-v1";
const CHECK = "our-games-sso-checked-v1";
const RECHECK_MS = 12 * 60 * 60 * 1000;

const ls = {
  get: (k) => { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const TEXT = {
  ru: { more: "Ещё наши игры", login: "Войти", out: "Выйти", one: "Один вход для всех наших игр", hi: "Привет" },
  sr: { more: "Još naših igara", login: "Prijava", out: "Odjavi se", one: "Jedna prijava za sve naše igre", hi: "Zdravo" },
  en: { more: "More of our games", login: "Log in", out: "Log out", one: "One login for all our games", hi: "Hi" },
};
const pick = (lang) => (lang === "sr" || lang === "rs" ? "sr" : lang === "ru" ? "ru" : "en");
const tx = (lang) => TEXT[pick(lang)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ---------------- вход ----------------
   При первом заходе (и раз в 12 часов) страница тихо уходит на /sso.html?mode=check и сразу возвращается:
   если в любой из игр уже вошли через Telegram, сессия приезжает в хеше #sso=…
   meUrl — адрес профиля по сессии (в играх это прокси на /api/me «Стран»). */
export function initAccount({ lang = "en", meUrl, onChange } = {}) {
  let state = ls.get(KEY) || { session: null, user: null };
  const hash = location.hash.match(/(?:^#|&)sso=([^&]*)/);
  if (hash) {
    const v = decodeURIComponent(hash[1]);
    history.replaceState(null, "", location.pathname + location.search);
    ls.set(CHECK, { at: Date.now(), out: false });
    if (v && v !== "none") state = { session: v, user: null };
  }
  const check = ls.get(CHECK);
  const needCheck = !state.session && !check?.out && (!check || Date.now() - check.at > RECHECK_MS);
  if (needCheck && !/^(127\.|localhost)/.test(location.hostname)) {
    ls.set(CHECK, { at: Date.now(), out: false });
    location.replace(`${AUTH}/sso.html?mode=check&lang=${lang}&return=${encodeURIComponent(location.href)}`);
    return { redirecting: true, user: null, login() {}, logout() {} };
  }
  ls.set(KEY, state.session ? state : null);

  const acc = {
    redirecting: false,
    get user() { return state.user; },
    get session() { return state.session; },
    login() {
      ls.set(CHECK, { at: Date.now(), out: false });
      location.href = `${AUTH}/sso.html?mode=login&lang=${lang}&return=${encodeURIComponent(location.href)}`;
    },
    logout() {
      state = { session: null, user: null };
      ls.set(KEY, null);
      ls.set(CHECK, { at: Date.now(), out: true }); // не входить снова автоматически
      onChange?.(null);
    },
  };
  if (state.session && meUrl) {
    fetch(`${meUrl}?session=${encodeURIComponent(state.session)}`)
      .then((r) => (r.status === 401 ? null : r.ok ? r.json() : undefined))
      .then((j) => {
        if (j === undefined) return; // сеть моргнула — оставляем как есть
        if (!j?.user) { acc.logout(); ls.set(CHECK, null); return; }
        state = { session: state.session, user: j.user };
        ls.set(KEY, state);
        onChange?.(state.user);
      })
      .catch(() => {});
  }
  return acc;
}

// Кнопка аккаунта: «Войти» с иконкой Telegram или аватарка с именем (по клику — выйти).
const TG = `<svg viewBox="0 0 24 24" fill="currentColor" width="15" height="15"><path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.3-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13.2 1.4 11.7c-1-.3-1-1 .2-1.5L20.6 2.9c.9-.3 1.6.2 1.3 1.4z"/></svg>`;
export function accountChipHTML(acc, lang = "en") {
  const u = acc?.user;
  if (!u) return `<button class="og-acc og-login" data-og="login" title="${tx(lang).one}">${TG}<span>${tx(lang).login}</span></button>`;
  const ava = u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : `<i>${esc((u.name || "?")[0])}</i>`;
  return `<button class="og-acc og-me" data-og="menu" title="${esc(u.name)}">${ava}<span>${esc(String(u.name || "").split(" ")[0])}</span></button>`;
}
export function bindAccountChip(root, acc, lang = "en") {
  root.querySelectorAll("[data-og]").forEach((b) => {
    b.onclick = () => {
      if (b.dataset.og === "login") return acc.login();
      if (confirm(`${tx(lang).out}?`)) acc.logout();
    };
  });
}

// Блок «Ещё наши игры» — все, кроме текущей.
export function promoHTML(current, lang = "en") {
  const L = pick(lang);
  const items = GAMES.filter((g) => g.id !== current).map((g) => `
    <a class="og-game" href="${g.url}${g.id === "countries" && L !== "en" ? (L === "sr" ? "/rs" : "/ru") : "/"}?from=${current}" style="--h:${g.hue}">
      <span class="og-emoji">${g.emoji}</span>
      <span class="og-txt"><b>${g[L].t}</b><small>${g[L].d}</small></span>
      <span class="og-go">›</span>
    </a>`).join("");
  return `<div class="og-promo"><div class="og-title">${tx(L).more}</div><div class="og-list">${items}</div></div>`;
}

// Стили модуля — вставляются один раз, используют токены страницы с запасными значениями.
const CSS = `
.og-acc { display:inline-flex; align-items:center; gap:7px; height:36px; padding:0 14px 0 12px; border-radius:999px; border:0; cursor:pointer;
  font:600 14px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif; transition:transform .16s; white-space:nowrap; }
.og-acc:active { transform:scale(.96); }
.og-login { background:#2aabee; color:#fff; box-shadow:0 1px 2px rgba(0,0,0,.06); }
.og-me { background:var(--surface,#fff); color:var(--text,#1d1d1f); padding-left:4px; box-shadow:var(--shadow-sm,0 1px 2px rgba(0,0,0,.06)); }
.og-me img, .og-me i { width:28px; height:28px; border-radius:50%; object-fit:cover; display:grid; place-items:center; font-style:normal; background:#2aabee; color:#fff; font-size:13px; }
.og-promo { margin-top:16px; text-align:left; }
.og-title { font-size:13px; font-weight:600; color:var(--text-2,#6e6e73); margin:0 4px 8px; }
.og-list { display:grid; gap:8px; }
.og-game { display:flex; align-items:center; gap:12px; padding:12px 14px; border-radius:18px; text-decoration:none; color:var(--text,#1d1d1f);
  background:linear-gradient(135deg, hsl(var(--h) 90% 55% / .12), hsl(var(--h) 90% 55% / .04)); transition:transform .16s; }
.og-game:active { transform:scale(.98); }
.og-emoji { width:44px; height:44px; border-radius:13px; display:grid; place-items:center; font-size:24px; flex:none;
  background:linear-gradient(135deg, hsl(var(--h) 90% 58%), hsl(calc(var(--h) + 25) 90% 48%)); box-shadow:0 6px 16px hsl(var(--h) 80% 45% / .3); }
.og-txt { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
.og-txt b { font-size:16px; font-weight:700; letter-spacing:-.01em; }
.og-txt small { font-size:13px; color:var(--text-2,#6e6e73); line-height:1.3; }
.og-go { font-size:24px; color:var(--text-3,#a1a1a6); }
`;
if (typeof document !== "undefined" && !document.getElementById("og-css")) {
  const s = document.createElement("style");
  s.id = "og-css";
  s.textContent = CSS;
  document.head.append(s);
}
