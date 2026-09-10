// ─────────────────────────────────────────────────────────────
// 견적을 통째로 주소(링크)에 담는다.
//
// 서버에 저장하지 않는다. 내용이 주소의 # 뒤에 들어가는데,
// # 뒤는 브라우저가 서버로 보내지 않으므로 고객 견적이 남의 서버를
// 거치지 않는다. 링크를 받은 사람 폰에서 바로 펼쳐진다.
// ─────────────────────────────────────────────────────────────

function b64url(bytes) {
  let raw = "";
  for (let i = 0; i < bytes.length; i++) raw += String.fromCharCode(bytes[i]);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(text) {
  const pad = text.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

// 자리를 아끼려고 이름표 없이 순서대로만 담는다
export function pack(shop, quote, issuedAt) {
  const rooms = quote.rooms
    .filter((r) => r.w || r.d)
    .map((r) => [
      r.name || "",
      r.w || "",
      r.d || "",
      r.h || "",
      r.cw || "",
      r.cd || "",
      r.ceiling ? 1 : 0,
      r.walls === false ? 0 : 1,
      r.paper === "hapji" ? 1 : 0,
    ]);

  return JSON.stringify([
    1,
    shop.name || "",
    shop.phone || "",
    quote.customer.name || "",
    quote.customer.site || "",
    quote.vat ? 1 : 0,
    quote.labor || "",
    quote.extra || "",
    quote.prices.silk || "",
    quote.prices.hapji || "",
    quote.loss ? 1 : 0,
    rooms,
    issuedAt || "",
  ]);
}

export function unpack(json) {
  const a = JSON.parse(json);
  if (!Array.isArray(a) || a[0] !== 1) throw new Error("모르는 형식입니다");

  return {
    shop: { name: a[1], phone: a[2] },
    issuedAt: a[12] || new Date().toISOString(),
    quote: {
      customer: { name: a[3], site: a[4] },
      vat: !!a[5],
      labor: a[6],
      extra: a[7],
      prices: { silk: a[8], hapji: a[9] },
      loss: !!a[10],
      rooms: (a[11] || []).map((r, i) => ({
        id: "q" + i,
        name: r[0],
        w: r[1],
        d: r[2],
        h: r[3],
        cw: r[4],
        cd: r[5],
        ceiling: !!r[6],
        walls: r[7] !== 0,
        paper: r[8] ? "hapji" : "silk",
      })),
    },
  };
}

/* ── 주소에 넣을 수 있는 글자로 ───────────── */

export async function toToken(json) {
  const bytes = new TextEncoder().encode(json);

  if (typeof CompressionStream !== "undefined") {
    try {
      const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate-raw"));
      const packed = new Uint8Array(await new Response(stream).arrayBuffer());
      if (packed.length < bytes.length) return "2" + b64url(packed);
    } catch (e) {
      /* 눌러 담기를 못 하면 그냥 담는다 */
    }
  }
  return "1" + b64url(bytes);
}

export async function fromToken(token) {
  const kind = token.slice(0, 1);
  const bytes = unb64url(token.slice(1));

  if (kind === "2") {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    const out = new Uint8Array(await new Response(stream).arrayBuffer());
    return new TextDecoder().decode(out);
  }
  if (kind === "1") return new TextDecoder().decode(bytes);
  throw new Error("모르는 형식입니다");
}

export async function makeLink(origin, shop, quote, issuedAt) {
  const token = await toToken(pack(shop, quote, issuedAt));
  return origin + "/q#" + token;
}
