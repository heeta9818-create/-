import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  parseSettingsForm,
  withDefaults,
} from "./settings";

function form(overrides: Record<string, string> = {}): FormData {
  const base: Record<string, string> = {
    "rollPrice.silk": "35000",
    "rollPrice.wide": "18000",
    "rollPrice.narrow": "7000",
    "rollsPerWorkerDay.silk": "12",
    "rollsPerWorkerDay.wide": "14",
    "rollsPerWorkerDay.narrow": "32",
    dailyWage: "250000",
    subMaterialPerM2: "1200",
    marginPercent: "15",
    lossPercent: "10",
    patternedLossPercent: "18",
    openingDeductionPercent: "50",
    ceilingHeightM: "2.3",
    wallAreaFactor: "2.4",
    ceilingAreaFactor: "1",
    exclusivePercent: "75",
    ...overrides,
  };

  const data = new FormData();
  for (const [key, value] of Object.entries(base)) data.set(key, value);
  return data;
}

describe("단가표 폼 파싱", () => {
  it("기본값 그대로 넣으면 기본 단가표가 된다", () => {
    const parsed = parseSettingsForm(form());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toEqual(DEFAULT_SETTINGS);
  });

  it("%로 받은 값을 비율로 바꾼다", () => {
    const parsed = parseSettingsForm(
      form({ marginPercent: "22", lossPercent: "12", exclusivePercent: "80" }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.marginRate).toBeCloseTo(0.22, 5);
    expect(parsed.data.lossRate).toBeCloseTo(0.12, 5);
    expect(parsed.data.exclusiveRatio).toBeCloseTo(0.8, 5);
  });

  it("음수 단가를 거부한다", () => {
    expect(parseSettingsForm(form({ dailyWage: "-1" })).success).toBe(false);
    expect(parseSettingsForm(form({ "rollPrice.silk": "-5000" })).success).toBe(
      false,
    );
  });

  it("말이 안 되는 비율을 거부한다", () => {
    expect(parseSettingsForm(form({ marginPercent: "900" })).success).toBe(false);
    expect(parseSettingsForm(form({ lossPercent: "150" })).success).toBe(false);
    expect(parseSettingsForm(form({ exclusivePercent: "0" })).success).toBe(false);
  });

  it("하루 시공량 0을 거부한다 — 품 계산이 무한대가 된다", () => {
    expect(
      parseSettingsForm(form({ "rollsPerWorkerDay.silk": "0" })).success,
    ).toBe(false);
  });

  it("숫자가 아니면 거부한다", () => {
    expect(parseSettingsForm(form({ dailyWage: "이십오만원" })).success).toBe(
      false,
    );
  });

  it("천장고 0을 거부한다", () => {
    expect(parseSettingsForm(form({ ceilingHeightM: "0" })).success).toBe(false);
  });
});

describe("저장된 값 채우기", () => {
  it("저장한 적 없으면 기본 단가표", () => {
    expect(withDefaults(null)).toEqual(DEFAULT_SETTINGS);
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("나중에 늘어난 항목은 기본값으로 채운다", () => {
    // 예전 버전이 저장해 둔, 항목이 모자란 단가표
    const filled = withDefaults({ dailyWage: 300_000 });

    expect(filled.dailyWage).toBe(300_000);
    expect(filled.subMaterialPerM2).toBe(DEFAULT_SETTINGS.subMaterialPerM2);
    expect(filled.rollPrice).toEqual(DEFAULT_SETTINGS.rollPrice);
  });

  it("벽지 종류가 일부만 저장돼 있어도 나머지를 채운다", () => {
    const filled = withDefaults({ rollPrice: { silk: 50_000 } as never });

    expect(filled.rollPrice.silk).toBe(50_000);
    expect(filled.rollPrice.wide).toBe(DEFAULT_SETTINGS.rollPrice.wide);
    expect(filled.rollPrice.narrow).toBe(DEFAULT_SETTINGS.rollPrice.narrow);
  });
});
