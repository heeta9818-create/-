"use client";

import { useActionState, useMemo, useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
import { EstimateBreakdown } from "@/components/estimate-breakdown";
import {
  calculateEstimate,
  type EstimateInput,
  type RoomMeasure,
} from "@/lib/domain/estimate";
import {
  DEFAULTS,
  WALLPAPER_SPECS,
  type WallpaperKind,
} from "@/lib/domain/wallpaper";

type Method = "pyeong" | "measured";

const EMPTY_ROOM: RoomMeasure = {
  name: "",
  widthM: 3.5,
  depthM: 3,
  heightM: DEFAULTS.ceilingHeightM,
  doors: 1,
  windows: 1,
};

export interface SaveEstimateState {
  error?: string;
}

export type SaveEstimateAction = (
  state: SaveEstimateState,
  formData: FormData,
) => Promise<SaveEstimateState>;

export function EstimateCalculator({
  initialInput,
  saveAction,
}: {
  /** 현장 정보나 직전 견적에서 이어받는 초기값 */
  initialInput?: EstimateInput;
  /** 넘기면 저장 영역이 붙는다. 없으면 계산만 하는 화면 */
  saveAction?: SaveEstimateAction;
}) {
  const initialScope = initialInput?.scope;

  const [method, setMethod] = useState<Method>(initialScope?.method ?? "pyeong");
  const [pyeong, setPyeong] = useState(
    initialScope?.method === "pyeong" ? initialScope.pyeong : 25,
  );
  const [basis, setBasis] = useState<"supply" | "exclusive">(
    initialScope?.method === "pyeong" ? initialScope.basis : "supply",
  );
  const [rooms, setRooms] = useState<RoomMeasure[]>(
    initialScope?.method === "measured"
      ? initialScope.rooms
      : [{ ...EMPTY_ROOM, name: "안방" }],
  );

  const [kind, setKind] = useState<WallpaperKind>(initialInput?.kind ?? "silk");
  const [includeCeiling, setIncludeCeiling] = useState(
    initialInput?.includeCeiling ?? true,
  );
  const [patterned, setPatterned] = useState(initialInput?.patterned ?? false);

  const [rollPrice, setRollPrice] = useState(
    initialInput?.rollPrice ??
      WALLPAPER_SPECS[initialInput?.kind ?? "silk"].defaultRollPrice,
  );
  const [dailyWage, setDailyWage] = useState<number>(
    initialInput?.dailyWage ?? DEFAULTS.dailyWage,
  );
  const [marginPercent, setMarginPercent] = useState(
    Math.round((initialInput?.marginRate ?? DEFAULTS.marginRate) * 100),
  );
  const [travelFee, setTravelFee] = useState(initialInput?.travelFee ?? 0);
  const [includeVat, setIncludeVat] = useState(initialInput?.includeVat ?? false);

  function changeKind(next: WallpaperKind) {
    setKind(next);
    // 벽지를 바꾸면 롤 단가도 그 벽지의 기본값으로 따라간다.
    setRollPrice(WALLPAPER_SPECS[next].defaultRollPrice);
  }

  function updateRoom(index: number, patch: Partial<RoomMeasure>) {
    setRooms((prev) =>
      prev.map((room, i) => (i === index ? { ...room, ...patch } : room)),
    );
  }

  const input = useMemo<EstimateInput>(
    () => ({
      scope:
        method === "pyeong"
          ? { method: "pyeong", pyeong, basis }
          : { method: "measured", rooms },
      kind,
      includeCeiling,
      patterned,
      rollPrice,
      dailyWage,
      travelFee: travelFee || undefined,
      marginRate: marginPercent / 100,
      includeVat,
    }),
    [
      method,
      pyeong,
      basis,
      rooms,
      kind,
      includeCeiling,
      patterned,
      rollPrice,
      dailyWage,
      travelFee,
      marginPercent,
      includeVat,
    ],
  );

  const result = useMemo(() => calculateEstimate(input), [input]);

  return (
    <div className="space-y-5 px-5 pb-8">
      <div className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-surface p-1">
        {(["pyeong", "measured"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMethod(value)}
            className={`rounded-md py-2.5 text-sm font-medium transition-colors ${
              method === value ? "bg-brand text-white" : "text-muted"
            }`}
          >
            {value === "pyeong" ? "평수로 간이 산출" : "실측으로 산출"}
          </button>
        ))}
      </div>

      {method === "pyeong" ? (
        <div className="grid grid-cols-2 gap-4">
          <Field label="평수">
            <input
              type="number"
              step="0.1"
              min="1"
              inputMode="decimal"
              value={pyeong}
              onChange={(e) => setPyeong(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="기준">
            <select
              value={basis}
              onChange={(e) =>
                setBasis(e.target.value as "supply" | "exclusive")
              }
              className={inputClass}
            >
              <option value="supply">공급면적 (분양평)</option>
              <option value="exclusive">전용면적</option>
            </select>
          </Field>
        </div>
      ) : (
        <div className="space-y-3">
          {rooms.map((room, index) => (
            <Card key={index} className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  value={room.name}
                  onChange={(e) => updateRoom(index, { name: e.target.value })}
                  placeholder={`공간 ${index + 1}`}
                  className={`${inputClass} font-medium`}
                />
                <button
                  type="button"
                  onClick={() =>
                    setRooms((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="shrink-0 px-2 text-sm text-muted"
                  aria-label="삭제"
                >
                  삭제
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ["가로(m)", "widthM"],
                    ["세로(m)", "depthM"],
                    ["천장고(m)", "heightM"],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="text-xs text-muted">{label}</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      inputMode="decimal"
                      value={room[key] ?? 0}
                      onChange={(e) =>
                        updateRoom(index, { [key]: Number(e.target.value) || 0 })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    ["문 개수", "doors"],
                    ["창 개수", "windows"],
                  ] as const
                ).map(([label, key]) => (
                  <label key={key} className="block">
                    <span className="text-xs text-muted">{label}</span>
                    <input
                      type="number"
                      min="0"
                      inputMode="numeric"
                      value={room[key] ?? 0}
                      onChange={(e) =>
                        updateRoom(index, { [key]: Number(e.target.value) || 0 })
                      }
                      className={`${inputClass} mt-1`}
                    />
                  </label>
                ))}
              </div>
            </Card>
          ))}

          <button
            type="button"
            onClick={() => setRooms((prev) => [...prev, { ...EMPTY_ROOM }])}
            className="w-full rounded-lg border border-dashed border-line py-3 text-sm font-medium text-muted"
          >
            + 공간 추가
          </button>
        </div>
      )}

      <Field label="벽지 종류">
        <select
          value={kind}
          onChange={(e) => changeKind(e.target.value as WallpaperKind)}
          className={inputClass}
        >
          {Object.values(WALLPAPER_SPECS).map((spec) => (
            <option key={spec.kind} value={spec.kind}>
              {spec.label} ({spec.widthM}m × {spec.lengthM}m)
            </option>
          ))}
        </select>
      </Field>

      <div className="space-y-3 rounded-lg border border-line bg-surface p-4">
        {(
          [
            ["천장도 도배", includeCeiling, setIncludeCeiling],
            ["무늬(리피트) 있는 벽지", patterned, setPatterned],
            ["부가세 10% 포함", includeVat, setIncludeVat],
          ] as const
        ).map(([label, checked, setter]) => (
          <label key={label} className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setter(e.target.checked)}
              className="size-4"
            />
            <span className="text-sm">{label}</span>
          </label>
        ))}
      </div>

      <details className="rounded-lg border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">
          단가 조정
        </summary>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="롤 단가" hint="원">
            <input
              type="number"
              min="0"
              step="1000"
              inputMode="numeric"
              value={rollPrice}
              onChange={(e) => setRollPrice(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="일당" hint="원">
            <input
              type="number"
              min="0"
              step="10000"
              inputMode="numeric"
              value={dailyWage}
              onChange={(e) => setDailyWage(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="마진율" hint="%">
            <input
              type="number"
              min="0"
              max="100"
              inputMode="numeric"
              value={marginPercent}
              onChange={(e) => setMarginPercent(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
          <Field label="출장비" hint="원">
            <input
              type="number"
              min="0"
              step="10000"
              inputMode="numeric"
              value={travelFee}
              onChange={(e) => setTravelFee(Number(e.target.value) || 0)}
              className={inputClass}
            />
          </Field>
        </div>
      </details>

      <EstimateBreakdown result={result} />

      {saveAction ? <SaveEstimate action={saveAction} input={input} /> : null}
    </div>
  );
}

/**
 * 저장 영역.
 *
 * 화면에 보이는 금액은 브라우저가 계산한 값이라 그대로 저장하지 않는다.
 * 입력(input)만 JSON으로 넘기고 금액은 서버가 다시 계산한다.
 */
function SaveEstimate({
  action,
  input,
}: {
  action: SaveEstimateAction;
  input: EstimateInput;
}) {
  const [state, formAction, pending] = useActionState<
    SaveEstimateState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="input" value={JSON.stringify(input)} />

      <Field label="견적 이름" hint="비우면 차수로 표시됩니다">
        <input
          name="label"
          maxLength={50}
          placeholder="실측 후 2차"
          className={inputClass}
        />
      </Field>

      <Field label="메모">
        <textarea
          name="memo"
          rows={2}
          maxLength={1000}
          placeholder="천장 제외 요청, 자재는 고객 직접 구매 …"
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
        {pending ? "저장 중…" : "이 견적 저장"}
      </button>

      <p className="text-xs text-muted">
        저장한 견적은 나중에 단가 기본값이 바뀌어도 금액이 그대로 남습니다.
      </p>
    </form>
  );
}
