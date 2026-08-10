import { useEffect, useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  Footprints, Flame, Moon, HeartPulse, Wind, TrendingUp, TrendingDown,
  Minus as MinusIcon, RefreshCw, Sparkles, PartyPopper,
} from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useHealthStore } from '../store/useHealthStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useUserStore } from '../store/useUserStore';
import { calculateHealthScore, type HealthScoreCategoryKey } from '../utils/healthScore';
import { useT } from '../hooks/useT';
import type { TranslationKey } from '../i18n/translations';
import { startOfDay } from 'date-fns';
import type { DailyHealthSnapshot } from '../services/healthService';

// ── Small building blocks ──────────────────────────────────────────────────

const Sparkline = ({ data, color }: { data: number[]; color: string }) => {
  const points = data.map((v, i) => ({ i, v }));
  if (data.every(v => v === 0)) {
    return <div style={{ height: 28, display: 'flex', alignItems: 'center', fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>—</div>;
  }
  return (
    <div style={{ height: 28 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const TrendArrow = ({ current, baseline }: { current: number; baseline: number }) => {
  if (baseline <= 0 || current <= 0) return null;
  const pct = Math.round(((current - baseline) / baseline) * 100);
  if (Math.abs(pct) < 3) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>
        <MinusIcon size={11} />
      </span>
    );
  }
  const up = pct > 0;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.65rem', color: up ? '#22c55e' : 'var(--magenta)' }}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {Math.abs(pct)}%
    </span>
  );
};

const MetricCard = ({ icon, label, value, unit, color, sparkData, current, baseline }: {
  icon: React.ReactNode; label: string; value: string; unit: string; color: string;
  sparkData: number[]; current: number; baseline: number;
}) => (
  <div className="glass-card" style={{ padding: '0.9rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        {icon}
        <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <TrendArrow current={current} baseline={baseline} />
    </div>
    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.3rem', fontWeight: 700, color, lineHeight: 1 }}>
      {value}<span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginInlineStart: 4 }}>{unit}</span>
    </div>
    <Sparkline data={sparkData} color={color} />
  </div>
);

// ── Activity Rings (Steps / Calories / Exercise) ───────────────────────────

const RING_SIZE = 140;
const RING_GAP = 14;

const Ring = ({ radius, pct, color, strokeWidth }: { radius: number; pct: number; color: string; strokeWidth: number }) => {
  const circ = 2 * Math.PI * radius;
  const fill = circ * Math.min(1, pct);
  return (
    <>
      <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={strokeWidth} />
      <circle
        cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={`${fill} ${circ - fill}`} strokeLinecap="round"
        transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
        style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: 'stroke-dasharray 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}
      />
    </>
  );
};

const ActivityRings = ({ steps, calories, exerciseMinutes, stepsGoal, caloriesGoal, exerciseGoal }: {
  steps: number; calories: number; exerciseMinutes: number;
  stepsGoal: number; caloriesGoal: number; exerciseGoal: number;
}) => {
  const t = useT();
  const outer = RING_SIZE / 2 - 8;
  const mid = outer - RING_GAP;
  const inner = mid - RING_GAP;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
      <svg width={RING_SIZE} height={RING_SIZE}>
        <Ring radius={outer} pct={steps / stepsGoal} color="#ff2d55" strokeWidth={10} />
        <Ring radius={mid} pct={calories / caloriesGoal} color="#34d399" strokeWidth={10} />
        <Ring radius={inner} pct={exerciseMinutes / exerciseGoal} color="#00f0ff" strokeWidth={10} />
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {[
          { color: '#ff2d55', label: t('health.steps'), val: `${steps.toLocaleString()} / ${stepsGoal.toLocaleString()}` },
          { color: '#34d399', label: t('health.calories'), val: `${calories} / ${caloriesGoal} kcal` },
          { color: '#00f0ff', label: t('health.exercise'), val: `${exerciseMinutes} / ${exerciseGoal} min` },
        ].map(r => (
          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color, display: 'inline-block', boxShadow: `0 0 6px ${r.color}` }} />
            <div>
              <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)' }}>{r.label}</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 700 }}>{r.val}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Sleep stage bar ─────────────────────────────────────────────────────────

const SleepStagesBar = ({ stages, totalMinutes }: { stages: DailyHealthSnapshot['sleepStages']; totalMinutes: number }) => {
  const t = useT();
  if (totalMinutes <= 0) return <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{t('health.no_sleep_data')}</div>;
  const segments: { key: string; label: string; minutes: number; color: string }[] = [
    { key: 'deep', label: t('health.sleep_deep'), minutes: stages.deep, color: '#4338ca' },
    { key: 'rem', label: t('health.sleep_rem'), minutes: stages.rem, color: '#8b5cf6' },
    { key: 'light', label: t('health.sleep_light'), minutes: stages.light, color: '#60a5fa' },
    { key: 'awake', label: t('health.sleep_awake'), minutes: stages.awake, color: '#fbbf24' },
  ];
  // `totalMinutes` (the headline sleep duration) intentionally excludes
  // awake time, but the bar needs to show awake time *within* the tracked
  // session — so its own denominator adds it back, otherwise the segments
  // would sum to more than 100% width and visually overflow the bar.
  const barTotal = totalMinutes + stages.awake;
  return (
    <div>
      <div style={{ display: 'flex', width: '100%', height: 10, borderRadius: 6, overflow: 'hidden', marginBottom: '0.6rem' }}>
        {segments.map(s => (
          <div key={s.key} style={{ width: `${(s.minutes / barTotal) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
        {segments.map(s => (
          <div key={s.key} style={{ textAlign: 'center' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, margin: '0 auto 2px' }} />
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', fontWeight: 700 }}>{Math.round(s.minutes)}m</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Health Score card ────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<HealthScoreCategoryKey, string> = {
  sleep: '#8b5cf6', activity: '#ff2d55', nutrition: '#34d399', heart: '#f87171', consistency: 'var(--cyan)',
};

const HealthScoreCard = ({ score, categories, tipKey, dataComplete }: ReturnType<typeof calculateHealthScore>) => {
  const t = useT();
  const scoreColor = score >= 75 ? '#22c55e' : score >= 50 ? 'var(--gold)' : 'var(--magenta)';
  const CATEGORY_LABELS: Record<HealthScoreCategoryKey, string> = {
    sleep: t('health.cat_sleep'), activity: t('health.cat_activity'), nutrition: t('health.cat_nutrition'),
    heart: t('health.cat_heart'), consistency: t('health.cat_consistency'),
  };

  return (
    <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -30, insetInlineEnd: -30, width: 110, height: 110, background: `radial-gradient(circle, ${scoreColor}33, transparent 70%)`, filter: 'blur(10px)', pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
        <Sparkles size={15} color={scoreColor} />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: scoreColor }}>
          {t('health.score_title')}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', marginBottom: '1rem' }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '3rem', fontWeight: 900, color: scoreColor, lineHeight: 1, filter: `drop-shadow(0 0 14px ${scoreColor}88)` }}>
          {score}
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {categories.filter(c => c.score != null).map(c => (
            <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.62rem', width: 70, color: 'var(--color-text-muted)', flexShrink: 0 }}>{CATEGORY_LABELS[c.key]}</span>
              <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ width: `${c.score}%`, height: '100%', background: CATEGORY_COLORS[c.key] }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '0.8rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
        <span>💡</span><span>{t(tipKey as TranslationKey)}</span>
      </div>

      {!dataComplete && (
        <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          {t('health.score_partial_data')}
        </div>
      )}
    </div>
  );
};

// ── Main export ──────────────────────────────────────────────────────────────

const HealthDashboard = () => {
  const t = useT();
  const profile = useUserStore(s => s.profile);
  const nutritionHistory = useNutritionStore(s => s.history);
  const getTargets = useNutritionStore(s => s.getTargets);
  const workoutHistory = useWorkoutStore(s => s.history);

  const { daily, authorized, syncing, error, requestAccess, syncWeek, today, yesterday, weeklyAverage } = useHealthStore();
  const [isNative] = useState(Capacitor.isNativePlatform());

  useEffect(() => {
    if (!isNative || !authorized) return;
    // `daily` is persisted, so it's non-empty on every launch after the
    // first — checking `daily.length === 0` alone meant the dashboard would
    // only ever auto-sync once, then show the same stale cached data on
    // every future app open. Refresh if we've never synced, or the cache
    // is more than 30 minutes old.
    const STALE_MS = 30 * 60 * 1000;
    const { lastSyncedAt } = useHealthStore.getState();
    if (!lastSyncedAt || Date.now() - lastSyncedAt > STALE_MS) syncWeek();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, authorized]);

  const todaySnap = today();
  const yestSnap = yesterday();
  const weekAvg = weeklyAverage();

  const targets = getTargets(profile.weight);
  const todayStr = startOfDay(new Date()).getTime();
  const todayLog = nutritionHistory[todayStr];
  let caloriesConsumed = 0, proteinConsumed = 0;
  todayLog?.meals.forEach(m => m.foods.forEach(f => { caloriesConsumed += f.calories; proteinConsumed += f.protein; }));

  const workoutDaysLast7 = useMemo(() => {
    const days = new Set<number>();
    const cutoff = todayStr - 6 * 24 * 60 * 60 * 1000;
    workoutHistory.forEach(s => {
      if (s.date >= cutoff) days.add(startOfDay(new Date(s.date)).getTime());
    });
    return days.size;
  }, [workoutHistory, todayStr]);

  const healthScore = calculateHealthScore({
    sleepMinutes: todaySnap?.available ? todaySnap.sleepMinutes : null,
    steps: todaySnap?.available ? todaySnap.steps : null,
    exerciseMinutes: todaySnap?.available ? todaySnap.exerciseMinutes : null,
    caloriesConsumed: todayLog ? caloriesConsumed : null,
    calorieTarget: targets.calories,
    proteinConsumed: todayLog ? proteinConsumed : null,
    proteinTarget: targets.protein,
    restingHeartRate: todaySnap?.available && todaySnap.restingHeartRate > 0 ? todaySnap.restingHeartRate : null,
    hrv: todaySnap?.available && todaySnap.hrv > 0 ? todaySnap.hrv : null,
    workoutDaysLast7,
  });

  const isFriday = new Date().getDay() === 5;
  const sparkOf = (key: keyof DailyHealthSnapshot) => daily.map(d => Number(d[key]) || 0);

  // ── Not connected yet ──
  if (!isNative) {
    return (
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'center' }}>
        <HeartPulse size={22} color="var(--cyan)" style={{ marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{t('health.native_only')}</div>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem', textAlign: 'center' }}>
        <HeartPulse size={22} color="var(--cyan)" style={{ marginBottom: '0.5rem' }} />
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>{t('health.connect_prompt')}</div>
        <button className="btn-primary" style={{ padding: '0.6rem 1.25rem' }} onClick={() => requestAccess()}>
          {t('health.connect_button')}
        </button>
        {error === 'permission_denied' && (
          <div style={{ fontSize: '0.65rem', color: 'var(--magenta)', marginTop: '0.5rem' }}>{t('health.permission_denied')}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Health Score */}
      <HealthScoreCard {...healthScore} />

      {/* Rings */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="section-label">{t('health.activity_title')}</div>
          <button onClick={() => syncWeek()} disabled={syncing}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.65rem', color: 'var(--cyan)', background: 'rgba(0,240,255,0.08)', padding: '0.3rem 0.6rem', borderRadius: 8 }}>
            <RefreshCw size={11} style={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /> {syncing ? t('common.loading') : t('health.sync')}
          </button>
        </div>
        <ActivityRings
          steps={todaySnap?.steps || 0} calories={todaySnap?.calories || 0} exerciseMinutes={todaySnap?.exerciseMinutes || 0}
          stepsGoal={10000} caloriesGoal={500} exerciseGoal={30}
        />
      </div>

      {/* Metric cards with sparklines + trend arrows */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <MetricCard
          icon={<Footprints size={13} color="#ff2d55" />} label={t('health.steps')}
          value={(todaySnap?.steps || 0).toLocaleString()} unit="" color="#ff2d55"
          sparkData={sparkOf('steps')} current={todaySnap?.steps || 0} baseline={yestSnap?.steps || 0}
        />
        <MetricCard
          icon={<Flame size={13} color="#34d399" />} label={t('health.calories')}
          value={String(todaySnap?.calories || 0)} unit="kcal" color="#34d399"
          sparkData={sparkOf('calories')} current={todaySnap?.calories || 0} baseline={yestSnap?.calories || 0}
        />
        <MetricCard
          icon={<Moon size={13} color="#8b5cf6" />} label={t('health.sleep')}
          value={todaySnap?.sleepMinutes ? `${Math.floor(todaySnap.sleepMinutes / 60)}h${todaySnap.sleepMinutes % 60}m` : '—'} unit="" color="#8b5cf6"
          sparkData={sparkOf('sleepMinutes')} current={todaySnap?.sleepMinutes || 0} baseline={yestSnap?.sleepMinutes || 0}
        />
        <MetricCard
          icon={<HeartPulse size={13} color="#f87171" />} label={t('health.resting_hr')}
          value={todaySnap?.restingHeartRate ? String(todaySnap.restingHeartRate) : '—'} unit="bpm" color="#f87171"
          sparkData={sparkOf('restingHeartRate')} current={todaySnap?.restingHeartRate || 0} baseline={yestSnap?.restingHeartRate || 0}
        />
      </div>

      {/* Sleep detail */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="section-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Moon size={14} /> {t('health.sleep_title')}
        </div>
        <SleepStagesBar stages={todaySnap?.sleepStages || { deep: 0, rem: 0, light: 0, awake: 0 }} totalMinutes={todaySnap?.sleepMinutes || 0} />
      </div>

      {/* Heart & recovery */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div className="section-label" style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <HeartPulse size={14} /> {t('health.heart_title')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {[
            { label: t('health.avg_hr'), val: todaySnap?.heartRate || '—', unit: 'bpm' },
            { label: t('health.hrv'), val: todaySnap?.hrv || '—', unit: 'ms' },
            { label: t('health.spo2'), val: todaySnap?.spo2 || '—', unit: '%' },
          ].map(m => (
            <div key={m.label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cyan)' }}>{m.val}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{m.label} {m.unit && `(${m.unit})`}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly summary — highlighted on Fridays */}
      {weekAvg && (
        <div className="glass-card animate-fade-up" style={{
          padding: '1.25rem', marginBottom: '1.25rem',
          border: isFriday ? '1px solid rgba(0,240,255,0.35)' : undefined,
          boxShadow: isFriday ? '0 0 20px rgba(0,240,255,0.15)' : undefined,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}>
            {isFriday ? <PartyPopper size={14} color="var(--cyan)" /> : <Wind size={14} />}
            <span className="section-label" style={{ margin: 0 }}>
              {isFriday ? t('health.weekly_friday') : t('health.weekly_title')}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {[
              { label: t('health.avg_steps'), val: weekAvg.steps.toLocaleString() },
              { label: t('health.avg_sleep'), val: `${Math.floor(weekAvg.sleepMinutes / 60)}h${weekAvg.sleepMinutes % 60}m` },
              { label: t('health.avg_hr'), val: weekAvg.heartRate || '—' },
            ].map(m => (
              <div key={m.label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700 }}>{m.val}</div>
                <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>{m.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default HealthDashboard;
