import { describe, expect, it } from "vitest";
import { calculateEstimate, type EstimateInput } from "./estimate";
import { resolveEstimateInput } from "./resolve-estimate";
import { DEFAULT_SETTINGS, type PriceSettings } from "./settings";

const bare: EstimateInput = {
  scope: { method: "pyeong", pyeong: 32, basis: "supply" },
  kind: "silk",
  includeCeiling: true,
};

const cheap: PriceSettings = {
  ...DEFAULT_SETTINGS,
  rollPrice: { silk: 20_000, wide: 10_000, narrow: 5_000 },
  dailyWage: 180_000,
  subMaterialPerM2: 800,
  marginRate: 0.05,
  wallAreaFactor: 2.0,
};

describe("단가표를 입력에 박아 넣기", () => {
  it("비어 있던 자리를 전부 채운다", () => {
    const resolved = resolveEstimateInput(bare, DEFAULT_SETTINGS);

    for (const key of [
      "rollPrice",
      "rollsPerWorkerDay",
      "dailyWage",
      "subMaterialPerM2",
      "marginRate",
      "lossRate",
      "openingDeductionRate",
      "ceilingHeightM",
      "wallAreaFactor",
      "ceilingAreaFactor",
      "exclusiveRatio",
    ] as const) {
      expect(resolved[key], key).toBeTypeOf("number");
    }
  });

  it("벽지 종류에 맞는 단가와 시공량을 가져온다", () => {
    const silk = resolveEstimateInput({ ...bare, kind: "silk" }, cheap);
    const narrow = resolveEstimateInput({ ...bare, kind: "narrow" }, cheap);

    expect(silk.rollPrice).toBe(20_000);
    expect(narrow.rollPrice).toBe(5_000);
    expect(silk.rollsPerWorkerDay).toBe(cheap.rollsPerWorkerDay.silk);
    expect(narrow.rollsPerWorkerDay).toBe(cheap.rollsPerWorkerDay.narrow);
  });

  it("사용자가 직접 넣은 값은 건드리지 않는다", () => {
    const resolved = resolveEstimateInput(
      { ...bare, rollPrice: 99_000, dailyWage: 300_000, marginRate: 0.4 },
      cheap,
    );

    expect(resolved.rollPrice).toBe(99_000);
    expect(resolved.dailyWage).toBe(300_000);
    expect(resolved.marginRate).toBe(0.4);
  });

  it("무늬 벽지는 무늬 로스율을 쓴다", () => {
    expect(resolveEstimateInput(bare, DEFAULT_SETTINGS).lossRate).toBe(
      DEFAULT_SETTINGS.lossRate,
    );
    expect(
      resolveEstimateInput({ ...bare, patterned: true }, DEFAULT_SETTINGS)
        .lossRate,
    ).toBe(DEFAULT_SETTINGS.patternedLossRate);
  });

  it("0은 유효한 값이라 기본값으로 덮이지 않는다", () => {
    const resolved = resolveEstimateInput(
      { ...bare, marginRate: 0, travelFee: 0, lossRate: 0 },
      DEFAULT_SETTINGS,
    );

    expect(resolved.marginRate).toBe(0);
    expect(resolved.lossRate).toBe(0);
  });
});

describe("단가표를 바꿔도 저장된 견적은 재현된다", () => {
  // 이 기능의 전제. 저장 시점에 단가를 입력에 박아 두지 않으면,
  // 단가표를 고치는 순간 지난 견적의 "이 값으로 다시 잡기"가 다른 금액을 낸다.
  it("저장한 입력은 나중에 다시 계산해도 같은 금액", () => {
    const saved = resolveEstimateInput(bare, DEFAULT_SETTINGS);
    const savedTotal = calculateEstimate(saved).total;

    // 사장님이 단가표를 싹 갈아엎었다.
    const later = calculateEstimate(saved).total;

    expect(later).toBe(savedTotal);
    // 같은 입력을 새 단가표로 다시 resolve해도 이미 박힌 값이 이긴다.
    expect(calculateEstimate(resolveEstimateInput(saved, cheap)).total).toBe(
      savedTotal,
    );
  });

  it("박아 두지 않은 입력은 단가표를 따라 움직인다", () => {
    // 대조군. 그래서 저장 전에 반드시 resolve를 거쳐야 한다.
    const withDefault = calculateEstimate(
      resolveEstimateInput(bare, DEFAULT_SETTINGS),
    ).total;
    const withCheap = calculateEstimate(
      resolveEstimateInput(bare, cheap),
    ).total;

    expect(withCheap).not.toBe(withDefault);
    expect(withCheap).toBeLessThan(withDefault);
  });

  it("면적 계수도 함께 박힌다", () => {
    const saved = resolveEstimateInput(bare, DEFAULT_SETTINGS);
    const rollsThen = calculateEstimate(saved).rolls;

    // wallAreaFactor를 낮춘 단가표로 다시 resolve해도 물량이 그대로여야 한다.
    const rollsNow = calculateEstimate(resolveEstimateInput(saved, cheap)).rolls;
    expect(rollsNow).toBe(rollsThen);
  });
});
