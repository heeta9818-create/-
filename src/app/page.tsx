import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { getSiteRepository, isSupabaseConfigured } from "@/lib/data/repository";
import { SITE_STATUS_LABEL, type Site } from "@/lib/domain/site";
import { daysFromToday, shortDate, todayISO, won } from "@/lib/format";

export const dynamic = "force-dynamic";

function upcoming(sites: Site[]): Site[] {
  return sites
    .filter((site) => site.scheduledOn && site.status !== "done")
    .filter((site) => daysFromToday(site.scheduledOn!) >= 0)
    .sort((a, b) => a.scheduledOn!.localeCompare(b.scheduledOn!));
}

function ScheduleRow({ site }: { site: Site }) {
  const days = daysFromToday(site.scheduledOn!);
  const when = days === 0 ? "오늘" : days === 1 ? "내일" : `${days}일 뒤`;

  return (
    <Link
      href={`/sites/${site.id}`}
      className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">{site.customerName}</p>
        <p className="truncate text-sm text-muted">
          {shortDate(site.scheduledOn!)} · {site.pyeong}평
          {site.address ? ` · ${site.address}` : ""}
        </p>
      </div>
      <span className="shrink-0 text-sm font-medium text-brand">{when}</span>
    </Link>
  );
}

export default async function HomePage() {
  const repo = await getSiteRepository();
  const sites = await repo.list();

  const schedule = upcoming(sites);
  const today = schedule.filter((site) => site.scheduledOn === todayISO());
  const active = sites.filter(
    (site) => site.status === "confirmed" || site.status === "in_progress",
  );
  const pipeline = active.reduce((sum, site) => sum + site.estimateTotal, 0);

  const counts = sites.reduce<Record<string, number>>((acc, site) => {
    acc[site.status] = (acc[site.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="오늘의 현장"
        subtitle={
          today.length > 0
            ? `오늘 ${today.length}건 시공 예정입니다`
            : "오늘 잡힌 시공은 없습니다"
        }
      />

      <div className="space-y-5 px-5">
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-sm text-muted">진행 중 현장</p>
            <p className="mt-1 text-2xl font-bold">{active.length}건</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">계약 예정 금액</p>
            <p className="mt-1 text-2xl font-bold">{won(pipeline)}</p>
          </Card>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">다가오는 일정</h2>
          {schedule.length === 0 ? (
            <EmptyState
              message="예정된 시공 일정이 없습니다."
              actionHref="/sites/new"
              actionLabel="현장 등록하기"
            />
          ) : (
            <Card className="py-1">
              {schedule.slice(0, 6).map((site) => (
                <ScheduleRow key={site.id} site={site} />
              ))}
            </Card>
          )}
        </section>

        {sites.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">상태별 현황</h2>
            <Card className="flex flex-wrap gap-2">
              {Object.entries(SITE_STATUS_LABEL).map(([status]) => (
                <span key={status} className="flex items-center gap-1.5">
                  <StatusBadge status={status as Site["status"]} />
                  <span className="text-sm text-muted">
                    {counts[status] ?? 0}
                  </span>
                </span>
              ))}
            </Card>
          </section>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/sites/new"
            className="rounded-xl bg-brand px-4 py-4 text-center font-medium text-white"
          >
            현장 등록
          </Link>
          <Link
            href="/estimate"
            className="rounded-xl border border-line bg-surface px-4 py-4 text-center font-medium"
          >
            견적 계산
          </Link>
        </div>

        {!isSupabaseConfigured() ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-3 text-xs text-muted">
            지금은 로컬 파일(<code>.data/sites.json</code>)에 저장하는 개발 모드입니다.
            Supabase 환경변수를 넣으면 자동으로 클라우드 저장으로 바뀝니다.
          </p>
        ) : null}
      </div>
    </>
  );
}
