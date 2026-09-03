import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EstimateBreakdown } from "@/components/estimate-breakdown";
import { Card } from "@/components/ui";
import { getEstimateRepository } from "@/lib/data/repository";
import { toPublicResult } from "@/lib/domain/public-estimate";
import { estimateTitle } from "@/lib/domain/saved-estimate";
import { WALLPAPER_SPECS } from "@/lib/domain/wallpaper";
import { shortDate } from "@/lib/format";

export const dynamic = "force-dynamic";

// 링크를 아는 사람만 보는 페이지다. 검색엔진에 걸리면 안 된다.
export const metadata: Metadata = {
  title: "견적서",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedEstimatePage(
  props: PageProps<"/q/[token]">,
) {
  const { token } = await props.params;

  const repo = await getEstimateRepository();
  const shared = await repo.findShared(token);
  if (!shared) notFound();

  const spec = WALLPAPER_SPECS[shared.input.kind];
  const scope = shared.input.scope;

  const rows: [string, string][] = [
    ["고객", shared.customerName],
    ["현장", shared.address || "—"],
    [
      "면적",
      scope.method === "pyeong"
        ? `${scope.pyeong}평 (${scope.basis === "supply" ? "공급" : "전용"})`
        : `실측 ${scope.rooms.length}개 공간`,
    ],
    ["벽지", spec.label],
    ["범위", shared.input.includeCeiling ? "벽 + 천장" : "벽만"],
    ["작성일", shortDate(shared.createdAt.slice(0, 10))],
  ];

  return (
    <div className="px-5 pb-10">
      <header className="pt-10 pb-6">
        <p className="text-sm text-muted">
          {estimateTitle(shared)}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">도배 견적서</h1>
        <p className="mt-1 text-sm text-muted">{shared.customerName} 고객님</p>
      </header>

      <div className="space-y-5">
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
          result={toPublicResult(shared.result)}
          showBasis={false}
          footnote="현장 상태에 따라 실제 시공 시 금액이 달라질 수 있습니다."
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
                    {room.widthM} × {room.depthM}m
                  </span>
                </div>
              ))}
            </Card>
          </section>
        ) : null}

        <p className="text-center text-xs text-muted">
          문의는 견적서를 보내드린 연락처로 부탁드립니다.
        </p>
      </div>
    </div>
  );
}
