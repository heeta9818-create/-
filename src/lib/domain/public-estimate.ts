import type { EstimateResult, LineItem } from "./estimate";
import { WALLPAPER_SPECS } from "./wallpaper";

/**
 * 고객에게 보내는 견적서용 항목.
 *
 * 내부 견적서에는 "관리비·마진 15%"가 한 줄로 찍힌다. 그대로 고객에게
 * 보내면 곤란하다. 마진은 시공비에, 부자재는 자재비에 합쳐서
 * 자재비 / 시공비 / 추가작업 형태로 다시 묶는다.
 *
 * 합계는 건드리지 않는다. 보여주는 방식만 바뀔 뿐 금액은 같아야 한다.
 *
 * 설명 문구는 원래 항목의 것을 이어붙이지 않고 새로 쓴다. 합쳐진 금액에
 * 원래 단가 설명이 붙으면 "2품 × 250,000원 = 684,917원"처럼 계산이 안 맞는
 * 견적서가 고객에게 간다.
 */
export function toPublicItems(result: EstimateResult): LineItem[] {
  const items0 = result.items.map(withGroup);

  const sum = (group: LineItem["group"]) =>
    items0
      .filter((item) => item.group === group)
      .reduce((total, item) => total + item.amount, 0);

  const items: LineItem[] = [];

  const material = sum("material");
  if (material !== 0) {
    const wallpaper = items0.find(
      (item) => item.group === "material" && item.label.endsWith(" 자재비"),
    );
    const kindLabel = Object.values(WALLPAPER_SPECS).find((spec) =>
      wallpaper?.label.startsWith(spec.label),
    )?.label;

    items.push({
      label: "자재비",
      detail: `${kindLabel ? `${kindLabel} ` : ""}${result.rolls}롤 · 초배지 등 부자재 포함`,
      amount: material,
      group: "material",
    });
  }

  const labor = sum("labor");
  if (labor !== 0) {
    items.push({
      label: "시공비",
      detail: `${result.workerDays}품`,
      amount: labor,
      group: "labor",
    });
  }

  // 추가 작업·출장비·할인은 고객이 알아야 하는 항목이라 그대로 둔다.
  items.push(
    ...items0.filter(
      (item) => item.group === "extra" || item.group === "adjustment",
    ),
  );

  return items;
}

/**
 * 분류가 붙기 전에 저장된 견적 스냅샷을 보정한다.
 *
 * 저장된 견적은 "나중에 금액이 바뀌지 않는다"가 전제다. 옛 스냅샷에
 * group이 없다고 항목을 통째로 빠뜨리면 고객 화면이 빈 표가 되고 그 약속이
 * 깨진다. 없으면 라벨로 되짚어 채운다.
 */
function withGroup(item: LineItem): LineItem {
  if (item.group) return item;

  if (item.label === "관리비·마진" || item.label === "시공 인건비") {
    return { ...item, group: "labor" };
  }
  if (item.label.endsWith("자재비")) {
    return { ...item, group: "material" };
  }
  if (item.label === "할인") {
    return { ...item, group: "adjustment" };
  }
  return { ...item, group: "extra" };
}

/** 고객 화면에서 쓸 수 있게 항목만 갈아끼운 결과 */
export function toPublicResult(result: EstimateResult): EstimateResult {
  return { ...result, items: toPublicItems(result) };
}
