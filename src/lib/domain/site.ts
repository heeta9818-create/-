import { z } from "zod";

/** 현장 진행 상태 */
export const SITE_STATUSES = [
  "inquiry",
  "quoted",
  "confirmed",
  "in_progress",
  "done",
] as const;

export type SiteStatus = (typeof SITE_STATUSES)[number];

export const SITE_STATUS_LABEL: Record<SiteStatus, string> = {
  inquiry: "문의",
  quoted: "견적발송",
  confirmed: "계약확정",
  in_progress: "시공중",
  done: "완료",
};

export const siteInputSchema = z.object({
  customerName: z.string().trim().min(1, "고객명을 입력하세요"),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  pyeong: z.coerce.number().positive("평수는 0보다 커야 합니다").max(500),
  areaBasis: z.enum(["supply", "exclusive"]),
  wallpaperKind: z.enum(["silk", "wide", "narrow"]),
  includeCeiling: z.coerce.boolean(),
  patterned: z.coerce.boolean(),
  scheduledOn: z.string().trim().optional().or(z.literal("")),
  status: z.enum(SITE_STATUSES),
  memo: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type SiteInput = z.infer<typeof siteInputSchema>;

export interface Site extends SiteInput {
  id: string;
  createdAt: string;
  /** 저장 시점에 계산해 둔 견적 총액 (목록에서 다시 계산하지 않으려고 캐시한다) */
  estimateTotal: number;
}

/** 폼에서 온 FormData를 도메인 입력으로 파싱한다. */
export function parseSiteForm(formData: FormData) {
  return siteInputSchema.safeParse({
    customerName: formData.get("customerName") ?? "",
    phone: formData.get("phone") ?? "",
    address: formData.get("address") ?? "",
    pyeong: formData.get("pyeong") ?? "",
    areaBasis: formData.get("areaBasis") ?? "supply",
    wallpaperKind: formData.get("wallpaperKind") ?? "silk",
    includeCeiling: formData.get("includeCeiling") === "on",
    patterned: formData.get("patterned") === "on",
    scheduledOn: formData.get("scheduledOn") ?? "",
    status: formData.get("status") ?? "inquiry",
    memo: formData.get("memo") ?? "",
  });
}
