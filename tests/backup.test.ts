import { beforeEach, expect, it } from "vitest";
import db from "../src/db/db";
import { useUserStore } from "../src/store/useUserStore";
import {
  useWorkoutStore,
  flushWorkoutWrites,
} from "../src/store/useWorkoutStore";
import {
  buildUserDataExport,
  importUserDataJSON,
  validateBackup,
} from "../src/services/backup";
beforeEach(async () => {
  await flushWorkoutWrites();
  useUserStore.setState({ activeUserId: null });
  useWorkoutStore.setState({
    activeSession: null,
    scheduledSessions: [],
    history: [],
  });
  await db.delete();
  await db.open();
  await useUserStore.getState().createUser("source", { name: "Source" });
});
it("round-trips measurements, workouts, schedules, active session, cache, snapshots and preferences", async () => {
  useWorkoutStore
    .getState()
    .scheduleSession("2026-09-30", "Push", ["bench_press"]);
  const plan = useWorkoutStore.getState().scheduledSessions[0];
  useWorkoutStore.getState().startSession("Push", ["bench_press"], plan.id);
  await flushWorkoutWrites();
  await db.measurements.put({
    id: "m",
    userId: "source",
    date: Date.now(),
    values: { weight: 80, leftCalf: 35, rightCalf: 36 },
    notes: "Week one",
  });
  await db.preferences.bulkPut([
    {
      id: "omnibody-lang",
      value: JSON.stringify({
        state: { lang: "ar", hasSelectedLanguage: true },
        version: 0,
      }),
    },
    { id: "usda-api-key", value: "not-exportable" },
  ]);
  const backup = await buildUserDataExport("source");
  expect(backup.preferences).toHaveLength(1);
  expect(
    validateBackup(JSON.parse(JSON.stringify(backup))).measurements,
  ).toHaveLength(1);
  await useUserStore.getState().createUser("target", { name: "Target" });
  await importUserDataJSON(backup, "target", "replace");
  const restored = await buildUserDataExport("target");
  expect(restored.measurements[0].values).toEqual(
    backup.measurements[0].values,
  );
  expect(restored.active_workouts[0].session.scheduledId).toBe(
    restored.schedules[0].id,
  );
  expect(await db.measurements.get("m")).toBeDefined();
  expect(restored.users[0].profile.name).toBe("Source");
  await importUserDataJSON(backup, "target", "merge");
  expect(await db.measurements.where("userId").equals("target").count()).toBe(
    1,
  );
});
it("rejects malformed version, ownership, dates and ranges atomically", async () => {
  const good = await buildUserDataExport("source");
  expect(() => validateBackup({ ...good, formatVersion: 999 })).toThrow();
  const bad = {
    ...good,
    measurements: [
      { id: "bad", userId: "source", date: -1, values: { weight: -2 } },
    ],
  };
  await expect(importUserDataJSON(bad, "source", "replace")).rejects.toThrow();
  expect((await db.users.get("source"))?.profile.name).toBe("Source");
  expect(() =>
    validateBackup({ ...good, users: [{ ...good.users[0], id: "other" }] }),
  ).toThrow();
});
it("merge retains existing same-day records and replace only clears target domains", async () => {
  const date = Date.now();
  await db.measurements.put({
    id: "source-m",
    userId: "source",
    date,
    values: { weight: 70 },
  });
  const backup = await buildUserDataExport("source");
  await useUserStore.getState().createUser("target", { name: "Target" });
  await db.measurements.put({
    id: "target-m",
    userId: "target",
    date,
    values: { weight: 80 },
  });
  await importUserDataJSON(backup, "target", "merge");
  expect(await db.measurements.count()).toBe(3);
  expect((await db.users.get("target"))?.profile.name).toBe("Target");
  await importUserDataJSON(backup, "target", "replace");
  expect(await db.measurements.count()).toBe(2);
  expect(await db.measurements.get("source-m")).toBeDefined();
});
