import { headers } from "next/headers";

/**
 * 지금 요청이 들어온 주소. 고객에게 보낼 링크를 만들 때 쓴다.
 * 배포 도메인을 환경변수로 박아 두면 미리보기 배포에서 틀린 링크가 나오므로
 * 요청 헤더에서 뽑는다.
 */
export async function requestOrigin(): Promise<string> {
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "localhost:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
