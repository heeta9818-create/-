import { Card, PageHeader } from "@/components/ui";
import { SignOutButton } from "@/components/sign-out-button";
import { requireUser, isAuthDisabled } from "@/lib/auth/user";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const devMode = isAuthDisabled();

  return (
    <>
      <PageHeader title="설정" />

      <div className="space-y-5 px-5">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">계정</h2>
          <Card>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted">이름</dt>
                <dd className="font-medium">{user.displayName}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted">이메일</dt>
                <dd className="font-medium break-all">{user.email}</dd>
              </div>
            </dl>
          </Card>
        </section>

        {devMode ? (
          <Card className="border-dashed">
            <p className="text-sm font-medium">로그인이 꺼진 개발 모드</p>
            <p className="mt-2 text-sm text-muted">
              Supabase 환경변수가 없어 고정된 개발용 계정으로 동작합니다.
              데이터는 <code>.data/</code> 아래 파일에 저장되고, 다른 사람과
              분리되지 않습니다. 실제로 쓰려면 Supabase를 설정하세요.
            </p>
          </Card>
        ) : (
          <SignOutButton />
        )}

        <p className="text-xs text-muted">
          단가표·기본 계수 설정 화면은 아직 없습니다. 지금은{" "}
          <code>src/lib/domain/wallpaper.ts</code>의 <code>DEFAULTS</code>를
          직접 고쳐야 합니다.
        </p>
      </div>
    </>
  );
}
