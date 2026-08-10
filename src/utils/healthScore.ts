// ── Health Score ─────────────────────────────────────────────────────────────
// Health Score = 30% Sleep + 25% Activity + 20% Nutrition + 15% Heart Health + 10% Consistency
//
// Design notes (read before tweaking the weights):
// - This is a *personal* wellness proxy, not a clinical or diagnostic score.
// - "Heart Health" is compared against general population resting-HR/HRV
//   ranges, NOT against age/gender-matched clinical norms — we don't have
//   the data to do that responsibly, so we don't pretend to.
// - Any category with no underlying data (e.g. health permissions not
//   granted, so no sleep/heart data) is dropped and the remaining
//   categories are reweighted proportionally so the score still sums
//   sensibly out of 100. `dataComplete` tells the UI whether that happened.

export type HealthScoreCategoryKey = 'sleep' | 'activity' | 'nutrition' | 'heart' | 'consistency';

const BASE_WEIGHTS: Record<HealthScoreCategoryKey, number> = {
  sleep: 0.30,
  activity: 0.25,
  nutrition: 0.20,
  heart: 0.15,
  consistency: 0.10,
};

export interface HealthScoreInputs {
  sleepMinutes: number | null;
  steps: number | null;
  exerciseMinutes: number | null;
  caloriesConsumed: number | null;
  calorieTarget: number;
  proteinConsumed: number | null;
  proteinTarget: number;
  restingHeartRate: number | null;
  hrv: number | null;
  workoutDaysLast7: number; // always computable from local workout history
}

export interface HealthScoreCategory {
  key: HealthScoreCategoryKey;
  score: number | null; // null = excluded from the total (no data)
  weight: number; // effective (reweighted) weight actually used
}

export interface HealthScoreResult {
  score: number; // 0-100, rounded
  categories: HealthScoreCategory[];
  dataComplete: boolean;
  tipKey: string; // i18n key for the one daily tip
}

const clamp = (n: number, min = 0, max = 100) => Math.max(min, Math.min(max, n));

function sleepScore(minutes: number | null): number | null {
  if (minutes == null || minutes <= 0) return null;
  // Ideal midpoint ~8h (480min); falls off symmetrically for over/under-sleeping.
  return clamp(100 - (Math.abs(minutes - 480) / 480) * 100);
}

function activityScore(steps: number | null, exerciseMinutes: number | null): number | null {
  if (steps == null && exerciseMinutes == null) return null;
  const stepScore = steps != null ? clamp((steps / 8000) * 100) : null;
  const exScore = exerciseMinutes != null ? clamp((exerciseMinutes / 30) * 100) : null;
  const parts = [stepScore, exScore].filter((v): v is number => v != null);
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function nutritionScore(
  caloriesConsumed: number | null, calorieTarget: number,
  proteinConsumed: number | null, proteinTarget: number
): number | null {
  if (caloriesConsumed == null && proteinConsumed == null) return null;
  const parts: number[] = [];
  if (caloriesConsumed != null && calorieTarget > 0) {
    parts.push(clamp(100 - (Math.abs(caloriesConsumed - calorieTarget) / calorieTarget) * 100));
  }
  if (proteinConsumed != null && proteinTarget > 0) {
    // Under-target protein is penalized; hitting or slightly exceeding is fine.
    parts.push(clamp((proteinConsumed / proteinTarget) * 100));
  }
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function heartScore(restingHR: number | null, hrv: number | null): number | null {
  if (!restingHR && !hrv) return null;
  const parts: number[] = [];
  // Rough general-population bands — lower resting HR trends healthier.
  if (restingHR) parts.push(clamp(100 - (restingHR - 50) * 2));
  // Higher HRV trends healthier; ~60ms treated as a strong (not maximal) score.
  if (hrv) parts.push(clamp((hrv / 60) * 100));
  if (!parts.length) return null;
  return parts.reduce((a, b) => a + b, 0) / parts.length;
}

function consistencyScore(workoutDaysLast7: number): number {
  // 4 active days/week is treated as "full score" — sustainable, not extreme.
  return clamp((workoutDaysLast7 / 4) * 100);
}

export function calculateHealthScore(inputs: HealthScoreInputs): HealthScoreResult {
  const raw: Record<HealthScoreCategoryKey, number | null> = {
    sleep: sleepScore(inputs.sleepMinutes),
    activity: activityScore(inputs.steps, inputs.exerciseMinutes),
    nutrition: nutritionScore(inputs.caloriesConsumed, inputs.calorieTarget, inputs.proteinConsumed, inputs.proteinTarget),
    heart: heartScore(inputs.restingHeartRate, inputs.hrv),
    consistency: consistencyScore(inputs.workoutDaysLast7),
  };

  const includedKeys = (Object.keys(raw) as HealthScoreCategoryKey[]).filter(k => raw[k] != null);
  const weightSum = includedKeys.reduce((a, k) => a + BASE_WEIGHTS[k], 0) || 1;

  const categories: HealthScoreCategory[] = (Object.keys(raw) as HealthScoreCategoryKey[]).map(key => ({
    key,
    score: raw[key],
    weight: raw[key] != null ? BASE_WEIGHTS[key] / weightSum : 0,
  }));

  const score = Math.round(
    categories.reduce((acc, c) => acc + (c.score ?? 0) * c.weight, 0)
  );

  const dataComplete = raw.sleep != null && raw.activity != null && raw.heart != null;

  // Daily tip = the lowest-scoring category that actually has data.
  const withScores = categories.filter(c => c.score != null) as { key: HealthScoreCategoryKey; score: number; weight: number }[];
  const worst = withScores.length
    ? withScores.reduce((min, c) => (c.score < min.score ? c : min))
    : null;
  const tipKey = worst ? `health.tip_${worst.key}` : 'health.tip_no_data';

  return { score: clamp(score, 0, 100), categories, dataComplete, tipKey };
}
