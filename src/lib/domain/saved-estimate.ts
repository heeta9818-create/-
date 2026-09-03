import type { EstimateInput, EstimateResult } from "./estimate";

/**
 * 저장된 견적 한 건.
 *
 * input과 result를 둘 다 남긴다. input만 있으면 나중에 견적 엔진이나
 * DEFAULTS를 손볼 때 과거 견적 금액이 조용히 바뀌어 버린다. 고객에게 이미
 * 보낸 견적서가 나중에 다른 금액이 되는 건 있을 수 없는 일이라,
 * 계산 결과를 그 시점 그대로 박아 둔다.
 *
 * input은 "이 견적을 복제해서 다시 잡기"에 쓴다.
 */
export interface SavedEstimate {
  id: string;
  siteId: string;
  /** 현장 안에서의 차수. 1차, 2차… */
  version: number;
  /** 사람이 붙이는 이름. 비워도 된다 */
  label: string;
  memo: string;
  createdAt: string;
  input: EstimateInput;
  /** 저장 시점의 계산 결과 스냅샷 */
  result: EstimateResult;
  /** result.total과 같다. 목록 정렬·조회용으로 따로 둔다 */
  total: number;
  /**
   * 고객에게 보내는 공개 링크의 열쇠. null이면 공유가 꺼진 상태.
   * 링크를 아는 사람은 누구나 볼 수 있으므로 추측 불가능해야 한다.
   */
  shareToken: string | null;
}

/**
 * 로그인하지 않은 고객이 공개 링크로 보는 견적.
 * 내부 메모는 들어 있지 않다 — 고객에게 보일 내용이 아니다.
 */
export interface SharedEstimate {
  version: number;
  label: string;
  createdAt: string;
  input: EstimateInput;
  result: EstimateResult;
  customerName: string;
  address: string;
}

export interface NewEstimate {
  label: string;
  memo: string;
  input: EstimateInput;
  result: EstimateResult;
}

/**
 * 이름이 없으면 차수로 부른다.
 * 저장된 견적과 공개 견적 양쪽에서 같은 이름이 나와야 하므로
 * 두 타입이 공통으로 가진 필드만 받는다.
 */
export function estimateTitle(estimate: {
  version: number;
  label: string;
}): string {
  return estimate.label || `${estimate.version}차 견적`;
}
