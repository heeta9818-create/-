import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import type { EstimateResult } from "@/lib/domain/estimate";
import { m2, won } from "@/lib/format";

/**
 * 물량과 금액을 보여주는 표. 현장 상세, 저장된 견적서, 견적 계산기에서
 * 같은 모양으로 쓴다 — 고객에게 보내는 화면과 계산하는 화면이 달라 보이면 곤란하다.
 */
export function EstimateBreakdown({
  result,
  footnote,
  showBasis = true,
}: {
  result: EstimateResult;
  footnote?: ReactNode;
  /** 면적·로스 산출 근거 한 줄을 보여줄지 */
  showBasis?: boolean;
}) {
  return (
    <Card>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-xs text-muted">시공면적</p>
          <p className="mt-1 font-bold">{m2(result.area.netAreaM2)}</p>
        </div>
        <div>
          <p className="text-xs text-muted">벽지</p>
          <p className="mt-1 font-bold">{result.rolls}롤</p>
        </div>
        <div>
          <p className="text-xs text-muted">품</p>
          <p className="mt-1 font-bold">{result.workerDays}품</p>
        </div>
      </div>

      {showBasis ? (
        <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
          벽 {m2(result.area.wallAreaM2)} + 천장 {m2(result.area.ceilingAreaM2)}
          {result.area.deductedAreaM2 > 0
            ? ` − 개구부 ${m2(result.area.deductedAreaM2)}`
            : ""}{" "}
          · 로스 {Math.round(result.area.lossRate * 100)}% 포함 소요{" "}
          {m2(result.area.requiredAreaM2)} · 롤당 {result.rollAreaM2}m²
        </p>
      ) : null}

      <table className="mt-4 w-full border-t border-line text-sm">
        <tbody>
          {result.items.map((item, index) => (
            <tr key={`${item.label}-${index}`} className="border-b border-line">
              <td className="py-2.5 pr-3">
                <p className="font-medium">{item.label}</p>
                {item.detail ? (
                  <p className="text-xs text-muted">{item.detail}</p>
                ) : null}
              </td>
              <td className="py-2.5 text-right font-medium whitespace-nowrap">
                {won(item.amount)}
              </td>
            </tr>
          ))}
          {result.vat > 0 ? (
            <tr className="border-b border-line">
              <td className="py-2.5">부가세</td>
              <td className="py-2.5 text-right whitespace-nowrap">
                {won(result.vat)}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold">합계</span>
        <span className="text-2xl font-bold">{won(result.total)}</span>
      </div>

      <p className="mt-2 text-xs text-muted">
        {result.vat > 0 ? "부가세 포함" : "부가세 별도"}
      </p>

      {footnote ? <div className="mt-3 text-xs text-muted">{footnote}</div> : null}
    </Card>
  );
}
