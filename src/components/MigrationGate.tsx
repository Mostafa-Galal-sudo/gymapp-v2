import { useEffect, useState } from 'react';
import db from '../db/db';
import { Shield } from 'lucide-react';
import { startOfDay } from 'date-fns';

export const MigrationGate = ({ children }: { children: React.ReactNode }) => {
  const [migrating, setMigrating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const checkMigration = async () => {
      const isMigrated = localStorage.getItem('dexie_v2_migration_complete');
      if (isMigrated === 'true') return;

      setMigrating(true);
      
      try {
        setProgress(10);
        const userRaw = localStorage.getItem('omnibody-user-storage');
        const workoutRaw = localStorage.getItem('omnibody-workout-storage');
        const exerciseRaw = localStorage.getItem('omnibody-exercise-storage');
        const nutritionRaw = localStorage.getItem('omnibody-nutrition-storage');

        setProgress(30);
        const userState = userRaw ? JSON.parse(userRaw).state : null;
        const workoutState = workoutRaw ? JSON.parse(workoutRaw).state : null;
        const exerciseState = exerciseRaw ? JSON.parse(exerciseRaw).state : null;
        const nutritionState = nutritionRaw ? JSON.parse(nutritionRaw).state : null;

        const defaultUserId = 'default_user';

        setProgress(50);
        // Create user
        if (userState?.profile) {
          await db.users.put({
            id: defaultUserId,
            profile: userState.profile,
            supplements: userState.supplements || [],
            weightHistory: userState.weightHistory || []
          });
        }

        setProgress(70);
        // Workouts
        if (workoutState?.history?.length) {
          const mappedWorkouts = workoutState.history.map((w: any) => ({ ...w, userId: defaultUserId }));
          await db.workouts.bulkPut(mappedWorkouts);
        }

        setProgress(80);
        // Custom Exercises
        if (exerciseState?.customExercises?.length) {
          const mappedEx = exerciseState.customExercises.map((e: any) => ({ ...e, userId: defaultUserId }));
          await db.custom_exercises.bulkPut(mappedEx);
        }

        setProgress(90);
        // Nutrition (Daily Logs)
        if (nutritionState?.history) {
          const historyMap = nutritionState.history;
          const dailyLogs = Object.values(historyMap).map((day: any) => {
            const dateStr = startOfDay(new Date(day.date)).getTime();
            return {
              id: `${defaultUserId}_${dateStr}`,
              userId: defaultUserId,
              date: dateStr,
              meals: day.meals || [],
              waterMl: day.waterMl || 0,
              supplementsTaken: {}
            };
          });
          await db.daily_logs.bulkPut(dailyLogs);
        }

        setProgress(100);
        localStorage.setItem('dexie_v2_migration_complete', 'true');
        // Point auto-login at the migrated user, otherwise App.tsx's
        // startup check finds nothing and the migrated data sits unused.
        localStorage.setItem('omni_active_user', defaultUserId);
        // Clear old local storage to prevent confusion (optional, but good for cleanup)
        // localStorage.removeItem('omnibody-user-storage');
        // localStorage.removeItem('omnibody-workout-storage');
        // localStorage.removeItem('omnibody-nutrition-storage');
        
        setTimeout(() => setMigrating(false), 500);

      } catch (err) {
        console.error('Migration failed:', err);
        alert('Failed to migrate old data. Starting fresh database.');
        localStorage.setItem('dexie_v2_migration_complete', 'true');
        setMigrating(false);
      }
    };

    checkMigration();
  }, []);

  if (migrating) {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '2rem', textAlign: 'center' }}>
        <Shield size={48} color="var(--cyan)" style={{ marginBottom: '1.5rem', animation: 'pulse 2s infinite' }} />
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', marginBottom: '1rem' }}>Upgrading Database</h2>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
          Migrating your data to OMNIBODY V2 Engine...<br/>Please do not close the app.
        </p>
        <div className="xp-bar-track" style={{ width: '100%', maxWidth: 300 }}>
          <div className="xp-bar-fill" style={{ width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
