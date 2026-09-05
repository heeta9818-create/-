import {
  DEFAULTS,
  PYEONG_TO_M2,
  WALLPAPER_SPECS,
  rollAreaM2,
  type WallpaperKind,
} from "./wallpaper";

/** 방 하나의 실측값 */
export interface RoomMeasure {
  name: string;
  /** 가로 (m) */
  widthM: number;
  /** 세로 (m) */
  depthM: number;
  /** 천장고 (m). 생략하면 기본 천장고 */
  heightM?: number;
  doors?: number;
  windows?: number;
}

export type AreaBasis = "supply" | "exclusive";

/** 실측 방식 입력 */
export interface MeasuredInput {
  method: "measured";
  rooms: RoomMeasure[];
}

/** 평수 간이 산출 입력 */
export interface PyeongInput {
  method: "pyeong";
  pyeong: number;
  /** 공급면적(분양평)인지 전용면적인지 */
  basis: AreaBasis;
}

export interface EstimateInput {
  scope: MeasuredInput | PyeongInput;
  kind: WallpaperKind;
  /** 천장도 도배하는지 */
  includeCeiling: boolean;
  /** 무늬 반복이 있는 벽지인지 (로스율이 올라간다) */
  patterned?: boolean;

  /** --- 단가 (미지정 시 기본값) --- */
  rollPrice?: number;
  dailyWage?: number;
  subMaterialPerM2?: number;
  /** 도배공 1인 하루 시공 롤 수. 품 산출에 쓴다 */
  rollsPerWorkerDay?: number;

  /** --- 조정값 (미지정 시 기본값) --- */
  lossRate?: number;
  openingDeductionRate?: number;
  ceilingHeightM?: number;
  wallAreaFactor?: number;
  ceilingAreaFactor?: number;
  exclusiveRatio?: number;

  /** 철거·곰팡이 처리 등 추가 항목 */
  extras?: { label: string; amount: number }[];
  /** 출장비 */
  travelFee?: number;
  /** 마진율 (0.15 = 15%) */
  marginRate?: number;
  /** 할인 금액 (원) */
  discount?: number;
  /** 부가세 포함 여부 */
  includeVat?: boolean;
}

export interface AreaBreakdown {
  wallAreaM2: number;
  ceilingAreaM2: number;
  /** 개구부 공제 후 순 시공면적 */
  netAreaM2: number;
  /** 로스 포함 소요면적 */
  requiredAreaM2: number;
  deductedAreaM2: number;
  lossRate: number;
}

/**
 * 항목 분류. 고객용 견적서에서 다시 묶을 때 쓴다.
 * 라벨 문자열로 판단하면 사용자가 추가 작업 이름을 "자재비"로 지었을 때
 * 엉뚱하게 합쳐지므로, 만들 때 분류를 달아 둔다.
 */
export type LineItemGroup = "material" | "labor" | "extra" | "adjustment";

export interface LineItem {
  label: string;
  detail: string;
  amount: number;
  group: LineItemGroup;
}

export interface EstimateResult {
  area: AreaBreakdown;
  rolls: number;
  rollAreaM2: number;
  /** 품 (도배공 1인 1일 = 1품) */
  workerDays: number;
  items: LineItem[];
  subtotal: number;
  vat: number;
  total: number;
}

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** 실측 방식: 방별 벽면적/천장면적/개구부 면적을 합산한다. */
function measuredAreas(
  rooms: RoomMeasure[],
  defaultHeightM: number,
): { wall: number; ceiling: number; openings: number } {
  let wall = 0;
  let ceiling = 0;
  let openings = 0;

  for (const room of rooms) {
    const h = room.heightM ?? defaultHeightM;
    const perimeter = 2 * (room.widthM + room.depthM);
    wall += perimeter * h;
    ceiling += room.widthM * room.depthM;
    openings +=
      (room.doors ?? 0) * DEFAULTS.doorAreaM2 +
      (room.windows ?? 0) * DEFAULTS.windowAreaM2;
  }

  return { wall, ceiling, openings };
}

/**
 * 평수 간이 산출.
 * 공급면적이 들어오면 전용률을 곱해 전용면적으로 환산한 뒤 계수를 적용한다.
 * ("25평 아파트"는 보통 공급면적이고, 도배 물량은 전용면적 기준이라 이 구분이 중요하다.)
 */
