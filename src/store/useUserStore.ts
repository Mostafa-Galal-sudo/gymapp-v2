import { create } from 'zustand';
import db, { type InjuryEntry } from '../db/db';

export interface Supplement {
  id: string;
  name: string;
  dose: string;
  timing: string;
  taken: boolean[]; // Array of booleans for multiple doses (used to define how many doses are needed)
  // Optional nutrient contribution PER DOSE — when set, marking a dose as
  // taken adds these values into that day's nutrition totals (see
  // toggleSupplement in useNutritionStore.ts). All optional since most
  // supplements only need a subset (e.g. a vitamin D pill only sets vitaminD).
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  vitaminD?: number;
  vitaminB12?: number;
  vitaminC?: number;
  vitaminE?: number;
  magnesium?: number;
  zinc?: number;
  calcium?: number;
  iron?: number;
}

export interface UserProfile {
  name: string;
  age: number;
  weight: number;
  height: number;
  level: string;
  goals: string[];
  profilePhoto?: string;
  activityLevel?: 'Sedentary' | 'Light' | 'Moderate' | 'Active';
  gender?: 'male' | 'female';
}

export interface WeightEntry {
  date: number;
  weight: number;
}

interface UserState {
  activeUserId: string | null;
  profile: UserProfile;
  supplements: Supplement[];
  weightHistory: WeightEntry[];
  injuries: InjuryEntry[];
  isAuthenticated: boolean;
  loadUser: (userId: string) => Promise<void>;
  createUser: (userId: string, name: string) => Promise<void>;
  logout: () => void;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  logWeight: (weight: number) => Promise<void>;
  addSupplement: (supplement: Supplement) => Promise<void>;
  deleteSupplement: (id: string) => Promise<void>;
  addInjury: (injury: Omit<InjuryEntry, 'id' | 'userId' | 'dateLogged'>) => Promise<void>;
  updateInjuryStatus: (id: string, status: InjuryEntry['status']) => Promise<void>;
  deleteInjury: (id: string) => Promise<void>;
}

const DEFAULT_SUPPLEMENTS: Supplement[] = [
  { id: 'cal_d', name: 'Cal-D', dose: '2 tabs', timing: 'Morning with breakfast', taken: [false], calcium: 500, vitaminD: 400 },
  { id: 'omega3', name: 'Omega-3', dose: '4 caps', timing: 'Morning + Evening', taken: [false, false] },
  { id: 'creatine', name: 'Creatine', dose: '5g', timing: 'Morning with breakfast', taken: [false] },
  { id: 'ashwagandha', name: 'Ashwagandha', dose: '300mg', timing: 'Evening with dinner', taken: [false] },
  { id: 'vit_d3', name: 'Vitamin D3', dose: '2000 IU', timing: 'After lunch', taken: [false], vitaminD: 2000 },
  { id: 'magnesium', name: 'Magnesium', dose: '200mg', timing: 'Evening before bed', taken: [false], magnesium: 200 },
];

const DEFAULT_PROFILE: UserProfile = {
  name: 'User',
  age: 25,
  weight: 70,
  height: 175,
  level: 'Beginner',
  goals: ['General Fitness'],
  activityLevel: 'Moderate',
  gender: 'male',
};

// DEFAULT_PROFILE/DEFAULT_SUPPLEMENTS are shared module-level objects — always
// clone them before putting them in state so mutating one user's session
// (or a future code path that edits arrays in place) can never leak into
// another user's data or into the next logout/login cycle.
const cloneDefaultProfile = (): UserProfile => ({ ...DEFAULT_PROFILE, goals: [...DEFAULT_PROFILE.goals] });
const cloneDefaultSupplements = (): Supplement[] => DEFAULT_SUPPLEMENTS.map(s => ({ ...s, taken: [...s.taken] }));

const saveToDb = async (state: UserState) => {
  if (!state.activeUserId) return;
  await db.users.put({
    id: state.activeUserId,
    profile: state.profile,
    supplements: state.supplements,
    weightHistory: state.weightHistory
  });
};

// Patches nutrient fields onto a user's already-saved supplements when they
// match a known default supplement's id but predate nutrient tracking being
// added (e.g. a Cal-D or Vitamin D3 saved before this feature existed) —
// without touching anything the user customized (dose/timing/name).
const backfillSupplementNutrients = (supplements: Supplement[]): Supplement[] => {
  const defaultsById = new Map(DEFAULT_SUPPLEMENTS.map(s => [s.id, s]));
  return supplements.map(sup => {
    const def = defaultsById.get(sup.id);
    if (!def) return sup;
    const hasAnyNutrient = [sup.calories, sup.protein, sup.carbs, sup.fats, sup.vitaminD,
      sup.vitaminB12, sup.vitaminC, sup.vitaminE, sup.magnesium, sup.zinc, sup.calcium, sup.iron]
      .some(v => v != null);
    if (hasAnyNutrient) return sup; // already has values (possibly user-edited) — leave alone
    const { id, name, dose, timing, taken, ...nutrients } = def;
    return { ...sup, ...nutrients };
  });
};

