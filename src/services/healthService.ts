import { Capacitor } from '@capacitor/core';
import type { HealthSample, SleepState } from '@capgo/capacitor-health';

export interface SleepStageMinutes {
  deep: number;
  rem: number;
  light: number;
  awake: number;
}

export interface DailyHealthSnapshot {
  /** Start-of-day timestamp (local), used as the record key. */
  date: number;
  steps: number;
  calories: number;
  distanceKm: number;
  exerciseMinutes: number;
  heartRate: number; // average reading for the day
  restingHeartRate: number;
  hrv: number; // ms, SDNN — 0 if unavailable
  spo2: number; // percent — 0 if unavailable
  sleepMinutes: number;
  sleepStages: SleepStageMinutes;
  // True only when this ran on a native build with HealthKit/Health Connect
  // actually available — never reachable from a plain web browser, so
  // `available: false` means "no access", not "zero activity".
  available: boolean;
}

const EMPTY_STAGES: SleepStageMinutes = { deep: 0, rem: 0, light: 0, awake: 0 };

export const emptySnapshot = (date: number): DailyHealthSnapshot => ({
  date, steps: 0, calories: 0, distanceKm: 0, exerciseMinutes: 0,
  heartRate: 0, restingHeartRate: 0, hrv: 0, spo2: 0,
  sleepMinutes: 0, sleepStages: { ...EMPTY_STAGES }, available: false,
});

let authRequested = false;

async function getHealthPlugin() {
  const { Health } = await import('@capgo/capacitor-health');
  return Health;
}

/** Ask the user for read access to every metric the app uses. Safe to call repeatedly. */
export async function ensureHealthAuthorization(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const Health = await getHealthPlugin();
    const availability = await Health.isAvailable();
    if (!availability.available) return false;

    const status = await Health.requestAuthorization({
      read: [
        'steps', 'distance', 'totalCalories', 'basalCalories',
        'heartRate', 'restingHeartRate', 'heartRateVariability',
        'oxygenSaturation', 'sleep', 'exerciseTime',
      ],
    });
    authRequested = true;
    // Consider it usable if at least one metric got granted — users can deny
    // individual metrics (e.g. sleep) and still get partial data for the rest.
    return status.readAuthorized.length > 0;
  } catch (err) {
    console.warn('[HealthService] Authorization failed:', err);
    return false;
  }
}

export async function checkHealthPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    const Health = await getHealthPlugin();
    const availability = await Health.isAvailable();
    if (!availability.available) return false;
    if (!authRequested) return false;
    const status = await Health.checkAuthorization({ read: ['steps', 'heartRate'] });
    return status.readAuthorized.length > 0;
  } catch {
    return false;
  }
}

const sumValues = (samples: HealthSample[]) => samples.reduce((acc, s) => acc + s.value, 0);
const avgValues = (samples: HealthSample[]) =>
  samples.length ? sumValues(samples) / samples.length : 0;

// Stage/state values that represent actual sleep time. 'awake' (briefly awake
// during the night) and 'inBed' (lying in bed but not yet/no longer asleep)
// are real values this API can return but must NOT be counted as sleep.
const NON_SLEEP_STATES = new Set<SleepState>(['awake', 'inBed']);

function addStageMinutes(stages: SleepStageMinutes, state: SleepState | undefined, minutes: number) {
  switch (state) {
    case 'deep': stages.deep += minutes; break;
    case 'rem': stages.rem += minutes; break;
    case 'awake': stages.awake += minutes; break;
    case 'light':
    case 'asleep':
    case 'inBed':
    default: stages.light += minutes; break; // treat undifferentiated "asleep" as light
  }
}

function summarizeSleep(samples: HealthSample[]): { minutes: number; stages: SleepStageMinutes } {
  const stages: SleepStageMinutes = { ...EMPTY_STAGES };
  let totalMinutes = 0;

  for (const sample of samples) {
    // Prefer stage-level detail when the platform/device provides it.
    if (sample.hasStageData && sample.stages?.length) {
      for (const seg of sample.stages) {
        // 'awake'/'inBed' segments are real data (briefly awake overnight, or
        // lying in bed before falling asleep) but must not inflate the sleep
        // total or get bucketed as "light" sleep.
        if (seg.stage === 'awake') {
          stages.awake += seg.durationMinutes; // tracked for the stage bar, excluded from the total
          continue;
        }
        if (seg.stage === 'inBed') continue; // not sleep at all, not even "awake time"
        totalMinutes += seg.durationMinutes;
        addStageMinutes(stages, seg.stage, seg.durationMinutes);
      }
    } else {
      // No stage detail — one sample covering a stretch of time with a single state.
      if (sample.sleepState && NON_SLEEP_STATES.has(sample.sleepState)) continue; // 'awake'/'inBed': not sleep
      const minutes = (new Date(sample.endDate).getTime() - new Date(sample.startDate).getTime()) / 60000;
      totalMinutes += minutes;
      addStageMinutes(stages, sample.sleepState, minutes);
    }
  }

  return { minutes: Math.round(totalMinutes), stages };
}

