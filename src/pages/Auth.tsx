import { useState, useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { useGamificationStore } from '../store/useGamificationStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useMeasurementsStore } from '../store/useMeasurementsStore';
import db from '../db/db';
import { useT } from '../hooks/useT';

export const Auth = () => {
  const t = useT();
  const loadUser = useUserStore((s) => s.loadUser);
  const createUser = useUserStore((s) => s.createUser);
  const loadUserWorkouts = useWorkoutStore((s) => s.loadUserWorkouts);
  const loadUserHistory = useNutritionStore((s) => s.loadUserHistory);
  const loadUserGamification = useGamificationStore((s) => s.loadUserGamification);
  const loadUserExercises = useExerciseStore((s) => s.loadUserExercises);
  const loadUserMeasurements = useMeasurementsStore((s) => s.loadUserMeasurements);

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(false);

  useEffect(() => {
    const checkExistingUser = async () => {
      const user = await db.users.get('default_user');
      if (user && user.profile) {
        setName(user.profile.name || '');
        setUserExists(true);
      }
      setLoading(false);
    };
    checkExistingUser();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Existing user -> load their real data. New user -> create fresh profile.
    // (Previously this always called createUser, which wiped existing
    // profile/supplements/weightHistory back to defaults on every re-login.)
    if (userExists) {
      await loadUser('default_user');
    } else {
      await createUser('default_user', name.trim());
    }

    await loadUserWorkouts('default_user');
    await loadUserHistory('default_user');
    await loadUserGamification('default_user');
    await loadUserExercises('default_user');
    await loadUserMeasurements('default_user');
    await useNutritionStore.getState().loadUserRecipes('default_user');
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <p className="neon-cyan" style={{ fontFamily: 'var(--font-mono)' }}>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '2rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 className="display" style={{ fontSize: '3rem', letterSpacing: '0.1em' }}>
          <span className="neon-cyan">OMNI</span>BODY
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginTop: '0.5rem', letterSpacing: '0.05em' }}>
          {t('auth.tagline') || 'Your AI-powered biomechanical companion'}
        </p>
      </div>

      <form onSubmit={handleLogin} className="glass-card" style={{ width: '100%', maxWidth: '360px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', textAlign: 'center', marginBottom: '0.5rem' }}>
          {userExists ? 'Welcome Back' : 'Login / Setup'}
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Name / Username</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, color: '#fff' }}
            autoFocus
          />
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: '0.5rem' }}>
          {userExists ? 'Continue' : 'Start'}
        </button>
      </form>
    </div>
  );
};

export default Auth;