import { NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/data/repository";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

/**
 * OAuth 로그인과 이메일 인증 링크가 돌아오는 자리.
 * 코드를 세션으로 바꿔 쿠키에 심고 홈으로 보낸다.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // open redirect를 막으려고 같은 사이트 내부 경로만 허용한다.
  const requested = searchParams.get("next") ?? "/";
  const next = requested.startsWith("/") && !requested.startsWith("//")
    ? requested
    : "/";

  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(`${origin}/`);
  }

  if (!code) {
    const description =
      searchParams.get("error_description") ?? "인증 정보가 없습니다.";
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(description)}`,
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent("인증에 실패했습니다. 다시 시도하세요.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${next}`);
}
