import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * 서버 컴포넌트·서버 액션에서 쓰는 Supabase 클라이언트.
 * 로그인 세션 쿠키를 그대로 넘겨주기 때문에 RLS가 사용자별로 걸린다.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없다. 세션 갱신은 proxy에서 처리한다.
          }
        },
      },
    },
  );
}
