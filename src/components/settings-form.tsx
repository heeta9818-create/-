"use client";

import { useActionState, useMemo, useState } from "react";
import {
  resetSettings,
  saveSettings,
  type SettingsState,
} from "@/app/settings/actions";
import { Card, Field, inputClass } from "@/components/ui";
import { calculateEstimate } from "@/lib/domain/estimate";
import { resolveEstimateInput } from "@/lib/domain/resolve-estimate";
import { DEFAULT_SETTINGS, type PriceSettings } from "@/lib/domain/settings";
import { WALLPAPER_SPECS, type WallpaperKind } from "@/lib/domain/wallpaper";
import { m2, won } from "@/lib/format";

/**
 * 값은 문자열로 들고 있는다. 숫자로 두면 입력칸을 비우는 순간 0이 되어
 * 지우고 다시 칠 수가 없다.
 */
type FormValues = Record<string, string>;

const KINDS: WallpaperKind[] = ["silk", "wide", "narrow"];

/** 미리보기 기준 현장. 흔한 32평 아파트 실크 도배. */
const PREVIEW = { pyeong: 32, kind: "silk" as WallpaperKind };

function toFormValues(settings: PriceSettings): FormValues {
  const values: FormValues = {
    dailyWage: String(settings.dailyWage),
    subMaterialPerM2: String(settings.subMaterialPerM2),
    marginPercent: String(round(settings.marginRate * 100)),

    lossPercent: String(round(settings.lossRate * 100)),
    patternedLossPercent: String(round(settings.patternedLossRate * 100)),
    openingDeductionPercent: String(round(settings.openingDeductionRate * 100)),
    ceilingHeightM: String(settings.ceilingHeightM),
    wallAreaFactor: String(settings.wallAreaFactor),
    ceilingAreaFactor: String(settings.ceilingAreaFactor),
    exclusivePercent: String(round(settings.exclusiveRatio * 100)),
  };

  for (const kind of KINDS) {
    values[`rollPrice.${kind}`] = String(settings.rollPrice[kind]);
    values[`rollsPerWorkerDay.${kind}`] = String(settings.rollsPerWorkerDay[kind]);
  }

  return values;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function SettingsForm({ settings }: { settings: PriceSettings }) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(settings));
  const [saveState, saveAction, saving] = useActionState<
    SettingsState,
    FormData
  >(saveSettings, {});
  const [resetState, resetAction, resetting] = useActionState<
    SettingsState,
    FormData
  >(resetSettings, {});

  const state = saveState.error || saveState.notice ? saveState : resetState;

  function set(name: string, value: string) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  /** 화면 값으로 만든 단가표. 비어 있거나 이상하면 저장된 값으로 되돌린다. */
  const draft = useMemo<PriceSettings>(() => {
    const num = (name: string, fallback: number) => {
      const parsed = Number(values[name]);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
    };
    const rate = (name: string, fallback: number) =>
      num(name, fallback * 100) / 100;

    return {
      rollPrice: {
        silk: num("rollPrice.silk", settings.rollPrice.silk),
        wide: num("rollPrice.wide", settings.rollPrice.wide),
        narrow: num("rollPrice.narrow", settings.rollPrice.narrow),
      },
      rollsPerWorkerDay: {
        silk: Math.max(1, num("rollsPerWorkerDay.silk", settings.rollsPerWorkerDay.silk)),
        wide: Math.max(1, num("rollsPerWorkerDay.wide", settings.rollsPerWorkerDay.wide)),
        narrow: Math.max(1, num("rollsPerWorkerDay.narrow", settings.rollsPerWorkerDay.narrow)),
      },
      dailyWage: num("dailyWage", settings.dailyWage),
      subMaterialPerM2: num("subMaterialPerM2", settings.subMaterialPerM2),
      marginRate: rate("marginPercent", settings.marginRate),

      lossRate: rate("lossPercent", settings.lossRate),
      patternedLossRate: rate("patternedLossPercent", settings.patternedLossRate),
      openingDeductionRate: rate(
        "openingDeductionPercent",
        settings.openingDeductionRate,
      ),
      ceilingHeightM: Math.max(1, num("ceilingHeightM", settings.ceilingHeightM)),
      wallAreaFactor: num("wallAreaFactor", settings.wallAreaFactor),
      ceilingAreaFactor: num("ceilingAreaFactor", settings.ceilingAreaFactor),
      exclusiveRatio: Math.min(1, rate("exclusivePercent", settings.exclusiveRatio)),
    };
  }, [values, settings]);

  const preview = useMemo(
    () =>
      calculateEstimate(
        resolveEstimateInput(
          {
            scope: { method: "pyeong", pyeong: PREVIEW.pyeong, basis: "supply" },
            kind: PREVIEW.kind,
            includeCeiling: true,
          },
          draft,
        ),
      ),
    [draft],
  );

  function numberField(
    name: string,
    props: { step?: string; min?: string; max?: string } = {},
  ) {
    return (
      <input
        name={name}
        type="number"
        inputMode="decimal"
        value={values[name] ?? ""}
        onChange={(event) => set(name, event.target.value)}
        className={inputClass}
        {...props}
      />
    );
  }

  return (
    <form action={saveAction} className="space-y-5">
      <Card className="sticky top-2 z-10 shadow-sm">
        <p className="text-xs text-muted">
          미리보기 · {PREVIEW.pyeong}평(공급) {WALLPAPER_SPECS[PREVIEW.kind].label}{" "}
          벽+천장
        </p>
        <div className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted">
            {m2(preview.area.netAreaM2)} · {preview.rolls}롤 · {preview.workerDays}품
          </span>
          <span className="text-xl font-bold">{won(preview.total)}</span>
        </div>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">벽지 단가</h2>
        <Card className="space-y-4">
          {KINDS.map((kind) => (
            <div key={kind}>
              <p className="text-sm font-medium">
                {WALLPAPER_SPECS[kind].label}
                <span className="ml-2 text-xs text-muted">
                  {WALLPAPER_SPECS[kind].widthM}m × {WALLPAPER_SPECS[kind].lengthM}m
                </span>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <Field label="롤 단가" hint="원">
                  {numberField(`rollPrice.${kind}`, { min: "0", step: "1000" })}
                </Field>
                <Field label="1인 하루" hint="롤">
                  {numberField(`rollsPerWorkerDay.${kind}`, {
                    min: "1",
                    step: "1",
                  })}
                </Field>
              </div>
            </div>
          ))}
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-muted">인건비·부자재</h2>
        <Card className="grid grid-cols-2 gap-4">
          <Field label="일당" hint="원">
            {numberField("dailyWage", { min: "0", step: "10000" })}
          </Field>
          <Field label="부자재비" hint="m²당 원">
            {numberField("subMaterialPerM2", { min: "0", step: "100" })}
          </Field>
          <Field label="기본 마진율" hint="%">
            {numberField("marginPercent", { min: "0", max: "100", step: "1" })}
          </Field>
        </Card>
      </section>

      <details className="rounded-xl border border-line bg-surface p-5">
        <summary className="cursor-pointer text-sm font-semibold">
          물량 산출 계수
        </summary>
        <p className="mt-3 text-xs text-muted">
          여기 값이 물량을 좌우합니다. 실제 현장 몇 건을 정산해 보고 맞추세요.
          잘 모르겠으면 그대로 두는 편이 낫습니다.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="로스율" hint="%">
            {numberField("lossPercent", { min: "0", max: "100", step: "1" })}
          </Field>
          <Field label="무늬 로스율" hint="%">
            {numberField("patternedLossPercent", {
              min: "0",
              max: "100",
              step: "1",
            })}
          </Field>
          <Field label="개구부 공제율" hint="%">
            {numberField("openingDeductionPercent", {
              min: "0",
              max: "100",
              step: "5",
            })}
          </Field>
          <Field label="기본 천장고" hint="m">
            {numberField("ceilingHeightM", { min: "1", max: "10", step: "0.1" })}
          </Field>
          <Field label="평수 벽 계수" hint="전용면적 ×">
            {numberField("wallAreaFactor", { min: "0.1", step: "0.1" })}
          </Field>
          <Field label="평수 천장 계수" hint="전용면적 ×">
            {numberField("ceilingAreaFactor", { min: "0", step: "0.1" })}
          </Field>
          <Field label="전용률" hint="공급면적 대비 %">
            {numberField("exclusivePercent", { min: "10", max: "100", step: "1" })}
          </Field>
        </div>
      </details>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      ) : null}

      {state.notice ? (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          {state.notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={saving || resetting}
        className="w-full rounded-lg bg-brand px-4 py-3.5 font-medium text-white disabled:opacity-50"
      >
        {saving ? "저장 중…" : "단가표 저장"}
      </button>

      <p className="text-xs text-muted">
        이미 저장한 견적서는 바뀌지 않습니다. 견적을 저장한 적 없는 현장의
        금액만 새 단가로 다시 계산됩니다.
      </p>

      <button
        type="submit"
        formAction={resetAction}
        disabled={saving || resetting}
        onClick={(event) => {
          if (!window.confirm("단가표를 기본값으로 되돌릴까요?")) {
            event.preventDefault();
            return;
          }
          setValues(toFormValues(DEFAULT_SETTINGS));
        }}
        className="w-full py-2 text-sm text-muted underline disabled:opacity-50"
      >
        {resetting ? "되돌리는 중…" : "기본값으로 되돌리기"}
      </button>
    </form>
  );
}
