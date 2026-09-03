import { calculateEstimate, type EstimateInput, type EstimateResult } from "./estimate";
import type { SiteInput } from "./site";
import { DEFAULTS } from "./wallpaper";

/**
 * 현장 정보만으로 뽑는 기본 견적.
 * 현장 등록 시점에는 실측 전인 경우가 대부분이라 평수 간이 산출을 쓰고,
 * 단가·마진은 기본값으로 둔다. 실측 후 조정은 견적 계산기에서 한다.
 */
export function siteEstimateInput(site: SiteInput): EstimateInput {
  return {
    scope: { method: "pyeong", pyeong: site.pyeong, basis: site.areaBasis },
    kind: site.wallpaperKind,
    includeCeiling: site.includeCeiling,
    patterned: site.patterned,
    marginRate: DEFAULTS.marginRate,
  };
}

export function estimateForSite(site: SiteInput): EstimateResult {
  return calculateEstimate(siteEstimateInput(site));
}
