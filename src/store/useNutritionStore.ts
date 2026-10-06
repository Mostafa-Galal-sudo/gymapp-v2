import { create } from 'zustand';
import { startOfDay, subDays } from 'date-fns';
import db, { type Recipe } from '../db/db';
import { useUserStore } from './useUserStore';
import { useGamificationStore } from './useGamificationStore';
import { foodSnapshot } from '../food/snapshot';
import type { Food, Nutrients } from '../food/model';
import { scheduleWaterReminders, cancelWaterReminders } from '../services/notificationService';

export interface LoggedFood {
  id?: string;
  nutrients?: Nutrients;
  source?: Food['source'];
  sourceId?: string;
  loggedAt?: number;
  foodId: string;
  name: string;
  nameAr?: string;
  amount: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  potassium?: number;
  iron?: number;
  calcium?: number;
  magnesium?: number;
  zinc?: number;
  phosphorus?: number;
  selenium?: number;
  vitaminA?: number;
  vitaminC?: number;
  vitaminD?: number;
  vitaminB12?: number;
  vitaminE?: number;
  vitaminK?: number;
  vitaminB6?: number;
  folate?: number;
}

export interface Meal {
  id: string;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks' | 'Pre-workout' | 'Post-workout' | 'Supplements';
  foods: LoggedFood[];
}

export interface NutritionDay {
  supplementPlan?: Record<string, { name: string; doses: number }>;
  targets?: Record<string, number>;
  date: number; // Start of day timestamp
  meals: Meal[];
  waterMl: number;
  supplementsTaken?: Record<string, boolean[]>;
}

interface NutritionState {
  history: Record<number, NutritionDay>; // Keyed by start of day timestamp
  recipes: Recipe[];
  getTargets: (weight?: number) => { 
    calories: number; protein: number; carbs: number; fats: number; fiber: number; water: number;
    sodium: number; potassium: number; iron: number; calcium: number;
    magnesium: number; zinc: number; phosphorus: number; selenium: number;
    vitaminA: number; vitaminC: number; vitaminD: number; vitaminB12: number;
    vitaminE: number; vitaminK: number; vitaminB6: number; folate: number;
  };
  loadUserHistory: (userId: string) => Promise<void>;
  addFood: (date: number, mealType: string, food: LoggedFood) => Promise<void>;
  removeFood: (date: number, mealId: string, foodId: string) => Promise<void>;
  addWater: (date: number, amount: number) => Promise<void>;
  toggleSupplement: (date: number, supId: string, doseIndex: number) => Promise<void>;
  resetMeal: (date: number, mealType: string) => Promise<void>;
  resetWater: (date: number) => Promise<void>;
  resetSupplements: (date: number) => Promise<void>;
  resetDay: (date: number) => Promise<void>;
  getTodayLog: () => NutritionDay;
  getLogForDate: (date: number) => NutritionDay;
  loadUserRecipes: (userId: string) => Promise<void>;
  saveRecipe: (name: string, items: Recipe['items']) => Promise<void>;
  deleteRecipe: (id: string) => Promise<void>;
  logRecipe: (date: number, mealType: string, recipeId: string) => Promise<void>;
}

const generateId = () => crypto.randomUUID();

const saveToDb = async (userId: string, date: number, dayLog: NutritionDay) => {
  await db.daily_logs.put({
    id: `${userId}_${date}`,
    userId,
    date,
    meals: dayLog.meals,
    waterMl: dayLog.waterMl,
    supplementPlan: dayLog.supplementPlan,
    supplementsTaken: dayLog.supplementsTaken || {}
    ,targets: dayLog.targets || useNutritionStore.getState().getTargets()
  });
};

