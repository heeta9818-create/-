"use client";

import { useEffect, useState } from "react";

const PAPERS = {
  silk: { label: "실크벽지", w: 1.06, len: 15.6, roll: 25000, labor: 25000 },
  hapji: { label: "합지벽지", w: 0.93, len: 17.5, roll: 12000, labor: 15000 },
};

const PYEONG = 3.305785;
const MARGIN = 0.1; // 폭당 재단 여유 (m)
const MAX_DRAW = 90; // 화면에 그리는 폭 수 상한
const STORE_KEY = "dobae.v1";

const DEFAULTS = {
  paper: "silk",
  w: "3.6",
  d: "3.0",
  h: "2.4",
  ceil: true,
  loss: true,
  pRoll: "25000",
  pLabor: "25000",
  pExtra: "3000",
};

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function won(value) {
  return Math.round(value).toLocaleString("ko-KR") + "원";
}

// 한 면을 폭으로 나눈다. span = 붙여야 할 가로 길이, drop = 한 폭의 길이
function splitRun(span, drop, paper) {
  if (span <= 0 || drop <= 0) {
    return { strips: 0, rolls: 0, perRoll: 0, remainder: 0, groups: [] };
  }
  const exact = span / paper.w;
  const strips = Math.ceil(exact);
  const remainder = strips - exact; // 마지막 폭이 잘리는 정도
  const perRoll = Math.max(1, Math.floor(paper.len / drop));
  const rolls = Math.ceil(strips / perRoll);

  const groups = [];
  for (let left = strips; left > 0; left -= perRoll) {
    groups.push(Math.min(perRoll, left));
  }
  return { strips, rolls, perRoll, remainder, groups };
}

function compute(state) {
  const paper = PAPERS[state.paper];
  const w = num(state.w);
  const d = num(state.d);
  const h = num(state.h);

  const pyeong = (w * d) / PYEONG;
  const perimeter = 2 * (w + d);

  const wall = splitRun(perimeter, h + MARGIN, paper);
  const ceiling = state.ceil ? splitRun(w, d + MARGIN, paper) : null;

  const base = wall.rolls + (ceiling ? ceiling.rolls : 0);
  const rolls = state.loss ? Math.ceil(base * 1.1) : base;

  const material = rolls * num(state.pRoll);
  const labor = pyeong * num(state.pLabor);
  const extra = pyeong * num(state.pExtra);
  const sub = material + labor + extra;
  const vat = sub * 0.1;

  return {
    paper, pyeong, perimeter, w, d, h,
    wall, ceiling, base, rolls,
    material, labor, extra, vat, total: sub + vat,
  };
}

