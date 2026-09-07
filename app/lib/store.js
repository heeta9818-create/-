// 이 브라우저 안에만 저장한다. 서버로 나가는 것은 없다.

const KEY = "dobae.v2";

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function emptyRoom(index) {
  return {
    id: newId(),
    name: index === 0 ? "안방" : "방 " + (index + 1),
    w: "",
    d: "",
    h: "2.4",
    ceiling: true,
    paper: "silk",
  };
}

export function blankQuote() {
  return {
    customer: { name: "", site: "" },
    // 첫 방은 아이디를 고정한다. 서버에서 그린 화면과 브라우저가 어긋나지 않게.
    rooms: [{ ...emptyRoom(0), id: "room-1", w: "3.6", d: "3.0" }],
    prices: { silk: "25000", hapji: "12000" },
    loss: true,
    labor: "",
    extra: "",
    vat: true,
  };
}

export function defaultData() {
  return {
    shop: { name: "", phone: "" },
    quote: blankQuote(),
    history: [],
  };
}

export function load() {
  const base = defaultData();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const saved = JSON.parse(raw);
    return {
      shop: { ...base.shop, ...(saved.shop || {}) },
      quote: {
        ...base.quote,
        ...(saved.quote || {}),
        customer: { ...base.quote.customer, ...((saved.quote || {}).customer || {}) },
        prices: { ...base.quote.prices, ...((saved.quote || {}).prices || {}) },
        rooms:
          Array.isArray((saved.quote || {}).rooms) && saved.quote.rooms.length
            ? saved.quote.rooms
            : base.quote.rooms,
      },
      history: Array.isArray(saved.history) ? saved.history : [],
    };
  } catch (e) {
    return base;
  }
}

export function save(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function quoteNo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const p = (n) => String(n).padStart(2, "0");
  return "" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}

export function formatDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate());
}
