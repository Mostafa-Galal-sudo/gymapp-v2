import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { format } from 'date-fns';
import db, {
  type UserEntity, type DailyLogEntity, type DBWorkoutSession, type DBCustomExercise,
  type InjuryEntry, type CustomFood, type MeasurementEntry, type ProgressPhoto, type Recipe,
} from '../db/db';

export const EXPORT_FORMAT_VERSION = 1;

export interface UserDataExport {
  formatVersion: number;
  exportedAt: string;
  userId: string;
  users: UserEntity[];
  daily_logs: DailyLogEntity[];
  workouts: DBWorkoutSession[];
  custom_exercises: DBCustomExercise[];
  injuries: InjuryEntry[];
  custom_foods: CustomFood[];
  measurements: MeasurementEntry[];
  progress_photos: ProgressPhoto[];
  recipes: Recipe[];
}

// ── Save/share a generated file (JSON or CSV), native or web ──────────────
export async function saveOrShareFile(fileName: string, mimeType: string, content: string, shareTitle: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const isText = mimeType.startsWith('text/') || mimeType === 'application/json';
    await Filesystem.writeFile({
      path: fileName,
      data: isText ? btoa(unescape(encodeURIComponent(content))) : content,
      directory: Directory.Cache,
    });
    const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
    await Share.share({ title: shareTitle, text: shareTitle, url: fileUri.uri, dialogTitle: shareTitle });
  } else {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  }
}

// ── JSON: full backup (every table, round-trippable) ──────────────────────

export async function buildUserDataExport(userId: string): Promise<UserDataExport> {
  const [
    users, daily_logs, workouts, custom_exercises, injuries,
    custom_foods, measurements, progress_photos, recipes,
  ] = await Promise.all([
    db.users.where('id').equals(userId).toArray(),
    db.daily_logs.where('userId').equals(userId).toArray(),
    db.workouts.where('userId').equals(userId).toArray(),
    db.custom_exercises.where('userId').equals(userId).toArray(),
    db.injuries.where('userId').equals(userId).toArray(),
    db.custom_foods.where('userId').equals(userId).toArray(),
    db.measurements.where('userId').equals(userId).toArray(),
    db.progress_photos.where('userId').equals(userId).toArray(),
    db.recipes.where('userId').equals(userId).toArray(),
  ]);
  return {
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    userId, users, daily_logs, workouts, custom_exercises, injuries,
    custom_foods, measurements, progress_photos, recipes,
  };
}

