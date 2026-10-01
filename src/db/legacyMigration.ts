import db from './db';
import { startOfDay } from 'date-fns';
let running: Promise<void> | undefined;
export function migrateLegacyData() { return running ??= migrate().finally(() => { running = undefined; }); }
async function migrate() {
  if (await db.preferences.get('legacy-migrated')) return;
  const read = (key: string) => { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw).state : null; };
  const user = read('omnibody-user-storage'), workouts = read('omnibody-workout-storage');
  const exercises = read('omnibody-exercise-storage'), nutrition = read('omnibody-nutrition-storage');
  const awards = read('omnibody-gamification-storage');
  await db.transaction('rw', db.tables, async () => {
    const id = 'default_user';
    if (!(await db.users.get(id)) && user?.profile) {
      await db.users.add({ id, profile: user.profile, supplements: user.supplements || [], weightHistory: user.weightHistory || [], gamification: awards || undefined,
        exercisePrefs: { favorites: exercises?.favoriteExerciseIds || [], templates: exercises?.customTemplates || [] } });
      for (const w of workouts?.history || []) await db.workouts.put({ ...w, userId: id });
      for (const x of exercises?.customExercises || []) await db.custom_exercises.put({ ...x, userId: id });
      for (const day of Object.values(nutrition?.history || {}) as import('../store/useNutritionStore').NutritionDay[]) {
        const date = startOfDay(day.date).getTime();
        await db.daily_logs.put({ ...day, meals: day.meals.map(m=>({...m, foods:m.foods.map(f=>({...f,id:f.id||crypto.randomUUID(),source:f.source||'legacy'}))})), date, id: `${id}_${date}`, userId: id, supplementsTaken: day.supplementsTaken || {} });
      }
      if (workouts?.activeSession) await db.active_workouts.put({ userId: id, session: workouts.activeSession });
      for (const s of workouts?.scheduledSessions || []) await db.schedules.put({ ...s, userId: id });
    }
    await db.preferences.put({ id: 'legacy-migrated', value: 'true' });
  });
  if (user?.profile && !localStorage.getItem('omni_active_user')) localStorage.setItem('omni_active_user', 'default_user');
}
