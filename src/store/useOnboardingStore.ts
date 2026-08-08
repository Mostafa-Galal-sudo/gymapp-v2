import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface OnboardingState {
  hasSeenWalkthrough: boolean;
  isWalkthroughOpen: boolean;
  markWalkthroughSeen: () => void;
  startWalkthrough: () => void;
  closeWalkthrough: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      hasSeenWalkthrough: false,
      isWalkthroughOpen: false,
      markWalkthroughSeen: () => set({ hasSeenWalkthrough: true }),
      startWalkthrough: () => set({ isWalkthroughOpen: true }),
      closeWalkthrough: () => set({ isWalkthroughOpen: false }),
    }),
    {
      name: 'omnibody-onboarding',
      // Only persist the "seen" flag — isWalkthroughOpen is transient UI
      // state and should never be restored as "open" on a fresh app load.
      partialize: (state) => ({ hasSeenWalkthrough: state.hasSeenWalkthrough }),
    }
  )
);