export const useUserStore = create<UserState>()((set, get) => ({
  activeUserId: null,
  profile: cloneDefaultProfile(),
  supplements: cloneDefaultSupplements(),
  weightHistory: [],
  injuries: [],
  isAuthenticated: false,

  loadUser: async (userId: string) => {
    const id = userId || 'default_user';
    const user = await db.users.get(id);
    const injuries = await db.injuries.where('userId').equals(id).toArray();
    if (user) {
      localStorage.setItem('omni_active_user', id);
      const finalSupplements = backfillSupplementNutrients(user.supplements || cloneDefaultSupplements());
      set({
        activeUserId: id,
        profile: user.profile,
        supplements: finalSupplements,
        weightHistory: user.weightHistory || [],
        injuries: injuries || [],
        isAuthenticated: true
      });
      const { scheduleSupplementReminders } = await import('../services/notificationService');
      await scheduleSupplementReminders(finalSupplements);
    } else {
      await get().createUser(id, 'User');
    }
  },

  createUser: async (userId: string, name: string) => {
    const id = userId || 'default_user';
    const profile = { ...cloneDefaultProfile(), name };
    const supplements = cloneDefaultSupplements();
    const weightHistory = [{ date: Date.now(), weight: profile.weight }];
    await db.users.put({
      id,
      profile,
      supplements,
      weightHistory
    });
    localStorage.setItem('omni_active_user', id);
    set({
      activeUserId: id,
      profile,
      supplements,
      weightHistory,
      injuries: [],
      isAuthenticated: true
    });
    const { scheduleSupplementReminders } = await import('../services/notificationService');
    await scheduleSupplementReminders(supplements);
  },

  logout: () => {
    localStorage.removeItem('omni_active_user');
    set({
      activeUserId: null,
      isAuthenticated: false,
      profile: cloneDefaultProfile(),
      supplements: cloneDefaultSupplements(),
      weightHistory: [],
      injuries: []
    });
  },

  updateProfile: async (updates) => {
    const state = get();
    const newProfile = { ...state.profile, ...updates };
    set({ profile: newProfile });
    await saveToDb({ ...state, profile: newProfile });
  },

  logWeight: async (weight) => {
    const state = get();
    const newProfile = { ...state.profile, weight };
    const newHistory = [...state.weightHistory, { date: Date.now(), weight }];
    set({ profile: newProfile, weightHistory: newHistory });
    await saveToDb({ ...state, profile: newProfile, weightHistory: newHistory });
  },

  addSupplement: async (supplement: Supplement) => {
    const state = get();
    const newSupplements = [...state.supplements, supplement];
    set({ supplements: newSupplements });
    await saveToDb({ ...state, supplements: newSupplements });
    const { scheduleSupplementReminders } = await import('../services/notificationService');
    await scheduleSupplementReminders(newSupplements);
  },

  deleteSupplement: async (id: string) => {
    const state = get();
    const newSupplements = state.supplements.filter(s => s.id !== id);
    set({ supplements: newSupplements });
    await saveToDb({ ...state, supplements: newSupplements });
    const { scheduleSupplementReminders } = await import('../services/notificationService');
    await scheduleSupplementReminders(newSupplements);
  },

  addInjury: async (injury) => {
    const state = get();
    const id = Math.random().toString(36).substring(2, 9);
    const userId = state.activeUserId || 'default_user';
    const newEntry: InjuryEntry = {
      ...injury,
      id,
      userId,
      dateLogged: Date.now()
    };
    await db.injuries.put(newEntry);
    set({ injuries: [...state.injuries, newEntry] });
  },

  deleteInjury: async (id: string) => {
    await db.injuries.delete(id);
    set(state => ({ injuries: state.injuries.filter(i => i.id !== id) }));
  },

  updateInjuryStatus: async (id: string, status: InjuryEntry['status']) => {
    const existing = get().injuries.find(i => i.id === id);
    if (!existing) return;
    const updated = { ...existing, status };
    await db.injuries.put(updated);
    set(state => ({ injuries: state.injuries.map(i => i.id === id ? updated : i) }));
  }
}));
