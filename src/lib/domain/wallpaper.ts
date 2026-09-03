/**
 * 도배 도메인 상수.
 *
 * 여기 있는 값들은 "출발점"이지 절대값이 아니다.
 * 롤 규격은 국내 유통 표준이라 그대로 써도 되지만,
 * 계수(로스율·품 산출·전용률)는 실제 현장 몇 건을 정산해 보고
 * 반드시 본인 현장 기준으로 보정할 것.
 */

export type WallpaperKind = "silk" | "wide" | "narrow";

export interface WallpaperSpec {
  kind: WallpaperKind;
  label: string;
  /** 롤 폭 (m) */
  widthM: number;
  /** 롤 길이 (m) */
  lengthM: number;
  /** 도배공 1인이 하루에 시공 가능한 롤 수 (품 산출용 기본값) */
  rollsPerWorkerDay: number;
  /** 롤당 자재 단가 기본값 (원) */
  defaultRollPrice: number;
}

export const WALLPAPER_SPECS: Record<WallpaperKind, WallpaperSpec> = {
  silk: {
    kind: "silk",
    label: "실크벽지",
    widthM: 1.06,
    lengthM: 15.6,
    rollsPerWorkerDay: 12,
    defaultRollPrice: 35_000,
  },
  wide: {
    kind: "wide",
    label: "광폭합지",
    widthM: 0.93,
    lengthM: 17.75,
    rollsPerWorkerDay: 14,
    defaultRollPrice: 18_000,
  },
  narrow: {
    kind: "narrow",
    label: "소폭합지",
    widthM: 0.53,
    lengthM: 12.5,
    rollsPerWorkerDay: 32,
    defaultRollPrice: 7_000,
  },
};

/** 롤 1개로 바를 수 있는 면적 (m²) */
export function rollAreaM2(kind: WallpaperKind): number {
  const spec = WALLPAPER_SPECS[kind];
  return spec.widthM * spec.lengthM;
}

/** 1평 = 3.3058 m² */
export const PYEONG_TO_M2 = 3.3058;

export const DEFAULTS = {
  /** 무늬 없음 기준 로스율. 무늬 반복이 있으면 patternedLossRate 사용 */
  lossRate: 0.1,
  /** 무늬(리피트) 있는 벽지 로스율 */
  patternedLossRate: 0.18,
  /** 기본 천장고 (m) */
  ceilingHeightM: 2.3,
  /** 문 1개당 면적 (m²) */
  doorAreaM2: 1.8,
  /** 창 1개당 면적 (m²) */
  windowAreaM2: 1.5,
  /**
   * 개구부 공제율. 1.0이면 문/창 면적을 전부 빼고, 0이면 안 뺀다.
   * 재단 로스 때문에 실무에선 절반만 공제하는 경우가 많아 0.5를 기본값으로 둔다.
   */
  openingDeductionRate: 0.5,
  /**
   * 평수 간이 산출용 계수 (전용면적 기준).
   * 시공 벽면적 ≈ 전용면적 × wallAreaFactor
   * 천장면적 ≈ 전용면적 × ceilingAreaFactor
   */
  wallAreaFactor: 2.4,
  ceilingAreaFactor: 1.0,
  /** 공급면적 → 전용면적 환산율 (아파트 전용률 근사) */
  exclusiveRatio: 0.75,
  /** 도배공 1인 일당 (원) */
  dailyWage: 250_000,
  /** 시공면적 m²당 부자재비 (초배지·풀·퍼티 등, 원) */
  subMaterialPerM2: 1_200,
  /** 부가세율 */
  vatRate: 0.1,
  /**
   * 기본 마진율. 현장의 기본 견적과 견적 계산기의 초기값이 같아야
   * 아무것도 바꾸지 않고 저장했을 때 금액이 튀지 않는다.
   */
  marginRate: 0.15,
} as const;
