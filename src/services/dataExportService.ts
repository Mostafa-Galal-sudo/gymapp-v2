import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { format } from 'date-fns';
import db from '../db/db';
import { buildUserDataExport } from './backup';
export { EXPORT_FORMAT_VERSION, buildUserDataExport, isValidUserDataExport, importUserDataJSON } from './backup';
export type { UserDataExport } from './backup';
import { measurementValues, measurementFields } from './measurements';

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

export async function exportUserDataJSON(userId: string): Promise<void> {
  const data = await buildUserDataExport(userId);
  const fileName = `omnibody-backup-${format(new Date(), 'yyyy-MM-dd')}.json`;
  await saveOrShareFile(fileName, 'application/json', JSON.stringify(data, null, 2), 'OmniBody Backup');
}

// ── CSV: flat, spreadsheet-friendly exports (one table at a time) ─────────
// CSV can't represent the nested shape of meals/exercises, so this is a
// one-way, spreadsheet-friendly export — not something we read back in.

function toCSV(rows: Record<string, string | number>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: string | number) => {
    const raw = String(v);
    const s = typeof v === 'string' && /^[=+@-]/.test(raw) ? `'${raw}` : raw;
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
    ...Object.fromEntries(measurementFields.map(([key]) => [key, measurementValues(m)[key] ?? ''])), notes: m.notes || '',
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
