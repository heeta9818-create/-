import Link from "next/link";
import { notFound } from "next/navigation";
import { EstimateCalculator } from "@/components/estimate-calculator";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/user";
import {
  getEstimateRepository,
  getSiteRepository,
} from "@/lib/data/repository";
import type { EstimateInput } from "@/lib/domain/estimate";
import { siteEstimateInput } from "@/lib/domain/site-estimate";
import { saveEstimate } from "./actions";

export const dynamic = "force-dynamic";

export default async function SiteEstimatePage(
  props: PageProps<"/sites/[id]/estimate">,
) {
  const { id } = await props.params;
  const { from } = await props.searchParams;

  const user = await requireUser();
  const siteRepo = await getSiteRepository();
  const site = await siteRepo.get(id, user.id);
  if (!site) notFound();

  const estimateRepo = await getEstimateRepository();
  const history = await estimateRepo.listForSite(id, user.id);

  // 초기값 우선순위: 복제하려는 견적 → 가장 최근 견적 → 현장 정보로 뽑은 기본값
  const copyId = Array.isArray(from) ? from[0] : from;
  const source = copyId
    ? (history.find((estimate) => estimate.id === copyId) ?? history[0])
    : history[0];

  const initialInput: EstimateInput = source
    ? source.input
    : siteEstimateInput(site);

  return (
    <>
      <PageHeader
        title="견적 잡기"
        subtitle={`${site.customerName} · ${site.pyeong}평`}
        action={
          <Link
            href={`/sites/${id}`}
            className="shrink-0 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium"
          >
            현장으로
          </Link>
        }
      />

      {source ? (
        <p className="px-5 pb-3 text-sm text-muted">
          {source.version}차 견적의 값을 불러왔습니다. 고쳐서 저장하면 새 차수로
          남습니다.
        </p>
      ) : null}

      <EstimateCalculator
        initialInput={initialInput}
        saveAction={saveEstimate.bind(null, id)}
      />
    </>
  );
}
