"use client";

import { useEffect, useRef, useState } from "react";
import QuoteDoc from "./QuoteDoc";
import { makeLink } from "../lib/link";
import { buildPdf, canvasBytes, captureSheet, safeName, sendFile } from "../lib/sheetfile";
import { quoteNo } from "../lib/store";

export default function QuoteSheet({
  pro, shop, quote, summary, issuedAt, text, contact, onToast, onClose, onPrint,
}) {
  const [pickOpen, setPickOpen] = useState(false);
  const [why, setWhy] = useState("");
  const [busy, setBusy] = useState("");
  const [link, setLink] = useState("");
  const paper = useRef(null);

  // 인쇄할 때 앱 화면은 빼고 이 종이만 나가게 표시해 둔다
  useEffect(() => {
    document.body.classList.add("sheet-open");
    return () => document.body.classList.remove("sheet-open");
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // 견적서를 통째로 담은 주소를 미리 만들어 둔다
  useEffect(() => {
    let alive = true;
    makeLink(window.location.origin, shop, quote, issuedAt)
      .then((url) => alive && setLink(url))
      .catch(() => alive && setLink(""));
    return () => {
      alive = false;
    };
  }, [shop, quote, issuedAt]);

  const title = (shop.name ? shop.name + " " : "") + "도배 견적";
  const canSystemShare = typeof navigator !== "undefined" && !!navigator.share;

  // 문자에 넣을 짧은 글. 견적서는 링크로 연다.
  function noteWithLink() {
    const head = (shop.name ? "[" + shop.name + "] " : "") + "도배 견적서입니다.";
    const money = "총 " + summary.total.toLocaleString("ko-KR") + "원" +
      (quote.vat ? " (부가세 포함)" : " (부가세 별도)");
    const tail = shop.phone ? "\n문의 " + shop.phone : "";
    return head + "\n" + money + (link ? "\n" + link : "") + tail;
  }

  /* ── 보내기 ────────────────────────────── */

  async function systemShare(body) {
    try {
      await navigator.share({ title, text: body });
      setPickOpen(false);
    } catch (e) {
      if (e && e.name === "AbortError") return;
      setWhy("휴대폰 공유창이 열리지 않았습니다. 아래에서 골라 주세요.");
      setPickOpen(true);
    }
  }

  function smsTo(number, body) {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
    const to = (number || "").replace(/[^0-9+]/g, "");
    window.location.href = "sms:" + to + (ios ? "&" : "?") + "body=" + encodeURIComponent(body);
    setPickOpen(false);
  }

  // 앱 안 브라우저에서는 최신 복사가 막혀 있어 옛날 방식도 준비해 둔다
  function oldCopy(value) {
    try {
      const box = document.createElement("textarea");
      box.value = value;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      box.setSelectionRange(0, value.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(box);
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function copy(value, said) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
        onToast(said);
        setPickOpen(false);
        return;
      }
    } catch (e) {
      /* 다음 방법으로 */
    }
    if (oldCopy(value)) {
      onToast(said);
      setPickOpen(false);
    } else {
      setWhy("복사가 막혀 있습니다. 아래 글을 길게 눌러 복사해 주세요.");
    }
  }

  // 견적서를 그대로 찍어서 PDF나 사진 파일로 보낸다
  async function sendAs(kind) {
    if (busy) return;
    setWhy("");
    setBusy(kind === "pdf" ? "PDF를 만드는 중…" : "사진을 만드는 중…");
    try {
      const canvas = await captureSheet(paper.current);
      const stamp = quoteNo(issuedAt).replace("-", "_");
      const who = safeName(quote.customer.name || quote.customer.site) || "견적";
      let done;

      if (kind === "pdf") {
        const jpeg = await canvasBytes(canvas, "image/jpeg", 0.92);
        const pdf = buildPdf(jpeg, canvas.width, canvas.height);
        done = await sendFile(pdf, "견적서_" + who + "_" + stamp + ".pdf", "application/pdf", title);
      } else {
        const png = await canvasBytes(canvas, "image/png");
        done = await sendFile(png, "견적서_" + who + "_" + stamp + ".png", "image/png", title);
      }

      if (done === "shared") setPickOpen(false);
      else if (done === "downloaded") {
        onToast("파일로 내려받았습니다");
        setPickOpen(false);
      }
    } catch (e) {
      setWhy("파일을 만들지 못했습니다. 아래 '견적 링크 복사'를 써 주세요.");
      setPickOpen(true);
    } finally {
      setBusy("");
    }
  }

  function onShareTap() {
    setWhy("");
    setPickOpen(true);
  }

  const who = contact && contact.name ? contact.name : quote.customer.name;
  const phone = contact && contact.phone ? contact.phone : "";

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="견적서">
      <QuoteDoc
        ref={paper}
        pro={pro}
        shop={shop}
        quote={quote}
        summary={summary}
        issuedAt={issuedAt}
      />

      {pickOpen ? (
        <div className="picker no-print">
          {why ? <p className="picker-why">{why}</p> : null}
          {busy ? <p className="picker-busy">{busy}</p> : null}

          {phone ? (
            <button type="button" className="pick strong" onClick={() => smsTo(phone, noteWithLink())}>
              <b>{who || "고객"}님께 문자 보내기</b>
              <span>{phone} · 견적서 링크가 함께 갑니다</span>
            </button>
          ) : null}

          <button type="button" className="pick strong" disabled={!link} onClick={() => (canSystemShare ? systemShare(noteWithLink()) : copy(noteWithLink(), "복사했습니다. 카톡에 붙여넣으세요"))}>
            <b>견적서 링크 보내기</b>
            <span>{canSystemShare ? "카톡·문자 목록에서 고르기 · 눌러서 바로 열립니다" : "복사해서 카톡에 붙여넣으세요"}</span>
          </button>

          <div className="picker-split">파일로 보내기</div>

          <button type="button" className="pick" disabled={!!busy} onClick={() => sendAs("image")}>
            <b>사진으로 보내기</b>
            <span>카톡 대화창에서 바로 펼쳐 보입니다</span>
          </button>
          <button type="button" className="pick" disabled={!!busy} onClick={() => sendAs("pdf")}>
            <b>PDF로 보내기</b>
            <span>문서 파일. 받는 쪽에서 열어야 합니다</span>
          </button>

          <div className="picker-split">그 밖에</div>

          <button type="button" className="pick" disabled={!link} onClick={() => copy(link, "링크를 복사했습니다")}>
            <b>견적 링크만 복사</b>
            <span>어디든 붙여넣어 쓰세요</span>
          </button>
          <button type="button" className="pick" onClick={() => copy(text, "복사했습니다")}>
            <b>내용 글자로 복사</b>
            <span>견적 내용 전체를 글로</span>
          </button>

          <textarea className="picker-text" readOnly value={noteWithLink()} aria-label="보낼 내용" />

          <button type="button" className="pick quiet" onClick={() => setPickOpen(false)}>
            <b>닫기</b>
          </button>
        </div>
      ) : null}

      <div className="sheet-actions no-print">
        <button type="button" className="btn" onClick={onShareTap}>
          보내기
        </button>
        <button type="button" className="btn quiet" onClick={onPrint}>
          인쇄
        </button>
        <button type="button" className="btn quiet" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
