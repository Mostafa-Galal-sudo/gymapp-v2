import { create } from 'zustand';
import db, { type MeasurementEntry, type ProgressPhoto } from '../db/db';
import { useUserStore } from './useUserStore';
import { useGamificationStore } from './useGamificationStore';

const generateId = () => Math.random().toString(36).substring(2, 9);

interface MeasurementsState {
  measurements: MeasurementEntry[];
  photos: ProgressPhoto[];

  loadUserMeasurements: (userId: string) => Promise<void>;
  addMeasurement: (entry: Omit<MeasurementEntry, 'id' | 'userId'>) => Promise<void>;
  deleteMeasurement: (id: string) => Promise<void>;
  addPhoto: (photo: Omit<ProgressPhoto, 'id' | 'userId'>) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
}

export const useMeasurementsStore = create<MeasurementsState>()((set, get) => ({
  measurements: [],
  photos: [],

  loadUserMeasurements: async (userId: string) => {
    const id = userId || 'default_user';
    const [measurements, photos] = await Promise.all([
      db.measurements.where('userId').equals(id).toArray(),
      db.progress_photos.where('userId').equals(id).toArray(),
    ]);
    set({
      measurements: measurements.sort((a, b) => a.date - b.date),
      photos: photos.sort((a, b) => a.date - b.date),
    });
  },

  addMeasurement: async (entry) => {
    const userId = useUserStore.getState().activeUserId || 'default_user';
    const newEntry: MeasurementEntry = { ...entry, id: generateId(), userId };
    await db.measurements.put(newEntry);
    set(state => ({ measurements: [...state.measurements, newEntry].sort((a, b) => a.date - b.date) }));
    if (get().measurements.length >= 10) {
      useGamificationStore.getState().unlockBadge('body_tracker');
    }
  },

  deleteMeasurement: async (id: string) => {
    await db.measurements.delete(id);
    set(state => ({ measurements: state.measurements.filter(m => m.id !== id) }));
  },

  addPhoto: async (photo) => {
    const userId = useUserStore.getState().activeUserId || 'default_user';
    const newPhoto: ProgressPhoto = { ...photo, id: generateId(), userId };
    await db.progress_photos.put(newPhoto);
    set(state => ({ photos: [...state.photos, newPhoto].sort((a, b) => a.date - b.date) }));
    if (get().photos.length >= 5) {
      useGamificationStore.getState().unlockBadge('photo_journal');
    }
  },

  deletePhoto: async (id: string) => {
    await db.progress_photos.delete(id);
    set(state => ({ photos: state.photos.filter(p => p.id !== id) }));
  },
}));
