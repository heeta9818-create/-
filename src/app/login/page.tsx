import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { Card, PageHeader } from "@/components/ui";
import { checkDevAuthBypass } from "@/lib/auth/dev-bypass";
import { getCurrentUser, isAuthDisabled } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function LoginPage(props: PageProps<"/login">) {
  if (isAuthDisabled()) {
    // 프로덕션에서 Supabase 없이 떴다면 나머지 페이지는 전부 막혀 있다.
    // 여기가 유일하게 열려 있는 화면이니 원인을 여기에 적어 준다.
    const bypass = checkDevAuthBypass({
      nodeEnv: process.env.NODE_ENV,
      allowInsecureDevAuth: process.env.ALLOW_INSECURE_DEV_AUTH,
    });

    return (
      <>
        <PageHeader
          title="로그인"
          subtitle={
            bypass.allowed
              ? "지금은 로그인이 꺼진 개발 모드입니다"
              : "설정이 필요합니다"
          }
        />
        <div className="px-5">
          <Card>
            <p className="text-sm">
              {bypass.allowed ? (
                <>
                  Supabase 환경변수가 없어 고정된 개발용 사용자로 동작합니다.
                  실제 로그인을 붙이려면 <code>.env.local</code>에
                  <code className="mx-1">NEXT_PUBLIC_SUPABASE_URL</code>과
                  <code className="mx-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>를
                  채우고 서버를 다시 띄우세요.
                </>
              ) : (
                bypass.reason
              )}
            </p>
            {bypass.allowed ? (
              <Link
                href="/"
                className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
              >
                홈으로
              </Link>
            ) : null}
          </Card>
        </div>
      </>
    );
  }

  // 이미 로그인한 사람이 /login에 들어오면 홈으로 보낸다.
  if (await getCurrentUser()) redirect("/");

  const { error } = await props.searchParams;
  const message = Array.isArray(error) ? error[0] : error;

  return (
    <>
      <PageHeader
        title="도배장이"
        subtitle="현장과 견적을 한 곳에서 관리하세요"
      />

      {message ? (
        <div className="px-5 pb-1">
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {message}
          </p>
        </div>
      ) : null}

      <LoginForm
        kakaoEnabled={process.env.NEXT_PUBLIC_KAKAO_LOGIN === "true"}
      />
    </>
  );
}
