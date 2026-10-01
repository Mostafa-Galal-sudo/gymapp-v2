export const nutrientUnits = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  fats: "g",
  fiber: "g",
  sugar: "g",
  cholesterol: "mg",
  sodium: "mg",
  potassium: "mg",
  calcium: "mg",
  magnesium: "mg",
  iron: "mg",
  zinc: "mg",
  phosphorus: "mg",
  selenium: "mcg",
  vitaminA: "mcg",
  vitaminC: "mg",
  vitaminD: "mcg",
  vitaminE: "mg",
  vitaminK: "mcg",
  thiamin: "mg",
  riboflavin: "mg",
  niacin: "mg",
  pantothenicAcid: "mg",
  vitaminB6: "mg",
  vitaminB12: "mcg",
  folate: "mcg",
  choline: "mg",
} as const;
export type Nutrient = keyof typeof nutrientUnits;
export type Nutrients = Partial<Record<Nutrient, number>>;
export interface Food {
  id: string;
  name: string;
  nameAr?: string;
  source: "usda" | "off" | "custom" | "legacy";
  sourceId: string;
  nutrients: Nutrients;
  servingSize: number;
  servingUnit: string;
  servingLabel?: string;
  createdAt: number;
  updatedAt: number;
  fetchedAt: number;
  userId?: string;
  barcode?: string;
}
export function validateFood(food: Food) {
  if (
    !food.id ||
    !food.name.trim() ||
    !Number.isFinite(food.servingSize) ||
    food.servingSize <= 0
  )
    throw new Error("Invalid food or serving");
  if (
    !["usda", "off", "custom", "legacy"].includes(food.source) ||
    !food.sourceId ||
    !food.servingUnit ||
    ![food.createdAt, food.updatedAt, food.fetchedAt].every(
      (n) => Number.isFinite(n) && n >= 0,
    )
  )
    throw new Error("Invalid food metadata");
  for (const [key, value] of Object.entries(food.nutrients)) {
    if (
      !(key in nutrientUnits) ||
      !Number.isFinite(value) ||
      value! < 0 ||
      value! > 1e7
    )
      throw new Error("Invalid nutrient");
  }
  return food;
}
export function scaleNutrients(nutrients: Nutrients, ratio: number): Nutrients {
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error("Invalid portion");
  return Object.fromEntries(
    Object.entries(nutrients).map(([key, value]) => [
      key,
      Math.round(value! * ratio * 1000) / 1000,
    ]),
  );
}
