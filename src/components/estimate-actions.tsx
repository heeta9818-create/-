"use client";

import Link from "next/link";
import { deleteEstimate } from "@/app/sites/[id]/estimate/actions";

export function EstimateActions({
  siteId,
  estimateId,
}: {
  siteId: string;
  estimateId: string;
}) {
  return (
    <div className="no-print grid grid-cols-3 gap-3">
      <Link
        href={`/sites/${siteId}/estimate?from=${estimateId}`}
        className="rounded-lg border border-line bg-surface py-3 text-center text-sm font-medium"
      >
        이 값으로 다시
      </Link>

      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-line bg-surface py-3 text-sm font-medium"
      >
        인쇄
      </button>

      <form
        action={deleteEstimate}
        onSubmit={(event) => {
          if (!window.confirm("이 견적을 삭제할까요?")) event.preventDefault();
        }}
      >
        <input type="hidden" name="siteId" value={siteId} />
        <input type="hidden" name="estimateId" value={estimateId} />
        <button
          type="submit"
          className="w-full rounded-lg border border-line bg-surface py-3 text-sm font-medium text-red-600"
        >
          삭제
        </button>
      </form>
    </div>
  );
}
