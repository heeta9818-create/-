"use client";

import { useMemo, useState } from "react";
import { Card, Field, inputClass } from "@/components/ui";
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
import { m2, won } from "@/lib/format";

type Method = "pyeong" | "measured";

const EMPTY_ROOM: RoomMeasure = {
  name: "",
  widthM: 3.5,
  depthM: 3,
  heightM: DEFAULTS.ceilingHeightM,
  doors: 1,
  windows: 1,
};

export function EstimateCalculator() {
  const [method, setMethod] = useState<Method>("pyeong");
  const [pyeong, setPyeong] = useState(25);
  const [basis, setBasis] = useState<"supply" | "exclusive">("supply");
  const [rooms, setRooms] = useState<RoomMeasure[]>([
    { ...EMPTY_ROOM, name: "안방" },
  ]);

  const [kind, setKind] = useState<WallpaperKind>("silk");
  const [includeCeiling, setIncludeCeiling] = useState(true);
  const [patterned, setPatterned] = useState(false);

  const [rollPrice, setRollPrice] = useState(WALLPAPER_SPECS.silk.defaultRollPrice);
  const [dailyWage, setDailyWage] = useState<number>(DEFAULTS.dailyWage);
  const [marginPercent, setMarginPercent] = useState(15);
  const [travelFee, setTravelFee] = useState(0);
  const [includeVat, setIncludeVat] = useState(false);

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

  const result = useMemo(() => {
    const input: EstimateInput = {
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
    };
    return calculateEstimate(input);
  }, [
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
  ]);

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

        <table className="mt-4 w-full border-t border-line text-sm">
          <tbody>
            {result.items.map((item) => (
              <tr key={item.label} className="border-b border-line">
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
      </Card>
    </div>
  );
}
