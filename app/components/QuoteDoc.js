"use client";

import { forwardRef } from "react";
import { won } from "../lib/calc";
import { FREE_MARK } from "../lib/plan";
import { formatDate, quoteNo } from "../lib/store";

// 견적서 종이 한 장. 앱 안에서도, 링크로 열었을 때도 같은 것을 쓴다.
const QuoteDoc = forwardRef(function QuoteDoc({ pro, shop, quote, summary, issuedAt }, ref) {
  const rooms = summary.rooms.filter((r) => r.m.strips > 0);

  function scope(room) {
    if (room.walls === false) return " (천장만)";
    return room.ceiling ? " (천장 포함)" : " (벽만)";
  }

  return (
    <div className="sheet" ref={ref}>
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
                    {scope(room)}
                  </td>
                  <td className="n">
                    {m.w} × {m.d} × {m.h}
                    {room.ceiling && (m.cw !== m.w || m.cd !== m.d) ? (
                      <>
                        <br />
                        <small>
                          천장 {m.cw} × {m.cd}
                        </small>
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
        본 견적은 제시한 치수를 기준으로 산출한 <b>예상 금액</b>입니다. 문·창문 공제, 몰딩, 벽면
        상태(곰팡이·단차·석고 보수), 걸레받이, 폐기물 처리는 포함되어 있지 않으며 현장 확인 후
        조정될 수 있습니다.
        {quote.vat ? " 금액은 부가세 포함가입니다." : " 금액은 부가세 별도입니다."}
      </p>

      {pro ? null : <div className="sheet-mark">{FREE_MARK}</div>}
    </div>
  );
});

export default QuoteDoc;
