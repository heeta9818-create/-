import { describe, expect, it } from "vitest";
import { calculateEstimate } from "./estimate";
import { toPublicItems, toPublicResult } from "./public-estimate";

const base = {
  scope: { method: "pyeong", pyeong: 32, basis: "supply" },
  kind: "silk",
  includeCeiling: true,
} as const;

describe("고객용 견적 항목", () => {
  it("마진을 따로 보여주지 않는다", () => {
    const result = calculateEstimate({ ...base, marginRate: 0.15 });
    expect(result.items.some((i) => i.label === "관리비·마진")).toBe(true);

    const items = toPublicItems(result);
    expect(items.some((i) => i.label.includes("마진"))).toBe(false);
  });

  it("마진은 시공비에 합쳐진다", () => {
    const result = calculateEstimate({ ...base, marginRate: 0.2 });
    const labor = result.items.find((i) => i.label === "시공 인건비")!.amount;
    const margin = result.items.find((i) => i.label === "관리비·마진")!.amount;

    const publicLabor = toPublicItems(result).find((i) => i.label === "시공비");
    expect(publicLabor?.amount).toBe(labor + margin);
  });

  it("벽지와 부자재는 자재비로 묶인다", () => {
    const result = calculateEstimate(base);
    const wallpaper = result.items.find((i) => i.label.startsWith("실크"))!.amount;
    const sub = result.items.find((i) => i.label === "부자재비")!.amount;

    const material = toPublicItems(result).find((i) => i.label === "자재비");
    expect(material?.amount).toBe(wallpaper + sub);
    expect(material?.detail).toContain(`${result.rolls}롤`);
    expect(material?.detail).toContain("부자재");
  });

  it("합계는 절대 바뀌지 않는다", () => {
    const inputs = [
      { ...base, marginRate: 0.15 },
      { ...base, marginRate: 0, includeVat: true },
      { ...base, marginRate: 0.3, travelFee: 30_000, discount: 50_000 },
      {
        ...base,
        extras: [{ label: "구벽지 철거", amount: 150_000 }],
        marginRate: 0.1,
      },
    ];

    for (const input of inputs) {
      const result = calculateEstimate(input);
      const sum = toPublicItems(result).reduce((acc, i) => acc + i.amount, 0);
      expect(sum).toBe(result.subtotal);
      expect(toPublicResult(result).total).toBe(result.total);
    }
  });

  it("추가 작업·출장비·할인은 그대로 남는다", () => {
    const result = calculateEstimate({
      ...base,
      extras: [{ label: "구벽지 철거", amount: 150_000 }],
      travelFee: 30_000,
      discount: 50_000,
    });

    const labels = toPublicItems(result).map((i) => i.label);
    expect(labels).toContain("구벽지 철거");
    expect(labels).toContain("출장비");
    expect(labels).toContain("할인");
  });

  it("마진이 0이면 시공비만 남는다", () => {
    const result = calculateEstimate({ ...base, marginRate: 0 });
    const items = toPublicItems(result);
    const labor = result.items.find((i) => i.label === "시공 인건비")!.amount;

    expect(items.find((i) => i.label === "시공비")?.amount).toBe(labor);
  });

  it("합쳐진 금액에 맞지 않는 단가 설명을 남기지 않는다", () => {
    // "2품 × 250,000원"인데 금액은 마진까지 더해진 684,917원 —
    // 고객이 계산기를 두드리면 바로 어긋나는 견적서가 된다.
    const result = calculateEstimate({ ...base, marginRate: 0.15 });
    const items = toPublicItems(result);

    for (const item of items) {
      expect(item.detail).not.toContain("×");
    }
    expect(items.find((i) => i.label === "시공비")?.detail).toBe(
      `${result.workerDays}품`,
    );
  });

  it("분류가 없는 옛 스냅샷도 같은 합계로 묶인다", () => {
    // 견적 이력이 먼저 나왔고 group은 나중에 붙었다. 이미 저장된 견적의
    // 고객 화면이 빈 표가 되면 "저장된 금액은 변하지 않는다"가 깨진다.
    const result = calculateEstimate({
      ...base,
      marginRate: 0.15,
      travelFee: 30_000,
      discount: 20_000,
    });
    const legacy = {
      ...result,
      items: result.items.map(({ label, detail, amount }) => ({
        label,
        detail,
        amount,
      })),
    } as typeof result;

    const items = toPublicItems(legacy);
    expect(items.reduce((acc, i) => acc + i.amount, 0)).toBe(result.subtotal);
    expect(items.map((i) => i.label).slice(0, 2)).toEqual(["자재비", "시공비"]);
    expect(items.some((i) => i.label.includes("마진"))).toBe(false);
  });

  it("항목 순서는 자재비 → 시공비 → 나머지", () => {
    const result = calculateEstimate({
      ...base,
      marginRate: 0.15,
      travelFee: 30_000,
    });
    const labels = toPublicItems(result).map((i) => i.label);
    expect(labels.slice(0, 2)).toEqual(["자재비", "시공비"]);
  });
});