/**
 * Pull one day's worth of health data (steps, calories, distance, heart rate,
 * resting HR, HRV, SpO2, sleep) for the window [startOfDay, endOfDay).
 */
export async function syncDailyHealth(dayStart: Date): Promise<DailyHealthSnapshot> {
  const dateKey = new Date(dayStart).setHours(0, 0, 0, 0);
  if (!Capacitor.isNativePlatform()) {
    console.info('[HealthService] Not on native platform — skipping sync');
    return emptySnapshot(dateKey);
  }

  try {
    const Health = await getHealthPlugin();
    const availability = await Health.isAvailable();
    if (!availability.available) return emptySnapshot(dateKey);

    const startDate = new Date(dateKey).toISOString();
    const endDate = new Date(dateKey + 24 * 60 * 60 * 1000).toISOString();

    const [
      stepsAgg, distanceAgg, caloriesAgg,
      hrSamples, restingHrSamples, hrvSamples, spo2Samples,
      sleepSamples, exerciseAgg,
    ] = await Promise.all([
      Health.queryAggregated({ dataType: 'steps', startDate, endDate, bucket: 'day', aggregation: 'sum' }).catch(() => null),
      Health.queryAggregated({ dataType: 'distance', startDate, endDate, bucket: 'day', aggregation: 'sum' }).catch(() => null),
      Health.queryAggregated({ dataType: 'totalCalories', startDate, endDate, bucket: 'day', aggregation: 'sum' }).catch(() => null),
      Health.readSamples({ dataType: 'heartRate', startDate, endDate, limit: 500 }).catch(() => ({ samples: [] })),
      Health.readSamples({ dataType: 'restingHeartRate', startDate, endDate, limit: 10 }).catch(() => ({ samples: [] })),
      Health.readSamples({ dataType: 'heartRateVariability', startDate, endDate, limit: 50 }).catch(() => ({ samples: [] })),
      Health.readSamples({ dataType: 'oxygenSaturation', startDate, endDate, limit: 100 }).catch(() => ({ samples: [] })),
      // Sleep for "today" is really last night — look back to the previous
      // afternoon so a sleep session that started before midnight is included.
      Health.readSamples({ dataType: 'sleep', startDate: new Date(dateKey - 12 * 60 * 60 * 1000).toISOString(), endDate, limit: 200 }).catch(() => ({ samples: [] })),
      Health.queryAggregated({ dataType: 'exerciseTime', startDate, endDate, bucket: 'day', aggregation: 'sum' }).catch(() => null),
    ]);

    const steps = Math.round(stepsAgg?.samples?.[0]?.value || 0);
    const distanceKm = parseFloat(((distanceAgg?.samples?.[0]?.value || 0) / 1000).toFixed(2));
    const calories = Math.round(caloriesAgg?.samples?.[0]?.value || 0);
    const exerciseMinutes = Math.round(exerciseAgg?.samples?.[0]?.value || 0);

    const heartRate = Math.round(avgValues(hrSamples.samples));
    const restingHeartRate = Math.round(avgValues(restingHrSamples.samples));
    const hrv = Math.round(avgValues(hrvSamples.samples));
    const spo2 = Math.round(avgValues(spo2Samples.samples) * 10) / 10;
    const { minutes: sleepMinutes, stages: sleepStages } = summarizeSleep(sleepSamples.samples);

    return {
      date: dateKey, steps, calories, distanceKm, exerciseMinutes,
      heartRate, restingHeartRate, hrv, spo2,
      sleepMinutes, sleepStages, available: true,
    };
  } catch (err) {
    console.warn('[HealthService] Health sync failed:', err);
    return emptySnapshot(dateKey);
  }
}

/** Convenience wrapper for today's snapshot (used by the dashboard sync button). */
export async function syncHealth(): Promise<DailyHealthSnapshot> {
  return syncDailyHealth(new Date());
}

/** Pull the last N days (including today) for sparklines / weekly summaries. */
export async function syncHealthRange(days: number): Promise<DailyHealthSnapshot[]> {
  const out: DailyHealthSnapshot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    out.push(await syncDailyHealth(day));
  }
  return out;
}
