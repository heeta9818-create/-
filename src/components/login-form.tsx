"use client";

import { useActionState, useState } from "react";
import {
  signIn,
  signInWithKakao,
  signUp,
  type AuthFormState,
} from "@/app/login/actions";
import { Field, inputClass } from "@/components/ui";

type Mode = "signIn" | "signUp";

const COPY: Record<Mode, { submit: string; toggle: string; switchTo: Mode }> = {
  signIn: {
    submit: "로그인",
    toggle: "계정이 없으신가요? 회원가입",
    switchTo: "signUp",
  },
  signUp: {
    submit: "회원가입",
    toggle: "이미 계정이 있으신가요? 로그인",
    switchTo: "signIn",
  },
};

export function LoginForm({ kakaoEnabled }: { kakaoEnabled: boolean }) {
  const [mode, setMode] = useState<Mode>("signIn");
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    mode === "signIn" ? signIn : signUp,
    {},
  );
  const copy = COPY[mode];

  // 서버 액션이 끝나면 React가 폼을 초기화한다. 실패했을 때 이메일까지
  // 지워지면 매번 다시 쳐야 하므로 이메일만 붙잡아 둔다.
  // 아직 아무것도 입력하지 않았으면(null) 액션이 돌려준 값을 쓴다 —
  // JS가 꺼진 환경에서도 서버 렌더 결과에 이메일이 남는다.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? state.email ?? "";

  return (
    <div className="space-y-5 px-5 pb-8">
      <form action={formAction} className="space-y-4">
        <Field label="이메일">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="name@example.com"
            value={email}
            onChange={(event) => setTypedEmail(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="비밀번호"
          hint={mode === "signUp" ? "8자 이상" : undefined}
        >
          <input
            name="password"
            type="password"
            required
            minLength={mode === "signUp" ? 8 : undefined}
            autoComplete={
              mode === "signUp" ? "new-password" : "current-password"
            }
            className={inputClass}
          />
        </Field>

        {state.error ? (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        ) : null}

        {state.notice ? (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            {state.notice}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-brand px-4 py-3.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? "처리 중…" : copy.submit}
        </button>
      </form>

      <button
        type="button"
        onClick={() => setMode(copy.switchTo)}
        className="w-full py-2 text-sm text-muted underline"
      >
        {copy.toggle}
      </button>

      {kakaoEnabled ? (
        <>
          <div className="flex items-center gap-3 text-xs text-muted">
            <span className="h-px flex-1 bg-line" />
            또는
            <span className="h-px flex-1 bg-line" />
          </div>

          <form action={signInWithKakao}>
            <button
              type="submit"
              className="w-full rounded-lg bg-[#fee500] px-4 py-3.5 font-medium text-[#191600]"
            >
              카카오로 계속하기
            </button>
          </form>
        </>
      ) : null}
    </div>
  );
}