function Run({ title, meta, run }) {
  const cells = [];
  let drawn = 0;

  for (let g = 0; g < run.groups.length && drawn < MAX_DRAW; g++) {
    const strips = [];
    for (let i = 0; i < run.groups[g] && drawn < MAX_DRAW; i++) {
      drawn++;
      const isLastCut = drawn === run.strips && run.remainder > 0.02;
      strips.push(
        <i key={i} className={isLastCut ? "strip part" : "strip"} />
      );
    }
    cells.push(
      <div className="roll" key={g}>
        <div className="roll-strips">{strips}</div>
        <div className="roll-tag">{g + 1}롤</div>
      </div>
    );
  }

  return (
    <div className="run">
      <div className="run-head">
        <span>
          {title} <b>{run.strips}폭</b>
        </span>
        <span>{meta}</span>
      </div>
      <div className="rolls">{cells}</div>
      {drawn < run.strips ? (
        <div className="roll-tag" style={{ textAlign: "left" }}>
          … 외 {run.strips - drawn}폭
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const [state, setState] = useState(DEFAULTS);

  // 저장값은 마운트 후에 읽는다 (서버 렌더 결과와 어긋나지 않게)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      setState((prev) => {
        const next = { ...prev };
        Object.keys(DEFAULTS).forEach((k) => {
          if (Object.prototype.hasOwnProperty.call(saved, k)) next[k] = saved[k];
        });
        return next;
      });
    } catch (e) {
      /* 저장을 못 읽어도 기본값으로 그냥 돈다 */
    }
  }, []);

  function update(patch) {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(next));
      } catch (e) {
        /* 저장 실패는 무시 */
      }
      return next;
    });
  }

  function pickPaper(key) {
    update({ paper: key, pRoll: String(PAPERS[key].roll), pLabor: String(PAPERS[key].labor) });
  }

  const c = compute(state);

  const costRows = [
    ["바닥 면적", c.pyeong.toFixed(1) + "평", null],
    ["자재비", won(c.material), c.rolls + "롤"],
    ["시공비", won(c.labor), c.pyeong.toFixed(1) + "평"],
    ["부자재", won(c.extra), "풀·초배지"],
    ["부가세", won(c.vat), "10%"],
  ];

  return (
    <div className="page">
      <header className="masthead">
        <div className="eyebrow">실크 · 합지 / 폭수 계산</div>
        <h1>도배 견적 계산기</h1>
        <p>방 치수를 재서 넣으면 필요한 폭수·롤 수와 예상 금액이 바로 나옵니다.</p>
      </header>

      <section className="panel">
        <div className="panel-title">방 치수</div>
        <div className="grid-3">
          <div className="field">
            <label htmlFor="w">
              가로 <span className="unit">M</span>
            </label>
            <input
              type="number" id="w" inputMode="decimal" step="0.1" min="0"
              value={state.w} onChange={(e) => update({ w: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="d">
              세로 <span className="unit">M</span>
            </label>
            <input
              type="number" id="d" inputMode="decimal" step="0.1" min="0"
              value={state.d} onChange={(e) => update({ d: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="h">
              천장고 <span className="unit">M</span>
            </label>
            <input
              type="number" id="h" inputMode="decimal" step="0.1" min="0"
              value={state.h} onChange={(e) => update({ h: e.target.value })}
            />
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">벽지</div>
        <div className="segmented" role="group" aria-label="벽지 종류">
          {Object.keys(PAPERS).map((key) => {
            const p = PAPERS[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={key === state.paper}
                onClick={() => pickPaper(key)}
              >
                {p.label}
                <span className="spec">
                  폭 {Math.round(p.w * 100)}cm · 1롤 {p.len}m
                </span>
              </button>
            );
          })}
        </div>
        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox" checked={state.ceil}
              onChange={(e) => update({ ceil: e.target.checked })}
            />
            천장도 시공
            <span className="sub">가로 방향 붙임</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox" checked={state.loss}
              onChange={(e) => update({ loss: e.target.checked })}
            />
            여유분 추가
            <span className="sub">+10%</span>
          </label>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">폭 나누기</div>
        <div className="diagram">
          {c.wall.strips === 0 ? (
            <div className="empty">방 치수를 넣으면 폭이 어떻게 나뉘는지 그려집니다.</div>
          ) : (
            <>
              <Run
                title="벽"
                meta={`둘레 ${c.perimeter.toFixed(1)}m ÷ 폭 ${c.paper.w}m · 1롤 ${c.wall.perRoll}폭`}
                run={c.wall}
              />
              {c.ceiling && c.ceiling.strips > 0 ? (
                <Run
                  title="천장"
                  meta={`가로 ${c.w.toFixed(1)}m ÷ 폭 ${c.paper.w}m · 1롤 ${c.ceiling.perRoll}폭`}
                  run={c.ceiling}
                />
              ) : null}
            </>
          )}
        </div>
        <div className="legend">
          <span>
            <i className="swatch full" /> 온전한 폭
          </span>
          <span>
            <i className="swatch part" /> 마지막 자투리 폭
          </span>
          <span>막대 한 칸 = 1폭</span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">견적</div>

        <div className="headline">
          <div className="n">
            {c.rolls}
            <span>롤</span>
          </div>
          <div className="cap">
            {state.loss && c.rolls > c.base
              ? `필요한 벽지 · 여유분 포함 (기본 ${c.base}롤)`
              : "필요한 벽지"}
          </div>
        </div>

        <div className="rows">
          {costRows.map(([k, v, note]) => (
            <div className="row" key={k}>
              <span className="k">
                {k}
                {note ? <em>{note}</em> : null}
              </span>
              <span className="v">{v}</span>
            </div>
          ))}
          <div className="row sum">
            <span className="k">총 예상 금액</span>
            <span className="v">{won(c.total)}</span>
          </div>
        </div>

        <details>
          <summary>단가 고치기</summary>
          <div className="price-body">
            <div className="field">
              <label htmlFor="pRoll">
                벽지 1롤 <span className="unit">원</span>
              </label>
              <input
                type="number" id="pRoll" inputMode="numeric" step="1000" min="0"
                value={state.pRoll} onChange={(e) => update({ pRoll: e.target.value })}
              />
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="pLabor">
                  시공비 <span className="unit">원/평</span>
                </label>
                <input
                  type="number" id="pLabor" inputMode="numeric" step="1000" min="0"
                  value={state.pLabor} onChange={(e) => update({ pLabor: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="pExtra">
                  부자재 <span className="unit">원/평</span>
                </label>
                <input
                  type="number" id="pExtra" inputMode="numeric" step="500" min="0"
                  value={state.pExtra} onChange={(e) => update({ pExtra: e.target.value })}
                />
              </div>
            </div>
          </div>
        </details>
      </section>

      <section className="panel notes">
        <h2>계산 방식</h2>
        <p>
          벽 둘레를 벽지 폭으로 나눠 <b>필요한 폭수</b>를 구하고, 1롤에서 몇 폭이 나오는지로{" "}
          <b>롤 수</b>를 냅니다. 한 폭마다 재단 여유 <code>10cm</code>를 더해 자릅니다. 천장은
          가로 방향으로 붙이고, 한 폭의 길이를 세로 치수로 잡습니다.
        </p>
        <p>
          <b>빠진 것</b> — 문·창문 공제, 몰딩, 벽면 상태(곰팡이·단차·석고 보수), 계단·복도처럼
          층고가 다른 구간, 걸레받이. 실제 견적은 현장을 보고 잡으셔야 합니다. 여기 나오는 금액은{" "}
          <b>현장 나가기 전 대략 잡는 용도</b>입니다.
        </p>
      </section>
    </div>
  );
}
