import { useState, useEffect } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { useGamificationStore } from '../store/useGamificationStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useMeasurementsStore } from '../store/useMeasurementsStore';
import db from '../db/db';
import { useT } from '../hooks/useT';
import type { TranslationKey } from '../i18n/translations';

const GOAL_OPTIONS = ['bulk', 'cut', 'maintain', 'Strength', 'Athletic', 'Aesthetics', 'Rehab'];
type Step = 'name' | 'details' | 'goals';
const NEW_USER_STEPS: Step[] = ['name', 'details', 'goals'];

interface OnboardingForm {
  name: string;
  age: number;
  weight: number;
  height: number;
  gender: 'male' | 'female';
  activityLevel: 'Sedentary' | 'Light' | 'Moderate' | 'Active';
  goals: string[];
}

export const Auth = () => {
  const t = useT();
  const loadUser = useUserStore((s) => s.loadUser);
  const createUser = useUserStore((s) => s.createUser);
  const loadUserWorkouts = useWorkoutStore((s) => s.loadUserWorkouts);
  const loadUserHistory = useNutritionStore((s) => s.loadUserHistory);
  const loadUserGamification = useGamificationStore((s) => s.loadUserGamification);
  const loadUserExercises = useExerciseStore((s) => s.loadUserExercises);
  const loadUserMeasurements = useMeasurementsStore((s) => s.loadUserMeasurements);

  const [loading, setLoading] = useState(true);
  const [userExists, setUserExists] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<OnboardingForm>({
    name: '', age: 25, weight: 70, height: 175, gender: 'male', activityLevel: 'Moderate', goals: ['maintain'],
  });

  useEffect(() => {
    const checkExistingUser = async () => {
      const user = await db.users.get('default_user');
      if (user && user.profile) {
        setForm(f => ({ ...f, name: user.profile.name || '' }));
        setUserExists(true);
      }
      setLoading(false);
    };
    checkExistingUser();
  }, []);

  const finishAuth = async (id: string) => {
    await loadUserWorkouts(id);
    await loadUserHistory(id);
    await loadUserGamification(id);
    await loadUserExercises(id);
    await loadUserMeasurements(id);
    await useNutritionStore.getState().loadUserRecipes(id);
  };

  const handleReturningLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || submitting) return;
    setSubmitting(true);
    try {
      await loadUser('default_user');
      await finishAuth('default_user');
    } catch (err) {
      console.error('Login failed', err);
      setSubmitting(false);
    }
  };

  const handleFinishOnboarding = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await createUser('default_user', {
        name: form.name.trim(),
        age: form.age,
        weight: form.weight,
        height: form.height,
        gender: form.gender,
        activityLevel: form.activityLevel,
        goals: form.goals.length ? form.goals : ['maintain'],
      });
      await finishAuth('default_user');
    } catch (err) {
      console.error('Onboarding failed', err);
      setSubmitting(false);
    }
  };

  const goNext = () => setStepIndex(i => Math.min(i + 1, NEW_USER_STEPS.length - 1));
  const goBack = () => setStepIndex(i => Math.max(i - 1, 0));
  const toggleGoal = (g: string) => setForm(f => ({
    ...f,
    goals: f.goals.includes(g) ? f.goals.filter(x => x !== g) : [...f.goals, g],
  }));

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <p className="neon-cyan" style={{ fontFamily: 'var(--font-mono)' }}>{t('common.loading')}</p>
      </div>
    );
  }

  const currentStep = NEW_USER_STEPS[stepIndex];
  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.75rem 1rem', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, color: '#fff' };
  const labelStyle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-text-muted)' };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: '2rem', overflowY: 'auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 className="display" style={{ fontSize: '3rem', letterSpacing: '0.1em' }}>
          <span className="neon-cyan">OMNI</span>BODY
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.9rem', marginTop: '0.5rem', letterSpacing: '0.05em' }}>
          {t('auth.tagline')}
        </p>
      </div>

      {/* Returning user: same simple flow as before */}
      {userExists ? (
        <form onSubmit={handleReturningLogin} className="glass-card" style={{ width: '100%', maxWidth: '360px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', textAlign: 'center', marginBottom: '0.5rem' }}>
            {t('auth.welcome')}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={labelStyle}>{t('auth.name')}</label>
            <input type="text" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} autoFocus />
          </div>
          <button type="submit" disabled={submitting} className="btn-primary" style={{ marginTop: '0.5rem' }}>
            {submitting ? t('common.loading') : t('common.continue')}
          </button>
        </form>
      ) : (
        /* New user: name -> physical details -> goals */
        <div className="glass-card" style={{ width: '100%', maxWidth: '360px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {NEW_USER_STEPS.map((s, i) => (
              <span key={s} style={{
                width: 8, height: 8, borderRadius: '50%',
                background: i <= stepIndex ? 'var(--cyan)' : 'rgba(255,255,255,0.15)',
                transition: 'background 0.2s',
              }} />
            ))}
          </div>

          {currentStep === 'name' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                {t('onboarding.step_name_title')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={labelStyle}>{t('auth.name')}</label>
                <input type="text" placeholder={t('onboarding.name_placeholder')} value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} autoFocus />
              </div>
            </>
          )}

          {currentStep === 'details' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                {t('onboarding.step_details_title')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('auth.age')}</label>
                  <input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: +e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t('auth.weight')}</label>
                  <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: +e.target.value }))} style={inputStyle} />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>{t('auth.height')}</label>
                  <input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: +e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>{t('profile.gender')}</label>
                  <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value as 'male' | 'female' }))} style={inputStyle}>
                    <option value="male">{t('profile.male')}</option>
                    <option value="female">{t('profile.female')}</option>
                  </select>
                </div>
              </div>
              <div>
                <label style={labelStyle}>{t('profile.activity_level')}</label>
                <select value={form.activityLevel} onChange={e => setForm(f => ({ ...f, activityLevel: e.target.value as OnboardingForm['activityLevel'] }))} style={inputStyle}>
                  <option value="Sedentary">{t('profile.activity_sedentary')}</option>
                  <option value="Light">{t('profile.activity_light')}</option>
                  <option value="Moderate">{t('profile.activity_moderate')}</option>
                  <option value="Active">{t('profile.activity_active')}</option>
                </select>
              </div>
            </>
          )}

          {currentStep === 'goals' && (
            <>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', textAlign: 'center', marginBottom: '0.5rem' }}>
                {t('onboarding.step_goals_title')}
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                {GOAL_OPTIONS.map(g => {
                  const selected = form.goals.includes(g);
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGoal(g)}
                      style={{
                        padding: '0.6rem', borderRadius: 8, fontSize: '0.8rem', textAlign: 'center',
                        border: `1px solid ${selected ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
                        background: selected ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.02)',
                        color: selected ? 'var(--cyan)' : 'var(--color-text-muted)',
                      }}
                    >
                      {t(`auth.goal.${g}` as TranslationKey)}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            {stepIndex > 0 && (
              <button type="button" onClick={goBack} className="btn-secondary" style={{ flex: 1, padding: '0.85rem' }}>
                {t('common.back')}
              </button>
            )}
            {currentStep !== 'goals' ? (
              <button
                type="button"
                onClick={goNext}
                disabled={currentStep === 'name' && !form.name.trim()}
                className="btn-primary"
                style={{ flex: 1, padding: '0.85rem' }}
              >
                {t('common.next')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFinishOnboarding}
                disabled={submitting}
                className="btn-primary"
                style={{ flex: 1, padding: '0.85rem' }}
              >
                {submitting ? t('common.loading') : t('onboarding.start_button')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