export const useNutritionStore = create<NutritionState>()(
  (set, get) => ({
    history: {},
    recipes: [],

    getTargets: (weightParam?: number) => {
      const profile = useUserStore.getState().profile;
      const weight = weightParam || profile.weight || 78;
      const height = profile.height || 177;
      const age = profile.age || 22;
      const goals = profile.goals || [];
      const activityLevel = profile.activityLevel || 'Moderate';

      const isFemale = profile.gender === 'female';
      const s = isFemale ? -161 : 5;
      const bmr = 10 * weight + 6.25 * height - 5 * age + s;

      const multiplierMap: Record<string, number> = {
        'Sedentary': 1.2,
        'Light': 1.375,
        'Moderate': 1.55,
        'Active': 1.725,
      };
      const multiplier = multiplierMap[activityLevel] ?? 1.55;

      const tdee = bmr * multiplier;

      let calories = tdee;
      if (goals.some(g => g.toLowerCase().includes('loss') || g.toLowerCase().includes('cut') || g.toLowerCase().includes('aesthetics'))) {
        calories = tdee - 500;
      } else if (goals.some(g => g.toLowerCase().includes('strength') || g.toLowerCase().includes('bulk') || g.toLowerCase().includes('mass') || g.toLowerCase().includes('athletic'))) {
        calories = tdee + 300;
      }

      calories = Math.round(calories);

      const proteinG = Math.round(weight * 2.0);
      const proteinKcal = proteinG * 4;
      const fatsG = Math.round(weight * 1.0);
      const fatsKcal = fatsG * 9;
      const remainingKcal = calories - proteinKcal - fatsKcal;
      const carbsG = Math.round(Math.max(50, remainingKcal / 4));

      const fiberG = 30;
      const waterMl = Math.round(weight * 35);

      return {
        calories,
        protein: proteinG,
        carbs: carbsG,
        fats: fatsG,
        fiber: fiberG,
        water: waterMl,
        sodium: 2300,        // mg (general upper limit / target)
        potassium: 3400,     // mg
        iron: isFemale ? 18 : 8, // mg
        calcium: 1000,       // mg
        magnesium: isFemale ? 310 : 400, // mg
        zinc: isFemale ? 8 : 11,         // mg
        phosphorus: 700,     // mg
        selenium: 55,        // mcg
        vitaminA: isFemale ? 700 : 900, // mcg
        vitaminC: isFemale ? 75 : 90,   // mg
        vitaminD: 600,       // IU
        vitaminB12: 2.4,     // mcg
        vitaminE: 15,        // mg
        vitaminK: isFemale ? 90 : 120,  // mcg
        vitaminB6: isFemale ? 1.3 : 1.3, // mg
        folate: 400          // mcg
      };
    },


    loadUserHistory: async (userId: string) => {
      const logs = await db.daily_logs.where('userId').equals(userId).toArray();
      const historyMap: Record<number, NutritionDay> = {};

      for (const log of logs) historyMap[log.date] = {
        date: log.date, meals: log.meals, waterMl: log.waterMl, supplementsTaken: log.supplementsTaken, targets: log.targets, supplementPlan: log.supplementPlan,
      };
      set({ history: historyMap });
    },

    getTodayLog: () => {
      const today = startOfDay(new Date()).getTime();
      return get().getLogForDate(today);
    },

    getLogForDate: (date: number) => {
      const targetDate = startOfDay(new Date(date)).getTime();
      const history = get().history;
      if (!history[targetDate]) {
        // Derive stable ids from date+type so empty-day skeletons keep identity
        // across renders (otherwise UI state keyed on meal.id resets every render).
        const emptyMeal = (type: Meal['type']): Meal => ({
          id: `${targetDate}_${type}`, type, foods: []
        });
        return {
          date: targetDate,
          targets: get().getTargets(),
          supplementPlan: Object.fromEntries(useUserStore.getState().supplements.map(s=>[s.id,{name:s.name,doses:s.taken.length}])),
          waterMl: 0,
          meals: [
            emptyMeal('Breakfast'),
            emptyMeal('Lunch'),
            emptyMeal('Dinner'),
            emptyMeal('Snacks'),
            emptyMeal('Pre-workout'),
            emptyMeal('Post-workout')
          ],
          supplementsTaken: {}
        };
      }
      return history[targetDate];
    },

    addFood: async (date, mealType, food) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      
      let meal = dayLog.meals.find(m => m.type === mealType);
      if (!meal) {
        meal = { id: generateId(), type: mealType as Meal['type'], foods: [] };
        dayLog.meals.push(meal);
      }
      
      meal.foods.push({ ...structuredClone(food), id: crypto.randomUUID() });
      
      const newLog = { ...dayLog, meals: [...dayLog.meals] };
      set((state) => ({
        history: { ...state.history, [today]: newLog }
      }));

      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);

      // Macro Master: 14 consecutive days hitting the protein target
      if (today === startOfDay(new Date()).getTime()) {
        const proteinTarget = get().getTargets(useUserStore.getState().profile.weight).protein;
        const totalProtein = (log: NutritionDay) => log.meals.reduce((sum, m) =>
          sum + m.foods.reduce((s, f) => s + f.protein, 0), 0);

        if (totalProtein(newLog) >= proteinTarget) {
          const historyMap = get().history;
          let streakDays = 0;
          for (let i = 0; i < 14; i++) {
            const checkDate = subDays(new Date(today), i).getTime();
            const log = i === 0 ? newLog : historyMap[checkDate];
            if (log && totalProtein(log) >= proteinTarget) streakDays++;
            else break;
          }
          if (streakDays >= 14) {
            useGamificationStore.getState().unlockBadge('macro_master');
          }
        }
      }
    },

    removeFood: async (date, mealId, foodId) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = get().history[today];
      if (!dayLog) return;

      const meals = dayLog.meals.map(m => {
        if (m.id !== mealId) return m;
        return { ...m, foods: m.foods.filter(f => f.id !== foodId) };
      });

      const newLog = { ...dayLog, meals };
      set((state) => ({
        history: { ...state.history, [today]: newLog }
      }));

      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);
    },

    addWater: async (date, amount) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      
      const newLog = { ...dayLog, waterMl: dayLog.waterMl + amount };
      set((state) => ({
        history: { ...state.history, [today]: newLog }
      }));

      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);

      // Handle water reminders if logging for today
      if (today === startOfDay(new Date()).getTime()) {
        const target = get().getTargets(useUserStore.getState().profile.weight).water;
        if (newLog.waterMl >= target) {
          cancelWaterReminders();

          // Hydration Hero: 7 consecutive days hitting the water target
          // (uses today's target as an approximation for prior days too,
          // since we don't store a historical per-day target).
          const historyMap = get().history;
          let streakDays = 0;
          for (let i = 0; i < 7; i++) {
            const checkDate = subDays(new Date(today), i).getTime();
            const dayLog = i === 0 ? newLog : historyMap[checkDate];
            if (dayLog && dayLog.waterMl >= target) streakDays++;
            else break;
          }
          if (streakDays >= 7) {
            useGamificationStore.getState().unlockBadge('hydration_hero');
          }
        } else {
          scheduleWaterReminders(target - newLog.waterMl);
        }
      }
    },

    toggleSupplement: async (date, supId, doseIndex) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      
      const supsTaken = { ...(dayLog.supplementsTaken || {}) };
      const doses = [...(supsTaken[supId] || [])];
      
      if (doseIndex >= doses.length) {
        for (let i = doses.length; i <= doseIndex; i++) doses[i] = false;
      }
      
      const wasTaken = doses[doseIndex] || false;
      doses[doseIndex] = !wasTaken;
      supsTaken[supId] = doses;

      // Reflect the supplement's nutrient contribution (if any was set when
      // it was added) into the day's nutrition totals — a dedicated
      // 'Supplements' meal bucket so it shows up in the daily totals/macro
      // bars the same way any other logged food does.
      const supplement = useUserStore.getState().supplements.find(s => s.id === supId);

      let meals = dayLog.meals;
      const entryId = `supplement_${supId}_${doseIndex}`;

      if (supplement) {
        const hasNutrients = [
          supplement.calories, supplement.protein, supplement.carbs, supplement.fats,
          supplement.vitaminD, supplement.vitaminB12, supplement.vitaminC, supplement.vitaminE,
          supplement.magnesium, supplement.zinc, supplement.calcium, supplement.iron,
        ].some(v => v != null && v > 0);

        if (hasNutrients) {
          const supplementsMeal = meals.find(m => m.type === 'Supplements');
          if (!doses[doseIndex]) {
            // Turned OFF — remove this dose's contribution if present
            if (supplementsMeal) {
              meals = meals.map(m => m.type === 'Supplements'
                ? { ...m, foods: m.foods.filter(f => f.foodId !== entryId) }
                : m);
            }
          } else {
            // Turned ON — add (or replace) this dose's contribution
            const loggedSupplement: LoggedFood = {
              id: crypto.randomUUID(), foodId: entryId,
              source: 'custom', loggedAt: Date.now(),
              nutrients: Object.fromEntries(Object.entries(supplement).filter(([key,value]) => ['calories','protein','carbs','fats','vitaminD','vitaminB12','vitaminC','vitaminE','magnesium','zinc','calcium','iron'].includes(key) && typeof value === 'number').map(([key,value]) => [key, key === 'vitaminD' ? Number(value) / 40 : value])),
              name: `${supplement.name} (${supplement.dose})`,
              amount: 1,
              unit: 'dose',
              calories: supplement.calories || 0,
              protein: supplement.protein || 0,
              carbs: supplement.carbs || 0,
              fats: supplement.fats || 0,
              vitaminD: supplement.vitaminD,
              vitaminB12: supplement.vitaminB12,
              vitaminC: supplement.vitaminC,
              vitaminE: supplement.vitaminE,
              magnesium: supplement.magnesium,
              zinc: supplement.zinc,
              calcium: supplement.calcium,
              iron: supplement.iron,
            };
            if (supplementsMeal) {
              meals = meals.map(m => m.type === 'Supplements'
                ? { ...m, foods: [...m.foods.filter(f => f.foodId !== entryId), loggedSupplement] }
                : m);
            } else {
              meals = [...meals, { id: generateId(), type: 'Supplements', foods: [loggedSupplement] }];
            }
          }
        }
      }

      const newLog = { ...dayLog, supplementsTaken: supsTaken, meals };
      set((state) => ({
        history: { ...state.history, [today]: newLog }
      }));

      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);

      // Supplement King: 30 consecutive days with every dose of every
      // supplement marked taken.
      const profileSupplements = useUserStore.getState().supplements;
      const isDayFullyTaken = (log: NutritionDay | undefined) => {
        if (!log || profileSupplements.length === 0) return false;
        return profileSupplements.every(sup => {
          const requiredDoses = sup.taken.length || 1;
          const takenArr = log.supplementsTaken?.[sup.id];
          if (!takenArr || takenArr.length < requiredDoses) return false;
          return takenArr.slice(0, requiredDoses).every(Boolean);
        });
      };

      if (isDayFullyTaken(newLog)) {
        const historyMap = get().history;
        let streakDays = 0;
        for (let i = 0; i < 30; i++) {
          const checkDate = subDays(new Date(today), i).getTime();
          const log = i === 0 ? newLog : historyMap[checkDate];
          if (isDayFullyTaken(log)) streakDays++;
          else break;
        }
        if (streakDays >= 30) {
          useGamificationStore.getState().unlockBadge('supplement_king');
        }
      }
    },

    resetDay: async (date) => {
      const today = startOfDay(new Date(date)).getTime();
      const emptyLog = {
        date: today,
        waterMl: 0,
        supplementsTaken: {},
        meals: [
          { id: generateId(), type: 'Breakfast', foods: [] },
          { id: generateId(), type: 'Lunch', foods: [] },
          { id: generateId(), type: 'Dinner', foods: [] },
          { id: generateId(), type: 'Snacks', foods: [] },
          { id: generateId(), type: 'Pre-workout', foods: [] },
          { id: generateId(), type: 'Post-workout', foods: [] }
        ] as Meal[]
      };

      set((state) => ({
        history: { ...state.history, [today]: emptyLog }
      }));

      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, emptyLog);
    },

    resetMeal: async (date, mealType) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      
      const meals = dayLog.meals.map(m => {
        if (m.type === mealType) return { ...m, foods: [] };
        return m;
      });

      const newLog = { ...dayLog, meals };
      set((state) => ({ history: { ...state.history, [today]: newLog } }));
      
      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);
    },

    resetWater: async (date) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      
      const newLog = { ...dayLog, waterMl: 0 };
      set((state) => ({ history: { ...state.history, [today]: newLog } }));
      
      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);

      if (today === startOfDay(new Date()).getTime()) {
        const target = get().getTargets(useUserStore.getState().profile.weight).water;
        scheduleWaterReminders(target);
      }
    },

    resetSupplements: async (date) => {
      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      
      // Also clear the Supplements meal bucket so its nutrient contributions
      // don't linger in the day's totals after the checklist is reset.
      const meals = dayLog.meals.filter(m => m.type !== 'Supplements');
      const newLog = { ...dayLog, supplementsTaken: {}, meals };
      set((state) => ({ history: { ...state.history, [today]: newLog } }));
      
      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);
    },

    // ── Recipes (saved meal combos) ──────────────────────────────────────
    loadUserRecipes: async (userId: string) => {
      const id = userId || 'default_user';
      const recipes = await db.recipes.where('userId').equals(id).toArray();
      set({ recipes });
    },

    saveRecipe: async (name, items) => {
      const activeUserId = useUserStore.getState().activeUserId || 'default_user';
      const recipe: Recipe = {
        id: generateId(),
        userId: activeUserId,
        name,
        items,
        createdAt: Date.now(),
      };
      await db.recipes.put(recipe);
      set(state => ({ recipes: [...state.recipes, recipe] }));
      if (get().recipes.length >= 5) {
        useGamificationStore.getState().unlockBadge('recipe_creator');
      }
    },

    deleteRecipe: async (id: string) => {
      await db.recipes.delete(id);
      set(state => ({ recipes: state.recipes.filter(r => r.id !== id) }));
    },

    // Logs every food in a saved recipe into one meal in a single write,
    // using the same DB-value-or-macro-estimate fallback as adding a food
    // manually (see handleAdd in Nutrition.tsx for the equivalent logic).
    logRecipe: async (date, mealType, recipeId) => {
      const recipe = get().recipes.find(r => r.id === recipeId);
      if (!recipe) return;

      const today = startOfDay(new Date(date)).getTime();
      const dayLog = structuredClone(get().history[today] || get().getLogForDate(today));
      const meal = dayLog.meals.find(m => m.type === mealType);
      if (!meal) throw new Error('Unknown meal');
      const foods = await Promise.all(recipe.items.map(async item => {
        if (item.snapshot) return { ...structuredClone(item.snapshot), id: crypto.randomUUID() };
        const source = await db.foods.get(item.foodId);
        if (!source) throw new Error('Recipe food is unavailable. Edit this recipe before logging it.');
        return foodSnapshot(source, item.amount);
      }));
      meal.foods.push(...foods);
      const newLog = { ...dayLog, meals: [...dayLog.meals] };
      set((state) => ({ history: { ...state.history, [today]: newLog } }));

      const activeUserId = useUserStore.getState().activeUserId;
      if (activeUserId) await saveToDb(activeUserId, today, newLog);
    }
  })
);
