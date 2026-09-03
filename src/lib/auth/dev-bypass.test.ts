import { describe, expect, it } from "vitest";
import { checkDevAuthBypass } from "./dev-bypass";

describe("로그인 우회 가드", () => {
  it("개발 환경에서는 우회를 허용한다", () => {
    expect(
      checkDevAuthBypass({ nodeEnv: "development", allowInsecureDevAuth: undefined }),
    ).toEqual({ allowed: true });
  });

  it("테스트 환경에서도 허용한다", () => {
    expect(
      checkDevAuthBypass({ nodeEnv: "test", allowInsecureDevAuth: undefined })
        .allowed,
    ).toBe(true);
  });

  it("프로덕션에서는 막는다 — 인증 없이 배포되는 사고를 방지", () => {
    const decision = checkDevAuthBypass({
      nodeEnv: "production",
      allowInsecureDevAuth: undefined,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("Supabase");
  });

  it("프로덕션이라도 명시적으로 켜면 허용한다", () => {
    expect(
      checkDevAuthBypass({
        nodeEnv: "production",
        allowInsecureDevAuth: "true",
      }).allowed,
    ).toBe(true);
  });

  it('"true"가 아닌 값은 켜진 것으로 보지 않는다', () => {
    for (const value of ["1", "yes", "TRUE", ""]) {
      expect(
        checkDevAuthBypass({
          nodeEnv: "production",
          allowInsecureDevAuth: value,
        }).allowed,
      ).toBe(false);
    }
  });
});
