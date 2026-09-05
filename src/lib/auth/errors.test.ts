import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errors";

describe("인증 에러 문구", () => {
  it("잘못된 자격증명은 계정 존재 여부를 흘리지 않는다", () => {
    const message = authErrorMessage("Invalid login credentials");
    expect(message).toBe("이메일 또는 비밀번호가 올바르지 않습니다.");
    expect(message).not.toContain("없는");
  });

  it("이메일 미인증을 안내한다", () => {
    expect(authErrorMessage("Email not confirmed")).toContain("이메일 인증");
  });

  it("중복 가입을 안내한다", () => {
    expect(authErrorMessage("User already registered")).toContain("이미 가입");
  });

  it("요청 제한을 안내한다", () => {
    expect(
      authErrorMessage("For security purposes, you can only request this after 30 seconds"),
    ).toContain("잠시 후");
  });

  it("모르는 에러도 한국어 기본 문구로 떨어진다", () => {
    const message = authErrorMessage("some unmapped supabase error");
    expect(message).toBe("로그인에 실패했습니다. 잠시 후 다시 시도하세요.");
  });

  it("빈 값도 안전하게 처리한다", () => {
    for (const value of [undefined, null, ""]) {
      expect(authErrorMessage(value)).toContain("다시 시도");
    }
  });
});
