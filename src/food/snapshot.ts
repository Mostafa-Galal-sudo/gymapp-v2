import { type Food, type Nutrients, scaleNutrients } from "./model";
import type { LoggedFood } from "../store/useNutritionStore";
export function foodSnapshot(food: Food, amount: number): LoggedFood {
  const nutrients = scaleNutrients(food.nutrients, amount / food.servingSize);
  return {
    id: crypto.randomUUID(),
    foodId: food.id,
    name: food.name,
    nameAr: food.nameAr,
    amount,
    unit: food.servingUnit,
    calories: nutrients.calories ?? 0,
    protein: nutrients.protein ?? 0,
    carbs: nutrients.carbs ?? 0,
    fats: nutrients.fats ?? 0,
    ...nutrients,
    nutrients: structuredClone(nutrients),
    source: food.source,
    sourceId: food.sourceId,
    loggedAt: Date.now(),
  };
}
export function storedNutrients(food: LoggedFood): Nutrients {
  // Legacy records predate provenance: never promote their estimated micros to measured values.
  return (
    food.nutrients ?? {
      calories: food.calories,
      protein: food.protein,
      carbs: food.carbs,
      fats: food.fats,
    }
  );
}
