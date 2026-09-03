/**
 * Supabase가 돌려주는 영문 에러를 사용자에게 보여줄 한국어 문구로 바꾼다.
 *
 * 주의: 로그인 실패 사유를 지나치게 자세히 알려주면 계정 존재 여부가
 * 새어나간다. "아이디가 없음"과 "비밀번호가 틀림"은 같은 문구로 합친다.
 */
export function authErrorMessage(raw: string | undefined | null): string {
  const message = (raw ?? "").toLowerCase();

  if (!message) return "요청을 처리할 수 없습니다. 잠시 후 다시 시도하세요.";

  if (message.includes("invalid login credentials")) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (message.includes("email not confirmed")) {
    return "이메일 인증이 아직 안 됐습니다. 받은 메일의 링크를 눌러주세요.";
  }
  if (message.includes("user already registered")) {
    return "이미 가입된 이메일입니다. 로그인해 주세요.";
  }
  if (message.includes("password should be at least")) {
    return "비밀번호는 8자 이상으로 정해주세요.";
  }
  if (
    message.includes("rate limit") ||
    message.includes("too many requests") ||
    message.includes("for security purposes")
  ) {
    return "시도가 너무 잦습니다. 잠시 후 다시 시도하세요.";
  }
  if (message.includes("provider is not enabled")) {
    return "이 로그인 방식은 아직 설정되지 않았습니다.";
  }
  if (message.includes("fetch failed") || message.includes("network")) {
    return "서버에 연결할 수 없습니다. 네트워크를 확인하세요.";
  }

  return "로그인에 실패했습니다. 잠시 후 다시 시도하세요.";
}
