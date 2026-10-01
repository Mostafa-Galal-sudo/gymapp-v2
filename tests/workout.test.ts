import { beforeEach, describe, expect, it } from "vitest";
import db from "../src/db/db";
import { useUserStore } from "../src/store/useUserStore";
import {
  useWorkoutStore as store,
  flushWorkoutWrites,
} from "../src/store/useWorkoutStore";

beforeEach(async () => {
  await flushWorkoutWrites();
  useUserStore.setState({ activeUserId: null });
  store.setState({ activeSession: null, history: [], scheduledSessions: [] });
  await db.delete();
  await db.open();
  await useUserStore.getState().createUser("test", { name: "Test" });
});
describe("durable workout lifecycle", () => {
  it("starts once, autosaves edits, restores and only completes the selected schedule", async () => {
    store.getState().scheduleSession("2026-09-30", "Today", ["bench_press"]);
    store.getState().scheduleSession("2026-10-01", "Tomorrow", ["squat"]);
    const [today, tomorrow] = store.getState().scheduledSessions;
    store.getState().startSession(today.type, today.exerciseIds, today.id);
    const id = store.getState().activeSession!.sessionId;
    store.getState().startSession("Accidental double tap", []);
    expect(store.getState().activeSession!.sessionId).toBe(id);
    store
      .getState()
      .updateSet("bench_press", 1, { weight: 50, reps: 10, completed: true });
    store.getState().updateNotes("bench_press", "controlled");
    store.getState().setRestEndsAt(123456789);
    await flushWorkoutWrites();
    await store.getState().loadUserWorkouts("test");
    expect(store.getState().restored).toBe(true);
    expect(store.getState().activeSession!.exercises[0].notes).toBe(
      "controlled",
    );
    expect(store.getState().activeSession!.restEndsAt).toBe(123456789);
    await store.getState().finishSession();
    await flushWorkoutWrites();
    expect(store.getState().activeSession).toBeNull();
    expect(await db.active_workouts.get("test")).toBeUndefined();
    expect((await db.workouts.get(id))!.totalVolume).toBe(500);
    expect((await db.schedules.get(today.id))!.completedSessionId).toBe(id);
    expect(
      (await db.schedules.get(tomorrow.id))!.completedSessionId,
    ).toBeUndefined();
    expect(store.getState().scheduledSessions[1]).toMatchObject(tomorrow);
    await store.getState().loadUserWorkouts("test");
    expect(store.getState().activeSession).toBeNull();
  });
  it("discards without finishing or changing schedules", async () => {
    store.getState().startSession("Draft", ["squat"]);
    await store.getState().discardSession();
    await flushWorkoutWrites();
    expect(await db.workouts.count()).toBe(0);
    expect(await db.active_workouts.count()).toBe(0);
  });
  it("sorts by date, not random primary key", async () => {
    const base = {
      userId: "test",
      type: "Test",
      exercises: [],
      totalVolume: 0,
      phase: "main" as const,
      isFinished: true,
    };
    await db.workouts.bulkPut([
      { ...base, sessionId: "z", date: 1 },
      { ...base, sessionId: "a", date: 2 },
    ]);
    await store.getState().loadUserWorkouts("test");
    expect(store.getState().history.map((w) => w.date)).toEqual([1, 2]);
  });
  it("profile, weight and supplements preserve preferences and awards", async () => {
    const gamification = { xp: 42, level: 1, badges: [] };
    const exercisePrefs = { favorites: ["squat"], templates: [] };
    await db.users.update("test", { gamification, exercisePrefs });
    await useUserStore.getState().updateProfile({ age: 30 });
    await useUserStore.getState().logWeight(80);
    await useUserStore.getState().deleteSupplement("creatine");
    expect(await db.users.get("test")).toMatchObject({
      gamification,
      exercisePrefs,
    });
    await db.injuries.put({
      id: "foreign-injury",
      userId: "other",
      bodyPart: "Knee",
      severity: 2,
      status: "Active",
      notes: "",
      dateLogged: Date.now(),
    });
    await expect(
      useUserStore.getState().deleteInjury("foreign-injury"),
    ).rejects.toThrow();
    expect(await db.injuries.get("foreign-injury")).toBeTruthy();
  });
});