export async function exportUserDataJSON(userId: string): Promise<void> {
  const data = await buildUserDataExport(userId);
  const fileName = `omnibody-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
  await saveOrShareFile(fileName, 'application/json', JSON.stringify(data, null, 2), 'OmniBody Backup');
}

export function isValidUserDataExport(data: unknown): data is UserDataExport {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return Array.isArray(d.users) && Array.isArray(d.daily_logs) && Array.isArray(d.workouts);
}

/**
 * Restore a backup into `targetUserId` (normally the currently logged-in
 * user). Every record's `userId` field is remapped to the target so a
 * backup can be safely restored even into a different/new account without
 * ever colliding with another user's data. Existing records with matching
 * primary keys are overwritten (bulkPut), everything else is left as-is.
 */
export async function importUserDataJSON(data: UserDataExport, targetUserId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.users, db.daily_logs, db.workouts, db.custom_exercises, db.injuries, db.custom_foods, db.measurements, db.progress_photos, db.recipes],
    async () => {
      const sourceUser = data.users[0];
      if (sourceUser) {
        const existing = await db.users.get(targetUserId);
        await db.users.put({ ...sourceUser, id: targetUserId });
        if (!existing) {
          // brand-new user record — nothing else to merge
        }
      }
      if (data.daily_logs?.length) {
        await db.daily_logs.bulkPut(data.daily_logs.map(d => ({ ...d, userId: targetUserId, id: `${targetUserId}_${d.date}` })));
      }
      if (data.workouts?.length) {
        await db.workouts.bulkPut(data.workouts.map(w => ({ ...w, userId: targetUserId })));
      }
      if (data.custom_exercises?.length) {
        await db.custom_exercises.bulkPut(data.custom_exercises.map(x => ({ ...x, userId: targetUserId })));
      }
      if (data.injuries?.length) {
        await db.injuries.bulkPut(data.injuries.map(x => ({ ...x, userId: targetUserId })));
      }
      if (data.custom_foods?.length) {
        await db.custom_foods.bulkPut(data.custom_foods.map(x => ({ ...x, userId: targetUserId })));
      }
      if (data.measurements?.length) {
        await db.measurements.bulkPut(data.measurements.map(x => ({ ...x, userId: targetUserId })));
      }
      if (data.progress_photos?.length) {
        await db.progress_photos.bulkPut(data.progress_photos.map(x => ({ ...x, userId: targetUserId })));
      }
      if (data.recipes?.length) {
        await db.recipes.bulkPut(data.recipes.map(x => ({ ...x, userId: targetUserId })));
      }
    }
  );
}

// ── CSV: flat, spreadsheet-friendly exports (one table at a time) ─────────
// CSV can't represent the nested shape of meals/exercises, so this is a
// one-way, spreadsheet-friendly export — not something we read back in.

function toCSV(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const row of rows) lines.push(headers.map(h => escape(row[h] ?? '')).join(','));
  return lines.join('\n');
}

export async function exportWorkoutsCSV(userId: string): Promise<void> {
  const workouts = await db.workouts.where('userId').equals(userId).sortBy('date');
  const csv = toCSV(workouts.map(w => ({
    date: format(new Date(w.date), 'yyyy-MM-dd'),
    type: w.type,
    exercises: w.exercises.length,
    totalVolume: w.totalVolume,
    phase: w.phase,
    finished: w.isFinished ? 'yes' : 'no',
  })));
  await saveOrShareFile(`omnibody-workouts-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv', csv, 'OmniBody Workouts CSV');
}

export async function exportNutritionCSV(userId: string): Promise<void> {
  const logs = await db.daily_logs.where('userId').equals(userId).sortBy('date');
  const csv = toCSV(logs.map(log => {
    let calories = 0, protein = 0, carbs = 0, fats = 0;
    log.meals.forEach(m => m.foods.forEach(f => { calories += f.calories; protein += f.protein; carbs += f.carbs; fats += f.fats; }));
    return {
      date: format(new Date(log.date), 'yyyy-MM-dd'),
      calories: Math.round(calories), protein: Math.round(protein),
      carbs: Math.round(carbs), fats: Math.round(fats), waterMl: log.waterMl,
    };
  }));
  await saveOrShareFile(`omnibody-nutrition-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv', csv, 'OmniBody Nutrition CSV');
}

export async function exportMeasurementsCSV(userId: string): Promise<void> {
  const rows = await db.measurements.where('userId').equals(userId).sortBy('date');
  const csv = toCSV(rows.map(m => ({
    date: format(new Date(m.date), 'yyyy-MM-dd'),
    weight: m.weight ?? '', bodyFat: m.bodyFat ?? '', waist: m.waist ?? '',
    chest: m.chest ?? '', arm: m.arm ?? '', thigh: m.thigh ?? '', hips: m.hips ?? '', neck: m.neck ?? '',
  })));
  await saveOrShareFile(`omnibody-measurements-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv', csv, 'OmniBody Measurements CSV');
}

export async function exportWeightHistoryCSV(userId: string): Promise<void> {
  const user = await db.users.get(userId);
  const csv = toCSV((user?.weightHistory || []).map(w => ({
    date: format(new Date(w.date), 'yyyy-MM-dd'), weight: w.weight,
  })));
  await saveOrShareFile(`omnibody-weight-${format(new Date(), 'yyyy-MM-dd')}.csv`, 'text/csv', csv, 'OmniBody Weight History CSV');
}
