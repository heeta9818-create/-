"use client";

import { useState } from "react";

const PAPERS = {
  silk: {
    label: "실크벽지",
    widthM: 1.06,
    rollLenM: 15.6,
    rollPrice: 25000,
    labor: 25000,
  },
  hapji: {
    label: "합지벽지",
    widthM: 0.93,
    rollLenM: 17.5,
    rollPrice: 12000,
    labor: 15000,
  },
};

const PYEONG_M2 = 3.305785;
const CUT_MARGIN_M = 0.1; // 재단 여유 10cm

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function won(value) {
  return Math.round(value).toLocaleString("ko-KR") + "원";
}

function calculate(input) {
  const paper = PAPERS[input.paperKey];
  const w = num(input.width);
  const d = num(input.depth);
  const h = num(input.height);

  const floorArea = w * d;
  const pyeong = floorArea / PYEONG_M2;

  // 벽면: 둘레를 벽지 폭으로 나눠 필요한 '폭수'를 구한다
  const perimeter = 2 * (w + d);
  const wallStripLen = h + CUT_MARGIN_M;
  const wallStrips = Math.ceil(perimeter / paper.widthM);
  const wallStripsPerRoll = Math.max(1, Math.floor(paper.rollLenM / wallStripLen));
  const wallRolls = wallStrips > 0 ? Math.ceil(wallStrips / wallStripsPerRoll) : 0;

  // 천장: 가로 방향으로 폭을 붙이고, 한 폭 길이는 세로 길이
  let ceilStrips = 0;
  let ceilRolls = 0;
  if (input.ceiling && floorArea > 0) {
    const ceilStripLen = d + CUT_MARGIN_M;
    ceilStrips = Math.ceil(w / paper.widthM);
    const perRoll = Math.max(1, Math.floor(paper.rollLenM / ceilStripLen));
    ceilRolls = Math.ceil(ceilStrips / perRoll);
  }

  const baseRolls = wallRolls + ceilRolls;
  const rolls = input.loss ? Math.ceil(baseRolls * 1.1) : baseRolls;

  const material = rolls * num(input.rollPrice);
  const labor = pyeong * num(input.laborPerPyeong);
  const extra = pyeong * num(input.extraPerPyeong);
  const subtotal = material + labor + extra;
  const vat = subtotal * 0.1;

  return {
    pyeong,
    perimeter,
    wallStrips,
    wallRolls,
    ceilStrips,
    ceilRolls,
    rolls,
    material,
    labor,
    extra,
    subtotal,
    vat,
    total: subtotal + vat,
  };
}

