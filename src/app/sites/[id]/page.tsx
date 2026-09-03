import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimateBreakdown } from "@/components/estimate-breakdown";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { SiteActions } from "@/components/site-actions";
import { requireUser } from "@/lib/auth/user";
import {
  getEstimateRepository,
  getSiteRepository,
} from "@/lib/data/repository";
import { estimateTitle } from "@/lib/domain/saved-estimate";
import { estimateForSite } from "@/lib/domain/site-estimate";
import { WALLPAPER_SPECS } from "@/lib/domain/wallpaper";
import { shortDate, won } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage(props: PageProps<"/sites/[id]">) {
  const { id } = await props.params;

  const user = await requireUser();
  const repo = await getSiteRepository();
  const site = await repo.get(id, user.id);
  if (!site) notFound();

  const estimateRepo = await getEstimateRepository();
  const history = await estimateRepo.listForSite(id, user.id);
  const latest = history[0];

  // 저장된 견적이 있으면 그게 이 현장의 견적이다.
  // 없으면 현장 정보만으로 뽑은 기본 견적을 보여준다.
  const shown = latest ? latest.result : estimateForSite(site);
  const spec = WALLPAPER_SPECS[site.wallpaperKind];

  const info: [string, string][] = [
    ["연락처", site.phone || "—"],
    ["주소", site.address || "—"],
    ["시공 예정일", site.scheduledOn ? shortDate(site.scheduledOn) : "미정"],
    [
      "면적",
      `${site.pyeong}평 (${site.areaBasis === "supply" ? "공급" : "전용"})`,
    ],
    ["벽지", `${spec.label}${site.patterned ? " · 무늬 있음" : ""}`],
    ["범위", site.includeCeiling ? "벽 + 천장" : "벽만"],
  ];

  return (
    <>
      <PageHeader
        title={site.customerName}
        subtitle={site.address || undefined}
        action={<StatusBadge status={site.status} />}
      />

      <div className="space-y-5 px-5">
        <Card>
          <dl className="space-y-2.5">
            {info.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="shrink-0 text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <section>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold text-muted">
              {latest ? estimateTitle(latest) : "기본 견적"}
            </h2>
            {latest ? (
              <Link
                href={`/sites/${id}/estimates/${latest.id}`}
                className="no-print text-sm font-medium text-brand"
              >
                견적서 보기
              </Link>
            ) : null}
          </div>

          <EstimateBreakdown
            result={shown}
            footnote={
              latest
                ? `${shortDate(latest.createdAt.slice(0, 10))}에 저장한 금액입니다.`
                : "아직 저장한 견적이 없습니다. 현장 정보와 기본 단가로 뽑은 값이라 단가를 손보면 달라집니다."
            }
          />

          <Link
            href={`/sites/${id}/estimate`}
            className="no-print mt-3 block rounded-lg bg-brand px-4 py-3.5 text-center font-medium text-white"
          >
            {latest ? "견적 다시 잡기" : "견적 잡고 저장하기"}
          </Link>
        </section>

        {history.length > 0 ? (
          <section className="no-print">
            <h2 className="mb-3 text-sm font-semibold text-muted">
              견적 이력 {history.length}건
            </h2>
            <Card className="py-1">
              {history.map((estimate) => (
                <Link
                  key={estimate.id}
                  href={`/sites/${id}/estimates/${estimate.id}`}
                  className="flex items-center justify-between gap-3 border-b border-line py-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {estimateTitle(estimate)}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {shortDate(estimate.createdAt.slice(0, 10))}
                      {estimate.memo ? ` · ${estimate.memo}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium whitespace-nowrap">
                    {won(estimate.total)}
                  </span>
                </Link>
              ))}
            </Card>
          </section>
        ) : null}

        {site.memo ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">메모</h2>
            <Card>
              <p className="text-sm whitespace-pre-wrap">{site.memo}</p>
            </Card>
          </section>
        ) : null}

        <SiteActions id={site.id} />
      </div>
    </>
  );
}
