// ─────────────────────────────────────────────────────────────
// 메모장에 적어둔 실측 내용을 그대로 붙여넣으면 방으로 만들어 준다.
//
// 이런 것들을 알아듣는다:
//   안방 3.6 x 3.0 x 2.4
//   작은방 3.6*3.0
//   거실 5m 4m 2.4m
//   안방 360 300 240        (100 넘으면 cm로 본다)
//   침실 3600 3000 2400     (1000 넘으면 mm로 본다)
//   방1 3.6 3.0
//   거실 5.0/4.0/2.4 실크
//   창고 3 2.5 천장제외
// ─────────────────────────────────────────────────────────────

const DEFAULT_HEIGHT = "2.4";

// 숫자 하나짜리 토큰인지 (단위가 붙어 있어도 된다)
const DIM = /^(\d+(?:[.,]\d+)?)\s*(mm|cm|m|미터|센치|센티|밀리)?$/i;

function toMetres(raw, unit) {
  const n = parseFloat(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;

  const u = (unit || "").toLowerCase();
  if (u === "mm" || u === "밀리") return n / 1000;
  if (u === "cm" || u === "센치" || u === "센티") return n / 100;
  if (u === "m" || u === "미터") return n;

  // 단위가 없으면 크기로 짐작한다
  if (n >= 1000) return n / 1000; // mm
  if (n >= 100) return n / 100; // cm
  return n; // m
}

function tidy(metres) {
  // 소수 둘째 자리까지, 뒤의 0은 떼고
  return String(Math.round(metres * 100) / 100);
}

function parseLine(line, index) {
  // "거실5.0", "안방360" 처럼 붙여 쓴 경우 떼어 준다.
  // "방1" 처럼 이름에 붙은 한 자리 숫자는 건드리지 않는다.
  const spaced = line.replace(/([가-힣A-Za-z])(?=\d+[.,]\d|\d{3,})/g, "$1 ");

  const tokens = spaced.split(/[\s,x*×/·|\-~]+/i).filter(Boolean);

  const dims = [];
  const words = [];
  tokens.forEach((token) => {
    const hit = token.match(DIM);
    if (hit) {
      const metres = toMetres(hit[1], hit[2]);
      if (metres !== null) {
        dims.push(metres);
        return;
      }
    }
    words.push(token);
  });

  if (!dims.length) return null;

  const text = line.replace(/\s+/g, "");
  const paper = /합지/.test(text) ? "hapji" : "silk";
  // 천장은 기본으로 포함한다. 빼라고 적혀 있을 때만 끈다.
  const ceilingOff = /천장(제외|뺌|빼고|없음|안함|X|x|엑스)|벽만|벽지만|벽면만/.test(text);
  const ceiling = !ceilingOff;

  // 이름에서 옵션 단어는 빼고 남은 것만 쓴다
  const name =
    words
      .filter((w) => !/^(천장.*|벽만|벽지만|벽면만|실크.*|합지.*|벽지|포함|제외|시공)$/.test(w))
      .join(" ")
      .trim() || "방 " + (index + 1);

  const room = {
    name,
    w: tidy(dims[0]),
    d: dims.length > 1 ? tidy(dims[1]) : "",
    h: dims.length > 2 ? tidy(dims[2]) : DEFAULT_HEIGHT,
    cw: dims.length > 3 ? tidy(dims[3]) : "",
    cd: dims.length > 4 ? tidy(dims[4]) : "",
    ceiling,
    paper,
  };

  // 천장 칸은 둘 다 있을 때만 의미가 있다
  if (!room.cw || !room.cd) {
    room.cw = "";
    room.cd = "";
  }

  return room;
}

export function parseMemo(text) {
  if (!text) return [];
  return String(text)
    .split(/[\n\r;]+/)
    .map((line, i) => parseLine(line.trim(), i))
    .filter(Boolean);
}

export const SAMPLE = `안방 3.6 x 3.0 x 2.4
작은방 3.2*2.7
거실 5m 4m 2.4m
주방 280 240 천장제외
현관 1.5 1.2 합지`;