function pyeongAreas(
  input: PyeongInput,
  wallFactor: number,
  ceilingFactor: number,
  exclusiveRatio: number,
): { wall: number; ceiling: number; openings: number } {
  const grossM2 = input.pyeong * PYEONG_TO_M2;
  const exclusiveM2 =
    input.basis === "supply" ? grossM2 * exclusiveRatio : grossM2;

  return {
    wall: exclusiveM2 * wallFactor,
    ceiling: exclusiveM2 * ceilingFactor,
    // 간이 산출 계수에는 개구부가 이미 녹아 있다고 본다.
    openings: 0,
  };
}

export function calculateEstimate(input: EstimateInput): EstimateResult {
  const spec = WALLPAPER_SPECS[input.kind];
  const lossRate =
    input.lossRate ??
    (input.patterned ? DEFAULTS.patternedLossRate : DEFAULTS.lossRate);
  const deductionRate =
    input.openingDeductionRate ?? DEFAULTS.openingDeductionRate;

  const raw =
    input.scope.method === "measured"
      ? measuredAreas(
          input.scope.rooms,
          input.ceilingHeightM ?? DEFAULTS.ceilingHeightM,
        )
      : pyeongAreas(
          input.scope,
          input.wallAreaFactor ?? DEFAULTS.wallAreaFactor,
          input.ceilingAreaFactor ?? DEFAULTS.ceilingAreaFactor,
          input.exclusiveRatio ?? DEFAULTS.exclusiveRatio,
        );

  const ceilingArea = input.includeCeiling ? raw.ceiling : 0;
  const deducted = raw.openings * deductionRate;
  const netArea = Math.max(0, raw.wall + ceilingArea - deducted);
  const requiredArea = netArea * (1 + lossRate);

  const perRoll = rollAreaM2(input.kind);
  const rolls = requiredArea > 0 ? Math.ceil(requiredArea / perRoll) : 0;

  const perWorkerDay = input.rollsPerWorkerDay ?? spec.rollsPerWorkerDay;
  const workerDays = rolls > 0 ? Math.ceil(rolls / perWorkerDay) : 0;

  const rollPrice = input.rollPrice ?? spec.defaultRollPrice;
  const dailyWage = input.dailyWage ?? DEFAULTS.dailyWage;
  const subPerM2 = input.subMaterialPerM2 ?? DEFAULTS.subMaterialPerM2;

  const items: LineItem[] = [];

  const materialCost = rolls * rollPrice;
  items.push({
    label: `${spec.label} 자재비`,
    detail: `${rolls}롤 × ${rollPrice.toLocaleString("ko-KR")}원`,
    amount: materialCost,
    group: "material",
  });

  const subMaterialCost = Math.round(netArea * subPerM2);
  items.push({
    label: "부자재비",
    detail: `${round(netArea, 1)}m² × ${subPerM2.toLocaleString("ko-KR")}원 (초배지·풀·퍼티)`,
    amount: subMaterialCost,
    group: "material",
  });

  const laborCost = workerDays * dailyWage;
  items.push({
    label: "시공 인건비",
    detail: `${workerDays}품 × ${dailyWage.toLocaleString("ko-KR")}원`,
    amount: laborCost,
    group: "labor",
  });

  for (const extra of input.extras ?? []) {
    items.push({
      label: extra.label,
      detail: "추가 작업",
      amount: extra.amount,
      group: "extra",
    });
  }

  if (input.travelFee) {
    items.push({
      label: "출장비",
      detail: "",
      amount: input.travelFee,
      group: "extra",
    });
  }

  const costBase = items.reduce((sum, item) => sum + item.amount, 0);

  const marginRate = input.marginRate ?? 0;
  if (marginRate > 0) {
    const margin = Math.round(costBase * marginRate);
    items.push({
      label: "관리비·마진",
      detail: `${round(marginRate * 100, 1)}%`,
      amount: margin,
      group: "labor",
    });
  }

  const discount = input.discount ?? 0;
  if (discount > 0) {
    items.push({
      label: "할인",
      detail: "",
      amount: -discount,
      group: "adjustment",
    });
  }

  const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
  const vat = input.includeVat ? Math.round(subtotal * DEFAULTS.vatRate) : 0;

  return {
    area: {
      wallAreaM2: round(raw.wall, 1),
      ceilingAreaM2: round(ceilingArea, 1),
      deductedAreaM2: round(deducted, 1),
      netAreaM2: round(netArea, 1),
      requiredAreaM2: round(requiredArea, 1),
      lossRate,
    },
    rolls,
    rollAreaM2: round(perRoll, 2),
    workerDays,
    items,
    subtotal,
    vat,
    total: subtotal + vat,
  };
}
