"use client";

import { useEffect, useState } from "react";
import { won } from "../lib/calc";
import { FREE_MARK } from "../lib/plan";
import { formatDate, quoteNo } from "../lib/store";

export default function QuoteSheet({ pro, shop, quote, summary, issuedAt, text, onToast, onClose, onPrint }) {
  const [pickOpen, setPickOpen] = useState(false);
  const [why, setWhy] = useState("");
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

  const rooms = summary.rooms.filter((r) => r.m.strips > 0);

  const title = (shop.name ? shop.name + " " : "") + "도배 견적";
  const canSystemShare = typeof navigator !== "undefined" && !!navigator.share;

  // 폰의 공유창(카톡·문자·인스타 목록)을 띄운다
  async function systemShare() {
    try {
      await navigator.share({ title, text });
      setPickOpen(false);
    } catch (e) {
      if (e && e.name === "AbortError") return; // 사용자가 공유창을 닫음
      setWhy("휴대폰 공유창이 열리지 않았습니다. 아래에서 골라 주세요.");
      setPickOpen(true);
    }
  }

  // 공유 버튼을 누르면 바로 공유창부터 시도하고, 안 되면 목록을 편다
  function onShareTap() {
    setWhy("");
    if (canSystemShare) {
      systemShare();
      return;
    }
    setWhy("이 브라우저에는 공유창이 없습니다. 카톡·인스타는 복사해서 붙여넣으세요.");
    setPickOpen(true);
  }

  function smsShare() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent || "");
    window.location.href = "sms:" + (ios ? "&" : "?") + "body=" + encodeURIComponent(text);
    setPickOpen(false);
  }

  // 앱 안 브라우저에서는 최신 복사 기능이 막혀 있어 옛날 방식도 준비해 둔다
  function oldCopy() {
    try {
      const box = document.createElement("textarea");
      box.value = text;
      box.setAttribute("readonly", "");
      box.style.position = "fixed";
      box.style.opacity = "0";
      document.body.appendChild(box);
      box.select();
      box.setSelectionRange(0, text.length);
      const ok = document.execCommand("copy");
      document.body.removeChild(box);
      return ok;
    } catch (e) {
      return false;
    }
  }

  async function copyText() {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        onToast("복사했습니다. 카톡에 붙여넣으세요");
        setPickOpen(false);
        return;
      }
    } catch (e) {
      /* 다음 방법으로 */
    }
    if (oldCopy()) {
      onToast("복사했습니다. 카톡에 붙여넣으세요");
      setPickOpen(false);
    } else {
      setWhy("복사가 막혀 있습니다. 아래 글을 길게 눌러 복사해 주세요.");
    }
  }

  return (
    <div className="scrim" role="dialog" aria-modal="true" aria-label="견적서">
      <div className="sheet">
        <div className="sheet-top">
          <h2 className="sheet-title">견 적 서</h2>
          <div className="sheet-shop">
            <div className="nm">{shop.name || "상호를 입력하세요"}</div>
            {shop.phone ? <div>{shop.phone}</div> : null}
          </div>
        </div>

        <dl className="sheet-meta">
          <div>
            <dt>고객명</dt>
            <dd>{quote.customer.name || "—"}</dd>
          </div>
          <div>
            <dt>견적일</dt>
            <dd>{formatDate(issuedAt)}</dd>
          </div>
          <div>
            <dt>현장</dt>
            <dd>{quote.customer.site || "—"}</dd>
          </div>
          <div>
            <dt>견적번호</dt>
            <dd>{quoteNo(issuedAt)}</dd>
          </div>
        </dl>

        <section>
          <h3>시공 범위</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>구분</th>
                  <th>크기 (m)</th>
                  <th className="n">면적</th>
                  <th className="n">벽지</th>
                  <th className="n">폭수</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map(({ room, m }) => (
                  <tr key={room.id}>
                    <td>
                      {room.name || "이름 없음"}
                      {room.walls === false
                        ? " (천장만)"
                        : room.ceiling
                          ? " (천장 포함)"
                          : " (벽만)"}
                    </td>
                    <td className="n">
                      {m.w} × {m.d} × {m.h}
                      {room.ceiling && (m.cw !== m.w || m.cd !== m.d) ? (
                        <>
                          <br />
                          <small>천장 {m.cw} × {m.cd}</small>
                        </>
                      ) : null}
                    </td>
                    <td className="n">{m.pyeong.toFixed(1)}평</td>
                    <td className="n">{m.paper.label}</td>
                    <td className="n">{m.strips}폭</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <b>합계 {rooms.length}개소</b>
                  </td>
                  <td className="n">
                    <b>{summary.pyeong.toFixed(1)}평</b>
                  </td>
                  <td className="n" />
                  <td className="n">
                    <b>{rooms.reduce((s, r) => s + r.m.strips, 0)}폭</b>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section>
          <h3>자재</h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>품목</th>
                  <th className="n">규격</th>
                  <th className="n">수량</th>
                  <th className="n">단가</th>
                  <th className="n">금액</th>
                </tr>
              </thead>
              <tbody>
                {summary.materials.map((b) => (
                  <tr key={b.paper.key}>
                    <td>{b.paper.label}</td>
                    <td className="n">
                      폭 {Math.round(b.paper.w * 100)}cm · {b.paper.len}m
                    </td>
                    <td className="n">{b.rolls}롤</td>
                    <td className="n">{b.price.toLocaleString("ko-KR")}</td>
                    <td className="n">{won(b.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="sheet-total">
          <div className="rows">
            <div className="row">
              <span className="k">
                자재비<em>{summary.rollCount}롤</em>
              </span>
              <span className="v">{won(summary.material)}</span>
            </div>
            {summary.labor > 0 ? (
              <div className="row">
                <span className="k">시공비</span>
                <span className="v">{won(summary.labor)}</span>
              </div>
            ) : null}
            {summary.extra > 0 ? (
              <div className="row">
                <span className="k">기타 비용</span>
                <span className="v">{won(summary.extra)}</span>
              </div>
            ) : null}
            {quote.vat ? (
              <>
                <div className="row">
                  <span className="k">공급가액</span>
                  <span className="v">{won(summary.subtotal)}</span>
                </div>
                <div className="row">
                  <span className="k">
                    부가세<em>10%</em>
                  </span>
                  <span className="v">{won(summary.vat)}</span>
                </div>
              </>
            ) : null}
            <div className="row grand">
              <span className="k">합계 금액</span>
              <span className="v">{won(summary.total)}</span>
            </div>
          </div>
        </section>

        <p className="sheet-foot">
          본 견적은 제시한 치수를 기준으로 산출한 <b>예상 금액</b>입니다. 문·창문 공제, 몰딩,
          벽면 상태(곰팡이·단차·석고 보수), 걸레받이, 폐기물 처리는 포함되어 있지 않으며 현장
          확인 후 조정될 수 있습니다.
          {quote.vat ? " 금액은 부가세 포함가입니다." : " 금액은 부가세 별도입니다."}
        </p>

        {pro ? null : <div className="sheet-mark">{FREE_MARK}</div>}
      </div>

      {pickOpen ? (
        <div className="picker no-print">
          {why ? <p className="picker-why">{why}</p> : null}
          {canSystemShare ? (
            <button type="button" className="pick" onClick={systemShare}>
              <b>휴대폰 공유창 열기</b>
              <span>카톡 · 문자 · 인스타 목록에서 고르기</span>
            </button>
          ) : null}
          <button type="button" className="pick" onClick={smsShare}>
            <b>문자로 보내기</b>
            <span>문자 앱이 내용과 함께 열립니다</span>
          </button>
          <button type="button" className="pick" onClick={copyText}>
            <b>내용 복사하기</b>
            <span>카톡·인스타에 붙여넣으세요</span>
          </button>
          <textarea className="picker-text" readOnly value={text} aria-label="견적 내용" />
          <button type="button" className="pick quiet" onClick={() => setPickOpen(false)}>
            <b>닫기</b>
          </button>
        </div>
      ) : null}

      <div className="sheet-actions no-print">
        <button type="button" className="btn" onClick={onPrint}>
          PDF로 저장
        </button>
        <button type="button" className="btn quiet" onClick={onShareTap}>
          공유하기
        </button>
        <button type="button" className="btn quiet" onClick={onClose}>
          닫기
        </button>
      </div>
    </div>
  );
}
