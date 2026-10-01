import {
  addDays,
  format,
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import db, { type DailyLogEntity, type MeasurementEntry } from "../db/db";
import type {
  WorkoutSession,
  ScheduledSession,
} from "../store/useWorkoutStore";
import type { Nutrient, Nutrients } from "../food/model";
import { storedNutrients } from "../food/snapshot";
import { EXERCISE_DATABASE } from "../data/exercises";
import { measurementValues } from "./measurements";
export type DateRange = "7d" | "30d" | "90d" | "6m" | "1y" | "all";
export type HeatMetric =
  | "workout"
  | "calories"
  | "protein"
  | "nutrition"
  | "hydration"
  | "measurements"
  | "activity";
export interface AnalyticsInput {
  workouts: WorkoutSession[];
  schedules: ScheduledSession[];
  logs: DailyLogEntity[];
  measurements: MeasurementEntry[];
  exercises: { id: string; name: string; muscleGroup: string }[];
  weight: { date: number; weight: number }[];
  supplementDoses: number;
}
export interface DayInsight {
  date: string;
  workouts: WorkoutSession[];
  schedules: ScheduledSession[];
  log?: DailyLogEntity;
  measurements: MeasurementEntry[];
  weight: { date: number; weight: number }[];
  volume: number;
  sets: number;
  reps: number;
  nutrients: Nutrients;
  water: number;
  hydrationAdherence: number | null;
  nutritionAdherence: number | null;
  supplementsTaken: number;
  supplementsExpected: number | null;
  activity: number;
}
export interface PeriodInsight {
  date: string;
  workouts: number;
  planned: number;
  completed: number;
  volume: number;
  sets: number;
  reps: number;
  nutrients: Nutrients;
  nutrientDays: Partial<Record<Nutrient, number>>;
  averages: Nutrients;
  water: number;
  hydrationAverage: number;
  loggedDays: number;
  days: number;
  checkIns: number;
}
export function aggregatePeriods(
  days: DayInsight[],
  period: "day" | "week" | "month",
): PeriodInsight[] {
  const groups = new Map<string, DayInsight[]>();
  for (const day of days) {
    const d = new Date(`${day.date}T12:00:00`);
    const key = format(
      period === "week"
        ? startOfWeek(d, { weekStartsOn: 1 })
        : period === "month"
          ? startOfMonth(d)
          : d,
      "yyyy-MM-dd",
    );
    groups.set(key, [...(groups.get(key) || []), day]);
  }
  return [...groups].map(([date, rows]) => {
    const nutrients: Nutrients = {},
      nutrientDays: Partial<Record<Nutrient, number>> = {};
    for (const r of rows)
      for (const [k, v] of Object.entries(r.nutrients)) {
        const key = k as Nutrient;
        nutrients[key] = (nutrients[key] || 0) + v!;
        nutrientDays[key] = (nutrientDays[key] || 0) + 1;
      }
    const sum = (fn: (r: DayInsight) => number) =>
      rows.reduce((a, r) => a + fn(r), 0);
    return {
      date,
      workouts: sum((r) => r.workouts.length),
      planned: sum((r) => r.schedules.length),
      completed: sum(
        (r) => r.schedules.filter((s) => !!s.completedSessionId).length,
      ),
      volume: sum((r) => r.volume),
      sets: sum((r) => r.sets),
      reps: sum((r) => r.reps),
      nutrients,
      nutrientDays,
      averages: Object.fromEntries(
        Object.entries(nutrients).map(([k, v]) => [
          k,
          v! / nutrientDays[k as Nutrient]!,
        ]),
      ),
      water: sum((r) => r.water),
      hydrationAverage: sum((r) => r.water) / rows.length,
      loggedDays: rows.filter((r) => r.log?.meals.some((m) => m.foods.length))
        .length,
      days: rows.length,
      checkIns: sum((r) => r.measurements.length),
    };
  });
}
export function buildAnalytics(
  input: AnalyticsInput,
  range: DateRange,
  now: number = Date.now(),
) {
  const end = startOfDay(now),
    earliest = Math.min(
      now,
      ...input.workouts.map((w) => w.date),
      ...input.logs.map((l) => l.date),
      ...input.measurements.map((m) => m.date),
      ...input.weight.map((w) => w.date),
      ...input.schedules.map((s) => new Date(`${s.date}T12:00:00`).getTime()),
    );
  const start = startOfDay(
    range === "all"
      ? earliest
      : range === "6m"
        ? subMonths(end, 6)
        : range === "1y"
          ? subYears(end, 1)
          : subDays(end, Number(range.slice(0, -1)) - 1),
  );
  const days = new Map<string, DayInsight>();
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    const date = format(cursor, "yyyy-MM-dd");
    days.set(date, {
      date,
      workouts: [],
      schedules: [],
      measurements: [],
      weight: [],
      volume: 0,
      sets: 0,
      reps: 0,
      nutrients: {},
      water: 0,
      hydrationAdherence: null,
      nutritionAdherence: null,
      supplementsTaken: 0,
      supplementsExpected: null,
      activity: 0,
    });
  }
  const get = (date: number) => days.get(format(date, "yyyy-MM-dd"));
  const lookup = new Map(input.exercises.map((e) => [e.id, e]));
  const muscle: Record<
      string,
      { sets: number; volume: number; sessions: number }
    > = {},
    exercise: Record<
      string,
      {
        name: string;
        sets: number;
        reps: number;
        volume: number;
        sessions: number;
        progression: { date: number; weight: number; est1RM: number }[];
      }
    > = {};
  const prs: {
    exerciseId: string;
    date: number;
    weight: number;
    est1RM: number;
  }[] = [];
  const best = new Map<string, number>();
  // Seed records before range, so a historical PR is not falsely awarded at each range boundary.
  for (const workout of [...input.workouts]
    .filter((w) => w.isFinished)
    .sort((a, b) => a.date - b.date)) {
    const day = get(workout.date);
    if (day) day.workouts.push(workout);
    const muscles = new Set<string>(),
      exercises = new Set<string>();
    for (const ex of workout.exercises) {
      const definition = lookup.get(ex.exerciseId),
        group = definition?.muscleGroup || "Other";
      const sets = ex.sets.filter((s) => s.completed),
        volume = sets.reduce((a, s) => a + s.weight * s.reps, 0),
        reps = sets.reduce((a, s) => a + s.reps, 0);
      if (!sets.length) continue;
      const weight = Math.max(...sets.map((s) => s.weight)),
        est1RM = Math.max(...sets.map((s) => s.weight * (1 + s.reps / 30)));
      if (est1RM > (best.get(ex.exerciseId) || 0)) {
        best.set(ex.exerciseId, est1RM);
        if (day)
          prs.push({
            exerciseId: ex.exerciseId,
            date: workout.date,
            weight,
            est1RM,
          });
      }
      if (!day) continue;
      day.sets += sets.length;
      day.reps += reps;
      day.volume += volume;
      const m = (muscle[group] ??= { sets: 0, volume: 0, sessions: 0 });
      m.sets += sets.length;
      m.volume += volume;
      muscles.add(group);
      const e = (exercise[ex.exerciseId] ??= {
        name: definition?.name || ex.exerciseId,
        sets: 0,
        reps: 0,
        volume: 0,
        sessions: 0,
        progression: [],
      });
      e.sets += sets.length;
      e.reps += reps;
      e.volume += volume;
      e.progression.push({ date: workout.date, weight, est1RM });
      exercises.add(ex.exerciseId);
    }
    for (const m of muscles) muscle[m].sessions++;
    for (const e of exercises) exercise[e].sessions++;
  }
  for (const s of input.schedules) days.get(s.date)?.schedules.push(s);
  for (const log of input.logs) {
    const day = get(log.date);
    if (!day) continue;
    day.log = log;
    day.water = log.waterMl;
    for (const food of log.meals.flatMap((m) => m.foods))
      for (const [k, v] of Object.entries(storedNutrients(food))) {
        const key = k as Nutrient;
        day.nutrients[key] = (day.nutrients[key] || 0) + v!;
      }
    day.supplementsExpected = log.supplementPlan
      ? Object.values(log.supplementPlan).reduce((n, s) => n + s.doses, 0)
      : null;
    day.supplementsTaken = Object.values(log.supplementsTaken || {})
      .flat()
      .filter(Boolean).length;
    if (log.targets?.water)
      day.hydrationAdherence = Math.min(1, day.water / log.targets.water);
    const adherence = (
      ["calories", "protein", "carbs", "fats", "fiber"] as const
    )
      .filter(
        (key) =>
          Number(log.targets?.[key]) > 0 && day.nutrients[key] !== undefined,
      )
      .map((key) =>
        Math.max(
          0,
          1 -
            Math.abs(day.nutrients[key]! - log.targets![key]) /
              log.targets![key],
        ),
      );
    if (adherence.length)
      day.nutritionAdherence =
        adherence.reduce((sum, score) => sum + score, 0) / adherence.length;
  }
  for (const m of input.measurements) get(m.date)?.measurements.push(m);
  for (const w of input.weight) get(w.date)?.weight.push(w);
  for (const day of days.values())
    day.activity =
      25 * Number(day.workouts.length > 0) +
      25 * Number(!!day.log?.meals.some((m) => m.foods.length)) +
      25 * Number(day.water > 0) +
      25 * Number(day.measurements.length > 0);
  const rows = [...days.values()];
  let longest = 0,
    run = 0,
    current = 0;
  for (const d of rows) {
    run = d.workouts.length ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  for (let i = rows.length - 1; i >= 0; i--) {
    if (i === rows.length - 1 && !rows[i].workouts.length) continue;
    if (!rows[i].workouts.length) break;
    current++;
  }
  const missed = rows
    .filter((d) => d.date < format(end, "yyyy-MM-dd"))
    .flatMap((d) => d.schedules.filter((s) => !s.completedSessionId));
  const lastCheckIn = [...input.measurements].sort(
    (a, b) => b.date - a.date,
  )[0];
  return {
    days: rows,
    daily: aggregatePeriods(rows, "day"),
    weekly: aggregatePeriods(rows, "week"),
    monthly: aggregatePeriods(rows, "month"),
    muscle,
    exercise,
    prs,
    streak: { current, longest },
    missed: missed.length,
    frequency: rows.filter((d) => d.workouts.length).length / (rows.length / 7),
    lastCheckIn,
    daysSinceCheckIn: lastCheckIn
      ? Math.floor(
          (end.getTime() - startOfDay(lastCheckIn.date).getTime()) / 86400000,
        )
      : null,
    body: input.measurements
      .map((m) => ({ date: m.date, values: measurementValues(m) }))
      .sort((a, b) => a.date - b.date),
    weight: input.weight
      .filter(
        (entry) =>
          entry.date >= start.getTime() &&
          entry.date <= end.getTime() + 86400000,
      )
      .sort((a, b) => a.date - b.date),
  };
}
export async function loadAnalytics(
  userId: string,
  range: DateRange,
  now = Date.now(),
) {
  const input = await db.transaction(
    "r",
    [
      db.users,
      db.workouts,
      db.schedules,
      db.daily_logs,
      db.measurements,
      db.custom_exercises,
    ],
    async () => {
      const [user, workouts, schedules, logs, measurements, custom] =
        await Promise.all([
          db.users.get(userId),
          db.workouts.where("userId").equals(userId).toArray(),
          db.schedules.where("userId").equals(userId).toArray(),
          db.daily_logs.where("userId").equals(userId).toArray(),
          db.measurements.where("userId").equals(userId).toArray(),
          db.custom_exercises.where("userId").equals(userId).toArray(),
        ]);
      return {
        workouts,
        schedules,
        logs,
        measurements,
        exercises: [...EXERCISE_DATABASE, ...custom],
        weight: user?.weightHistory || [],
        supplementDoses:
          user?.supplements.reduce((a, s) => a + s.taken.length, 0) || 0,
      };
    },
  );
  return buildAnalytics(input, range, now);
}
export function heatValue(day: DayInsight, metric: HeatMetric): number {
  return metric === "workout"
    ? day.workouts.length
    : metric === "calories"
      ? day.nutrients.calories || 0
      : metric === "protein"
        ? day.nutrients.protein || 0
        : metric === "nutrition"
          ? (day.nutritionAdherence || 0) * 100
          : metric === "hydration"
            ? day.water
            : metric === "measurements"
              ? day.measurements.length
              : day.activity;
}
