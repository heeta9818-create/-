// 도배 물량·금액 계산. 화면과 분리해서 이 파일만 보면 계산이 다 보이게 둔다.

export const PAPERS = {
  silk: { key: "silk", label: "실크벽지", w: 1.06, len: 15.6, price: 25000 },
  hapji: { key: "hapji", label: "합지벽지", w: 0.93, len: 17.5, price: 12000 },
};

export const PAPER_KEYS = ["silk", "hapji"];

const PYEONG = 3.305785; // 1평 = 3.305785㎡
const MARGIN = 0.1; // 폭마다 붙는 재단 여유 10cm

export function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function won(value) {
  return Math.round(value).toLocaleString("ko-KR") + "원";
}

export function paperOf(key) {
  return PAPERS[key] || PAPERS.silk;
}

// 한 면을 폭으로 나눈다. span = 붙여야 할 가로 길이(m), drop = 한 폭의 길이(m)
function splitRun(span, drop, paper) {
  if (span <= 0 || drop <= 0) return { strips: 0, perRoll: 0, remainder: 0 };
  const exact = span / paper.w;
  const strips = Math.ceil(exact);
  return {
    strips,
    perRoll: Math.max(1, Math.floor(paper.len / drop)),
    remainder: strips - exact, // 마지막 폭이 잘려 나가는 정도
  };
}

const NONE = { strips: 0, perRoll: 0, remainder: 0 };

// 폭으로 적은 방. "250x2" = 250cm 짜리 폭 2장.
// 적어둔 길이는 이미 재단해서 자를 길이로 본다(여유분을 또 붙이지 않는다).
function measureStrips(room, paper) {
  const groups = (room.groups || [])
    .map((g) => ({
      len: num(g.len),
      count: Math.floor(num(g.count)),
      part: g.part || "",
    }))
    .filter((g) => g.len > 0 && g.count > 0);

  let strips = 0;
  let rollsExact = 0;
  groups.forEach((g) => {
    strips += g.count;
    rollsExact += g.count / Math.max(1, Math.floor(paper.len / g.len));
  });

  return {
    paper,
    mode: "strips",
    groups,
    w: 0, d: 0, h: 0, cw: 0, cd: 0,
    area: 0, pyeong: 0, perimeter: 0,
    ceilArea: 0, ceilPyeong: 0,
    wall: { strips, perRoll: 0, remainder: 0 },
    ceiling: NONE,
    strips,
    rollsExact,
    // 벽지가 실제로 덮는 면적 (바닥 평이 아니다)
    paperArea: groups.reduce((sum, g) => sum + g.count * paper.w * g.len, 0),
    paperPyeong: groups.reduce((sum, g) => sum + g.count * paper.w * g.len, 0) / PYEONG,
  };
}

// 방 하나의 물량
export function measureRoom(room) {
  if (room.mode === "strips") return measureStrips(room, paperOf(room.paper));
  return measureSize(room);
}

function measureSize(room) {
  const paper = paperOf(room.paper);
  const w = num(room.w);
  const d = num(room.d);
  const h = num(room.h);

  const area = w * d;
  const pyeong = area / PYEONG;
  const perimeter = 2 * (w + d);

  // 천장은 따로 잰다. 비워두면 방 가로·세로를 그대로 쓴다
  // (우물천장, 확장 구간처럼 바닥과 다를 때를 위해 따로 받는다)
  const cw = num(room.cw) || w;
  const cd = num(room.cd) || d;

  const wall = room.walls === false ? NONE : splitRun(perimeter, h + MARGIN, paper);
  const ceiling = room.ceiling ? splitRun(cw, cd + MARGIN, paper) : NONE;

  // 롤은 방마다 올림하지 않는다. 남은 자투리는 다음 방에서 쓰므로
  // 소수로 쌓아뒀다가 현장 전체에서 한 번만 올린다.
  const rollsExact =
    (wall.perRoll ? wall.strips / wall.perRoll : 0) +
    (ceiling.perRoll ? ceiling.strips / ceiling.perRoll : 0);

  return {
    paper, mode: "size", groups: [], paperArea: 0, paperPyeong: 0,
    w, d, h, cw, cd, area, pyeong, perimeter,
    ceilArea: room.ceiling ? cw * cd : 0,
    ceilPyeong: room.ceiling ? (cw * cd) / PYEONG : 0,
    wall, ceiling,
    strips: wall.strips + ceiling.strips,
    rollsExact,
  };
}

// 현장 전체
export function summarize(state) {
  const rooms = (state.rooms || []).map((room) => ({ room, m: measureRoom(room) }));

  // 벽지 종류가 다르면 롤을 섞어 쓸 수 없으니 종류별로 모은다
  const buckets = {};
  rooms.forEach(({ m }) => {
    const key = m.paper.key;
    if (!buckets[key]) buckets[key] = { paper: m.paper, strips: 0, rollsExact: 0, rooms: 0 };
    buckets[key].strips += m.strips;
    buckets[key].rollsExact += m.rollsExact;
    if (m.strips > 0) buckets[key].rooms += 1;
  });

  const materials = PAPER_KEYS
    .filter((key) => buckets[key])
    .map((key) => {
      const b = buckets[key];
      const base = Math.ceil(b.rollsExact);
      const rolls = state.loss ? Math.ceil(b.rollsExact * 1.1) : base;
      const price = num(state.prices[key]);
      return { ...b, base, rolls, price, amount: rolls * price };
    })
    .filter((b) => b.rolls > 0);

  const material = materials.reduce((sum, b) => sum + b.amount, 0);
  const labor = num(state.labor);
  const extra = num(state.extra);
  const subtotal = material + labor + extra;
  const vat = state.vat ? subtotal * 0.1 : 0;

  return {
    rooms,
    materials,
    material,
    labor,
    extra,
    subtotal,
    vat,
    total: subtotal + vat,
    pyeong: rooms.reduce((sum, r) => sum + r.m.pyeong, 0),
    rollCount: materials.reduce((sum, b) => sum + b.rolls, 0),
    filledRooms: rooms.filter((r) => r.m.strips > 0).length,
    // 폭으로만 적은 견적이면 바닥 면적이 없다
    anyArea: rooms.some((r) => r.m.strips > 0 && r.m.pyeong > 0),
  };
}
