import {
  type Food,
  type Nutrient,
  type Nutrients,
  nutrientUnits,
  validateFood,
} from "./model";

// The sole USDA ID mapping. Values are per 100 g, including branded search results.
export const USDA_NUTRIENTS: Record<number, Nutrient> = {
  1008: "calories",
  2047: "calories",
  2048: "calories",
  1003: "protein",
  1005: "carbs",
  1004: "fats",
  1079: "fiber",
  2000: "sugar",
  1063: "sugar",
  1253: "cholesterol",
  1093: "sodium",
  1092: "potassium",
  1087: "calcium",
  1090: "magnesium",
  1089: "iron",
  1095: "zinc",
  1091: "phosphorus",
  1103: "selenium",
  1106: "vitaminA",
  1162: "vitaminC",
  1114: "vitaminD",
  1109: "vitaminE",
  1185: "vitaminK",
  1165: "thiamin",
  1166: "riboflavin",
  1167: "niacin",
  1170: "pantothenicAcid",
  1175: "vitaminB6",
  1178: "vitaminB12",
  1177: "folate",
  1180: "choline",
};
export interface USDAFood {
  fdcId: number;
  description: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: {
    nutrientId?: number;
    nutrient?: { id: number; unitName: string };
    unitName?: string;
    value?: number;
    amount?: number;
  }[];
}
export function normalizeUSDA(raw: USDAFood, now = Date.now()): Food {
  const nutrients: Nutrients = {};
  for (const n of raw.foodNutrients || []) {
    const key = USDA_NUTRIENTS[n.nutrientId ?? n.nutrient?.id ?? 0];
    const value = n.value ?? n.amount;
    if (!key || value == null || !Number.isFinite(value) || value < 0) continue;
    const from = (n.unitName ?? n.nutrient?.unitName ?? "")
      .toLowerCase()
      .replace("µg", "mcg")
      .replace("ug", "mcg");
    const to = nutrientUnits[key];
    const factor =
      from === to
        ? 1
        : from === "g" && to === "mg"
          ? 1000
          : from === "mg" && to === "mcg"
            ? 1000
            : from === "mcg" && to === "mg"
              ? 0.001
              : null;
    if (factor !== null && nutrients[key] === undefined)
      nutrients[key] = value * factor;
  }
  return validateFood({
    id: `usda:${raw.fdcId}`,
    sourceId: String(raw.fdcId),
    source: "usda",
    name: raw.description,
    nutrients,
    servingSize: 100,
    servingUnit: "g",
    servingLabel:
      raw.householdServingFullText ||
      (raw.servingSize
        ? `${raw.servingSize} ${raw.servingSizeUnit || "g"}`
        : undefined),
    createdAt: now,
    updatedAt: now,
    fetchedAt: now,
  });
}
export interface OFFProduct {
  product_name?: string;
  generic_name?: string;
  serving_size?: string;
  nutriments?: Record<string, number>;
}
const OFF_FIELDS: Partial<Record<Nutrient, string>> = {
  calories: "energy-kcal",
  protein: "proteins",
  carbs: "carbohydrates",
  fats: "fat",
  fiber: "fiber",
  sugar: "sugars",
  cholesterol: "cholesterol",
  sodium: "sodium",
  potassium: "potassium",
  calcium: "calcium",
  magnesium: "magnesium",
  iron: "iron",
  zinc: "zinc",
  phosphorus: "phosphorus",
  selenium: "selenium",
  vitaminA: "vitamin-a",
  vitaminC: "vitamin-c",
  vitaminD: "vitamin-d",
  vitaminE: "vitamin-e",
  vitaminK: "vitamin-k",
  thiamin: "vitamin-b1",
  riboflavin: "vitamin-b2",
  niacin: "vitamin-pp",
  vitaminB6: "vitamin-b6",
  vitaminB12: "vitamin-b12",
  folate: "folates",
};
export function normalizeOFF(
  barcode: string,
  raw: OFFProduct,
  now = Date.now(),
): Food {
  const nutrients: Nutrients = {};
  for (const [key, field] of Object.entries(OFF_FIELDS)) {
    const n = key as Nutrient,
      value = raw.nutriments?.[`${field}_100g`];
    if (value == null || !Number.isFinite(value) || value < 0) continue;
    nutrients[n] =
      value *
      (nutrientUnits[n] === "mg" ? 1000 : nutrientUnits[n] === "mcg" ? 1e6 : 1);
  }
  return validateFood({
    id: `off:${barcode}`,
    barcode,
    source: "off",
    sourceId: barcode,
    name: raw.product_name || raw.generic_name || barcode,
    servingSize: 100,
    servingUnit: "g",
    servingLabel: raw.serving_size,
    nutrients,
    createdAt: now,
    updatedAt: now,
    fetchedAt: now,
  });
}
