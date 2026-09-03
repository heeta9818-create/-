"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/sites/actions";
import { Field, inputClass } from "@/components/ui";
import { SITE_STATUSES, SITE_STATUS_LABEL, type Site } from "@/lib/domain/site";
import { WALLPAPER_SPECS } from "@/lib/domain/wallpaper";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function SiteForm({
  action,
  site,
  submitLabel,
}: {
  action: Action;
  site?: Site;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="space-y-5 px-5 pb-8">
      <Field label="고객명">
        <input
          name="customerName"
          required
          defaultValue={site?.customerName}
          placeholder="김철수"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="연락처">
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            defaultValue={site?.phone}
            placeholder="010-0000-0000"
            className={inputClass}
          />
        </Field>

        <Field label="시공 예정일">
          <input
            name="scheduledOn"
            type="date"
            defaultValue={site?.scheduledOn}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="주소">
        <input
          name="address"
          defaultValue={site?.address}
          placeholder="서울시 강남구 …"
          className={inputClass}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="평수">
          <input
            name="pyeong"
            type="number"
            step="0.1"
            min="1"
            required
            inputMode="decimal"
            defaultValue={site?.pyeong ?? 25}
            className={inputClass}
          />
        </Field>

        <Field label="평수 기준">
          <select
            name="areaBasis"
            defaultValue={site?.areaBasis ?? "supply"}
            className={inputClass}
          >
            <option value="supply">공급면적 (분양평)</option>
            <option value="exclusive">전용면적</option>
          </select>
        </Field>
      </div>

      <Field label="벽지 종류">
        <select
          name="wallpaperKind"
          defaultValue={site?.wallpaperKind ?? "silk"}
          className={inputClass}
        >
          {Object.values(WALLPAPER_SPECS).map((spec) => (
            <option key={spec.kind} value={spec.kind}>
              {spec.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="includeCeiling"
            defaultChecked={site?.includeCeiling ?? true}
            className="size-4"
          />
          <span className="text-sm">천장도 도배</span>
        </label>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            name="patterned"
            defaultChecked={site?.patterned ?? false}
            className="size-4"
          />
          <span className="text-sm">
            무늬(리피트) 있는 벽지
            <span className="ml-1 text-xs text-muted">— 로스율 18% 적용</span>
          </span>
        </label>
      </div>

      <Field label="진행 상태">
        <select
          name="status"
          defaultValue={site?.status ?? "inquiry"}
          className={inputClass}
        >
          {SITE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {SITE_STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </Field>

      <Field label="메모">
        <textarea
          name="memo"
          rows={3}
          defaultValue={site?.memo}
          placeholder="곰팡이 있음, 구벽지 철거 필요 …"
          className={inputClass}
        />
      </Field>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand px-4 py-3.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? "저장 중…" : submitLabel}
      </button>
    </form>
  );
}
