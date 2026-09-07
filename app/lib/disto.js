// ─────────────────────────────────────────────────────────────
// 라이카 디스토(Leica DISTO) 레이저 측정기 블루투스 연결
//
// ★ 확인이 필요한 부분 ★
// 아래 UUID는 라이카가 공개한 DISTO BLE 규격으로 알려진 값이며,
// 이 코드를 쓴 환경에서는 실제 기기로 확인하지 못했습니다.
// 연결은 되는데 숫자가 안 들어오면 이 값을 고쳐야 합니다.
// 앱의 "측정기" 칸에 기기 이름과 찾은 서비스가 표시되니
// 그 내용을 그대로 알려주시면 맞춰 드릴 수 있습니다.
//
// 아이폰은 사파리가 Web Bluetooth를 지원하지 않아 동작하지 않습니다.
// supported() 가 false라 버튼 자체가 나타나지 않습니다.
// ─────────────────────────────────────────────────────────────

export const DISTO_SERVICE = "3ab10100-f831-4395-b29d-570977d5bf94";
export const DISTO_DISTANCE = "3ab10101-f831-4395-b29d-570977d5bf94";

// 위 값으로 못 찾을 때 같이 훑어볼 후보. 여기 없는 서비스는
// 브라우저 규칙상 접근 자체가 막히므로 진단에도 안 잡힙니다.
const EXTRA_SERVICES = [
  DISTO_SERVICE,
  "0000180a-0000-1000-8000-00805f9b34fb", // Device Information
  "0000180f-0000-1000-8000-00805f9b34fb", // Battery
];

export function supported() {
  return typeof navigator !== "undefined" && !!navigator.bluetooth;
}

// 측정값은 4바이트 실수(미터)로 온다고 알려져 있다.
// 길이가 다르면 앞 4바이트만 읽어 본다.
function readMetres(dataView) {
  if (!dataView || dataView.byteLength < 4) return null;
  const metres = dataView.getFloat32(0, true);
  if (!Number.isFinite(metres)) return null;
  // 방 치수로 말이 되는 범위만 받는다 (5cm ~ 200m)
  if (metres < 0.05 || metres > 200) return null;
  return metres;
}

export async function connectDisto({ onDistance, onStatus, onDisconnect }) {
  if (!supported()) throw new Error("이 브라우저는 블루투스를 지원하지 않습니다");

  onStatus("기기를 고르는 중…");

  const device = await navigator.bluetooth.requestDevice({
    filters: [{ services: [DISTO_SERVICE] }, { namePrefix: "DISTO" }, { namePrefix: "Leica" }],
    optionalServices: EXTRA_SERVICES,
  });

  const name = device.name || "이름 없는 기기";
  onStatus(name + " 연결 중…");

  device.addEventListener("gattserverdisconnected", () => onDisconnect(name));

  const server = await device.gatt.connect();

  let service;
  try {
    service = await server.getPrimaryService(DISTO_SERVICE);
  } catch (e) {
    // 규격이 다른 기기. 무엇이 잡히는지라도 알려준다.
    let found = [];
    try {
      const all = await server.getPrimaryServices();
      found = all.map((s) => s.uuid);
    } catch (e2) {
      /* 목록도 못 읽는 경우 */
    }
    server.disconnect();
    const err = new Error(
      name + " — 측정값 규격을 못 찾았습니다." +
      (found.length ? " 찾은 서비스: " + found.join(", ") : " 접근 가능한 서비스가 없습니다.")
    );
    err.deviceName = name;
    err.services = found;
    throw err;
  }

  const ch = await service.getCharacteristic(DISTO_DISTANCE);
  await ch.startNotifications();

  ch.addEventListener("characteristicvaluechanged", (event) => {
    const metres = readMetres(event.target.value);
    if (metres !== null) onDistance(metres);
  });

  onStatus(name);
  return {
    name,
    disconnect() {
      try {
        if (device.gatt.connected) device.gatt.disconnect();
      } catch (e) {
        /* 이미 끊긴 경우 */
      }
    },
  };
}

// 측정값을 받을 칸의 순서. 마지막 칸까지 채우면 멈춘다.
export function nextField(room, field) {
  const order = ["w", "d", "h"];
  if (room.ceiling) order.push("cw", "cd");
  const at = order.indexOf(field);
  if (at < 0 || at === order.length - 1) return null;
  return order[at + 1];
}

export const FIELD_LABEL = { w: "가로", d: "세로", h: "천장고", cw: "천장 가로", cd: "천장 세로" };
