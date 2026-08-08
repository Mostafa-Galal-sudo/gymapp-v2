import { Capacitor } from '@capacitor/core';

export interface HealthData {
  steps: number;
  heartRate: number;
  calories: number;
  distanceKm: number;
  // True only when this ran on a native iOS/Android build with the Health
  // plugin actually available — HealthKit/Health Connect are never
  // reachable from a plain web browser, so `available: false` means "zero
  // because there's no access", not "zero steps taken".
  available: boolean;
}

const EMPTY_HEALTH: HealthData = { steps: 0, heartRate: 0, calories: 0, distanceKm: 0, available: false };

/**
 * Sync health data from Google Fit (Android) or Apple Health (iOS).
 * Uses @capacitor-community/health plugin when available.
 */
export async function syncHealth(): Promise<HealthData> {
  if (!Capacitor.isNativePlatform()) {
    console.info('[HealthService] Not on native platform — skipping sync');
    return EMPTY_HEALTH;
  }

  try {
    // Dynamically import to avoid crashing on web
    const { Health } = await import('@awesome-cordova-plugins/health');

    const isAvailable = await Health.isAvailable();
    if (!isAvailable) return EMPTY_HEALTH;

    // Request permissions
    await Health.requestAuthorization([
      { read: ['steps'] },
      { read: ['calories'] },
      { read: ['distance'] },
      { read: ['heart_rate'] },
    ]);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0); // Start of today

    const query = { startDate, endDate, dataType: '' };

    // Query each data type
    const [stepsData, caloriesData, distanceData, hrData] = await Promise.all([
      Health.query({ ...query, dataType: 'steps' }).catch(() => []),
      Health.query({ ...query, dataType: 'calories' }).catch(() => []),
      Health.query({ ...query, dataType: 'distance' }).catch(() => []),
      Health.query({ ...query, dataType: 'heart_rate' }).catch(() => []),
    ]);

    const sumValues = (data: any[]) =>
      data.reduce((acc, d) => acc + (d.value || 0), 0);

    const steps = Math.round(sumValues(stepsData));
    const calories = Math.round(sumValues(caloriesData));
    const distanceKm = parseFloat((sumValues(distanceData) / 1000).toFixed(2));

    // Heart rate: use the latest reading
    const hrReadings = hrData as any[];
    const heartRate = hrReadings.length > 0
      ? Math.round(hrReadings[hrReadings.length - 1]?.value || 0)
      : 0;

    return { steps, heartRate, calories, distanceKm, available: true };
  } catch (err) {
    console.warn('[HealthService] Health sync failed:', err);
    return EMPTY_HEALTH;
  }
}

/**
 * Check if health permissions are granted.
 */
export async function checkHealthPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const { Health } = await import('@awesome-cordova-plugins/health');
    return await Health.isAvailable();
  } catch {
    return false;
  }
}
