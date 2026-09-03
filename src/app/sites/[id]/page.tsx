import { notFound } from "next/navigation";
import { Card, PageHeader, StatusBadge } from "@/components/ui";
import { SiteActions } from "@/components/site-actions";
import { requireUser } from "@/lib/auth/user";
import { getSiteRepository } from "@/lib/data/repository";
import { estimateForSite } from "@/lib/domain/site-estimate";
import { WALLPAPER_SPECS } from "@/lib/domain/wallpaper";
import { m2, shortDate, won } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SiteDetailPage(props: PageProps<"/sites/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const repo = await getSiteRepository();
  const site = await repo.get(id, user.id);
  if (!site) notFound();

  const estimate = estimateForSite(site);
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
          <h2 className="mb-3 text-sm font-semibold text-muted">물량 산출</h2>
          <Card>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted">시공면적</p>
                <p className="mt-1 font-bold">{m2(estimate.area.netAreaM2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted">벽지</p>
                <p className="mt-1 font-bold">{estimate.rolls}롤</p>
              </div>
              <div>
                <p className="text-xs text-muted">품</p>
                <p className="mt-1 font-bold">{estimate.workerDays}품</p>
              </div>
            </div>
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
              벽 {m2(estimate.area.wallAreaM2)} + 천장{" "}
              {m2(estimate.area.ceilingAreaM2)} · 로스{" "}
              {Math.round(estimate.area.lossRate * 100)}% 포함 소요{" "}
              {m2(estimate.area.requiredAreaM2)} · 롤당 {estimate.rollAreaM2}m²
            </p>
          </Card>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-muted">견적</h2>
          <Card>
            <table className="w-full text-sm">
              <tbody>
                {estimate.items.map((item) => (
                  <tr key={item.label} className="border-b border-line">
                    <td className="py-2.5 pr-3">
                      <p className="font-medium">{item.label}</p>
                      {item.detail ? (
                        <p className="text-xs text-muted">{item.detail}</p>
                      ) : null}
                    </td>
                    <td className="py-2.5 text-right font-medium whitespace-nowrap">
                      {won(item.amount)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="pt-3 font-semibold">합계</td>
                  <td className="pt-3 text-right text-lg font-bold whitespace-nowrap">
                    {won(estimate.total)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted">
              부가세 별도 · 기본 단가 기준입니다. 단가와 마진을 손보려면 견적
              계산기를 쓰세요.
            </p>
          </Card>
        </section>

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
