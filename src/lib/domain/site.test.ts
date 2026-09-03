import { describe, expect, it } from "vitest";
import { parseSiteForm } from "./site";
import { estimateForSite } from "./site-estimate";

function form(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const base: Record<string, string> = {
    customerName: "김철수",
    phone: "010-1234-5678",
    address: "서울시 강남구",
    pyeong: "32",
    areaBasis: "supply",
    wallpaperKind: "silk",
    includeCeiling: "on",
    status: "confirmed",
    memo: "",
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) {
    if (value !== "") data.set(key, value);
  }
  return data;
}

describe("현장 폼 파싱", () => {
  it("정상 입력을 도메인 모델로 바꾼다", () => {
    const parsed = parseSiteForm(form());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    expect(parsed.data.customerName).toBe("김철수");
    expect(parsed.data.pyeong).toBe(32);
    expect(parsed.data.includeCeiling).toBe(true);
    expect(parsed.data.patterned).toBe(false);
  });

  it("고객명이 비면 거부한다", () => {
    const parsed = parseSiteForm(form({ customerName: "" }));
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues[0].message).toContain("고객명");
  });

  it("평수가 0 이하면 거부한다 (브라우저 검증을 우회한 요청 대비)", () => {
    for (const value of ["0", "-5"]) {
      const parsed = parseSiteForm(form({ pyeong: value }));
      expect(parsed.success).toBe(false);
      if (parsed.success) continue;
      expect(parsed.error.issues[0].message).toContain("평수는 0보다");
    }
  });

  it("평수가 숫자가 아니면 거부한다", () => {
    expect(parseSiteForm(form({ pyeong: "서른두평" })).success).toBe(false);
  });

  it("허용되지 않은 상태·벽지 종류를 거부한다", () => {
    expect(parseSiteForm(form({ status: "hacked" })).success).toBe(false);
    expect(parseSiteForm(form({ wallpaperKind: "gold" })).success).toBe(false);
  });

  it("체크박스를 끄면 false로 들어간다", () => {
    const data = form();
    data.delete("includeCeiling");
    const parsed = parseSiteForm(data);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.includeCeiling).toBe(false);
  });
});

describe("현장 기본 견적", () => {
  it("현장 정보만으로 견적 총액이 나온다", () => {
    const parsed = parseSiteForm(form());
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = estimateForSite(parsed.data);
    expect(result.rolls).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    // 부가세는 별도지만 마진은 기본값이 붙는다. 견적 계산기 초기값과
    // 같아야 아무것도 바꾸지 않고 저장했을 때 금액이 튀지 않는다.
    expect(result.vat).toBe(0);
    expect(result.items.some((i) => i.label === "관리비·마진")).toBe(true);
  });

  it("천장을 빼면 견적이 내려간다", () => {
    const withCeiling = parseSiteForm(form());
    const noCeilingData = form();
    noCeilingData.delete("includeCeiling");
    const withoutCeiling = parseSiteForm(noCeilingData);

    if (!withCeiling.success || !withoutCeiling.success) throw new Error("파싱 실패");
    expect(estimateForSite(withoutCeiling.data).total).toBeLessThan(
      estimateForSite(withCeiling.data).total,
    );
  });
});
