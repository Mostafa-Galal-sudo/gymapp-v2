import type { MeasurementEntry } from "../db/db";
import { subDays } from "date-fns";
export const measurementFields = [
  ["weight", "Weight", "الوزن", "kg"],
  ["bodyFat", "Body fat", "نسبة الدهون", "%"],
  ["neck", "Neck", "الرقبة", "cm"],
  ["shoulders", "Shoulders", "الأكتاف", "cm"],
  ["chest", "Chest", "الصدر", "cm"],
  ["leftUpperArm", "Left upper arm", "العضد الأيسر", "cm"],
  ["rightUpperArm", "Right upper arm", "العضد الأيمن", "cm"],
  ["leftForearm", "Left forearm", "الساعد الأيسر", "cm"],
  ["rightForearm", "Right forearm", "الساعد الأيمن", "cm"],
  ["waist", "Waist", "الخصر", "cm"],
  ["abdomen", "Abdomen", "البطن", "cm"],
  ["hips", "Hips", "الأرداف", "cm"],
  ["leftThigh", "Left thigh", "الفخذ الأيسر", "cm"],
  ["rightThigh", "Right thigh", "الفخذ الأيمن", "cm"],
  ["leftCalf", "Left calf", "السمانة اليسرى", "cm"],
  ["rightCalf", "Right calf", "السمانة اليمنى", "cm"],
] as const;
export const pairs = [
  ["leftUpperArm", "rightUpperArm"],
  ["leftForearm", "rightForearm"],
  ["leftThigh", "rightThigh"],
  ["leftCalf", "rightCalf"],
] as const;
export function measurementValues(
  row: MeasurementEntry,
): Record<string, number> {
  const values = { ...row.values };
  for (const k of [
    "weight",
    "bodyFat",
    "neck",
    "chest",
    "waist",
    "hips",
    "arm",
    "thigh",
  ] as const)
    if (row[k] != null && values[k] === undefined) values[k] = row[k]!;
  return values;
}
export function difference(current?: number, baseline?: number) {
  if (current === undefined || baseline === undefined) return null;
  const absolute = current - baseline;
  return {
    absolute,
    percentage: baseline === 0 ? null : (absolute / baseline) * 100,
  };
}
export function compareMeasurements(
  current: MeasurementEntry,
  records: MeasurementEntry[],
) {
  const sorted = records
    .filter((r) => r.id !== current.id && r.date < current.date)
    .sort((a, b) => a.date - b.date);
  const baselines = {
    previous: sorted.at(-1),
    days30: sorted
      .filter((r) => r.date <= subDays(current.date, 30).getTime())
      .at(-1),
    days90: sorted
      .filter((r) => r.date <= subDays(current.date, 90).getTime())
      .at(-1),
    first: sorted[0],
  };
  const values = measurementValues(current);
  return Object.fromEntries(
    Object.entries(baselines).map(([period, row]) => [
      period,
      {
        date: row?.date,
        changes: Object.fromEntries(
          Object.keys(values).map((k) => [
            k,
            difference(values[k], row ? measurementValues(row)[k] : undefined),
          ]),
        ),
      },
    ]),
  ) as Record<
    keyof typeof baselines,
    { date?: number; changes: Record<string, ReturnType<typeof difference>> }
  >;
}
export function symmetry(row: MeasurementEntry) {
  const values = measurementValues(row);
  return pairs.map(([left, right]) => ({
    left,
    right,
    ...difference(values[left], values[right]),
    gap:
      values[left] !== undefined && values[right] !== undefined
        ? Math.abs(values[left] - values[right])
        : null,
  }));
}
export function validateMeasurement(row: MeasurementEntry) {
  if (
    !row.id ||
    !Number.isFinite(row.date) ||
    row.date < 0 ||
    row.date > Date.now() + 86400000
  )
    throw new Error("Invalid check-in date");
  const values = measurementValues(row);
  if (!Object.keys(values).length)
    throw new Error("Enter at least one measurement");
  for (const [key, value] of Object.entries(values))
    if (
      !Number.isFinite(value) ||
      value <= 0 ||
      value > (key === "bodyFat" ? 100 : 1000)
    )
      throw new Error("Invalid measurement");
}
