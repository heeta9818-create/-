import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Supabase 액세스 토큰은 한 시간이면 만료된다. 서버 컴포넌트에서는 쿠키를
 * 쓸 수 없으니, 매 요청 앞단에서 세션을 갱신하고 새 쿠키를 응답에 실어준다.
 *
 * 여기서 인가 판단은 하지 않는다. 인가는 각 페이지·서버 액션의
 * requireUser()와 Supabase RLS가 담당한다.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Supabase 미설정(개발) 모드에서는 갱신할 세션이 없다.
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // 정적 파일과 이미지 최적화 요청은 건너뛴다.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
