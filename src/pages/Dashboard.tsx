import { useState, useEffect, useRef } from 'react';
import { useUserStore } from '../store/useUserStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { useGamificationStore } from '../store/useGamificationStore';
import { useNavigate } from 'react-router-dom';
import {
  Zap, TrendingUp, AlertTriangle, Dumbbell, Droplet,
  ChevronRight, Activity, Share2, Accessibility, Minus, Plus, Brain,
  Sparkles, Trophy
} from 'lucide-react';
import { format, startOfDay } from 'date-fns';
import html2canvas from 'html2canvas';
import { useT } from '../hooks/useT';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import HealthDashboard from '../components/HealthDashboard';

// ── XP Level Bar ──────────────────────────────────────────────────────────────
const XPBar = ({ xp, level }: { xp: number; level: number }) => {
  const t = useT();
  const xpForCurrentLevel = (level - 1) * (level - 1) * 100;
  const xpForNextLevel    = level * level * 100;
  const progress = ((xp - xpForCurrentLevel) / (xpForNextLevel - xpForCurrentLevel)) * 100;
  const levelNames = ['', t('dash.beginner'), t('dash.intermediate'), t('dash.advanced'), t('dash.elite'), t('dash.legend')];
  const levelName  = levelNames[Math.min(level, 5)] || t('dash.legend');

  return (
    <div className="glass-card" style={{ padding: '1rem 1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Zap size={16} color="var(--cyan)" />
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {t('dash.level')} {level} — {levelName}
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan)' }}>{xp.toLocaleString()} XP</span>
      </div>
      <div className="xp-bar-track">
        <div className="xp-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
        <span>Lv {level}</span>
        <span>Lv {level + 1} — {xpForNextLevel.toLocaleString()} XP</span>
      </div>
    </div>
  );
};

// ── Stepper Button ────────────────────────────────────────────────────────────
const Stepper = ({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
    <div style={{ fontSize: '0.58rem', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>{label}</div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
      <button
        onClick={() => onChange(Math.max(min, parseFloat((value - step).toFixed(1))))}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '1px solid rgba(0,240,255,0.25)',
          background: 'rgba(0,240,255,0.06)', color: 'var(--cyan)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,240,255,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,240,255,0.06)')}
      >
        <Minus size={11} />
      </button>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, minWidth: 38, textAlign: 'center', color: 'var(--color-text)' }}>
        {value}
      </span>
      <button
        onClick={() => onChange(Math.min(max, parseFloat((value + step).toFixed(1))))}
        style={{
          width: 26, height: 26, borderRadius: '50%',
          border: '1px solid rgba(0,240,255,0.25)',
          background: 'rgba(0,240,255,0.06)', color: 'var(--cyan)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,240,255,0.2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,240,255,0.06)')}
      >
        <Plus size={11} />
      </button>
    </div>
  </div>
);

