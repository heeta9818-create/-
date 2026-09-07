// ─────────────────────────────────────────────────────────────
// 블루투스 레이저 측정기 연결 (브랜드 가리지 않고 시도)
//
// 브랜드마다 신호 규격이 다르고 표준이 없다. 그래서 특정 기기를
// 정해두는 대신, 붙은 기기가 내보내는 신호를 전부 열어놓고
// "방 치수로 말이 되는 숫자"가 나오는 곳을 찾아 그 자리를 기억한다.
//
// 한 번 찾아낸 기기는 이름으로 기억해서 다음부터 바로 붙는다.
//
// ── 안 되는 경우 (코드로 못 뚫는다) ──
// · 아이폰: 사파리가 Web Bluetooth를 지원하지 않음
// · 옛날 방식(Bluetooth Classic SPP) 측정기: 브라우저가 접근 불가
// · 아래 SERVICES 목록에 없는 규격: 브라우저 규칙상 열람 자체가 막힘
//   → 그럴 땐 앱 화면의 진단 내용을 보고 목록에 추가하면 된다
// ─────────────────────────────────────────────────────────────

const base = (n) => "0000" + n.toString(16).padStart(4, "0") + "-0000-1000-8000-00805f9b34fb";

// 브라우저는 여기 적힌 서비스만 열어준다. 넓게 잡아둔다.
export const SERVICES = [
  "3ab10100-f831-4395-b29d-570977d5bf94", // 라이카 디스토
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART (저가 BLE 모듈 다수)
  "0000fee7-0000-1000-8000-00805f9b34fb", // Telink 계열
  base(0xffe0), // HM-10 계열
  base(0xffe5),
  base(0xfff0), // CC2541 계열
  base(0xff10),
  base(0xffb0),
  base(0xfd00),
  base(0x180d),
  base(0x180a), // Device Information
  base(0x180f), // Battery
  base(0x1801),
];

const STORE_KEY = "dobae.meter";

export function supported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

/* ── 값 읽기 ───────────────────────────────── */

// 방 치수로 말이 되는 범위 (5cm ~ 200m)
const OK = (m) => Number.isFinite(m) && m >= 0.05 && m <= 200;

export const DECODER_LABEL = {
  text_m: "글자 (미터)",
  text_cm: "글자 (cm)",
  text_mm: "글자 (mm)",
  f32le: "소수 4바이트",
  u32le_mm: "정수 4바이트 (mm)",
  f32be: "소수 4바이트 (역순)",
  u16le_mm: "정수 2바이트 (mm)",
};

// 보내온 바이트가 통째로 읽을 수 있는 글자인지
function looksLikeText(view) {
  if (!view.byteLength) return false;
  for (let i = 0; i < view.byteLength; i++) {
    const b = view.getUint8(i);
    const printable = (b >= 32 && b < 127) || b === 9 || b === 10 || b === 13;
    if (!printable) return false;
  }
  return true;
}

// 한 묶음의 바이트를 여러 방식으로 읽어보고, 말이 되는 것만 추린다.
// 앞에 있는 것일수록 믿을 만하다.
export function decode(view) {
  const out = [];
  const add = (key, metres) => {
    if (OK(metres) && !out.some((c) => c.key === key)) out.push({ key, metres });
  };

  const isText = looksLikeText(view);
  let text = "";
  try {
    text = new TextDecoder().decode(view).trim();
  } catch (e) {
    /* 글자가 아닌 경우 */
  }
  const hit = text.match(/-?\d+(?:[.,]\d+)?/);
  const n = hit ? parseFloat(hit[0].replace(",", ".")) : NaN;

  // 글자 안에 단위가 적혀 있으면 그 말을 믿는다
  function fromText() {
    if (!Number.isFinite(n)) return;
    if (/mm|밀리/i.test(text)) {
      add("text_mm", n / 1000);
      add("text_m", n);
    } else if (/cm|센치|센티/i.test(text)) {
      add("text_cm", n / 100);
    } else {
      add("text_m", n);
      add("text_mm", n / 1000);
    }
  }

  if (isText) fromText();

  if (view.byteLength >= 4) {
    add("f32le", view.getFloat32(0, true));
    add("u32le_mm", view.getUint32(0, true) / 1000);
  }

  if (!isText) fromText();

  if (view.byteLength >= 4) add("f32be", view.getFloat32(0, false));

  // 2바이트 정수는 아무 값이나 그럴듯해 보여서 오해를 부른다.
  // 정말 2~3바이트만 오는 기기에서만 쓴다.
  if (view.byteLength >= 2 && view.byteLength <= 3) {
    add("u16le_mm", view.getUint16(0, true) / 1000);
  }

  return out;
}

