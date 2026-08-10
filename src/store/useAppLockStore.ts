import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppLockState {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
}

export const useAppLockStore = create<AppLockState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
    }),
    { name: 'omnibody-app-lock-storage' }
  )
);
