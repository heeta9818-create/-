"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ALTERNATIVES, FAQ, OURS } from "../lib/compare";
import { FEATURES, FREE_SAVE_LIMIT, PRO_PRICE, PRO_PRICE_YEAR } from "../lib/plan";
import { load, save } from "../lib/store";

function Mark({ value }) {
  if (value === true) return <span className="yes" aria-label="포함">●</span>;
  if (value === false || value === undefined) return <span className="no" aria-label="없음">–</span>;
  return <span className="txt">{value}</span>;
}

export default function Pricing() {
  const [plan, setPlan] = useState("free");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const d = load();
    setPlan(d.plan === "pro" ? "pro" : "free");
    setReady(true);
  }, []);

  function switchPlan(next) {
    const d = load();
    save({ ...d, plan: next });
    setPlan(next);
  }

  return (
    <div className="app pricing">
      <header className="masthead">
        <div>
          <h1>요금제</h1>
          <p className="sub">계산과 견적서는 무료입니다. 쌓아두실 때만 값을 받습니다.</p>
        </div>
        <Link className="ghost-btn" href="/">
          앱으로
        </Link>
      </header>

      <div className="plans">
        <section className={"plan" + (plan === "free" ? " on" : "")}>
          <div className="plan-top">
            <span className="label">무료</span>
            {plan === "free" && ready ? <span className="now">사용 중</span> : null}
          </div>
          <div className="price">
            0<span>원</span>
          </div>
          <p className="plan-say">현장에서 바로 쓰기에 부족함이 없습니다.</p>
          <ul className="ticks">
            <li>방 개수 제한 없이 계산</li>
            <li>견적서 PDF · 카카오톡 공유</li>
            <li>견적 저장 {FREE_SAVE_LIMIT}건</li>
          </ul>
        </section>

        <section className={"plan pro" + (plan === "pro" ? " on" : "")}>
          <div className="plan-top">
            <span className="label">프로</span>
            {plan === "pro" && ready ? <span className="now">사용 중</span> : null}
          </div>
          <div className="price">
            {PRO_PRICE.toLocaleString("ko-KR")}
            <span>원 / 월</span>
          </div>
          <p className="plan-say">
            1년에 {PRO_PRICE_YEAR.toLocaleString("ko-KR")}원으로 내시면 두 달치가 빠집니다.
          </p>
          <ul className="ticks">
            <li>견적 저장 제한 없음</li>
            <li>견적서에서 무료판 문구 제거</li>
            <li>무료판의 모든 기능 포함</li>
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <span className="label">무료와 프로 차이</span>
          <span className="rule" />
        </div>
        <div className="tbl-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th />
                <th>무료</th>
                <th>프로</th>
              </tr>
            </thead>
            {FEATURES.map((g) => (
              <tbody key={g.group}>
                <tr className="grp">
                  <th colSpan={3}>{g.group}</th>
                </tr>
                {g.items.map((f) => (
                  <tr key={f.name}>
                    <td>
                      {f.name}
                      {f.note ? <em>{f.note}</em> : null}
                    </td>
                    <td className="c">
                      <Mark value={f.free} />
                    </td>
                    <td className="c">
                      <Mark value={f.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <span className="label">지금 쓰시는 방법과 뭐가 다른가</span>
          <span className="rule" />
        </div>

        <div className="alt ours">
          <div className="alt-top">
            <b>{OURS.name}</b>
            <span className="role">{OURS.role}</span>
          </div>
          <ul>
            {OURS.facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>

        {ALTERNATIVES.map((a) => (
          <div className="alt" key={a.key}>
            <div className="alt-top">
              <b>{a.name}</b>
              <span className="role">{a.role}</span>
            </div>
            <ul>
              {a.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
              {a.verify ? <li>{a.verify}</li> : null}
            </ul>
          </div>
        ))}

        <p className="note">
          다른 서비스의 요금과 정책은 수시로 바뀝니다. 위 내용은 각 서비스가 <b>무엇을 하는
          곳인지</b>에 대한 설명이며, 금액 비교가 아닙니다. 실제 조건은 해당 서비스에서 직접
          확인해 주세요.
        </p>
      </section>

      <section className="card">
        <div className="card-head">
          <span className="label">자주 묻는 것</span>
          <span className="rule" />
        </div>
        <div className="faq">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <span className="label">결제</span>
          <span className="rule" />
        </div>
        <p className="note">
          아직 결제 창이 연결되어 있지 않습니다. 프로가 필요하시면 아래 버튼으로 먼저 켜서
          써보시고, 결제 수단이 붙는 대로 안내드리겠습니다.
        </p>
        <div className="plan-actions">
          <button
            type="button"
            className={"btn" + (plan === "pro" ? " quiet" : "")}
            onClick={() => switchPlan(plan === "pro" ? "free" : "pro")}
          >
            {plan === "pro" ? "무료로 되돌리기" : "프로 켜보기"}
          </button>
          <Link className="btn quiet" href="/">
            견적 내러 가기
          </Link>
        </div>
      </section>
    </div>
  );
}