/* ── 찾아낸 기기 기억하기 ──────────────────── */

function readProfiles() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch (e) {
    return {};
  }
}

export function getProfile(name) {
  return readProfiles()[name] || null;
}

export function saveProfile(name, profile) {
  try {
    const all = readProfiles();
    all[name] = profile;
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* 저장 못 해도 이번 연결은 그대로 쓴다 */
  }
}

export function forgetProfile(name) {
  try {
    const all = readProfiles();
    delete all[name];
    localStorage.setItem(STORE_KEY, JSON.stringify(all));
  } catch (e) {
    /* 무시 */
  }
}

/* ── 연결 ──────────────────────────────────── */

export async function connectMeter({ onDistance, onStatus, onFound, onDisconnect, relearn }) {
  if (!supported()) throw new Error("이 브라우저는 블루투스를 지원하지 않습니다");

  onStatus("기기를 고르세요");

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICES,
  });

  const name = device.name || "이름 없는 기기";
  onStatus(name + " 연결 중…");

  device.addEventListener("gattserverdisconnected", () => onDisconnect(name));

  const server = await device.gatt.connect();
  const services = await server.getPrimaryServices();

  if (!services.length) {
    server.disconnect();
    throw new Error(
      name + " — 열어볼 수 있는 신호가 없습니다. 옛날 방식(SPP) 측정기이거나 규격이 목록에 없습니다."
    );
  }

  // 기억해 둔 자리가 있으면 그것부터 쓴다
  const saved = relearn ? null : getProfile(name);

  const listening = []; // 진단용 목록
  let locked = saved ? { ...saved } : null;

  function handle(serviceUuid, charUuid, view) {
    const options = decode(view);
    if (!options.length) return;

    if (locked) {
      if (locked.char !== charUuid) return;
      const pick = options.find((o) => o.key === locked.decoder) || options[0];
      onDistance(pick.metres, { ...locked, decoder: pick.key, options });
      return;
    }

    // 아직 못 찾았으면 여기가 거리값 자리라고 보고 기억한다
    locked = { service: serviceUuid, char: charUuid, decoder: options[0].key };
    saveProfile(name, locked);
    onFound({ ...locked, name });
    onDistance(options[0].metres, { ...locked, options });
  }

  for (const service of services) {
    let chars = [];
    try {
      chars = await service.getCharacteristics();
    } catch (e) {
      continue;
    }
    for (const ch of chars) {
      const props = ch.properties;
      if (!props.notify && !props.indicate) continue;
      listening.push({ service: service.uuid, char: ch.uuid });
      try {
        await ch.startNotifications();
        ch.addEventListener("characteristicvaluechanged", (event) =>
          handle(service.uuid, ch.uuid, event.target.value)
        );
      } catch (e) {
        /* 이 신호는 못 여는 경우 — 다음 것으로 */
      }
    }
  }

  if (!listening.length) {
    server.disconnect();
    throw new Error(name + " — 값을 내보내는 신호가 없습니다. 이 측정기는 웹에서 지원되지 않습니다.");
  }

  onStatus("");

  return {
    name,
    listening,
    profile: locked,
    learned: !!saved,
    disconnect() {
      try {
        if (device.gatt.connected) device.gatt.disconnect();
      } catch (e) {
        /* 이미 끊긴 경우 */
      }
    },
  };
}

/* ── 칸 순서 ───────────────────────────────── */

export function nextField(room, field) {
  const order = room.walls === false ? [] : ["w", "d", "h"];
  if (room.ceiling) order.push("cw", "cd");
  const at = order.indexOf(field);
  if (at < 0 || at === order.length - 1) return null;
  return order[at + 1];
}

export const FIELD_LABEL = { w: "가로", d: "세로", h: "천장고", cw: "천장 가로", cd: "천장 세로" };
