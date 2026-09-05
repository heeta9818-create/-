import { z } from "zod";
import {
  DEFAULTS,
  WALLPAPER_SPECS,
  type WallpaperKind,
} from "./wallpaper";

/**
 * 사장님이 앱에서 고치는 단가표와 산출 계수.
 *
 * 코드의 DEFAULTS는 "아무것도 설정하지 않았을 때의 출발점"으로 남고,
 * 실제 견적은 이 설정으로 계산한다.
 *
 * 부가세율(10%)과 문·창 1개당 면적은 여기 없다. 취향이 아니라 정해진
 * 값이라서, 고칠 수 있게 만들면 실수만 는다.
 */
export interface PriceSettings {
  /** 벽지 종류별 롤 단가 (원) */
  rollPrice: Record<WallpaperKind, number>;
  /** 벽지 종류별 도배공 1인 하루 시공 롤 수 */
  rollsPerWorkerDay: Record<WallpaperKind, number>;
  /** 도배공 1인 일당 (원) */
  dailyWage: number;
  /** 시공면적 m²당 부자재비 (원) */
  subMaterialPerM2: number;
  /** 기본 마진율 (0.15 = 15%) */
  marginRate: number;

  /** --- 물량 산출 계수 --- */
  lossRate: number;
  patternedLossRate: number;
  openingDeductionRate: number;
  ceilingHeightM: number;
  wallAreaFactor: number;
  ceilingAreaFactor: number;
  exclusiveRatio: number;
}

export const DEFAULT_SETTINGS: PriceSettings = {
  rollPrice: {
    silk: WALLPAPER_SPECS.silk.defaultRollPrice,
    wide: WALLPAPER_SPECS.wide.defaultRollPrice,
    narrow: WALLPAPER_SPECS.narrow.defaultRollPrice,
  },
  rollsPerWorkerDay: {
    silk: WALLPAPER_SPECS.silk.rollsPerWorkerDay,
    wide: WALLPAPER_SPECS.wide.rollsPerWorkerDay,
    narrow: WALLPAPER_SPECS.narrow.rollsPerWorkerDay,
  },
  dailyWage: DEFAULTS.dailyWage,
  subMaterialPerM2: DEFAULTS.subMaterialPerM2,
  marginRate: DEFAULTS.marginRate,

  lossRate: DEFAULTS.lossRate,
  patternedLossRate: DEFAULTS.patternedLossRate,
  openingDeductionRate: DEFAULTS.openingDeductionRate,
  ceilingHeightM: DEFAULTS.ceilingHeightM,
  wallAreaFactor: DEFAULTS.wallAreaFactor,
  ceilingAreaFactor: DEFAULTS.ceilingAreaFactor,
  exclusiveRatio: DEFAULTS.exclusiveRatio,
};

const money = z.coerce.number().int().min(0).max(100_000_000);
const percent = z.coerce.number().min(0).max(100);

export const settingsSchema = z.object({
  rollPrice: z.object({
    silk: money,
    wide: money,
    narrow: money,
  }),
  rollsPerWorkerDay: z.object({
    silk: z.coerce.number().int().min(1).max(200),
    wide: z.coerce.number().int().min(1).max(200),
    narrow: z.coerce.number().int().min(1).max(200),
  }),
  dailyWage: money,
  subMaterialPerM2: money,
  marginRate: z.coerce.number().min(0).max(5),

  lossRate: z.coerce.number().min(0).max(1),
  patternedLossRate: z.coerce.number().min(0).max(1),
  openingDeductionRate: z.coerce.number().min(0).max(1),
  ceilingHeightM: z.coerce.number().min(1).max(10),
  wallAreaFactor: z.coerce.number().min(0.1).max(20),
  ceilingAreaFactor: z.coerce.number().min(0).max(20),
  exclusiveRatio: z.coerce.number().min(0.1).max(1),
}) satisfies z.ZodType<PriceSettings>;

/**
 * 설정 폼을 도메인 값으로 바꾼다.
 *
 * 비율은 화면에서 % 로 받는다. 0.18 대신 18을 입력하게 하는 편이
 * 손으로 고치기 훨씬 낫다.
 */
export function parseSettingsForm(formData: FormData) {
  const num = (name: string) => formData.get(name);
  const rate = (name: string) => {
    const parsed = percent.safeParse(formData.get(name));
    return parsed.success ? parsed.data / 100 : Number.NaN;
  };

  return settingsSchema.safeParse({
    rollPrice: {
      silk: num("rollPrice.silk"),
      wide: num("rollPrice.wide"),
      narrow: num("rollPrice.narrow"),
    },
    rollsPerWorkerDay: {
      silk: num("rollsPerWorkerDay.silk"),
      wide: num("rollsPerWorkerDay.wide"),
      narrow: num("rollsPerWorkerDay.narrow"),
    },
    dailyWage: num("dailyWage"),
    subMaterialPerM2: num("subMaterialPerM2"),
    marginRate: rate("marginPercent"),

    lossRate: rate("lossPercent"),
    patternedLossRate: rate("patternedLossPercent"),
    openingDeductionRate: rate("openingDeductionPercent"),
    ceilingHeightM: num("ceilingHeightM"),
    wallAreaFactor: num("wallAreaFactor"),
    ceilingAreaFactor: num("ceilingAreaFactor"),
    exclusiveRatio: rate("exclusivePercent"),
  });
}

/** 저장된 값이 일부만 있어도 나머지는 기본값으로 채운다. */
export function withDefaults(
  stored: Partial<PriceSettings> | null | undefined,
): PriceSettings {
  if (!stored) return DEFAULT_SETTINGS;

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    rollPrice: { ...DEFAULT_SETTINGS.rollPrice, ...stored.rollPrice },
    rollsPerWorkerDay: {
      ...DEFAULT_SETTINGS.rollsPerWorkerDay,
      ...stored.rollsPerWorkerDay,
    },
  };
}
