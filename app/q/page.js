"use client";

import { useEffect, useState } from "react";
import QuoteDoc from "../components/QuoteDoc";
import { summarize } from "../lib/calc";
import { fromToken, unpack } from "../lib/link";

// 고객이 링크를 눌렀을 때 열리는 화면.
// 견적 내용은 주소의 # 뒤에 들어 있어 서버로 넘어가지 않는다.
export default function QuoteLink() {
  const [data, setData] = useState(null);
  const [state, setState] = useState("여는 중…");

  useEffect(() => {
    async function open() {
      const token = window.location.hash.replace(/^#/, "");
      if (!token) {
        setState("견적 내용이 없는 주소입니다.");
        return;
      }
      try {
        setData(unpack(await fromToken(token)));
        setState("");
      } catch (e) {
        setState("견적을 열지 못했습니다. 링크가 잘린 것 같습니다. 보내주신 분께 다시 요청해 주세요.");
      }
    }
    open();
  }, []);

  if (!data) {
    return (
      <div className="link-page">
        <p className="link-msg">{state}</p>
      </div>
    );
  }

  const summary = summarize(data.quote);

  return (
    <div className="link-page">
      <QuoteDoc
        pro
        shop={data.shop}
        quote={data.quote}
        summary={summary}
        issuedAt={data.issuedAt}
      />

      <div className="link-foot no-print">
        {data.shop.phone ? (
          <a className="btn" href={"tel:" + data.shop.phone.replace(/[^0-9+]/g, "")}>
            {data.shop.name || "업체"}에 전화하기
          </a>
        ) : null}
        <button type="button" className="btn quiet" onClick={() => window.print()}>
          인쇄 · PDF로 저장
        </button>
      </div>
    </div>
  );
}
