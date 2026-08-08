import { useUserStore } from './useUserStore';
import { useWorkoutStore } from './useWorkoutStore';
import { useNutritionStore } from './useNutritionStore';
import { useGamificationStore } from './useGamificationStore';
import { useExerciseStore } from './useExerciseStore';
import { useMeasurementsStore } from './useMeasurementsStore';

/**
 * Hydrate every per-user store (workouts, nutrition, gamification, exercises)
 * for the given user. The stores are independent, so they load in parallel.
 */
export async function hydrateSecondaryStores(userId: string): Promise<void> {
  await Promise.all([
    useWorkoutStore.getState().loadUserWorkouts(userId),
    useNutritionStore.getState().loadUserHistory(userId),
    useNutritionStore.getState().loadUserRecipes(userId),
    useGamificationStore.getState().loadUserGamification(userId),
    useExerciseStore.getState().loadUserExercises(userId),
    useMeasurementsStore.getState().loadUserMeasurements(userId),
  ]);
}

/**
 * Load the user profile and all per-user data. Used for auto-login on app
 * restart, where the user already exists (loadUser creates one if missing).
 */
export async function loadAllUserData(userId: string): Promise<void> {
  await useUserStore.getState().loadUser(userId);
  await hydrateSecondaryStores(userId);
}