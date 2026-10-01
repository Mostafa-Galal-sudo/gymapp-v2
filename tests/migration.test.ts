import { beforeEach, expect, it } from "vitest";
import Dexie from "dexie";
import db from "../src/db/db";
import { migrateLegacyData } from "../src/db/legacyMigration";
beforeEach(async () => {
  await db.delete();
  localStorage.clear();
});
it("upgrades v5 without erasing legacy measurements, logs or profile fields", async () => {
  const old = new Dexie(db.name);
  old
    .version(5)
    .stores({
      users: "id",
      daily_logs: "id,userId,date,[userId+date]",
      workouts: "sessionId,userId,date,type,phase",
      custom_exercises: "id,userId,name,category,muscleGroup",
      injuries: "id,userId,bodyPart,status",
      custom_foods: "id,userId",
      measurements: "id,userId,date",
      progress_photos: "id,userId,date",
      recipes: "id,userId",
    });
  await old.open();
  await old
    .table("measurements")
    .put({ id: "m", userId: "u", date: 1, arm: 30, weight: 70 });
  await old
    .table("daily_logs")
    .put({
      id: "l",
      userId: "u",
      date: 1,
      waterMl: 1,
      supplementsTaken: {},
      meals: [
        {
          id: "meal",
          type: "Lunch",
          foods: [
            {
              foodId: "old",
              name: "old",
              amount: 100,
              unit: "g",
              calories: 1,
              protein: 2,
              carbs: 3,
              fats: 4,
            },
          ],
        },
      ],
    });
  old.close();
  await db.open();
  expect((await db.measurements.get("m"))?.values).toMatchObject({
    arm: 30,
    weight: 70,
  });
  expect((await db.daily_logs.get("l"))?.meals[0].foods[0].id).toBeTruthy();
});
it("legacy migration is repeatable and preserves source storage on parse failure", async () => {
  await db.open();
  localStorage.setItem("omnibody-user-storage", "broken");
  await expect(migrateLegacyData()).rejects.toThrow();
  expect(await db.preferences.get("legacy-migrated")).toBeUndefined();
  expect(localStorage.getItem("omnibody-user-storage")).toBe("broken");
  localStorage.setItem(
    "omnibody-user-storage",
    JSON.stringify({
      state: {
        profile: {
          name: "Legacy",
          age: 30,
          weight: 70,
          height: 175,
          level: "Beginner",
          goals: [],
        },
      },
    }),
  );
  await migrateLegacyData();
  await migrateLegacyData();
  expect(await db.users.count()).toBe(1);
  expect((await db.users.get("default_user"))?.profile.name).toBe("Legacy");
});
