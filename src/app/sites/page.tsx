import Link from "next/link";
import { Card, EmptyState, PageHeader, StatusBadge } from "@/components/ui";
import { getSiteRepository } from "@/lib/data/repository";
import { WALLPAPER_SPECS } from "@/lib/domain/wallpaper";
import { shortDate, won } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SitesPage() {
  const repo = await getSiteRepository();
  const sites = await repo.list();

  return (
    <>
      <PageHeader
        title="현장"
        subtitle={`${sites.length}건`}
        action={
          <Link
            href="/sites/new"
            className="shrink-0 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white"
          >
            + 등록
          </Link>
        }
      />

      <div className="space-y-3 px-5">
        {sites.length === 0 ? (
          <EmptyState
            message="아직 등록한 현장이 없습니다."
            actionHref="/sites/new"
            actionLabel="첫 현장 등록하기"
          />
        ) : (
          sites.map((site) => (
            <Link key={site.id} href={`/sites/${site.id}`} className="block">
              <Card className="transition-colors hover:border-brand">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{site.customerName}</p>
                    <p className="mt-0.5 truncate text-sm text-muted">
                      {site.address || "주소 미입력"}
                    </p>
                  </div>
                  <StatusBadge status={site.status} />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                  <span>
                    {site.pyeong}평
                    {site.areaBasis === "supply" ? " (공급)" : " (전용)"}
                  </span>
                  <span>{WALLPAPER_SPECS[site.wallpaperKind].label}</span>
                  {site.scheduledOn ? (
                    <span>{shortDate(site.scheduledOn)}</span>
                  ) : null}
                  <span className="ml-auto font-medium text-foreground">
                    {won(site.estimateTotal)}
                  </span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
