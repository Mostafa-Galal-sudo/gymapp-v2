import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Capacitor } from '@capacitor/core';
import type { DailyHealthSnapshot } from '../services/healthService';

interface HealthState {
  /** Last 7 days of snapshots, oldest first, today last. */
  daily: DailyHealthSnapshot[];
  authorized: boolean;
  syncing: boolean;
  lastSyncedAt: number | null;
  error: string | null;

  requestAccess: () => Promise<boolean>;
  syncWeek: () => Promise<void>;
  today: () => DailyHealthSnapshot | null;
  yesterday: () => DailyHealthSnapshot | null;
  weeklyAverage: () => Omit<DailyHealthSnapshot, 'date' | 'available' | 'sleepStages'> | null;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      daily: [],
      authorized: false,
      syncing: false,
      lastSyncedAt: null,
      error: null,

      requestAccess: async () => {
        if (!Capacitor.isNativePlatform()) {
          set({ error: 'native_only' });
          return false;
        }
        const { ensureHealthAuthorization } = await import('../services/healthService');
        const ok = await ensureHealthAuthorization();
        set({ authorized: ok, error: ok ? null : 'permission_denied' });
        if (ok) await get().syncWeek();
        return ok;
      },

      syncWeek: async () => {
        set({ syncing: true, error: null });
        try {
          const { syncHealthRange } = await import('../services/healthService');
          const daily = await syncHealthRange(7);
          set({ daily, syncing: false, lastSyncedAt: Date.now(), authorized: daily.some(d => d.available) });
        } catch (err) {
          console.warn('[useHealthStore] sync failed', err);
          set({ syncing: false, error: 'sync_failed' });
        }
      },

      today: () => {
        const { daily } = get();
        return daily.length ? daily[daily.length - 1] : null;
      },

      yesterday: () => {
        const { daily } = get();
        return daily.length > 1 ? daily[daily.length - 2] : null;
      },

      weeklyAverage: () => {
        const { daily } = get();
        const withData = daily.filter(d => d.available);
        if (!withData.length) return null;
        const n = withData.length;
        return {
          steps: Math.round(withData.reduce((a, d) => a + d.steps, 0) / n),
          calories: Math.round(withData.reduce((a, d) => a + d.calories, 0) / n),
          distanceKm: parseFloat((withData.reduce((a, d) => a + d.distanceKm, 0) / n).toFixed(2)),
          exerciseMinutes: Math.round(withData.reduce((a, d) => a + d.exerciseMinutes, 0) / n),
          heartRate: Math.round(withData.reduce((a, d) => a + d.heartRate, 0) / n),
          restingHeartRate: Math.round(withData.reduce((a, d) => a + d.restingHeartRate, 0) / n),
          hrv: Math.round(withData.reduce((a, d) => a + d.hrv, 0) / n),
          spo2: parseFloat((withData.reduce((a, d) => a + d.spo2, 0) / n).toFixed(1)),
          sleepMinutes: Math.round(withData.reduce((a, d) => a + d.sleepMinutes, 0) / n),
        };
      },
    }),
    {
      name: 'omnibody-health-storage',
      // `syncing`/`error` are transient UI state, not data — if the app is
      // killed mid-sync, a persisted `syncing: true` would leave the sync
      // button permanently stuck/disabled on the next launch.
      partialize: (state) => ({ daily: state.daily, authorized: state.authorized, lastSyncedAt: state.lastSyncedAt }),
    }
  )
);
