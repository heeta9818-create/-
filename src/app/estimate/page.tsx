import { PageHeader } from "@/components/ui";
import { EstimateCalculator } from "@/components/estimate-calculator";

export default function EstimatePage() {
  return (
    <>
      <PageHeader
        title="견적 계산"
        subtitle="평수만 넣어도 되고, 실측값을 넣으면 더 정확합니다"
      />
      <EstimateCalculator />
    </>
  );
}
