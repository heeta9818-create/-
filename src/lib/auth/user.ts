import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/repository";
import { checkDevAuthBypass } from "./dev-bypass";

export interface AppUser {
  id: string;
  email: string;
  displayName: string;
}

/** Supabase 없이 개발할 때 쓰는 고정 사용자 */
export const DEV_USER: AppUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "dev@localhost",
  displayName: "개발 모드",
};

/** 지금 로그인이 꺼진(개발) 모드인지 */
export function isAuthDisabled(): boolean {
  return !isSupabaseConfigured();
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (isAuthDisabled()) {
    const decision = checkDevAuthBypass({
      nodeEnv: process.env.NODE_ENV,
      allowInsecureDevAuth: process.env.ALLOW_INSECURE_DEV_AUTH,
    });
    if (!decision.allowed) throw new Error(decision.reason);
    return DEV_USER;
  }

  const supabase = await createSupabaseServerClient();
  // getSession()이 아니라 getUser()를 쓴다. getSession은 쿠키를 그대로
  // 믿기 때문에 서버에서 신뢰하면 안 된다.
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;

  const metadata = data.user.user_metadata ?? {};
  const name =
    (typeof metadata.name === "string" && metadata.name) ||
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    (data.user.email ?? "").split("@")[0];

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    displayName: name || "사용자",
  };
}

/**
 * 로그인이 필요한 페이지·서버 액션에서 쓴다.
 * 서버 액션은 UI를 거치지 않고 POST로 직접 호출될 수 있으므로
 * 페이지에서 한 번 확인했더라도 액션 안에서 다시 확인해야 한다.
 */
export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
