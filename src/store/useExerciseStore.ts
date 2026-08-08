import { create } from 'zustand';
import db from '../db/db';
import { useUserStore } from './useUserStore';
import { EXERCISE_DATABASE, WORKOUT_SCHEDULES, SPLIT_SYSTEMS, type Exercise, type SplitSystem, type SplitSystemId } from '../data/exercises';

export interface CustomExercise extends Exercise {
  isCustom: boolean;
  equipment: string[];
  description: string;
  createdAt: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exerciseIds: string[];
  description?: string;
}

interface ExerciseState {
  customExercises: CustomExercise[];
  customTemplates: WorkoutTemplate[];
  favoriteExerciseIds: string[];
  
  // Getters
  getAllExercises: () => (Exercise | CustomExercise)[];
  getAllTemplates: () => Record<string, string[]>;
  getSplitSystems: () => SplitSystem[];
  getExerciseIdsForDay: (systemId: SplitSystemId, dayKey: string) => string[];
  
  // Loaders
  loadUserExercises: (userId: string) => Promise<void>;

  // Setters
  addCustomExercise: (ex: CustomExercise) => Promise<void>;
  deleteCustomExercise: (id: string) => Promise<void>;
  duplicateExercise: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  addTemplate: (template: WorkoutTemplate) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
}

const saveExercisePrefsToDb = async (state: ExerciseState) => {
  const activeUserId = useUserStore.getState().activeUserId;
  if (!activeUserId) return;
  const user = await db.users.get(activeUserId);
  if (user) {
    await db.users.update(activeUserId, {
      exercisePrefs: {
        favorites: state.favoriteExerciseIds,
        templates: state.customTemplates
      }
    });
  }
};

export const useExerciseStore = create<ExerciseState>()((set, get) => ({
  customExercises: [],
  customTemplates: [],
  favoriteExerciseIds: [],

  getAllExercises: () => {
    return [...EXERCISE_DATABASE, ...get().customExercises];
  },

  getAllTemplates: () => {
    const base: Record<string, string[]> = { ...WORKOUT_SCHEDULES };
    get().customTemplates.forEach(t => {
      base[t.name] = t.exerciseIds;
    });
    return base;
  },

  // Returns all split systems (PPL, Pro Split, Arnold, Batman, Custom) with the
  // 'custom' system's days populated from the user's own saved templates.
  getSplitSystems: () => {
    const customTemplates = get().customTemplates;
    return SPLIT_SYSTEMS.map(system => {
      if (system.id !== 'custom') return system;
      return {
        ...system,
        days: customTemplates.map(t => ({ key: t.name, label: t.name })),
      };
    });
  },

  // Resolves a split-system day key to its exercise id list, checking custom
  // templates first (since 'custom' days reference template names directly).
  getExerciseIdsForDay: (systemId, dayKey) => {
    if (systemId === 'custom') {
      const template = get().customTemplates.find(t => t.name === dayKey);
      return template?.exerciseIds || [];
    }
    return (WORKOUT_SCHEDULES as Record<string, string[]>)[dayKey] || [];
  },

  loadUserExercises: async (userId: string) => {
    const user = await db.users.get(userId);
    const customExercises = await db.custom_exercises.where('userId').equals(userId).toArray();
    
    set({
      customExercises: customExercises || [],
      customTemplates: user?.exercisePrefs?.templates || [],
      favoriteExerciseIds: user?.exercisePrefs?.favorites || []
    });
  },

  addCustomExercise: async (ex) => {
    set((state) => ({ customExercises: [...state.customExercises, ex] }));
    const activeUserId = useUserStore.getState().activeUserId;
    if (activeUserId) {
      await db.custom_exercises.put({ ...ex, userId: activeUserId });
    }
  },

  deleteCustomExercise: async (id) => {
    set((state) => ({ customExercises: state.customExercises.filter(e => e.id !== id) }));
    await db.custom_exercises.delete(id);
  },

  duplicateExercise: async (id) => {
    const all = get().getAllExercises();
    const existing = all.find(e => e.id === id);
    if (!existing) return;
    
    const dup: CustomExercise = {
      ...existing,
      id: `custom_${Date.now()}`,
      name: `${existing.name} (Copy)`,
      isCustom: true,
      equipment: (existing as CustomExercise).equipment || [],
      description: (existing as CustomExercise).description || '',
      createdAt: Date.now()
    };
    
    set((state) => ({ customExercises: [...state.customExercises, dup] }));
    const activeUserId = useUserStore.getState().activeUserId;
    if (activeUserId) {
      await db.custom_exercises.put({ ...dup, userId: activeUserId });
    }
  },

  toggleFavorite: async (id) => {
    set((state) => {
      const isFav = state.favoriteExerciseIds.includes(id);
      return {
        favoriteExerciseIds: isFav
          ? state.favoriteExerciseIds.filter(fId => fId !== id)
          : [...state.favoriteExerciseIds, id]
      };
    });
    await saveExercisePrefsToDb(get());
  },

  addTemplate: async (template) => {
    set((state) => ({ customTemplates: [...state.customTemplates, template] }));
    await saveExercisePrefsToDb(get());
  },

  deleteTemplate: async (id) => {
    set((state) => ({ customTemplates: state.customTemplates.filter(t => t.id !== id) }));
    await saveExercisePrefsToDb(get());
  }
}));
