import { calculateEstimate, type EstimateInput, type EstimateResult } from "./estimate";
import { resolveEstimateInput } from "./resolve-estimate";
import type { PriceSettings } from "./settings";
import type { SiteInput } from "./site";

/**
 * 현장 정보만으로 뽑는 기본 견적.
 * 현장 등록 시점에는 실측 전인 경우가 대부분이라 평수 간이 산출을 쓰고,
 * 단가·계수는 사용자의 단가표에서 가져온다.
 */
export function siteEstimateInput(
  site: SiteInput,
  settings: PriceSettings,
): EstimateInput {
  return resolveEstimateInput(
    {
      scope: { method: "pyeong", pyeong: site.pyeong, basis: site.areaBasis },
      kind: site.wallpaperKind,
      includeCeiling: site.includeCeiling,
      patterned: site.patterned,
    },
    settings,
  );
}

export function estimateForSite(
  site: SiteInput,
  settings: PriceSettings,
): EstimateResult {
  return calculateEstimate(siteEstimateInput(site, settings));
}
