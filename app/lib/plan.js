// ─────────────────────────────────────────────────────────────
// 요금제 설정. 가격을 바꾸려면 이 파일 하나만 고치면 된다.
// ─────────────────────────────────────────────────────────────

// ★ 사장님이 정하실 값 ★  아래 숫자를 실제 팔 가격으로 바꾸세요.
export const PRO_PRICE = 9900; // 원 / 월
export const PRO_PRICE_YEAR = 99000; // 원 / 년 (2개월치 할인)

// 무료로 저장할 수 있는 견적 건수. 넘으면 오래된 것부터 지우거나 프로로 올려야 한다.
export const FREE_SAVE_LIMIT = 3;

// 무료판 견적서 아래에 붙는 한 줄. 프로에서는 사라진다.
export const FREE_MARK = "무료판으로 작성된 견적서입니다";

// 기능 비교. free / pro 값은 true, false, 또는 표시할 문자열.
// 여기 적힌 것은 전부 이 앱이 실제로 하는 일이다. 없는 기능은 적지 말 것.
export const FEATURES = [
  {
    group: "계산",
    items: [
      { name: "방 개수 제한 없이 추가", free: true, pro: true },
      { name: "실크·합지 폭수 자동 계산", free: true, pro: true },
      { name: "천장 따로 실측 입력", free: true, pro: true },
      {
        name: "현장 전체 롤 통합 올림",
        note: "방마다 올림하지 않아 자재가 덜 남습니다",
        free: true,
        pro: true,
      },
      { name: "벽지 종류 섞어 쓰기", note: "거실 실크 · 방 합지", free: true, pro: true },
    ],
  },
  {
    group: "견적서",
    items: [
      { name: "상호·연락처 표기", free: true, pro: true },
      { name: "PDF 저장", free: true, pro: true },
      { name: "카카오톡·문자 공유", free: true, pro: true },
      { name: "견적서 하단 무료판 문구", free: "표시됨", pro: "없음" },
    ],
  },
  {
    group: "보관",
    items: [
      { name: "견적 저장", free: FREE_SAVE_LIMIT + "건까지", pro: "제한 없음" },
      { name: "저장한 견적 다시 불러오기", free: true, pro: true },
    ],
  },
];

export function isPro(data) {
  return (data && data.plan) === "pro";
}
