import type { EstimateInput } from "./estimate";
import type { PriceSettings } from "./settings";

/**
 * 설정값을 견적 입력에 박아 넣는다.
 *
 * 견적을 저장할 때 반드시 거쳐야 한다. 입력에 단가와 계수가 비어 있으면
 * 계산할 때마다 "그때의 설정"을 끌어다 쓰게 되고, 단가표를 고치는 순간
 * 지난 견적을 다시 열었을 때 다른 금액이 나온다. 저장된 result는 그대로라
 * 겉으로는 멀쩡해 보이지만, "이 값으로 다시 잡기"를 누르는 순간 어긋난다.
 *
 * 사용자가 계산기에서 직접 고친 값(rollPrice 등)은 건드리지 않는다.
 * 비어 있는 자리만 채운다.
 */
export function resolveEstimateInput(
  input: EstimateInput,
  settings: PriceSettings,
): EstimateInput {
  const patterned = input.patterned ?? false;

  return {
    ...input,
    patterned,
    rollPrice: input.rollPrice ?? settings.rollPrice[input.kind],
    rollsPerWorkerDay:
      input.rollsPerWorkerDay ?? settings.rollsPerWorkerDay[input.kind],
    dailyWage: input.dailyWage ?? settings.dailyWage,
    subMaterialPerM2: input.subMaterialPerM2 ?? settings.subMaterialPerM2,
    marginRate: input.marginRate ?? settings.marginRate,

    lossRate:
      input.lossRate ??
      (patterned ? settings.patternedLossRate : settings.lossRate),
    openingDeductionRate:
      input.openingDeductionRate ?? settings.openingDeductionRate,
    ceilingHeightM: input.ceilingHeightM ?? settings.ceilingHeightM,
    wallAreaFactor: input.wallAreaFactor ?? settings.wallAreaFactor,
    ceilingAreaFactor: input.ceilingAreaFactor ?? settings.ceilingAreaFactor,
    exclusiveRatio: input.exclusiveRatio ?? settings.exclusiveRatio,

    includeVat: input.includeVat ?? false,
  };
}
