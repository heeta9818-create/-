"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import QuoteSheet from "./components/QuoteSheet";
import { FREE_SAVE_LIMIT, isPro } from "./lib/plan";
import {
  DECODER_LABEL, FIELD_LABEL, connectMeter, forgetProfile, nextField,
  supported as btSupported,
} from "./lib/meter";
import { SAMPLE, parseMemo } from "./lib/parse";
import { PAPERS, PAPER_KEYS, summarize, won } from "./lib/calc";
import { blankQuote, defaultData, emptyRoom, formatDate, load, newId, save } from "./lib/store";

export default function Home() {
  const [data, setData] = useState(defaultData);
  const [ready, setReady] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [sheetAt, setSheetAt] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // 레이저 측정기 (안드로이드·PC 크롬에서만 나타난다)
  const [btOk, setBtOk] = useState(false);
  const [bt, setBt] = useState(null); // 연결되면 { name, disconnect }
  const [btMsg, setBtMsg] = useState("");
  const [meter, setMeter] = useState(null); // { profile, listening, learned }
  const [aim, setAim] = useState(null); // { roomId, field }

  // 메모장 붙여넣기
  const [memoOpen, setMemoOpen] = useState(false);
  const [memoText, setMemoText] = useState("");
  const memoBackup = useRef(null); // 붙여넣기 전 방 목록
  const aimRef = useRef(null);
  const dataRef = useRef(null);
  const btRef = useRef(null);

  // 저장된 값은 화면이 뜬 뒤에 읽는다
  useEffect(() => {
    setData(load());
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) save(data);
  }, [data, ready]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => setBtOk(btSupported()), []);
  useEffect(() => { aimRef.current = aim; }, [aim]);
  useEffect(() => { dataRef.current = data; }, [data]);
  useEffect(() => { btRef.current = bt; }, [bt]);
  useEffect(() => () => { if (btRef.current) btRef.current.disconnect(); }, []);

  function say(message) {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }

  const { shop, quote, history } = data;
  const summary = summarize(quote);
  const pro = isPro(data);
  const saveFull = !pro && history.length >= FREE_SAVE_LIMIT;

  /* ── 상태 바꾸기 ─────────────────────────── */

  const setShop = (patch) => setData((d) => ({ ...d, shop: { ...d.shop, ...patch } }));
  const setQuote = (patch) => setData((d) => ({ ...d, quote: { ...d.quote, ...patch } }));
  const setCustomer = (patch) =>
    setData((d) => ({ ...d, quote: { ...d.quote, customer: { ...d.quote.customer, ...patch } } }));
  const setPrice = (key, value) =>
    setData((d) => ({ ...d, quote: { ...d.quote, prices: { ...d.quote.prices, [key]: value } } }));

  const patchRoom = (id, patch) =>
    setData((d) => ({
      ...d,
      quote: { ...d.quote, rooms: d.quote.rooms.map((r) => (r.id === id ? { ...r, ...patch } : r)) },
    }));

  const addRoom = () => setQuote({ rooms: [...quote.rooms, emptyRoom(quote.rooms.length)] });

  const removeRoom = (id) => {
    const rest = quote.rooms.filter((r) => r.id !== id);
    setQuote({ rooms: rest.length ? rest : [emptyRoom(0)] });
  };

  /* ── 견적 보관 ───────────────────────────── */

  function saveQuote() {
    if (saveFull) {
      say("무료판은 " + FREE_SAVE_LIMIT + "건까지 저장됩니다");
      return;
    }
    const entry = {
      id: newId(),
      savedAt: new Date().toISOString(),
      name: quote.customer.name || "이름 없는 견적",
      site: quote.customer.site,
      total: summary.total,
      quote: JSON.parse(JSON.stringify(quote)),
    };
    setData((d) => ({ ...d, history: [entry, ...d.history].slice(0, 50) }));
    say("견적을 저장했습니다");
  }

  function openSaved(entry) {
    setData((d) => ({ ...d, quote: JSON.parse(JSON.stringify(entry.quote)) }));
    say("불러왔습니다");
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function dropSaved(id) {
    setData((d) => ({ ...d, history: d.history.filter((h) => h.id !== id) }));
  }

  function startNew() {
    setData((d) => ({ ...d, quote: { ...blankQuote(), prices: d.quote.prices } }));
    say("새 견적을 시작합니다");
  }

  /* ── 내보내기 ────────────────────────────── */

  function shareText() {
    const lines = [];
    if (shop.name) lines.push("[" + shop.name + "] 도배 견적");
    else lines.push("도배 견적");
    if (quote.customer.name) lines.push("고객: " + quote.customer.name);
    if (quote.customer.site) lines.push("현장: " + quote.customer.site);
    lines.push("");
    summary.rooms
      .filter((r) => r.m.strips > 0)
      .forEach(({ room, m }) => {
        const ceilNote =
          room.walls === false
            ? " (천장만)"
            : room.ceiling
              ? m.cw !== m.w || m.cd !== m.d
                ? " (천장 " + m.cw + "×" + m.cd + ")"
                : " (천장 포함)"
              : " (벽만)";
        lines.push(
          "· " + (room.name || "방") + " " + m.w + "×" + m.d + "×" + m.h +
          " / " + m.pyeong.toFixed(1) + "평" + ceilNote
        );
      });
    lines.push("");
    summary.materials.forEach((b) => {
      lines.push(b.paper.label + " " + b.rolls + "롤 — " + won(b.amount));
    });
    if (summary.labor > 0) lines.push("시공비 — " + won(summary.labor));
    if (summary.extra > 0) lines.push("기타 비용 — " + won(summary.extra));
    lines.push("");
    lines.push("합계 " + won(summary.total) + (quote.vat ? " (부가세 포함)" : " (부가세 별도)"));
    if (shop.phone) lines.push("문의 " + shop.phone);
    return lines.join("\n");
  }

  async function shareQuote() {
    const text = shareText();
    const title = (shop.name ? shop.name + " " : "") + "도배 견적";
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return;
      }
    } catch (e) {
      return; // 사용자가 공유창을 닫은 경우
    }
    try {
      await navigator.clipboard.writeText(text);
      say("견적 내용을 복사했습니다");
    } catch (e) {
      say("공유를 지원하지 않는 환경입니다");
    }
  }

  function printSheet() {
    if (typeof window !== "undefined") window.print();
  }

  /* ── 레이저 측정기 ───────────────────────── */

  // 측정기에서 값이 하나 올 때마다 조준한 칸을 채우고 다음 칸으로 넘어간다
  function onDistance(metres, info) {
    if (info) setMeter((m) => (m ? { ...m, profile: info } : m));
    const target = aimRef.current;
    if (!target) return;
    const current = dataRef.current;
    if (!current) return;
    const room = current.quote.rooms.find((r) => r.id === target.roomId);
    if (!room) return;

    const value = metres.toFixed(2);
    patchRoom(target.roomId, { [target.field]: value });
    say(FIELD_LABEL[target.field] + " " + value + "m");

    const next = nextField(room, target.field);
    setAim(next ? { roomId: target.roomId, field: next } : null);
  }

  async function linkMeter(relearn) {
    setBtMsg("");
    try {
      const conn = await connectMeter({
        relearn,
        onDistance,
        onStatus: (m) => setBtMsg(m),
        onFound: (profile) => say("측정값 위치를 찾았습니다"),
        onDisconnect: (name) => {
          setBt(null);
          setMeter(null);
          setAim(null);
          setBtMsg(name + " 연결이 끊겼습니다");
        },
      });
      setBt(conn);
      setMeter({ profile: conn.profile, listening: conn.listening, learned: conn.learned });
      setBtMsg("");
      say(conn.name + " 연결됨");
    } catch (e) {
      setBt(null);
      setMeter(null);
      // 기기 선택창을 그냥 닫은 경우는 조용히 넘어간다
      if (e && e.name === "NotFoundError") {
        setBtMsg("");
        return;
      }
      setBtMsg((e && e.message) || "연결하지 못했습니다");
    }
  }

  function unlinkMeter() {
    if (bt) bt.disconnect();
    setBt(null);
    setMeter(null);
    setAim(null);
    setBtMsg("");
  }

  function relearnMeter() {
    if (bt) {
      forgetProfile(bt.name);
      bt.disconnect();
    }
    setBt(null);
    setMeter(null);
    setAim(null);
    say("기억을 지웠습니다. 다시 연결해 주세요");
  }

  /* ── 메모장 붙여넣기 ─────────────────────── */

  // 붙여넣는 즉시 방 목록에 반영한다. 버튼을 한 번 더 누르게 하지 않는다.
  function onMemoChange(text) {
    setMemoText(text);
    const parsed = parseMemo(text);
    if (!parsed.length) return;

    // 처음 반영할 때 원래 방 목록을 챙겨둔다 (되돌리기용)
    if (memoBackup.current === null) memoBackup.current = quote.rooms;

    setQuote({
      rooms: parsed.map((r, i) => ({ ...emptyRoom(0), ...r, id: "memo-" + i })),
    });
  }

  function undoMemo() {
    if (!memoBackup.current) return;
    setQuote({ rooms: memoBackup.current });
    memoBackup.current = null;
    setMemoText("");
    say("되돌렸습니다");
  }

  function toggleMemo() {
    setMemoOpen((open) => {
      if (open) memoBackup.current = null; // 닫으면 그대로 확정
      return !open;
    });
  }

  function aimAt(roomId, field) {
    setAim((cur) =>
      cur && cur.roomId === roomId && cur.field === field ? null : { roomId, field }
    );
  }

  const canQuote = summary.filledRooms > 0;
  const memoPreview = memoOpen ? parseMemo(memoText) : [];
  const ceilingRooms = summary.rooms.filter((r) => r.room.ceiling && r.m.strips > 0).length;

  /* ── 화면 ────────────────────────────────── */

  return (
    <>
      <div className="app">
        <header className="masthead">
          <div>
            <h1>도배 견적</h1>
            <p className="sub">방을 하나씩 넣으면 전체를 한 번에 계산합니다.</p>
          </div>
          <div className="head-actions">
            <button type="button" className="ghost-btn" onClick={() => setShowShop((v) => !v)}>
              {showShop ? "닫기" : "내 상호"}
            </button>
            <Link className="ghost-btn" href="/pricing">
              {pro ? "프로" : "요금제"}
            </Link>
          </div>
        </header>

        {showShop ? (
          <section className="card">
            <div className="card-head">
              <span className="label">견적서에 찍힐 정보</span>
              <span className="rule" />
            </div>
            <div className="grid2">
              <label className="field">
                <span>상호</span>
                <input
                  className="in" type="text" placeholder="○○도배"
                  value={shop.name} onChange={(e) => setShop({ name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>연락처</span>
                <input
                  className="in" type="tel" placeholder="010-0000-0000"
                  value={shop.phone} onChange={(e) => setShop({ phone: e.target.value })}
                />
              </label>
            </div>
            <p className="note">한 번만 넣어두면 계속 쓰입니다.</p>
          </section>
        ) : null}

        <section className="card">
          <div className="card-head">
            <span className="label">현장</span>
            <span className="rule" />
            <button type="button" className="mini" onClick={startNew}>
              새 견적
            </button>
          </div>
          <div className="grid2">
            <label className="field">
              <span>고객명</span>
              <input
                className="in" type="text" placeholder="홍길동"
                value={quote.customer.name} onChange={(e) => setCustomer({ name: e.target.value })}
              />
            </label>
            <label className="field">
              <span>현장</span>
              <input
                className="in" type="text" placeholder="○○아파트 101동"
                value={quote.customer.site} onChange={(e) => setCustomer({ site: e.target.value })}
              />
            </label>
          </div>
        </section>

        {btOk ? (
          <section className="card">
            <div className="card-head">
              <span className="label">레이저 측정기</span>
              {bt ? <span className="count">연결됨</span> : null}
              <span className="rule" />
            </div>
            <div className="bt-row">
              <span className="bt-name">{bt ? bt.name : "블루투스 측정기 (브랜드 무관)"}</span>
              <button type="button" className="mini" onClick={bt ? unlinkMeter : () => linkMeter(false)}>
                {bt ? "연결 끊기" : "연결하기"}
              </button>
            </div>

            {btMsg ? <p className="bt-msg">{btMsg}</p> : null}

            {bt && meter ? (
              <div className="bt-state">
                {meter.profile ? (
                  <>
                    <span className="ok">
                      측정값 위치 {meter.learned ? "기억해 둔 것 사용" : "찾음"}
                      {meter.profile.decoder ? " · " + DECODER_LABEL[meter.profile.decoder] : ""}
                    </span>
                    <button type="button" className="mini" onClick={relearnMeter}>
                      값이 이상해요
                    </button>
                  </>
                ) : (
                  <span className="hunting">
                    측정기 버튼을 한 번 눌러 주세요. 어느 신호가 거리값인지 찾습니다.
                    {meter.listening ? " (" + meter.listening.length + "개 신호 감시 중)" : ""}
                  </span>
                )}
              </div>
            ) : null}

            <p className="note">
              {bt
                ? "방 카드에서 채울 칸을 누른 뒤 측정기 버튼을 누르면 숫자가 들어갑니다. 한 칸이 차면 다음 칸으로 자동으로 넘어갑니다."
                : "브랜드를 가리지 않고 붙여 봅니다. 측정기 전원과 블루투스를 켜고 연결하기를 누른 뒤, 측정기 버튼을 한 번 누르면 앱이 거리값을 찾아냅니다. 처음에는 꼭 줄자와 맞춰보세요."}
            </p>
          </section>
        ) : null}

        <section className="card">
          <div className="card-head">
            <span className="label">방 목록</span>
            <span className="count">{quote.rooms.length}개</span>
            <span className="rule" />
            <button type="button" className="mini" onClick={toggleMemo}>
              {memoOpen ? "닫기" : "메모 붙여넣기"}
            </button>
          </div>

          {memoOpen ? (
            <div className="memo">
              <textarea
                className="in memo-in"
                rows={5}
                placeholder={SAMPLE}
                value={memoText}
                onChange={(e) => onMemoChange(e.target.value)}
                aria-label="메모 붙여넣기"
              />
              {memoText.trim() ? (
                memoPreview.length ? (
                  <>
                    <div className="memo-out">
                      <span className="sub-lead">읽은 방 {memoPreview.length}개</span>
                      {memoPreview.map((r, i) => (
                        <span className="memo-line" key={i}>
                          <b>{r.name}</b> {r.w}×{r.d || "?"}×{r.h}
                          {r.walls === false
                            ? " · 천장만"
                            : r.ceiling
                              ? r.cw
                                ? " · 천장 " + r.cw + "×" + r.cd
                                : " · 천장 포함"
                              : " · 벽만"}
                          {r.paper === "hapji" ? " · 합지" : ""}
                        </span>
                      ))}
                    </div>

                    <div className="memo-sum">
                      <div className="memo-sum-row">
                        <span>{summary.filledRooms}개소 · {summary.pyeong.toFixed(1)}평</span>
                        <span>
                          {ceilingRooms > 0 ? "천장 " + ceilingRooms + "개소 포함" : "천장 없음"}
                        </span>
                      </div>
                      <div className="memo-sum-row rolls">
                        {summary.materials.length ? (
                          summary.materials.map((b) => (
                            <span key={b.paper.key}>
                              {b.paper.label} <b>{b.rolls}롤</b>
                            </span>
                          ))
                        ) : (
                          <span>벽지 —</span>
                        )}
                      </div>
                      <div className="memo-sum-total">
                        <span>예상 금액{quote.vat ? " (부가세 포함)" : ""}</span>
                        <b>{won(summary.total)}</b>
                      </div>
                    </div>

                    {memoBackup.current ? (
                      <button type="button" className="btn quiet" onClick={undoMemo}>
                        붙여넣기 전으로 되돌리기
                      </button>
                    ) : null}
                  </>
                ) : (
                  <p className="bt-msg">치수를 못 찾았습니다. 숫자가 들어간 줄이 있는지 봐주세요.</p>
                )
              ) : (
                <p className="note">
                  메모장 내용을 그대로 붙여넣으면 <b>바로 아래에 견적이 나옵니다.</b> 따로 누를
                  버튼은 없습니다. <code>안방 3.6 x 3.0 x 2.4</code> 같은 줄을 알아서 읽고,
                  cm·mm도 알아서 바꿉니다. <b>천장은 기본으로 포함</b>하며, 빼려면 줄 끝에{" "}
                  <code>천장제외</code>라고 적으세요.
                </p>
              )}
            </div>
          ) : null}

          <div className="rooms">
            {summary.rooms.map(({ room, m }) => (
              <div className="room" key={room.id}>
                <div className="room-top">
                  <input
                    className="room-name" type="text" placeholder="방 이름"
                    aria-label="방 이름"
                    value={room.name} onChange={(e) => patchRoom(room.id, { name: e.target.value })}
                  />
                  <button
                    type="button" className="icon-btn"
                    aria-label={(room.name || "방") + " 삭제"}
                    onClick={() => removeRoom(room.id)}
                  >
                    ✕
                  </button>
                </div>

                <div className="grid3">
                  <label className="field">
                    <span>가로 <i>M</i></span>
                    <input
                      className="in num" type="number" inputMode="decimal" step="0.1" min="0"
                      placeholder="0" value={room.w}
                      onChange={(e) => patchRoom(room.id, { w: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>세로 <i>M</i></span>
                    <input
                      className="in num" type="number" inputMode="decimal" step="0.1" min="0"
                      placeholder="0" value={room.d}
                      onChange={(e) => patchRoom(room.id, { d: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>천장고 <i>M</i></span>
                    <input
                      className="in num" type="number" inputMode="decimal" step="0.1" min="0"
                      placeholder="2.4" value={room.h}
                      onChange={(e) => patchRoom(room.id, { h: e.target.value })}
                    />
                  </label>
                </div>

                <div className="room-opts">
                  {PAPER_KEYS.map((key) => (
                    <button
                      key={key} type="button" className="chip"
                      aria-pressed={room.paper === key}
                      onClick={() => patchRoom(room.id, { paper: key })}
                    >
                      {PAPERS[key].label}
                    </button>
                  ))}
                  <span className="chip-gap" />
                  <button
                    type="button" className="chip"
                    aria-pressed={room.walls !== false}
                    onClick={() => patchRoom(room.id, { walls: room.walls === false })}
                  >
                    벽
                  </button>
                  <button
                    type="button" className="chip"
                    aria-pressed={!!room.ceiling}
                    onClick={() => patchRoom(room.id, { ceiling: !room.ceiling })}
                  >
                    천장
                  </button>
                </div>

                {room.ceiling ? (
                  <div className="sub-grid">
                    <span className="sub-lead">천장</span>
                    <label className="field">
                      <span>가로 <i>M</i></span>
                      <input
                        className="in num" type="number" inputMode="decimal" step="0.1" min="0"
                        placeholder={room.w || "방과 같음"} value={room.cw || ""}
                        onChange={(e) => patchRoom(room.id, { cw: e.target.value })}
                      />
                    </label>
                    <label className="field">
                      <span>세로 <i>M</i></span>
                      <input
                        className="in num" type="number" inputMode="decimal" step="0.1" min="0"
                        placeholder={room.d || "방과 같음"} value={room.cd || ""}
                        onChange={(e) => patchRoom(room.id, { cd: e.target.value })}
                      />
                    </label>
                  </div>
                ) : null}

                {bt ? (
                  <div className="aim-row">
                    <span className="sub-lead">조준</span>
                    {(room.walls === false ? [] : ["w", "d", "h"])
                      .concat(room.ceiling ? ["cw", "cd"] : [])
                      .map((f) => (
                      <button
                        key={f} type="button" className="chip"
                        aria-pressed={!!aim && aim.roomId === room.id && aim.field === f}
                        onClick={() => aimAt(room.id, f)}
                      >
                        {FIELD_LABEL[f]}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="room-out">
                  {m.strips > 0 ? (
                    <>
                      <span>바닥 {m.pyeong.toFixed(1)}평</span>
                      <span>둘레 {m.perimeter.toFixed(1)}m</span>
                      {m.wall.strips > 0 ? (
                        <span>
                          벽 <b>{m.wall.strips}폭</b>
                        </span>
                      ) : (
                        <span className="none">벽 제외</span>
                      )}
                      {m.ceiling.strips > 0 ? (
                        <span>
                          천장 {m.cw}×{m.cd} <b>{m.ceiling.strips}폭</b>
                        </span>
                      ) : null}
                      <span>약 <b>{m.rollsExact.toFixed(1)}롤</b></span>
                    </>
                  ) : (
                    <span className="none">치수를 넣으면 물량이 나옵니다</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className="add-room" onClick={addRoom}>
            ＋ 방 추가
          </button>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="label">벽지 단가</span>
            <span className="rule" />
          </div>
          <div className="grid2">
            {PAPER_KEYS.map((key) => (
              <label className="field" key={key}>
                <span>
                  {PAPERS[key].label} <i>원/롤</i>
                </span>
                <input
                  className="in num" type="number" inputMode="numeric" step="1000" min="0"
                  value={quote.prices[key]} onChange={(e) => setPrice(key, e.target.value)}
                />
              </label>
            ))}
          </div>
          <label className="check">
            <input
              type="checkbox" checked={quote.loss}
              onChange={(e) => setQuote({ loss: e.target.checked })}
            />
            여유분 추가
            <span className="tail">+10%</span>
          </label>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="label">금액</span>
            <span className="rule" />
          </div>

          <div className="rows">
            {summary.materials.length ? (
              summary.materials.map((b) => (
                <div className="row" key={b.paper.key}>
                  <span className="k">
                    {b.paper.label}
                    <em>{b.rolls}롤 × {b.price.toLocaleString("ko-KR")}</em>
                  </span>
                  <span className="v">{won(b.amount)}</span>
                </div>
              ))
            ) : (
              <div className="row muted">
                <span className="k">자재비</span>
                <span className="v">—</span>
              </div>
            )}
          </div>

          <div className="grid2">
            <label className="field">
              <span>시공비 <i>원</i></span>
              <input
                className="in num" type="number" inputMode="numeric" step="10000" min="0"
                placeholder="현장 보고 입력" value={quote.labor}
                onChange={(e) => setQuote({ labor: e.target.value })}
              />
            </label>
            <label className="field">
              <span>기타 비용 <i>원</i></span>
              <input
                className="in num" type="number" inputMode="numeric" step="10000" min="0"
                placeholder="비우면 생략" value={quote.extra}
                onChange={(e) => setQuote({ extra: e.target.value })}
              />
            </label>
          </div>

          <label className="check">
            <input
              type="checkbox" checked={quote.vat}
              onChange={(e) => setQuote({ vat: e.target.checked })}
            />
            부가세 포함
            <span className="tail">10%</span>
          </label>

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
              <div className="row">
                <span className="k">
                  부가세<em>10%</em>
                </span>
                <span className="v">{won(summary.vat)}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <span className="label">지난 견적</span>
            {history.length ? (
              <span className="count">
                {history.length}건{pro ? "" : " / " + FREE_SAVE_LIMIT}
              </span>
            ) : null}
            <span className="rule" />
          </div>
          {saveFull ? (
            <div className="upsell">
              <span className="txt">
                무료판 저장이 <b>{FREE_SAVE_LIMIT}건</b>까지 찼습니다. 계속 쌓아두시려면 프로로
                올리시거나, 아래에서 오래된 견적을 지워주세요.
              </span>
              <Link href="/pricing">요금제</Link>
            </div>
          ) : null}
          {history.length ? (
            <div className="hist">
              {history.map((h) => (
                <div className="hist-item" key={h.id}>
                  <div className="hist-main">
                    <span className="who">
                      {h.name}
                      {h.site ? " · " + h.site : ""}
                    </span>
                    <span className="when">{formatDate(h.savedAt)}</span>
                  </div>
                  <span className="hist-amt">{won(h.total)}</span>
                  <button type="button" className="mini" onClick={() => openSaved(h)}>
                    불러오기
                  </button>
                  <button
                    type="button" className="icon-btn"
                    aria-label={h.name + " 삭제"}
                    onClick={() => dropSaved(h.id)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty">저장한 견적이 아직 없습니다.</p>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <span className="label">알아두실 점</span>
            <span className="rule" />
          </div>
          <p className="note">
            벽 둘레를 벽지 폭으로 나눠 <b>폭수</b>를 구하고, 1롤에서 몇 폭이 나오는지로 롤 수를
            냅니다. 폭마다 재단 여유 <code>10cm</code>를 더합니다. 방마다 롤을 올림하지 않고
            <b> 현장 전체에서 한 번만 올림</b>하므로 자투리가 덜 남습니다.
          </p>
          <p className="note">
            문·창문 공제, 몰딩, 벽면 상태, 걸레받이, 폐기물 처리는 빠져 있습니다. 저장한 견적은
            <b> 이 기기 안에만</b> 남습니다.
          </p>
        </section>
      </div>

      <div className="dock no-print">
        <div className="dock-in">
          <div className="dock-sum">
            <span className="cap">
              총 {summary.filledRooms}개소 · 벽지 {summary.rollCount}롤
              {quote.vat ? " · 부가세 포함" : " · 부가세 별도"}
            </span>
            <span className="amt">{won(summary.total)}</span>
          </div>
          <button type="button" className="btn quiet" onClick={saveQuote} disabled={!canQuote}>
            저장
          </button>
          <button
            type="button" className="btn" disabled={!canQuote}
            onClick={() => setSheetAt(new Date().toISOString())}
          >
            견적서
          </button>
        </div>
      </div>

      {sheetAt ? (
        <QuoteSheet
          pro={pro}
          shop={shop}
          quote={quote}
          summary={summary}
          issuedAt={sheetAt}
          onClose={() => setSheetAt(null)}
          onShare={shareQuote}
          onPrint={printSheet}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
