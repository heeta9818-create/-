import { describe, expect, it } from "vitest";
import { calculateEstimate } from "./estimate";
import { rollAreaM2 } from "./wallpaper";

describe("롤 규격", () => {
  it("실크벽지 한 롤은 약 16.5m²", () => {
    expect(rollAreaM2("silk")).toBeCloseTo(16.536, 3);
  });

  it("소폭합지 한 롤은 약 6.6m²", () => {
    expect(rollAreaM2("narrow")).toBeCloseTo(6.625, 3);
  });
});

describe("실측 산출", () => {
  const room = {
    name: "안방",
    widthM: 3.5,
    depthM: 3.0,
    heightM: 2.3,
    doors: 1,
    windows: 1,
  };

  it("벽면적은 둘레 × 천장고", () => {
    const result = calculateEstimate({
      scope: { method: "measured", rooms: [room] },
      kind: "silk",
      includeCeiling: false,
    });
    // 2 * (3.5 + 3.0) * 2.3 = 29.9
    expect(result.area.wallAreaM2).toBeCloseTo(29.9, 1);
  });

  it("천장 포함 시 천장면적이 더해진다", () => {
    const withCeiling = calculateEstimate({
      scope: { method: "measured", rooms: [room] },
      kind: "silk",
      includeCeiling: true,
    });
    expect(withCeiling.area.ceilingAreaM2).toBeCloseTo(10.5, 1);
    expect(withCeiling.area.netAreaM2).toBeGreaterThan(29.9);
  });

  it("개구부는 기본 50%만 공제한다", () => {
    const result = calculateEstimate({
      scope: { method: "measured", rooms: [room] },
      kind: "silk",
      includeCeiling: false,
    });
    // (1.8 + 1.5) * 0.5 = 1.65 → 표시값은 소수 1자리로 반올림
    expect(result.area.deductedAreaM2).toBe(1.7);
    expect(result.area.netAreaM2).toBe(28.3);
  });

  it("공제율 1.0이면 개구부 전체를 뺀다", () => {
    const result = calculateEstimate({
      scope: { method: "measured", rooms: [room] },
      kind: "silk",
      includeCeiling: false,
      openingDeductionRate: 1,
    });
    expect(result.area.deductedAreaM2).toBe(3.3);
  });

  it("무늬 벽지는 로스율이 올라가고 롤 수가 줄지 않는다", () => {
    const plain = calculateEstimate({
      scope: { method: "measured", rooms: Array(6).fill(room) },
      kind: "silk",
      includeCeiling: true,
    });
    const patterned = calculateEstimate({
      scope: { method: "measured", rooms: Array(6).fill(room) },
      kind: "silk",
      includeCeiling: true,
      patterned: true,
    });
    expect(patterned.area.lossRate).toBeGreaterThan(plain.area.lossRate);
    expect(patterned.rolls).toBeGreaterThanOrEqual(plain.rolls);
  });

  it("롤 수는 소요면적을 롤 면적으로 나눠 올림한다", () => {
    const result = calculateEstimate({
      scope: { method: "measured", rooms: [room] },
      kind: "silk",
      includeCeiling: true,
    });
    const expected = Math.ceil(result.area.requiredAreaM2 / result.rollAreaM2);
    expect(result.rolls).toBe(expected);
  });
});

describe("평수 간이 산출", () => {
  it("25평(공급) 실크 + 천장 도배는 13~16롤 범위에 들어온다", () => {
    const result = calculateEstimate({
      scope: { method: "pyeong", pyeong: 25, basis: "supply" },
      kind: "silk",
      includeCeiling: true,
    });
    expect(result.rolls).toBeGreaterThanOrEqual(13);
    expect(result.rolls).toBeLessThanOrEqual(16);
  });

  it("같은 숫자라도 전용면적 기준이면 물량이 더 많다", () => {
    const supply = calculateEstimate({
      scope: { method: "pyeong", pyeong: 25, basis: "supply" },
      kind: "silk",
      includeCeiling: true,
    });
    const exclusive = calculateEstimate({
      scope: { method: "pyeong", pyeong: 25, basis: "exclusive" },
      kind: "silk",
      includeCeiling: true,
    });
    expect(exclusive.rolls).toBeGreaterThan(supply.rolls);
  });

  it("소폭합지는 롤이 작아서 롤 수가 훨씬 많다", () => {
    const base = {
      scope: { method: "pyeong", pyeong: 25, basis: "supply" },
      includeCeiling: true,
    } as const;
    const silk = calculateEstimate({ ...base, kind: "silk" });
    const narrow = calculateEstimate({ ...base, kind: "narrow" });
    expect(narrow.rolls).toBeGreaterThan(silk.rolls * 2);
  });
});

describe("금액 산출", () => {
  const base = {
    scope: { method: "pyeong", pyeong: 25, basis: "supply" },
    kind: "silk",
    includeCeiling: true,
  } as const;

  it("합계는 항목 금액의 합", () => {
    const result = calculateEstimate(base);
    const sum = result.items.reduce((acc, item) => acc + item.amount, 0);
    expect(result.subtotal).toBe(sum);
  });

  it("부가세 미포함이 기본", () => {
    const result = calculateEstimate(base);
    expect(result.vat).toBe(0);
    expect(result.total).toBe(result.subtotal);
  });

  it("부가세 포함 시 10%가 붙는다", () => {
    const result = calculateEstimate({ ...base, includeVat: true });
    expect(result.vat).toBe(Math.round(result.subtotal * 0.1));
    expect(result.total).toBe(result.subtotal + result.vat);
  });

  it("할인은 음수 항목으로 들어가 합계를 낮춘다", () => {
    const plain = calculateEstimate(base);
    const discounted = calculateEstimate({ ...base, discount: 50_000 });
    expect(discounted.total).toBe(plain.total - 50_000);
    expect(discounted.items.at(-1)?.amount).toBe(-50_000);
  });

  it("마진은 원가 합계에 대해 붙는다", () => {
    const result = calculateEstimate({ ...base, marginRate: 0.2 });
    const margin = result.items.find((i) => i.label === "관리비·마진");
    const costBase = result.items
      .filter((i) => i.label !== "관리비·마진")
      .reduce((acc, i) => acc + i.amount, 0);
    expect(margin?.amount).toBe(Math.round(costBase * 0.2));
  });

  it("추가 작업과 출장비가 항목에 포함된다", () => {
    const result = calculateEstimate({
      ...base,
      extras: [{ label: "구벽지 철거", amount: 150_000 }],
      travelFee: 30_000,
    });
    const labels = result.items.map((i) => i.label);
    expect(labels).toContain("구벽지 철거");
    expect(labels).toContain("출장비");
  });
});

describe("경계값", () => {
  it("면적이 0이면 롤도 품도 0", () => {
    const result = calculateEstimate({
      scope: { method: "measured", rooms: [] },
      kind: "silk",
      includeCeiling: true,
    });
    expect(result.rolls).toBe(0);
    expect(result.workerDays).toBe(0);
  });

  it("개구부가 벽면적보다 커도 음수가 되지 않는다", () => {
    const result = calculateEstimate({
      scope: {
        method: "measured",
        rooms: [{ name: "창고", widthM: 0.5, depthM: 0.5, doors: 5 }],
      },
      kind: "silk",
      includeCeiling: false,
      openingDeductionRate: 1,
    });
    expect(result.area.netAreaM2).toBe(0);
    expect(result.rolls).toBe(0);
  });
});
