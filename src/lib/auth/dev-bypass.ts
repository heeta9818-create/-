/**
 * Supabase 환경변수가 없으면 앱은 로그인 없이 고정 사용자로 돈다.
 * 설정 없이 바로 돌려볼 수 있게 하려고 남긴 길인데, 그대로 배포되면
 * 아무나 남의 현장을 보게 되므로 프로덕션에서는 막는다.
 *
 * 순수 함수로 빼서 테스트로 못 박아 둔다.
 */
export interface DevBypassEnv {
  nodeEnv: string | undefined;
  allowInsecureDevAuth: string | undefined;
}

export interface DevBypassDecision {
  allowed: boolean;
  reason?: string;
}

export function checkDevAuthBypass(env: DevBypassEnv): DevBypassDecision {
  if (env.nodeEnv !== "production") return { allowed: true };

  if (env.allowInsecureDevAuth === "true") return { allowed: true };

  return {
    allowed: false,
    reason:
      "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)가 " +
      "없어 로그인이 꺼진 상태입니다. 프로덕션에서는 이대로 띄울 수 없습니다. " +
      "Supabase를 설정하거나, 로컬에서 프로덕션 빌드를 확인하려면 " +
      "ALLOW_INSECURE_DEV_AUTH=true 를 지정하세요.",
  };
}
