import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { useUserStore } from '../store/useUserStore';
import { useLanguageStore } from '../store/useLanguageStore';
import { useT } from '../hooks/useT';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { ChevronLeft, Trophy, FileDown, Search } from 'lucide-react';

const MUSCLE_COLORS: Record<string, string> = {
  Chest: '#00f0ff', Back: '#ff006e', Shoulders: '#ffaa00', Quads: '#4ade80',
  Hamstrings: '#38bdf8', Glutes: '#f472b6', Biceps: '#c084fc', Triceps: '#facc15',
  Core: '#fb7185', Calves: '#34d399',
};
const muscleColor = (m: string) => MUSCLE_COLORS[m] || '#a1a1aa';

// ── Personal Records section ────────────────────────────────────────────────
const PRTracker = () => {
  const t = useT();
  const getPersonalRecords = useWorkoutStore(s => s.getPersonalRecords);
  const getAllExercises = useExerciseStore(s => s.getAllExercises);
  const lang = useLanguageStore(s => s.lang);
  const [search, setSearch] = useState('');

  const records = getPersonalRecords();
  const allEx = getAllExercises();
  const exLookup = new Map(allEx.map(e => [e.id, e]));

  const rows = Object.entries(records)
    .map(([exerciseId, rec]) => {
      const def = exLookup.get(exerciseId);
      const name = def ? (lang === 'ar' && def.nameAr ? def.nameAr : def.name) : exerciseId;
      return { exerciseId, name, ...rec };
    })
    .filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => b.est1RM - a.est1RM);

  return (
    <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Trophy size={18} color="var(--gold)" />
        <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
          {t('progress.pr_tracker') || 'Personal Records'}
        </h2>
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder={t('workout.search_alt') || 'Search exercise...'}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '2.2rem', width: '100%' }}
        />
      </div>

      {rows.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
          {t('progress.no_records') || 'No completed sets logged yet — finish a session to start tracking PRs.'}
        </div>
      ) : (
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          {rows.map(r => (
            <div key={r.exerciseId} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{r.name}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {new Date(r.date).toLocaleDateString()}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--gold)' }}>
                  {r.bestWeight}kg × {r.bestReps}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--cyan)', fontFamily: 'var(--font-mono)' }}>
                  e1RM: {r.est1RM.toFixed(1)}kg
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Muscle Volume Balance section ───────────────────────────────────────────
const VolumeBalanceChart = () => {
  const t = useT();
  const history = useWorkoutStore(s => s.history);
  const getAllExercises = useExerciseStore(s => s.getAllExercises);
  const allEx = getAllExercises();
  const exLookup = new Map(allEx.map(e => [e.id, e]));

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const setsByMuscle: Record<string, number> = {};

  history.forEach(session => {
    if (session.date < oneWeekAgo) return;
    session.exercises.forEach(ex => {
      const def = exLookup.get(ex.exerciseId);
      if (!def) return;
      const completed = ex.sets.filter(s => s.completed).length;
      if (completed === 0) return;
      setsByMuscle[def.muscleGroup] = (setsByMuscle[def.muscleGroup] || 0) + completed;
    });
  });

  const data = Object.entries(setsByMuscle)
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);

  return (
    <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
        {t('progress.volume_balance') || 'Weekly Muscle Volume Balance'}
      </h2>
      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>
        {t('progress.volume_balance_sub') || 'Completed sets per muscle group, last 7 days'}
      </div>

      {data.length === 0 ? (
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>
          {t('progress.no_volume') || 'No sets logged in the last 7 days.'}
        </div>
      ) : (
        <div style={{ height: Math.max(220, data.length * 42) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="muscle" width={80} tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="sets" radius={[0, 6, 6, 0]}>
                {data.map((d, i) => (
                  <Cell key={i} fill={muscleColor(d.muscle)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

// ── PDF-style export (opens a printable report; use the browser's "Save as PDF") ──
const buildReportHtml = (opts: {
  profileName: string;
  records: Record<string, { bestWeight: number; bestReps: number; est1RM: number; date: number }>;
  exLookup: Map<string, any>;
  history: any[];
  weekMeals: { date: string; calories: number; protein: number; carbs: number; fats: number }[];
}) => {
  const { profileName, records, exLookup, history, weekMeals } = opts;
  const prRows = Object.entries(records)
    .map(([id, r]) => ({ name: exLookup.get(id)?.name || id, ...r }))
    .sort((a, b) => b.est1RM - a.est1RM)
    .slice(0, 20);

  const recentSessions = [...history].sort((a, b) => b.date - a.date).slice(0, 10);

  const escapeHtml = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));

  return `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>OmniBody Progress Report — ${escapeHtml(profileName)}</title>
<style>
  body { font-family: -apple-system, Arial, sans-serif; color: #111; margin: 40px; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 28px; border-bottom: 2px solid #111; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
  th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #ddd; }
  th { background: #f2f2f2; }
  .muted { color: #666; font-size: 12px; }
  @media print { body { margin: 15mm; } }
</style>
</head>
<body>
  <h1>OmniBody Progress Report</h1>
  <div class="muted">${escapeHtml(profileName)} — generated ${new Date().toLocaleDateString()}</div>

  <h2>Personal Records (Top 20 by estimated 1RM)</h2>
  <table>
    <tr><th>Exercise</th><th>Best Set</th><th>Est. 1RM</th><th>Date</th></tr>
    ${prRows.map(r => `<tr><td>${escapeHtml(r.name)}</td><td>${r.bestWeight}kg × ${r.bestReps}</td><td>${r.est1RM.toFixed(1)}kg</td><td>${new Date(r.date).toLocaleDateString()}</td></tr>`).join('')}
  </table>

  <h2>Recent Sessions</h2>
  <table>
    <tr><th>Date</th><th>Type</th><th>Total Volume</th><th>Exercises</th></tr>
    ${recentSessions.map((s: any) => `<tr><td>${new Date(s.date).toLocaleDateString()}</td><td>${escapeHtml(s.type)}</td><td>${Math.round(s.totalVolume)}kg</td><td>${s.exercises.length}</td></tr>`).join('')}
  </table>

  <h2>Nutrition — Last 7 Days</h2>
  <table>
    <tr><th>Date</th><th>Calories</th><th>Protein</th><th>Carbs</th><th>Fats</th></tr>
    ${weekMeals.map(m => `<tr><td>${m.date}</td><td>${Math.round(m.calories)}</td><td>${Math.round(m.protein)}g</td><td>${Math.round(m.carbs)}g</td><td>${Math.round(m.fats)}g</td></tr>`).join('')}
  </table>
</body>
</html>`;
};

const ExportReportButton = () => {
  const t = useT();
  const profile = useUserStore(s => s.profile);
  const getPersonalRecords = useWorkoutStore(s => s.getPersonalRecords);
  const history = useWorkoutStore(s => s.history);
  const getAllExercises = useExerciseStore(s => s.getAllExercises);
  const nutritionHistory = useNutritionStore(s => s.history);

  const handleExport = () => {
    const exLookup = new Map(getAllExercises().map(e => [e.id, e]));
    const records = getPersonalRecords();

    const weekMeals = Object.values(nutritionHistory)
      .filter(day => day.date >= Date.now() - 7 * 24 * 60 * 60 * 1000)
      .sort((a, b) => a.date - b.date)
      .map(day => {
        let calories = 0, protein = 0, carbs = 0, fats = 0;
        day.meals.forEach(m => m.foods.forEach(f => {
          calories += f.calories; protein += f.protein; carbs += f.carbs; fats += f.fats;
        }));
        return { date: new Date(day.date).toLocaleDateString(), calories, protein, carbs, fats };
      });

    const html = buildReportHtml({
      profileName: profile.name,
      records,
      exLookup,
      history,
      weekMeals,
    });

    const win = window.open('', '_blank');
    if (!win) {
      alert(t('progress.popup_blocked') || 'Your browser blocked the report popup — please allow popups for this site and try again.');
      return;
    }
    win.document.write(html);
    win.document.close();
    // Give the new document a moment to render before invoking print
    setTimeout(() => win.print(), 400);
  };

  return (
    <button onClick={handleExport} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', marginBottom: '1.25rem' }}>
      <FileDown size={16} /> {t('progress.export_report') || 'Export Progress Report (PDF)'}
    </button>
  );
};

// ── Progress Page ────────────────────────────────────────────────────────────
const ProgressPage = () => {
  const t = useT();
  const navigate = useNavigate();

  return (
    <div style={{ padding: '1rem 1rem 6rem', maxWidth: 640, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--color-text-muted)', padding: '0.4rem' }}>
          <ChevronLeft size={20} />
        </button>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>
          {t('progress.title') || 'Progress'}
        </h1>
      </div>

      <ExportReportButton />
      <PRTracker />
      <VolumeBalanceChart />
    </div>
  );
};

export default ProgressPage;
