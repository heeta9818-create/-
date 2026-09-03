"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/user";
import {
  getEstimateRepository,
  getSiteRepository,
} from "@/lib/data/repository";
import { calculateEstimate } from "@/lib/domain/estimate";
import { parseEstimateInput } from "@/lib/domain/estimate-schema";

export interface SaveEstimateState {
  error?: string;
}

export interface ShareState {
  error?: string;
}

export async function saveEstimate(
  siteId: string,
  _prev: SaveEstimateState,
  formData: FormData,
): Promise<SaveEstimateState> {
  const user = await requireUser();

  const siteRepo = await getSiteRepository();
  const site = await siteRepo.get(siteId, user.id);
  if (!site) return { error: "현장을 찾을 수 없습니다" };

  const parsed = parseEstimateInput(formData.get("input"));
  if (!parsed.success) return { error: parsed.error };

  // 브라우저가 보낸 금액은 쓰지 않는다. 입력만 받고 서버가 다시 계산한다.
  const result = calculateEstimate(parsed.data);

  const estimateRepo = await getEstimateRepository();
  const saved = await estimateRepo.create(user.id, siteId, {
    label: String(formData.get("label") ?? "")
      .trim()
      .slice(0, 50),
    memo: String(formData.get("memo") ?? "")
      .trim()
      .slice(0, 1000),
    input: parsed.data,
    result,
  });

  // 목록·대시보드에 보이는 금액을 가장 최근 견적으로 맞춘다.
  await siteRepo.setEstimateTotal(siteId, user.id, result.total);

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  revalidatePath("/");
  redirect(`/sites/${siteId}/estimates/${saved.id}`);
}

export async function deleteEstimate(formData: FormData): Promise<void> {
  const user = await requireUser();

  const siteId = String(formData.get("siteId") ?? "");
  const estimateId = String(formData.get("estimateId") ?? "");
  if (!siteId || !estimateId) return;

  const estimateRepo = await getEstimateRepository();
  await estimateRepo.remove(estimateId, user.id);

  // 최신 견적이 지워졌을 수 있으니 현장 금액을 다시 맞춘다.
  const remaining = await estimateRepo.listForSite(siteId, user.id);
  const siteRepo = await getSiteRepository();

  if (remaining.length > 0) {
    await siteRepo.setEstimateTotal(siteId, user.id, remaining[0].total);
  } else {
    // 저장된 견적이 하나도 없으면 현장 정보로 뽑은 기본 견적으로 돌아간다.
    const site = await siteRepo.get(siteId, user.id);
    if (site) {
      const { estimateForSite } = await import("@/lib/domain/site-estimate");
      await siteRepo.setEstimateTotal(
        siteId,
        user.id,
        estimateForSite(site).total,
      );
    }
  }

  revalidatePath(`/sites/${siteId}`);
  revalidatePath("/sites");
  revalidatePath("/");
  redirect(`/sites/${siteId}`);
}

/** 공개 링크를 켠다. 이미 켜져 있으면 기존 링크가 그대로 유지된다. */
export async function enableSharing(
  siteId: string,
  estimateId: string,
  _prev: ShareState,
): Promise<ShareState> {
  const user = await requireUser();

  const estimateRepo = await getEstimateRepository();
  const token = await estimateRepo.enableSharing(estimateId, user.id);
  if (!token) return { error: "견적을 찾을 수 없습니다" };

  revalidatePath(`/sites/${siteId}/estimates/${estimateId}`);
  return {};
}

/** 공개 링크를 끈다. 고객이 이미 받은 링크도 즉시 죽는다. */
export async function disableSharing(
  siteId: string,
  estimateId: string,
  _prev: ShareState,
): Promise<ShareState> {
  const user = await requireUser();

  const estimateRepo = await getEstimateRepository();
  await estimateRepo.disableSharing(estimateId, user.id);

  revalidatePath(`/sites/${siteId}/estimates/${estimateId}`);
  return {};
}
