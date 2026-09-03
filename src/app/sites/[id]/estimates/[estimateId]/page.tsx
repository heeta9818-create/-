import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimateBreakdown } from "@/components/estimate-breakdown";
import { EstimateActions } from "@/components/estimate-actions";
import { Card, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/user";
import {
  getEstimateRepository,
  getSiteRepository,
} from "@/lib/data/repository";
import { estimateTitle } from "@/lib/domain/saved-estimate";
import { WALLPAPER_SPECS } from "@/lib/domain/wallpaper";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SavedEstimatePage(
  props: PageProps<"/sites/[id]/estimates/[estimateId]">,
) {
  const { id, estimateId } = await props.params;

  const user = await requireUser();
  const estimateRepo = await getEstimateRepository();
  const estimate = await estimateRepo.get(estimateId, user.id);

  // 주소창의 현장 id와 견적이 실제로 속한 현장이 다르면 없는 것으로 본다.
  if (!estimate || estimate.siteId !== id) notFound();

  const siteRepo = await getSiteRepository();
  const site = await siteRepo.get(id, user.id);
  if (!site) notFound();

  const spec = WALLPAPER_SPECS[estimate.input.kind];
  const scope = estimate.input.scope;

  const rows: [string, string][] = [
    ["고객", site.customerName],
    ["현장", site.address || "—"],
    [
      "산출 방식",
      scope.method === "pyeong"
        ? `${scope.pyeong}평 (${scope.basis === "supply" ? "공급" : "전용"}) 간이 산출`
        : `실측 ${scope.rooms.length}개 공간`,
    ],
    ["벽지", `${spec.label}${estimate.input.patterned ? " · 무늬 있음" : ""}`],
    ["범위", estimate.input.includeCeiling ? "벽 + 천장" : "벽만"],
    ["작성일", shortDate(estimate.createdAt.slice(0, 10))],
  ];

  return (
    <>
      <PageHeader
        title={estimateTitle(estimate)}
        subtitle={`${site.customerName} 현장 견적서`}
        action={
          <Link
            href={`/sites/${id}`}
            className="no-print shrink-0 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium"
          >
            현장으로
          </Link>
        }
      />

      <div className="space-y-5 px-5">
        <Card>
          <dl className="space-y-2.5">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 text-sm">
                <dt className="shrink-0 text-muted">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <EstimateBreakdown
          result={estimate.result}
          footnote="저장 당시 금액입니다. 기본 단가가 바뀌어도 이 견적은 변하지 않습니다."
        />

        {scope.method === "measured" ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">실측 내역</h2>
            <Card className="py-1">
              {scope.rooms.map((room, index) => (
                <div
                  key={index}
                  className="flex justify-between gap-4 border-b border-line py-2.5 text-sm last:border-0"
                >
                  <span className="font-medium">
                    {room.name || `공간 ${index + 1}`}
                  </span>
                  <span className="text-right text-muted">
                    {room.widthM} × {room.depthM}m · 천장고{" "}
                    {room.heightM ?? "-"}m · 문 {room.doors ?? 0} · 창{" "}
                    {room.windows ?? 0}
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        {estimate.memo ? (
          <section>
            <h2 className="mb-3 text-sm font-semibold text-muted">메모</h2>
            <Card>
              <p className="text-sm whitespace-pre-wrap">{estimate.memo}</p>
            </Card>
          </section>
        ) : null}

        <EstimateActions siteId={id} estimateId={estimate.id} />
      </div>
    </>
  );
}
