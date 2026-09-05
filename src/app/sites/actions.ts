"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import {
  getSettingsRepository,
  getSiteRepository,
} from "@/lib/data/repository";
import { estimateForSite } from "@/lib/domain/site-estimate";
import { parseSiteForm } from "@/lib/domain/site";

export interface FormState {
  error?: string;
}

export async function createSite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  // 서버 액션은 UI를 거치지 않고 POST로 직접 호출될 수 있다.
  // 페이지에서 확인했더라도 여기서 다시 확인한다.
  const user = await requireUser();
  const parsed = parseSiteForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" };
  }

  const repo = await getSiteRepository();
  const settings = await (await getSettingsRepository()).get(user.id);
  const total = estimateForSite(parsed.data, settings).total;
  const site = await repo.create(user.id, parsed.data, total);

  revalidatePath("/sites");
  revalidatePath("/");
  redirect(`/sites/${site.id}`);
}

export async function updateSite(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = parseSiteForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" };
  }

  const repo = await getSiteRepository();
  const settings = await (await getSettingsRepository()).get(user.id);
  const total = estimateForSite(parsed.data, settings).total;
  const updated = await repo.update(id, user.id, parsed.data, total);
  if (!updated) return { error: "현장을 찾을 수 없습니다" };

  revalidatePath("/sites");
  revalidatePath(`/sites/${id}`);
  revalidatePath("/");
  redirect(`/sites/${id}`);
}

export async function deleteSite(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const repo = await getSiteRepository();
  await repo.remove(id, user.id);

  revalidatePath("/sites");
  revalidatePath("/");
  redirect("/sites");
}
