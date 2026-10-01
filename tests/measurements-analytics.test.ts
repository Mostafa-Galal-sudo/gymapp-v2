import { beforeEach, expect, it } from "vitest";
import { subDays, startOfDay } from "date-fns";
import db from "../src/db/db";
import { useUserStore } from "../src/store/useUserStore";
import { useMeasurementsStore as measurements } from "../src/store/useMeasurementsStore";
import {
  compareMeasurements,
  difference,
  symmetry,
} from "../src/services/measurements";
import {
  buildAnalytics,
  heatValue,
  type AnalyticsInput,
} from "../src/services/analytics";
const now = startOfDay(new Date()).getTime();
beforeEach(async () => {
  await db.delete();
  await db.open();
  await useUserStore.getState().createUser("test", { name: "Test" });
  measurements.setState({ measurements: [] });
});
it("persists, reloads, edits and deletes a check-in without changing another user", async () => {
  await measurements.getState().addMeasurement({
    date: now,
    values: { weight: 80, leftUpperArm: 30, rightUpperArm: 31 },
  });
  const id = measurements.getState().measurements[0].id;
  await measurements.getState().loadUserMeasurements("test");
  expect(measurements.getState().measurements[0].values?.weight).toBe(80);
  await measurements.getState().updateMeasurement(id, {
    date: now,
    values: { weight: 79 },
    notes: "steady",
  });
  expect((await db.measurements.get(id))?.values?.weight).toBe(79);
  await db.measurements.put({
    id: "foreign",
    userId: "other",
    date: now,
    values: { weight: 60 },
  });
  await expect(
    measurements.getState().deleteMeasurement("foreign"),
  ).rejects.toThrow();
  await measurements.getState().deleteMeasurement(id);
  expect(await db.measurements.count()).toBe(1);
  await db.progress_photos.put({
    id: "foreign-photo",
    userId: "other",
    date: now,
    photo: "data:image/png;base64,eA==",
  });
  await expect(
    measurements.getState().deletePhoto("foreign-photo"),
  ).rejects.toThrow();
  expect(await db.progress_photos.get("foreign-photo")).toBeTruthy();
});
it("compares actual baselines and symmetry, leaving absent/zero baselines unknown", () => {
  const rows = [100, 40, 10, 0].map((days, i) => ({
    id: String(i),
    userId: "test",
    date: subDays(now, days).getTime(),
    values: { weight: 100 - i * 10, leftUpperArm: 30 + i, rightUpperArm: 33 },
  }));
  const c = compareMeasurements(rows[3], rows);
  expect(c.previous.changes.weight).toEqual({
    absolute: -10,
    percentage: -12.5,
  });
  expect(c.days30.changes.weight?.absolute).toBe(-20);
  expect(c.days90.changes.weight?.absolute).toBe(-30);
  expect(c.first.changes.weight?.percentage).toBe(-30);
  expect(symmetry(rows[3])[0].gap).toBe(0);
  expect(difference(2, 0)?.percentage).toBeNull();
  expect(difference(2)).toBeNull();
});
it("aggregates real sets, muscles, macros, micros, periods and heatmap without filling missing nutrients", () => {
  const input: AnalyticsInput = {
    workouts: [
      {
        sessionId: "w",
        date: now,
        type: "Push",
        phase: "main",
        isFinished: true,
        totalVolume: 999,
        exercises: [
          {
            exerciseId: "bench",
            notes: "",
            voiceNotes: [],
            sets: [
              { setNumber: 1, weight: 50, reps: 10, rpe: 8, completed: true },
              { setNumber: 2, weight: 99, reps: 99, rpe: 0, completed: false },
            ],
          },
        ],
      },
    ],
    schedules: [],
    measurements: [],
    exercises: [{ id: "bench", name: "Bench", muscleGroup: "Chest" }],
    weight: [],
    supplementDoses: 0,
    logs: [
      {
        id: "l",
        userId: "test",
        date: now,
        waterMl: 500,
        supplementsTaken: {},
        targets: { water: 2000, calories: 2000, protein: 10 },
        meals: [
          {
            id: "m",
            type: "Lunch",
            foods: [
              {
                id: "f",
                foodId: "usda:1",
                name: "Food",
                amount: 100,
                unit: "g",
                calories: 200,
                protein: 10,
                carbs: 20,
                fats: 3,
                nutrients: {
                  calories: 200,
                  protein: 10,
                  sodium: 5,
                  vitaminC: 2,
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const a = buildAnalytics(input, "7d", now);
  expect(a.days).toHaveLength(7);
  expect(a.muscle.Chest.volume).toBe(500);
  expect(a.exercise.bench.reps).toBe(10);
  expect(a.weekly.reduce((n, p) => n + p.volume, 0)).toBe(500);
  expect(a.monthly.reduce((n, p) => n + p.workouts, 0)).toBe(1);
  expect(a.days.at(-1)?.nutrients).toEqual({
    calories: 200,
    protein: 10,
    sodium: 5,
    vitaminC: 2,
  });
  expect(a.days.at(-1)?.hydrationAdherence).toBe(0.25);
  expect(a.days.at(-1)?.nutritionAdherence).toBeCloseTo(0.55);
  expect(heatValue(a.days.at(-1)!, "activity")).toBe(75);
  expect(a.prs).toHaveLength(1);
});
