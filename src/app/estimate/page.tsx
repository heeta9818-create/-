import { EstimateCalculator } from "@/components/estimate-calculator";
import { PageHeader } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth/user";
import { getSettingsRepository } from "@/lib/data/repository";
import { resolveEstimateInput } from "@/lib/domain/resolve-estimate";
import { DEFAULT_SETTINGS } from "@/lib/domain/settings";

export const dynamic = "force-dynamic";

export default async function EstimatePage() {
  // 현장 없이 빠르게 계산해 보는 화면이라 로그인을 요구하지 않는다.
  // 로그인한 사람에게는 본인 단가표를 채워 준다.
  const user = await getCurrentUser().catch(() => null);
  const settings = user
    ? await (await getSettingsRepository()).get(user.id)
    : DEFAULT_SETTINGS;

  const initialInput = resolveEstimateInput(
    {
      scope: { method: "pyeong", pyeong: 25, basis: "supply" },
      kind: "silk",
      includeCeiling: true,
    },
    settings,
  );

  return (
    <>
      <PageHeader
        title="견적 계산"
        subtitle={
          user
            ? "내 단가표 기준입니다. 평수만 넣어도 되고, 실측값을 넣으면 더 정확합니다"
            : "평수만 넣어도 되고, 실측값을 넣으면 더 정확합니다"
        }
      />
      <EstimateCalculator initialInput={initialInput} />
    </>
  );
}