export default function Home() {
  const [width, setWidth] = useState("3.6");
  const [depth, setDepth] = useState("3.0");
  const [height, setHeight] = useState("2.4");
  const [paperKey, setPaperKey] = useState("silk");
  const [ceiling, setCeiling] = useState(true);
  const [loss, setLoss] = useState(true);
  const [rollPrice, setRollPrice] = useState(String(PAPERS.silk.rollPrice));
  const [laborPerPyeong, setLaborPerPyeong] = useState(String(PAPERS.silk.labor));
  const [extraPerPyeong, setExtraPerPyeong] = useState("3000");

  function pickPaper(key) {
    setPaperKey(key);
    setRollPrice(String(PAPERS[key].rollPrice));
    setLaborPerPyeong(String(PAPERS[key].labor));
  }

  const r = calculate({
    width,
    depth,
    height,
    paperKey,
    ceiling,
    loss,
    rollPrice,
    laborPerPyeong,
    extraPerPyeong,
  });

  const paper = PAPERS[paperKey];

  return (
    <main className="wrap">
      <div className="header">
        <h1>도배 견적 계산기</h1>
        <p>방 크기만 넣으면 벽지 롤 수와 예상 금액이 바로 나옵니다.</p>
      </div>

      <section className="card">
        <h2>1. 방 크기</h2>
        <div className="row">
          <div className="field">
            <label>
              가로 <span className="hint">m</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              세로 <span className="hint">m</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              value={depth}
              onChange={(e) => setDepth(e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>
            천장 높이 <span className="hint">m · 보통 2.3~2.5</span>
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            value={height}
            onChange={(e) => setHeight(e.target.value)}
          />
        </div>
      </section>

      <section className="card">
        <h2>2. 벽지 종류</h2>
        <div className="seg">
          {Object.keys(PAPERS).map((key) => (
            <button
              key={key}
              type="button"
              className={key === paperKey ? "on" : ""}
              onClick={() => pickPaper(key)}
            >
              {PAPERS[key].label}
            </button>
          ))}
        </div>
        <p className="note" style={{ marginTop: 10 }}>
          폭 {Math.round(paper.widthM * 100)}cm · 1롤 {paper.rollLenM}m 기준
        </p>
      </section>

      <section className="card">
        <h2>3. 옵션</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={ceiling}
            onChange={(e) => setCeiling(e.target.checked)}
          />
          천장도 함께 시공
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={loss}
            onChange={(e) => setLoss(e.target.checked)}
          />
          여유분(로스) 10% 추가
        </label>
      </section>

      <section className="card">
        <h2>4. 단가 (직접 수정 가능)</h2>
        <div className="field">
          <label>
            벽지 1롤 단가 <span className="hint">원</span>
          </label>
          <input
            type="number"
            inputMode="numeric"
            step="1000"
            value={rollPrice}
            onChange={(e) => setRollPrice(e.target.value)}
          />
        </div>
        <div className="row">
          <div className="field">
            <label>
              시공비 <span className="hint">원/평</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="1000"
              value={laborPerPyeong}
              onChange={(e) => setLaborPerPyeong(e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              부자재 <span className="hint">원/평</span>
            </label>
            <input
              type="number"
              inputMode="numeric"
              step="500"
              value={extraPerPyeong}
              onChange={(e) => setExtraPerPyeong(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card result">
        <span className="badge">예상 견적</span>
        <h2>계산 결과</h2>
        <div className="line">
          <span>바닥 면적</span>
          <span>{r.pyeong.toFixed(1)}평</span>
        </div>
        <div className="line">
          <span>벽 둘레</span>
          <span>{r.perimeter.toFixed(1)}m</span>
        </div>
        <div className="line">
          <span>벽 폭수</span>
          <span>
            {r.wallStrips}폭 ({r.wallRolls}롤)
          </span>
        </div>
        {ceiling ? (
          <div className="line">
            <span>천장 폭수</span>
            <span>
              {r.ceilStrips}폭 ({r.ceilRolls}롤)
            </span>
          </div>
        ) : null}
        <div className="line">
          <span>필요 벽지</span>
          <span>{r.rolls}롤</span>
        </div>
        <div className="line">
          <span>자재비</span>
          <span>{won(r.material)}</span>
        </div>
        <div className="line">
          <span>시공비</span>
          <span>{won(r.labor)}</span>
        </div>
        <div className="line">
          <span>부자재</span>
          <span>{won(r.extra)}</span>
        </div>
        <div className="line">
          <span>부가세 (10%)</span>
          <span>{won(r.vat)}</span>
        </div>
        <div className="line total">
          <span>총 예상 금액</span>
          <span>{won(r.total)}</span>
        </div>
      </section>

      <section className="card">
        <p className="note">
          <b>계산 방법</b>
          <br />
          벽 둘레를 벽지 폭으로 나눠 필요한 폭수를 구하고, 1롤에서 몇 폭이
          나오는지로 롤 수를 계산합니다. 재단 여유는 폭당 10cm를 더합니다.
          <br />
          <br />
          <b>참고</b> — 문·창문 공제, 몰딩, 벽면 상태(곰팡이·단차), 계단·복도
          같은 현장 조건은 반영되지 않습니다. 실제 견적은 현장 확인 후
          달라질 수 있습니다.
        </p>
      </section>
    </main>
  );
}
