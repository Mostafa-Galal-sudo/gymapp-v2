import Dexie, { type EntityTable } from 'dexie';
import { type UserProfile, type Supplement, type WeightEntry } from '../store/useUserStore';
import { type WorkoutSession, type ScheduledSession } from '../store/useWorkoutStore';
import { type CustomExercise } from '../store/useExerciseStore';
import { type Meal } from '../store/useNutritionStore';
import { type Food } from '../food/model';

export interface InjuryEntry {
  id: string;
  userId: string;
  bodyPart: string;
  severity: number;
  status: 'Active' | 'Recovering' | 'Healed';
  notes: string;
  dateLogged: number;
}

export interface UserEntity {
  id: string;
  profile: UserProfile;
  supplements: Supplement[];
  weightHistory: WeightEntry[];
  gamification?: {
    xp: number;
    level: number;
    badges: import('../store/useGamificationStore').Badge[];
  };
  exercisePrefs?: {
    favorites: string[];
    templates: import('../store/useExerciseStore').WorkoutTemplate[];
  };
}

export interface DailyLogEntity {
  supplementPlan?: Record<string, { name: string; doses: number }>;
  targets?: Record<string, number>;
  id: string; // Composite key: `${userId}_${date}`
  userId: string;
  date: number; // Start of day timestamp
  meals: Meal[];
  waterMl: number;
  supplementsTaken: Record<string, boolean[]>; // supplementId -> boolean array of taken doses
}

export interface CustomFood {
  id: string;
  userId: string;
  name: string;
  nameAr: string;
  category: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber?: number;
  sodium?: number;
  potassium?: number;
  servingSize?: number;
  servingUnit?: string;
}

export interface MeasurementEntry {
  values?: Record<string, number>;
  id: string;
  userId: string;
  date: number;
  weight?: number;
  bodyFat?: number;
  waist?: number;
  chest?: number;
  arm?: number;
  thigh?: number;
  hips?: number;
  neck?: number;
  notes?: string;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  date: number;
  photo: string; // base64 data URL
  pose?: 'Front' | 'Side' | 'Back';
  notes?: string;
}

export interface Recipe {
  id: string;
  userId: string;
  name: string;
  nameAr?: string;
  items: { foodId: string; amount: number; snapshot?: import('../store/useNutritionStore').LoggedFood }[];
  createdAt: number;
}

// Extend WorkoutSession and CustomExercise to include userId for the DB layer
export type DBWorkoutSession = WorkoutSession & { userId: string };
export type DBCustomExercise = CustomExercise & { userId: string };

const db = new Dexie('OmnibodyDB_V2') as Dexie & {
  users: EntityTable<UserEntity, 'id'>;
  daily_logs: EntityTable<DailyLogEntity, 'id'>;
  workouts: EntityTable<DBWorkoutSession, 'sessionId'>;
  custom_exercises: EntityTable<DBCustomExercise, 'id'>;
  injuries: EntityTable<InjuryEntry, 'id'>;
  custom_foods: EntityTable<CustomFood, 'id'>;
  measurements: EntityTable<MeasurementEntry, 'id'>;
  progress_photos: EntityTable<ProgressPhoto, 'id'>;
  recipes: EntityTable<Recipe, 'id'>;
  active_workouts: EntityTable<{ userId: string; session: WorkoutSession }, 'userId'>;
  schedules: EntityTable<ScheduledSession & { userId: string }, 'id'>;
  preferences: EntityTable<{ id: string; value: string }, 'id'>;
  foods: EntityTable<Food, 'id'>;
  food_searches: EntityTable<{ query: string; foodIds: string[]; fetchedAt: number }, 'query'>;
};

// Schema version 2 (V2)
db.version(2).stores({
  users: 'id',
  daily_logs: 'id, userId, date, [userId+date]', 
  workouts: 'sessionId, userId, date, type, phase',
  custom_exercises: 'id, userId, name, category, muscleGroup',
  injuries: 'id, userId, bodyPart, status'
});

// Schema version 3 (V3)
db.version(3).stores({
  users: 'id',
  daily_logs: 'id, userId, date, [userId+date]',
  workouts: 'sessionId, userId, date, type, phase',
  custom_exercises: 'id, userId, name, category, muscleGroup',
  injuries: 'id, userId, bodyPart, status',
  custom_foods: 'id, name, category'
});

// Schema version 4 (V4) — custom_foods scoped per user
db.version(4).stores({
  users: 'id',
  daily_logs: 'id, userId, date, [userId+date]',
  workouts: 'sessionId, userId, date, type, phase',
  custom_exercises: 'id, userId, name, category, muscleGroup',
  injuries: 'id, userId, bodyPart, status',
  custom_foods: 'id, userId, name, category'
});

// Schema version 5 (V5) — body measurements, progress photos, saved recipes
db.version(5).stores({
  users: 'id',
  daily_logs: 'id, userId, date, [userId+date]',
  workouts: 'sessionId, userId, date, type, phase',
  custom_exercises: 'id, userId, name, category, muscleGroup',
  injuries: 'id, userId, bodyPart, status',
  custom_foods: 'id, userId, name, category',
  measurements: 'id, userId, date',
  progress_photos: 'id, userId, date',
  recipes: 'id, userId, name'
});

db.version(6).stores({
  active_workouts: 'userId',
  schedules: 'id, userId, date, [userId+date]',
  preferences: 'id',
  workouts: 'sessionId, userId, date, [userId+date], type, phase',
}).upgrade(async tx => {
  await tx.table('custom_foods').toCollection().modify(food => {
    food.userId ||= 'default_user';
  });
});

db.version(7).stores({ foods: 'id, source, sourceId, userId, name, fetchedAt', food_searches: 'query' }).upgrade(async tx => {
  const custom = await tx.table('custom_foods').toArray();
  for (const food of custom) {
    const keys = ['calories','protein','carbs','fats','fiber','sugar','sodium','potassium'];
    const nutrients = Object.fromEntries(keys.filter(k => typeof food[k] === 'number').map(k => [k, food[k]]));
    await tx.table('foods').put({ id: food.id, userId: food.userId || 'default_user', name: food.name, nameAr: food.nameAr,
      source: 'custom', sourceId: food.id, nutrients, servingSize: food.servingSize || 100, servingUnit: food.servingUnit || 'g', createdAt: 0, updatedAt: 0, fetchedAt: 0 });
  }
  await tx.table('daily_logs').toCollection().modify(log => {
    for (const meal of log.meals || []) for (const food of meal.foods || []) {
      food.id ||= crypto.randomUUID();
      food.source ||= 'legacy';
    }
  });
});

db.version(8).stores({ measurements: 'id, userId, date, [userId+date]' }).upgrade(async tx => {
  await tx.table('measurements').toCollection().modify(row => {
    row.values ||= {};
    for (const key of ['weight', 'bodyFat', 'waist', 'chest', 'hips', 'neck', 'arm', 'thigh']) {
      if (row[key] != null) row.values[key] = row[key];
    }
    // Old arm/thigh measurements have no side. Preserve as unpaired legacy values.
  });
});

export default db;
