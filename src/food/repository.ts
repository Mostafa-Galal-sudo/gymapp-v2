import db from "../db/db";
import { Capacitor } from "@capacitor/core";
import { type Food, validateFood } from "./model";
import { normalizeUSDA, normalizeOFF, type USDAFood } from "./normalize";
const DAY = 86400000;
export interface FoodSource {
  search(query: string): Promise<Food[]>;
}
export const usdaSource: FoodSource = {
  async search(query) {
    const key = (await db.preferences.get("usda-api-key"))?.value || "DEMO_KEY";
    let response: Response | undefined;
    if (!Capacitor.isNativePlatform()) {
      try {
        const proxy = await fetch(
          `/api/foods/search?${new URLSearchParams({ query })}`,
          { signal: AbortSignal.timeout(15000) },
        );
        if (
          proxy.status !== 404 &&
          proxy.headers.get("content-type")?.includes("application/json")
        )
          response = proxy;
      } catch {
        /* Static web hosting has no proxy; use the personal key directly. */
      }
    }
    response ??= await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?${new URLSearchParams({ api_key: key, query, pageSize: "25" })}`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!response.ok)
      throw new Error(
        response.status === 429
          ? "USDA rate limit reached. Cached foods are available."
          : "USDA search unavailable. Try again.",
      );
    const data = (await response.json()) as { foods: USDAFood[] };
    return data.foods.map((f) => normalizeUSDA(f));
  },
};
export class FoodRepository {
  private pending = new Map<string, Promise<Food[]>>();
  private source: FoodSource;
  private online: () => boolean;
  private now: () => number;
  constructor(
    source: FoodSource = usdaSource,
    online = () => typeof navigator === "undefined" || navigator.onLine,
    now = () => Date.now(),
  ) {
    this.source = source;
    this.online = online;
    this.now = now;
  }
  async search(
    query: string,
    userId: string,
  ): Promise<{ foods: Food[]; refresh?: Promise<Food[]> }> {
    const q = query.trim().toLocaleLowerCase();
    const custom = await db.foods.where("userId").equals(userId).toArray();
    const matches = custom.filter((f) =>
      `${f.name} ${f.nameAr || ""}`.toLocaleLowerCase().includes(q),
    );
    const cached = await db.food_searches.get(q);
    const rows = cached
      ? (await db.foods.bulkGet(cached.foodIds)).filter((f): f is Food => !!f)
      : await db.foods
          .filter(
            (f) =>
              f.source !== "custom" && f.name.toLocaleLowerCase().includes(q),
          )
          .limit(25)
          .toArray();
    const foods = [...matches, ...rows];
    if (
      q.length < 2 ||
      !this.online() ||
      (cached && this.now() - cached.fetchedAt < 7 * DAY)
    )
      return { foods };
    let refresh = this.pending.get(q);
    if (!refresh) {
      refresh = this.source
        .search(q)
        .then(async (fresh) => {
          await db.transaction("rw", [db.foods, db.food_searches], async () => {
            await db.foods.bulkPut(fresh);
            await db.food_searches.put({
              query: q,
              foodIds: fresh.map((f) => f.id),
              fetchedAt: this.now(),
            });
          });
          return fresh;
        })
        .finally(() => this.pending.delete(q));
      this.pending.set(q, refresh);
    }
    return { foods, refresh: refresh.then((fresh) => [...matches, ...fresh]) };
  }
  async barcode(code: string): Promise<Food> {
    if (!/^\d{8,14}$/.test(code)) throw new Error("Invalid barcode");
    const cached = await db.foods.get(`off:${code}`);
    if (cached) return cached;
    if (!this.online())
      throw new Error("This barcode is not cached. Add a custom food offline.");
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${code}.json`,
      { signal: AbortSignal.timeout(15000) },
    );
    if (!res.ok) throw new Error("Barcode lookup unavailable");
    const data = await res.json();
    if (data.status !== 1)
      throw new Error("Product not found. Add a custom food.");
    const food = normalizeOFF(code, data.product);
    await db.foods.put(food);
    return food;
  }
  async saveCustom(food: Food, userId: string) {
    const existing = await db.foods.get(food.id);
    if (
      existing &&
      (existing.userId !== userId || existing.source !== "custom")
    )
      throw new Error("Food belongs to another source");
    await db.foods.put(
      validateFood({
        ...food,
        userId,
        source: "custom",
        updatedAt: this.now(),
      }),
    );
  }
  async deleteCustom(id: string, userId: string) {
    const food = await db.foods.get(id);
    if (food?.userId !== userId || food.source !== "custom")
      throw new Error("Food belongs to another source");
    await db.foods.delete(id);
  }
}
export const foodRepository = new FoodRepository();
