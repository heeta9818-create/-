export function won(amount: number): string {
  return `${Math.round(amount).toLocaleString("ko-KR")}원`;
}

export function m2(value: number): string {
  return `${value.toLocaleString("ko-KR")}m²`;
}

/** "2026-09-10" → "9월 10일 (목)" */
export function shortDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 오늘로부터 며칠 뒤인지. 지난 날짜는 음수. */
export function daysFromToday(iso: string): number {
  const target = new Date(`${iso}T00:00:00`).getTime();
  const today = new Date(`${todayISO()}T00:00:00`).getTime();
  return Math.round((target - today) / 86_400_000);
}
