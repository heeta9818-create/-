"use client";

import Link from "next/link";
import { deleteSite } from "@/app/sites/actions";

export function SiteActions({ id }: { id: string }) {
  return (
    <div className="no-print grid grid-cols-3 gap-3">
      <Link
        href={`/sites/${id}/edit`}
        className="rounded-lg border border-line bg-surface py-3 text-center text-sm font-medium"
      >
        수정
      </Link>

      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg border border-line bg-surface py-3 text-sm font-medium"
      >
        견적서 인쇄
      </button>

      <form
        action={deleteSite}
        onSubmit={(event) => {
          if (!window.confirm("이 현장을 삭제할까요?")) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
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
