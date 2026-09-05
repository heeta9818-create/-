import { describe, expect, it } from "vitest";
import { parseEstimateInput } from "./estimate-schema";
import { calculateEstimate } from "./estimate";

function payload(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    scope: { method: "pyeong", pyeong: 32, basis: "supply" },
    kind: "silk",
    includeCeiling: true,
    rollPrice: 35000,
    dailyWage: 250000,
    marginRate: 0.15,
    includeVat: false,
    ...overrides,
  });
}

describe("견적 입력 파싱", () => {
  it("정상 입력을 통과시킨다", () => {
    const parsed = parseEstimateInput(payload());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.kind).toBe("silk");
  });

  it("실측 입력도 통과시킨다", () => {
    const parsed = parseEstimateInput(
      payload({
        scope: {
          method: "measured",
          rooms: [
            { name: "안방", widthM: 3.5, depthM: 3, heightM: 2.3, doors: 1, windows: 1 },
          ],
        },
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("문자열이 아니면 거부한다", () => {
    for (const value of [null, undefined, 42, {}]) {
      expect(parseEstimateInput(value).success).toBe(false);
    }
  });

  it("JSON이 깨졌으면 거부한다", () => {
    const parsed = parseEstimateInput("{not json");
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error).toContain("읽을 수 없습니다");
  });

  it("음수 단가를 거부한다 — 합계를 마음대로 낮출 수 없어야 한다", () => {
    expect(parseEstimateInput(payload({ rollPrice: -100000 })).success).toBe(false);
    expect(parseEstimateInput(payload({ dailyWage: -1 })).success).toBe(false);
    expect(parseEstimateInput(payload({ discount: -50000 })).success).toBe(false);
  });

  it("말이 안 되는 크기를 거부한다", () => {
    expect(parseEstimateInput(payload({ scope: { method: "pyeong", pyeong: 99999, basis: "supply" } })).success).toBe(false);
    expect(parseEstimateInput(payload({ rollPrice: 9_999_999_999 })).success).toBe(false);
    expect(parseEstimateInput(payload({ lossRate: 5 })).success).toBe(false);
  });

  it("방이 없는 실측 입력을 거부한다", () => {
    const parsed = parseEstimateInput(
      payload({ scope: { method: "measured", rooms: [] } }),
    );
    expect(parsed.success).toBe(false);
  });

  it("모르는 벽지 종류를 거부한다", () => {
    expect(parseEstimateInput(payload({ kind: "gold" })).success).toBe(false);
  });

  it("산출 방식이 없으면 거부한다", () => {
    expect(parseEstimateInput(payload({ scope: { pyeong: 32 } })).success).toBe(false);
  });

  it("통과한 입력은 견적 엔진에 그대로 넣을 수 있다", () => {
    const parsed = parseEstimateInput(payload());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = calculateEstimate(parsed.data);
    expect(result.total).toBeGreaterThan(0);
    expect(result.rolls).toBeGreaterThan(0);
  });

  it("모르는 필드는 무시하고 통과시킨다", () => {
    const parsed = parseEstimateInput(payload({ total: 1, evil: "x" }));
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("evil");
  });
});
