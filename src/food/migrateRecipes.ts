import db from "../db/db";
import type { Food, Nutrients } from "./model";
// Migration-only lookup is lazy and never part of food search or the main bundle.
export async function migrateRecipeFoods() {
  if (await db.preferences.get("recipe-foods-migrated")) return;
  const recipes = await db.recipes.toArray();
  const ids = [
    ...new Set(
      recipes.flatMap((r) =>
        r.items.filter((i) => !i.snapshot).map((i) => i.foodId),
      ),
    ),
  ];
  const missing = [];
  for (const id of ids) if (!(await db.foods.get(id))) missing.push(id);
  if (missing.length) {
    const res = await fetch(
      `${import.meta.env.BASE_URL}migrations/legacy-foods.json`,
    );
    if (!res.ok) throw new Error("Recipe migration unavailable");
    const legacy = await res.json();
    const foods: Food[] = missing.flatMap((id) => {
      const f = legacy[id];
      if (!f) return [];
      const nutrients: Nutrients = {
        calories: f.calories,
        protein: f.protein,
        carbs: f.carbs,
        fats: f.fats,
      };
      return [
        {
          id,
          name: f.name,
          nameAr: f.nameAr,
          source: "legacy",
          sourceId: id,
          nutrients,
          servingSize: f.servingSize,
          servingUnit: f.servingUnit,
          createdAt: 0,
          updatedAt: 0,
          fetchedAt: 0,
        },
      ];
    });
    await db.foods.bulkPut(foods);
  }
  await db.preferences.put({ id: "recipe-foods-migrated", value: "true" });
}
