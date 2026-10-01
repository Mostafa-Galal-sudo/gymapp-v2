import { create } from 'zustand';


export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: number;
}


const DEFAULT_BADGES: Badge[] = [
  { id: 'first_workout', name: 'First Workout', icon: '🏋️', description: 'Complete your first session', unlocked: false },
  { id: 'streak_7', name: '7-Day Streak', icon: '🔥', description: 'Train for 7 consecutive days', unlocked: false },
  { id: 'streak_30', name: '30-Day Streak', icon: '💎', description: 'Train for 30 consecutive days', unlocked: false },
  { id: 'bench_100', name: '100kg Bench Press', icon: '💪', description: 'Hit a 100kg Bench Press', unlocked: false },
  { id: 'neck_pain_free', name: 'Neck Pain Free Week', icon: '🛡️', description: '7 days with zero neck pain spikes', unlocked: false },
  { id: 'grip_master', name: 'Grip Master', icon: '✊', description: '+10kg grip strength improvement', unlocked: false },
  { id: 'face_gains', name: 'Face Gains', icon: '😤', description: 'Completed 30 days of face exercises', unlocked: false },
  { id: 'hydration_hero', name: 'Hydration Hero', icon: '💧', description: '7 days hitting 3.5L water', unlocked: false },
  { id: 'supplement_king', name: 'Supplement King', icon: '💊', description: '30 days all supplements taken', unlocked: false },
  { id: 'early_bird', name: 'Early Bird', icon: '🌅', description: '10 workouts before 8am', unlocked: false },
  { id: 'night_owl', name: 'Night Owl', icon: '🌙', description: '10 workouts after 8pm', unlocked: false },
  { id: 'c1c2_warrior', name: 'C1-C2 Warrior', icon: '⚔️', description: '50 neck rehab sessions without pain increase', unlocked: false },
  { id: 'century_club', name: 'Century Club', icon: '💯', description: 'Log 50 workout sessions', unlocked: false },
  { id: 'iron_will', name: 'Iron Will', icon: '🏆', description: 'Set personal records in 10 different exercises', unlocked: false },
  { id: 'macro_master', name: 'Macro Master', icon: '🎯', description: '14 consecutive days hitting your protein target', unlocked: false },
  { id: 'recipe_creator', name: 'Recipe Creator', icon: '📖', description: 'Save 5 of your own recipes', unlocked: false },
  { id: 'body_tracker', name: 'Body Tracker', icon: '📏', description: 'Log 10 body measurements', unlocked: false },
  { id: 'photo_journal', name: 'Photo Journal', icon: '📸', description: 'Add 5 progress photos', unlocked: false }
];

import db from '../db/db';
import { useUserStore } from './useUserStore';

const calculateLevel = (xp: number) => Math.floor(Math.sqrt(xp / 100)) + 1;

// Merges a user's persisted badge list with the current DEFAULT_BADGES
// roster — any badge added to DEFAULT_BADGES after the user's data was
// last saved would otherwise never appear (the stored array was used
// as-is, so new badges were invisible until the whole roster was reset).
const mergeBadges = (stored: Badge[] | undefined): Badge[] => {
  if (!stored || stored.length === 0) return DEFAULT_BADGES;
  const storedIds = new Set(stored.map(b => b.id));
  const missing = DEFAULT_BADGES.filter(b => !storedIds.has(b.id));
  return [...stored, ...missing];
};

interface GamificationState {
  xp: number;
  level: number;
  badges: Badge[];
  addXP: (amount: number) => Promise<void>;
  unlockBadge: (id: string) => Promise<void>;
  importData: (data: Partial<Pick<GamificationState,'xp'|'level'|'badges'>>) => Promise<void>;
  loadUserGamification: (userId: string) => Promise<void>;
}

const saveGamificationToDb = async (state: GamificationState) => {
  const activeUserId = useUserStore.getState().activeUserId;
  if (!activeUserId) return;
  const user = await db.users.get(activeUserId);
  if (user) {
    await db.users.update(activeUserId, {
      gamification: {
        xp: state.xp,
        level: state.level,
        badges: state.badges
      }
    });
  }
};

export const useGamificationStore = create<GamificationState>()((set, get) => ({
  xp: 0,
  level: 1,
  badges: DEFAULT_BADGES,
  
  loadUserGamification: async (userId: string) => {
    const user = await db.users.get(userId);
    if (user && user.gamification) {
      set({
        xp: user.gamification.xp,
        level: user.gamification.level,
        badges: mergeBadges(user.gamification.badges)
      });
    } else {
      set({ xp: 0, level: 1, badges: DEFAULT_BADGES });
    }
  },

  addXP: async (amount) => {
    set((state) => {
      const newXp = state.xp + amount;
      return { xp: newXp, level: calculateLevel(newXp) };
    });
    await saveGamificationToDb(get());
  },

  unlockBadge: async (id) => {
    set((state) => {
      const badges = state.badges.map(b => {
        if (b.id === id && !b.unlocked) {
          return { ...b, unlocked: true, unlockedAt: Date.now() };
        }
        return b;
      });
      return { badges };
    });
    await saveGamificationToDb(get());
  },

  importData: async (data) => {
    set({ 
      xp: data.xp || 0, 
      level: data.level || 1, 
      badges: mergeBadges(data.badges || [])
    });
    await saveGamificationToDb(get());
  }
}));
