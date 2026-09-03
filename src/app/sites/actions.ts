"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSiteRepository } from "@/lib/data/repository";
import { estimateForSite } from "@/lib/domain/site-estimate";
import { parseSiteForm } from "@/lib/domain/site";

export interface FormState {
  error?: string;
}

export async function createSite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseSiteForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" };
  }

  const repo = await getSiteRepository();
  const total = estimateForSite(parsed.data).total;
  const site = await repo.create(parsed.data, total);

  revalidatePath("/sites");
  revalidatePath("/");
  redirect(`/sites/${site.id}`);
}

export async function updateSite(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseSiteForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인하세요" };
  }

  const repo = await getSiteRepository();
  const total = estimateForSite(parsed.data).total;
  const updated = await repo.update(id, parsed.data, total);
  if (!updated) return { error: "현장을 찾을 수 없습니다" };

  revalidatePath("/sites");
  revalidatePath(`/sites/${id}`);
  revalidatePath("/");
  redirect(`/sites/${id}`);
}

export async function deleteSite(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const repo = await getSiteRepository();
  await repo.remove(id);

  revalidatePath("/sites");
  revalidatePath("/");
  redirect("/sites");
}
