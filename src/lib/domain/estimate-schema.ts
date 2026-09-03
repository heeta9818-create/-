import { z } from "zod";
import type { EstimateInput } from "./estimate";

/**
 * 견적 입력 검증 스키마.
 *
 * 견적 계산기는 클라이언트에서 돌지만, 저장할 때는 그 결과를 믿지 않는다.
 * 브라우저가 보낸 건 "입력"뿐이고 금액은 서버가 다시 계산한다.
 * 그러려면 입력이 먼저 안전한 범위인지 확인해야 한다.
 */

const roomSchema = z.object({
  name: z.string().trim().max(50),
  widthM: z.number().positive().max(100),
  depthM: z.number().positive().max(100),
  heightM: z.number().positive().max(10).optional(),
  doors: z.number().int().min(0).max(50).optional(),
  windows: z.number().int().min(0).max(50).optional(),
});

const scopeSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("pyeong"),
    pyeong: z.number().positive().max(500),
    basis: z.enum(["supply", "exclusive"]),
  }),
  z.object({
    method: z.literal("measured"),
    // 방이 없으면 면적이 0이라 견적이 성립하지 않는다.
    rooms: z.array(roomSchema).min(1).max(50),
  }),
]);

/** 원 단위 금액. 소수점과 음수는 받지 않는다. */
const money = z.number().int().min(0).max(1_000_000_000);

export const estimateInputSchema = z.object({
  scope: scopeSchema,
  kind: z.enum(["silk", "wide", "narrow"]),
  includeCeiling: z.boolean(),
  patterned: z.boolean().optional(),

  rollPrice: money.optional(),
  dailyWage: money.optional(),
  subMaterialPerM2: money.optional(),
  rollsPerWorkerDay: z.number().int().min(1).max(200).optional(),

  lossRate: z.number().min(0).max(1).optional(),
  openingDeductionRate: z.number().min(0).max(1).optional(),
  ceilingHeightM: z.number().positive().max(10).optional(),
  wallAreaFactor: z.number().min(0).max(20).optional(),
  ceilingAreaFactor: z.number().min(0).max(20).optional(),
  exclusiveRatio: z.number().positive().max(1).optional(),

  extras: z
    .array(z.object({ label: z.string().trim().min(1).max(50), amount: money }))
    .max(20)
    .optional(),
  travelFee: money.optional(),
  marginRate: z.number().min(0).max(5).optional(),
  discount: money.optional(),
  includeVat: z.boolean().optional(),
}) satisfies z.ZodType<EstimateInput>;

/** 폼의 hidden 필드로 넘어온 JSON 문자열을 검증해 입력으로 만든다. */
export function parseEstimateInput(raw: unknown) {
  if (typeof raw !== "string") {
    return { success: false as const, error: "견적 입력이 비어 있습니다" };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false as const, error: "견적 입력을 읽을 수 없습니다" };
  }

  const parsed = estimateInputSchema.safeParse(json);
  if (!parsed.success) {
    return {
      success: false as const,
      error: "견적 입력값이 올바르지 않습니다. 값을 다시 확인하세요.",
    };
  }

  return { success: true as const, data: parsed.data as EstimateInput };
}
