"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { authErrorMessage } from "@/lib/auth/errors";
import { isAuthDisabled } from "@/lib/auth/user";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";

export interface AuthFormState {
  error?: string;
  notice?: string;
  /** 실패했을 때 입력한 이메일을 돌려줘서 다시 타이핑하지 않게 한다. */
  email?: string;
}

interface Credentials {
  email: string;
  password: string;
}

function readCredentials(formData: FormData): Credentials | null {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !email.includes("@") || !password) return null;
  return { email, password };
}

/** OAuth 콜백이 돌아올 주소. 배포 도메인이 바뀌어도 요청 헤더에서 뽑는다. */
async function originFromRequest(): Promise<string> {
  const headerList = await headers();
  const forwardedHost = headerList.get("x-forwarded-host");
  const host = forwardedHost ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (isAuthDisabled()) redirect("/");

  const email = String(formData.get("email") ?? "").trim();
  const credentials = readCredentials(formData);
  if (!credentials) {
    return { error: "이메일과 비밀번호를 입력하세요.", email };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) return { error: authErrorMessage(error.message), email };

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  if (isAuthDisabled()) redirect("/");

  const email = String(formData.get("email") ?? "").trim();
  const credentials = readCredentials(formData);
  if (!credentials) {
    return { error: "이메일과 비밀번호를 입력하세요.", email };
  }
  if (credentials.password.length < 8) {
    return { error: "비밀번호는 8자 이상으로 정해주세요.", email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...credentials,
    options: { emailRedirectTo: `${await originFromRequest()}/auth/callback` },
  });
  if (error) return { error: authErrorMessage(error.message), email };

  // 프로젝트 설정에서 이메일 인증을 켜 두면 세션 없이 돌아온다.
  if (!data.session) {
    return {
      notice:
        "가입 확인 메일을 보냈습니다. 메일의 링크를 눌러 인증을 마치면 로그인됩니다.",
      email,
    };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

export async function signInWithKakao(_formData: FormData): Promise<void> {
  if (isAuthDisabled()) redirect("/");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "kakao",
    options: { redirectTo: `${await originFromRequest()}/auth/callback` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(authErrorMessage(error?.message))}`);
  }

  redirect(data.url);
}

export async function signOut(_formData: FormData): Promise<void> {
  if (!isAuthDisabled()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
