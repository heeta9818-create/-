// ─────────────────────────────────────────────────────────────
// 견적서를 그림으로 찍어서 PDF / 사진 파일로 만들고, 그대로 공유한다.
//
// PDF 라이브러리를 쓰지 않는다. 한글이 들어간 PDF를 글자로 만들려면
// 한글 글꼴(수 MB)을 통째로 넣어야 해서 무겁고 잘 깨진다.
// 화면에 이미 잘 그려진 것을 그대로 찍어 넣는 편이 확실하다.
// ─────────────────────────────────────────────────────────────

const A4_WIDTH_PT = 595.28; // A4 가로 (72dpi 기준)

function latin1(text) {
  const out = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) out[i] = text.charCodeAt(i) & 0xff;
  return out;
}

// JPEG 한 장을 담은 가장 단순한 PDF를 손으로 짠다.
export function buildPdf(jpeg, pxWidth, pxHeight) {
  const pageW = A4_WIDTH_PT;
  const pageH = Math.round((A4_WIDTH_PT * pxHeight) / pxWidth * 100) / 100;

  const parts = [];
  const offsets = [];
  let length = 0;

  const put = (chunk) => {
    const bytes = typeof chunk === "string" ? latin1(chunk) : chunk;
    parts.push(bytes);
    length += bytes.length;
  };
  const mark = () => offsets.push(length);

  // 머리말. 두 번째 줄의 깨진 글자는 "이 파일은 글자가 아니라 이진 파일"이라는 표시다.
  put("%PDF-1.4\n%" + String.fromCharCode(0xe2, 0xe3, 0xcf, 0xd3) + "\n");

  mark();
  put("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  mark();
  put("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  mark();
  put(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + pageW + " " + pageH +
    "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );

  mark();
  put(
    "4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + pxWidth + " /Height " + pxHeight +
    " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length +
    " >>\nstream\n"
  );
  put(jpeg);
  put("\nendstream\nendobj\n");

  // 그림을 페이지 전체에 깔라는 지시
  const content = "q " + pageW + " 0 0 " + pageH + " 0 0 cm /Im0 Do Q\n";
  mark();
  put("5 0 obj\n<< /Length " + content.length + " >>\nstream\n" + content + "endstream\nendobj\n");

  // 각 덩어리가 파일 어디에 있는지 적은 목차
  const xrefAt = length;
  let xref = "xref\n0 " + (offsets.length + 1) + "\n0000000000 65535 f \n";
  offsets.forEach((at) => {
    xref += String(at).padStart(10, "0") + " 00000 n \n";
  });
  put(xref);
  put(
    "trailer\n<< /Size " + (offsets.length + 1) + " /Root 1 0 R >>\nstartxref\n" + xrefAt + "\n%%EOF\n"
  );

  const out = new Uint8Array(length);
  let at = 0;
  parts.forEach((p) => {
    out.set(p, at);
    at += p.length;
  });
  return out;
}

/* ── 화면 찍기 ─────────────────────────────── */

export async function captureSheet(element) {
  const html2canvas = (await import("html2canvas")).default;
  return html2canvas(element, {
    backgroundColor: "#ffffff",
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0,
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });
}

export function canvasBytes(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("그림을 만들지 못했습니다"));
          return;
        }
        blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
      },
      type,
      quality
    );
  });
}

/* ── 내보내기 ──────────────────────────────── */

export function safeName(text) {
  return String(text || "")
    .replace(/[\\/:*?"<>|\s]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}

// 공유창에 파일로 넘긴다. 안 되면 내려받는다.
export async function sendFile(bytes, name, type, title) {
  const file = new File([bytes], name, { type });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e && e.name === "AbortError") return "cancelled";
      // 공유가 막히면 내려받기로 넘어간다
    }
  }

  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}
