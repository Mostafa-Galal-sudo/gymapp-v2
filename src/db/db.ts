import Dexie, { type EntityTable } from 'dexie';
import { type UserProfile, type Supplement, type WeightEntry } from '../store/useUserStore';
import { type WorkoutSession } from '../store/useWorkoutStore';
import { type CustomExercise } from '../store/useExerciseStore';
import { type Meal } from '../store/useNutritionStore';

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
    badges: any[]; // we'll use any to avoid circular imports, or just import Badge from GamificationStore
  };
  exercisePrefs?: {
    favorites: string[];
    templates: any[];
  };
}

export interface DailyLogEntity {
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
  items: { foodId: string; amount: number }[];
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

export default db;
