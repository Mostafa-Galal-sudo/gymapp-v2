import { beforeEach, expect, it } from "vitest";
import db from "../src/db/db";
import { normalizeUSDA, normalizeOFF } from "../src/food/normalize";
import { FoodRepository } from "../src/food/repository";
import { foodSnapshot } from "../src/food/snapshot";
import { useNutritionStore as store } from "../src/store/useNutritionStore";
import { useUserStore } from "../src/store/useUserStore";
const sample = () =>
  normalizeUSDA({
    fdcId: 1,
    description: "Egg",
    foodNutrients: [
      { nutrientId: 1003, unitName: "G", value: 12 },
      { nutrientId: 1089, unitName: "MG", value: 2 },
    ],
  });
beforeEach(async () => {
  await db.delete();
  await db.open();
  store.setState({ history: {}, recipes: [] });
  useUserStore.setState({ activeUserId: "test" });
});
it("normalizes real nutrient IDs and units; missing is unknown", () => {
  expect(sample().nutrients).toEqual({ protein: 12, iron: 2 });
  expect(
    normalizeOFF("12345678", {
      nutriments: { sodium_100g: 0.1, "vitamin-b12_100g": 0.000002 },
    }).nutrients,
  ).toEqual({ sodium: 100, vitaminB12: 2 });
});
it("serves cache immediately and refreshes stale online results", async () => {
  let calls = 0,
    now = 0;
  const repo = new FoodRepository(
    {
      search: async () => {
        calls++;
        return [sample()];
      },
    },
    () => true,
    () => now,
  );
  const first = await repo.search("egg", "test");
  expect(first.foods).toEqual([]);
  await first.refresh;
  expect((await repo.search("egg", "test")).refresh).toBeUndefined();
  expect(calls).toBe(1);
  now = 8 * 86400000;
  const stale = await repo.search("egg", "test");
  expect(stale.foods).toHaveLength(1);
  await stale.refresh;
  expect(calls).toBe(2);
});
it("supports offline cache and fully editable custom foods", async () => {
  const repo = new FoodRepository(
    {
      search: async () => {
        throw Error("offline");
      },
    },
    () => false,
  );
  const food = {
    ...sample(),
    source: "custom" as const,
    id: "custom",
    name: "Ful",
  };
  await repo.saveCustom(food, "test");
  await repo.saveCustom({ ...food, name: "Ful with oil" }, "test");
  const found = await repo.search("ful", "test");
  expect(found.foods[0].name).toBe("Ful with oil");
  expect(found.refresh).toBeUndefined();
  await repo.deleteCustom("custom", "test");
  expect((await repo.search("ful", "test")).foods).toEqual([]);
});
it("keeps immutable meal snapshots and removes only one occurrence", async () => {
  const food = sample();
  const date = new Date(2026, 8, 30).getTime();
  await store.getState().addFood(date, "Breakfast", foodSnapshot(food, 50));
  await store.getState().addFood(date, "Breakfast", foodSnapshot(food, 100));
  food.nutrients.protein = 999;
  await store.getState().loadUserHistory("test");
  const meal = store.getState().getLogForDate(date).meals[0];
  expect(meal.foods.map((f) => f.protein)).toEqual([6, 12]);
  expect(meal.foods[0].id).not.toBe(meal.foods[1].id);
  await store.getState().removeFood(date, meal.id, meal.foods[0].id!);
  expect(store.getState().getLogForDate(date).meals[0].foods).toHaveLength(1);
});