// ── Volume Calculator ─────────────────────────────────────────────────────────
const VolumeCalculator = () => {
  const [sets,   setSets]   = useState(3);
  const [reps,   setReps]   = useState(10);
  const [weight, setWeight] = useState(60);
  const [bump,   setBump]   = useState(0); // animation trigger key

  const volume = sets * reps * weight;
  const prevVol = useRef(volume);

  useEffect(() => {
    if (prevVol.current !== volume) {
      setBump(k => k + 1);
      prevVol.current = volume;
    }
  }, [volume]);

  const intensity =
    volume < 500  ? { label: 'Light',      color: 'var(--color-success)' } :
    volume < 1500 ? { label: 'Moderate',   color: 'var(--cyan)' }          :
    volume < 3000 ? { label: 'Hard',       color: 'var(--color-warning)' } :
                    { label: 'Max Effort', color: 'var(--magenta)' };

  // SVG arc (270° sweep starting at 135°)
  const arcPct   = Math.min(1, volume / 5000);
  const svgSize  = 104;
  const sw       = 8;
  const r        = (svgSize - sw) / 2;
  const circ     = 2 * Math.PI * r;
  const arcLen   = circ * 0.75; // 270° out of 360°
  const fillLen  = arcLen * arcPct;

  return (
    <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <TrendingUp size={15} color="var(--cyan)" />
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.75rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--cyan)' }}>
          Volume Calculator
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Arc meter */}
        <div style={{ position: 'relative', flexShrink: 0, width: svgSize, height: svgSize }}>
          <svg width={svgSize} height={svgSize} style={{ transform: 'rotate(135deg)' }}>
            {/* Track ring */}
            <circle
              cx={svgSize / 2} cy={svgSize / 2} r={r}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw}
              strokeDasharray={`${arcLen} ${circ - arcLen}`}
              strokeLinecap="round"
            />
            {/* Fill ring */}
            <circle
              cx={svgSize / 2} cy={svgSize / 2} r={r}
              fill="none" stroke={intensity.color} strokeWidth={sw}
              strokeDasharray={`${fillLen} ${circ - fillLen}`}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 7px ${intensity.color})`,
                transition: 'stroke-dasharray 0.55s cubic-bezier(0.34,1.56,0.64,1), stroke 0.3s',
              }}
            />
          </svg>

          {/* Centre label */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            paddingBottom: '4px',
          }}>
            <span
              key={bump}
              style={{
                fontFamily: 'var(--font-mono)', fontWeight: 700,
                fontSize: volume >= 10000 ? '0.85rem' : '1.1rem',
                color: intensity.color, lineHeight: 1,
                animation: 'volumePop 0.4s var(--ease-spring)',
              }}
            >
              {volume.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.5rem', letterSpacing: '0.12em', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
              kg·vol
            </span>
          </div>
        </div>

        {/* Steppers column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          <Stepper label="Sets"       value={sets}   min={1}  max={20}  step={1}   onChange={setSets}   />
          <Stepper label="Reps"       value={reps}   min={1}  max={50}  step={1}   onChange={setReps}   />
          <Stepper label="Weight (kg)" value={weight} min={0}  max={500} step={2.5} onChange={setWeight} />
        </div>
      </div>

      {/* Formula + intensity badge */}
      <div style={{ marginTop: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
          {sets} × {reps} × {weight}kg
        </span>
        <span style={{
          fontFamily: 'var(--font-heading)', fontSize: '0.68rem', fontWeight: 600,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: intensity.color, border: `1px solid ${intensity.color}`,
          padding: '0.15rem 0.65rem', borderRadius: 'var(--radius-full)',
          boxShadow: `0 0 8px ${intensity.color}55`,
        }}>
          {intensity.label}
        </span>
      </div>
    </div>
  );
};

// ── Daily Insight Quote ───────────────────────────────────────────────────────
const DAILY_QUOTES: [string, string][] = [
  ["Discipline is choosing between what you want now and what you want most. 💪", "Every session you show up for is a vote for the person you're becoming."],
  ["Consistency beats intensity. 🔥", "A short workout done today beats a perfect one you keep postponing."],
  ["Progress hides in the boring reps. ⚡", "The sets that feel routine are the ones building the base for your PRs."],
  ["Recovery is part of training, not a break from it. 😴", "Muscles grow while you rest — respect the sleep and the rest days."],
  ["You don't need to feel motivated, you need to show up. 🚀", "Motivation fades. Habits carry you on the days it does."],
  ["Small daily wins compound into big changes. 📈", "1% better today is invisible. 1% better for a year is a transformation."],
  ["Your only competition is who you were yesterday. 🎯", "Compare today's version of you to last month's, not to anyone else."],
  ["Fuel matters as much as effort. 🍗", "Great training with poor nutrition is a car with no gas — go top up."],
  ["The hardest rep is the one you almost skip. 🧠", "Showing up on the low-motivation days is what separates progress from plans."],
  ["Strength is built, not born. 🏋️", "Every expert lifter once struggled with the empty bar too."],
];

const getDailyQuote = (): [string, string] => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
};

const DailyInsight = () => {
  const [headline, subtitle] = getDailyQuote();

  return (
    <div
      className="glass-card animate-fade-up"
      style={{
        padding: '1.25rem', marginBottom: '1.25rem',
        background: 'linear-gradient(135deg, rgba(0,240,255,0.04) 0%, rgba(255,0,110,0.03) 100%)',
        borderLeft: '3px solid var(--cyan)',
        position: 'relative', overflow: 'hidden'
      }}
    >
      {/* Decorative glow */}
      <div style={{
        position: 'absolute', top: -24, right: -24,
        width: 90, height: 90,
        background: 'var(--cyan-glow)', borderRadius: '50%',
        filter: 'blur(24px)', pointerEvents: 'none', opacity: 0.5,
      }} />

      {/* Label row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--cyan), var(--magenta))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 10px var(--cyan-glow)',
          }}>
            <Brain size={13} color="#000" />
          </div>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '0.68rem', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--color-text-muted)' }}>
            Daily Insight
          </span>
        </div>
      </div>

      {/* Quote text */}
      <p style={{
        fontFamily: 'var(--font-handwriting)',
        fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.35,
        color: 'var(--color-text)', margin: '0 0 0.3rem',
        position: 'relative', zIndex: 1,
      }}>
        {headline}
      </p>
      <p style={{
        fontFamily: 'var(--font-handwriting)',
        fontSize: '1.1rem', fontWeight: 400, lineHeight: 1.4,
        color: 'var(--color-text-muted)', margin: 0,
        position: 'relative', zIndex: 1,
      }}>
        {subtitle}
      </p>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────────────────────────────
const Dashboard = () => {
  const t           = useT();
  const profile     = useUserStore(s => s.profile);
  const history     = useWorkoutStore(s => s.history);
  const volumeSpike = useWorkoutStore(s => s.volumeSpikeWarning);
  const suggestDeload = useWorkoutStore(s => s.suggestDeload);
  const nutritionHistory = useNutritionStore(s => s.history);
  const getTodayLog = useNutritionStore(s => s.getTodayLog);
  const getTargets  = useNutritionStore(s => s.getTargets);
  const { xp, level, badges } = useGamificationStore();
  const navigate    = useNavigate();

  const todayStr = startOfDay(new Date()).getTime();
  const todayLog = nutritionHistory[todayStr] || getTodayLog();
  const targets  = getTargets(profile.weight);

  let totalCal = 0, totalPro = 0;
  todayLog.meals.forEach(m => m.foods.forEach(f => { totalCal += f.calories; totalPro += f.protein; }));

  const lastSession   = history.length > 0 ? history[history.length - 1] : null;
  const unlockedCount = badges.filter(b => b.unlocked).length;
  const waterPercent  = Math.min(100, (todayLog.waterMl / targets.water) * 100);

  const handleShare = async () => {
    const target = document.getElementById('dashboard-export-target');
    if (!target) return;
    try {
      const canvas = await html2canvas(target, { backgroundColor: '#0f172a' });
      const dataUrl = canvas.toDataURL('image/png');

      if (Capacitor.isNativePlatform()) {
        // On Android/iOS: use native share sheet
        const base64 = dataUrl.split(',')[1];
        const fileName = `Omnibody-Stats-${format(new Date(), 'yyyy-MM-dd')}.png`;
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Cache,
        });
        const fileUri = await Filesystem.getUri({ directory: Directory.Cache, path: fileName });
        await Share.share({
          title: 'OmniBody Stats',
          text: 'Check out my fitness stats!',
          url: fileUri.uri,
          dialogTitle: 'Share your stats',
        });
      } else {
        // Fallback for browser
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `Omnibody-Stats-${format(new Date(), 'yyyy-MM-dd')}.png`;
        link.click();
      }
    } catch (err) {
      console.error('Failed to generate share image', err);
    }
  };

  // ACWR (Acute:Chronic Workload Ratio) — standard sports-science definition:
  // acute = total volume in the last 7 days, chronic = average weekly volume
  // over the last 28 days. Using all-time history here would dilute the
  // "chronic" baseline more and more the longer someone uses the app.
  let acwr = 1.0;
  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const acuteSessions = history.filter(s => s.date >= now - 7 * DAY_MS);
  const chronicSessions = history.filter(s => s.date >= now - 28 * DAY_MS);
  if (chronicSessions.length > 5) {
    const acuteVolume = acuteSessions.reduce((acc, s) => acc + s.totalVolume, 0);
    const chronicWeeklyAvg = chronicSessions.reduce((acc, s) => acc + s.totalVolume, 0) / 4;
    acwr = chronicWeeklyAvg > 0 ? acuteVolume / chronicWeeklyAvg : 1.0;
  }
  const acwrColor  = acwr > 1.3 ? 'var(--magenta)' : acwr < 0.8 ? 'var(--color-warning)' : 'var(--color-success)';
  const acwrStatus = acwr > 1.3 ? t('dash.danger_zone') : acwr < 0.8 ? t('dash.detraining') : t('dash.sweet_spot');

  return (
    <div className="page pb-24" id="dashboard-export-target">

      {/* Header */}
      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-label">{t('dash.overview')}</div>
          <h1 className="display" style={{ fontSize: '2rem' }}>
            {t('dash.hello')}, <span className="neon-cyan">{profile.name.toUpperCase()}</span>
          </h1>
        </div>
        <button
          onClick={() => navigate('/profile')}
          style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '50%', border: '1px solid rgba(0,240,255,0.2)' }}
        >
          <img
            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=0f172a`}
            alt="Avatar" width={32} height={32} style={{ borderRadius: '50%' }}
          />
        </button>
      </header>

      {/* Volume spike warning */}
      {volumeSpike && (
        <div className="alert-warning" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={18} />
          <div>{t('dash.volume_spike')}</div>
        </div>
      )}

      {/* Deload suggestion — training load has been consistently high */}
      {suggestDeload && (
        <div className="alert-warning" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={18} />
          <div>{t('dash.suggest_deload')}</div>
        </div>
      )}

      {/* XP Bar */}
      <div style={{ marginBottom: '1.5rem' }}>
        <XPBar xp={xp} level={level} />
      </div>

      {/* Daily Insight */}
      <DailyInsight />

      {/* Health (steps / sleep / heart / Health Score) */}
      <HealthDashboard />

      {/* Stats Row */}
      <div className="stagger" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginBottom: '1.25rem' }}>
        {[
          { label: t('dash.sessions'), val: history.length,                                                   icon: <Dumbbell   size={16} color="var(--cyan)"    />, color: 'var(--cyan)'    },
          { label: t('dash.badges'),   val: `${unlockedCount}/${badges.length}`,                               icon: <Zap        size={16} color="var(--gold)"    />, color: 'var(--gold)'    },
          { label: t('dash.volume'),   val: lastSession ? `${lastSession.totalVolume.toLocaleString()}` : '—', icon: <TrendingUp size={16} color="var(--magenta)" />, color: 'var(--magenta)' },
        ].map(({ label, val, icon, color }) => (
          <div key={label} className="glass-card animate-fade-up" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.4rem' }}>{icon}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.4rem', fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginTop: '0.25rem' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Volume Calculator */}
      <VolumeCalculator />

      {/* Analytics & Body Map */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          className="glass-card"
          style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
          onClick={() => navigate('/muscles')}
        >
          <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Accessibility size={14} /> {t('dash.anatomy')}
          </div>
          <button className="btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.5rem' }}>
            {t('dash.open_map')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Activity size={14} /> {t('dash.fatigue')}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.5rem', fontWeight: 700, color: acwrColor }}>
              {acwr.toFixed(2)}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{acwrStatus}</div>
          </div>

          <div
            className="glass-card"
            style={{ padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}
            onClick={handleShare}
          >
            <div className="section-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Share2 size={14} /> {t('dash.export')}
            </div>
            <button className="btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.5rem' }}>
              {t('dash.generate_share')}
            </button>
          </div>
        </div>
      </div>

      {/* Last Workout */}
      <div
        className="glass-card animate-fade-up"
        style={{ padding: '1.25rem', marginBottom: '1.25rem', cursor: 'pointer' }}
        onClick={() => navigate('/workout')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="section-label">{t('dash.workout')}</div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700 }}>
              {lastSession ? lastSession.type : t('dash.start_first')}
            </div>
            {lastSession && (
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                Volume: {lastSession.totalVolume.toLocaleString()}kg · {format(new Date(lastSession.date), 'MMM d')}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <div style={{ background: 'linear-gradient(135deg, var(--cyan), #0080ff)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-cyan)' }}>
              <Dumbbell size={22} color="#000" />
            </div>
            <ChevronRight size={16} color="var(--color-text-muted)" />
          </div>
        </div>
      </div>

      {/* Progress & Records */}
      <div
        data-walkthrough="progress-card"
        className="glass-card animate-fade-up"
        style={{ padding: '1.25rem', marginBottom: '1.25rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => navigate('/progress')}
      >
        <div>
          <div className="section-label">{t('dash.progress') || 'Progress & Records'}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
            {t('dash.progress_sub') || 'PRs, weekly volume balance & export'}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
          <div style={{ background: 'linear-gradient(135deg, var(--gold), #ff8800)', borderRadius: '50%', width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 12px rgba(255,170,0,0.3)' }}>
            <Trophy size={20} color="#000" />
          </div>
          <ChevronRight size={16} color="var(--color-text-muted)" />
        </div>
      </div>

      {/* Nutrition Today */}
      <div
        className="glass-card animate-fade-up"
        style={{ padding: '1.25rem', marginBottom: '1.25rem', cursor: 'pointer' }}
        onClick={() => navigate('/nutrition')}
      >
        <div className="section-label">{t('dash.nutrition')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          {[
            { label: t('dash.calories'), current: Math.round(totalCal), target: targets.calories, unit: 'kcal', color: 'linear-gradient(90deg,var(--cyan),#0080ff)' },
            { label: t('dash.protein'),  current: Math.round(totalPro), target: targets.protein,  unit: 'g',    color: 'linear-gradient(90deg,#00ff88,var(--cyan))' },
          ].map(({ label, current, target, unit, color }) => (
            <div key={label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{current}/{target}{unit}</span>
              </div>
              <div className="macro-bar-track">
                <div className="macro-bar-fill" style={{ width: `${Math.min(100, (current / target) * 100)}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
          <Droplet size={14} color="var(--cyan)" />
          <div className="macro-bar-track" style={{ flex: 1, height: 6 }}>
            <div className="macro-bar-fill" style={{ width: `${waterPercent}%`, background: 'linear-gradient(90deg, var(--cyan), #0044ff)' }} />
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
            {todayLog.waterMl}ml
          </span>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
