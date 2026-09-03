"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/user";
import {
  getEstimateRepository,
  getSettingsRepository,
  getSiteRepository,
} from "@/lib/data/repository";
import { DEFAULT_SETTINGS, parseSettingsForm } from "@/lib/domain/settings";
import type { PriceSettings } from "@/lib/domain/settings";
import { estimateForSite } from "@/lib/domain/site-estimate";

export interface SettingsState {
  error?: string;
  notice?: string;
}

/**
 * 단가표를 바꾸면 이미 저장된 견적은 그대로 두고(스냅샷이다),
 * 저장된 견적이 없어서 기본 견적을 쓰는 현장만 금액을 다시 계산한다.
 * 안 그러면 목록에 옛 단가로 뽑은 금액이 남는다.
 */
async function recalculateAutoTotals(
  ownerId: string,
  settings: PriceSettings,
): Promise<number> {
  const siteRepo = await getSiteRepository();
  const estimateRepo = await getEstimateRepository();

  const [sites, siteIdsWithEstimates] = await Promise.all([
    siteRepo.list(ownerId),
    estimateRepo.siteIdsWithEstimates(ownerId),
  ]);

  const hasSavedEstimate = new Set(siteIdsWithEstimates);
  let updated = 0;

  for (const site of sites) {
    if (hasSavedEstimate.has(site.id)) continue;

    const total = estimateForSite(site, settings).total;
    if (total === site.estimateTotal) continue;

    await siteRepo.setEstimateTotal(site.id, ownerId, total);
    updated += 1;
  }

  return updated;
}

async function apply(
  ownerId: string,
  settings: PriceSettings,
): Promise<SettingsState> {
  const repo = await getSettingsRepository();
  await repo.save(ownerId, settings);

  const updated = await recalculateAutoTotals(ownerId, settings);

  revalidatePath("/", "layout");

  return {
    notice:
      updated > 0
        ? `저장했습니다. 견적을 저장한 적 없는 현장 ${updated}건의 금액을 새 단가로 다시 계산했습니다.`
        : "저장했습니다.",
  };
}

export async function saveSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const parsed = parseSettingsForm(formData);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: `${issue?.path.join(".") || "입력값"}이(가) 올바르지 않습니다. 값을 확인하세요.`,
    };
  }

  return apply(user.id, parsed.data);
}

export async function resetSettings(
  _prev: SettingsState,
  _formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();
  const state = await apply(user.id, DEFAULT_SETTINGS);
  return { ...state, notice: "기본값으로 되돌렸습니다." };
}
