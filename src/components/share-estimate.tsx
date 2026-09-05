"use client";

import Script from "next/script";
import { useActionState, useRef, useState } from "react";
import type { ShareState } from "@/app/sites/[id]/estimate/actions";
import { Card } from "@/components/ui";

type ShareAction = (state: ShareState) => Promise<ShareState>;

interface KakaoSdk {
  isInitialized(): boolean;
  init(key: string): void;
  Share: {
    sendDefault(settings: Record<string, unknown>): void;
  };
}

declare global {
  interface Window {
    Kakao?: KakaoSdk;
  }
}

export function ShareEstimate({
  shareUrl,
  title,
  description,
  enable,
  disable,
  kakaoJsKey,
}: {
  /** 공유가 꺼져 있으면 null */
  shareUrl: string | null;
  title: string;
  description: string;
  enable: ShareAction;
  disable: ShareAction;
  /** 있으면 카카오 SDK로 카드 형태 메시지를 보낸다 */
  kakaoJsKey?: string;
}) {
  const [enableState, enableAction, enabling] = useActionState<ShareState>(
    enable,
    {},
  );
  const [disableState, disableAction, disabling] = useActionState<ShareState>(
    disable,
    {},
  );
  const [copied, setCopied] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);

  const error = enableState.error ?? disableState.error;

  async function copyLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // https가 아니면 clipboard를 못 쓴다. 직접 복사하도록 선택해 준다.
      linkRef.current?.select();
    }
  }

  function shareToKakao() {
    if (!shareUrl) return;

    const kakao = window.Kakao;
    if (kakaoJsKey && kakao) {
      if (!kakao.isInitialized()) kakao.init(kakaoJsKey);
      kakao.Share.sendDefault({
        objectType: "text",
        text: `${title}\n${description}`,
        link: { mobileWebUrl: shareUrl, webUrl: shareUrl },
        buttonTitle: "견적서 보기",
      });
      return;
    }

    // 기본 경로. 폰에서 공유 시트가 열리고 거기서 카카오톡을 고른다.
    if (navigator.share) {
      navigator.share({ title, text: description, url: shareUrl }).catch(() => {
        // 사용자가 취소한 경우. 아무것도 하지 않는다.
      });
      return;
    }

    // 공유 시트가 없는 데스크톱 브라우저
    void copyLink();
  }

  if (!shareUrl) {
    return (
      <form action={enableAction} className="no-print">
        <Card>
          <p className="text-sm font-medium">고객에게 견적서 보내기</p>
          <p className="mt-2 text-sm text-muted">
            링크를 만들면 고객이 로그인 없이 견적서를 볼 수 있습니다. 내부 메모와
            마진 항목은 고객 화면에 보이지 않습니다.
          </p>

          {error ? (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={enabling}
            className="mt-4 w-full rounded-lg bg-brand px-4 py-3.5 font-medium text-white disabled:opacity-50"
          >
            {enabling ? "만드는 중…" : "공유 링크 만들기"}
          </button>
        </Card>
      </form>
    );
  }

  return (
    <>
      {/*
        카카오 SDK는 키를 넣은 경우에만 불러온다. 없으면 아래 카톡 버튼이
        Web Share(공유 시트)로 동작하므로 이 스크립트 없이도 공유는 된다.

        integrity를 비워 뒀다. 카카오가 버전별 SRI 해시를 개발자 문서에
        공개하므로, 이 기능을 켤 때 해당 버전 해시를 함께 넣을 것.
        확인하지 않은 해시를 적어 두면 조용히 로드가 실패한다.
      */}
      {kakaoJsKey ? (
        <Script
          src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js"
          crossOrigin="anonymous"
          strategy="lazyOnload"
        />
      ) : null}

      <Card className="no-print">
        <p className="text-sm font-medium">고객에게 견적서 보내기</p>

        <input
          ref={linkRef}
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="mt-3 w-full rounded-lg border border-line bg-background px-3 py-2.5 text-sm"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={shareToKakao}
            className="rounded-lg bg-[#fee500] px-4 py-3 text-sm font-medium text-[#191600]"
          >
            카톡으로 보내기
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="rounded-lg border border-line bg-surface px-4 py-3 text-sm font-medium"
          >
            {copied ? "복사됨" : "링크 복사"}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted">
          링크를 아는 사람은 누구나 볼 수 있습니다. 내부 메모와 마진 항목은
          보이지 않습니다.
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-brand"
          >
            고객 화면 미리보기
          </a>

          <form action={disableAction}>
            <button
              type="submit"
              disabled={disabling}
              className="text-sm text-muted underline disabled:opacity-50"
            >
              {disabling ? "중지 중…" : "공유 중지"}
            </button>
          </form>
        </div>

        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </Card>
    </>
  );
}
