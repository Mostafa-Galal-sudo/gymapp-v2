import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useUserStore } from '../store/useUserStore';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useGamificationStore } from '../store/useGamificationStore';
import { useDeviceStore } from '../store/useDeviceStore';
import { useHealthStore } from '../store/useHealthStore';
import { useAppLockStore } from '../store/useAppLockStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { useMeasurementsStore } from '../store/useMeasurementsStore';
import type { MeasurementEntry } from '../db/db';
import { useOnboardingStore } from '../store/useOnboardingStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format } from 'date-fns';
import {
  Download, Upload, Save, Trophy, Plus, ShieldAlert, Watch, Activity,
  HeartPulse, ShieldCheck, Globe, ChevronUp, ChevronDown, Camera, X, Loader2,
  Pill, Trash2, HelpCircle, Fingerprint
} from 'lucide-react';
import { useT } from '../hooks/useT';
import { useLanguageStore } from '../store/useLanguageStore';
import { Capacitor } from '@capacitor/core';

// ── Custom Recharts Tooltip ───────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'rgba(6,9,15,0.95)', border: '1px solid rgba(0,240,255,0.2)',
      borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.8rem',
    }}>
      <div style={{ color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontWeight: 700 }}>
        {payload[0].value} kg
      </div>
    </div>
  );
};

// ── Edit Profile Modal ────────────────────────────────────────────────────────
const EditProfileModal = ({ onClose }: { onClose: () => void }) => {
  const { profile, updateProfile } = useUserStore();
  const [form, setForm] = useState({ ...profile });
  const photoRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(profile.profilePhoto || null);
  const t = useT();

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const max = 400;
        const scale = Math.min(max / img.width, max / img.height, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoPreview(compressed);
        setForm(f => ({ ...f, profilePhoto: compressed }));
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => { updateProfile(form); onClose(); };

  const content = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(2,4,8,0.9)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', animation: 'fadeIn 0.2s ease'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: '1.5rem', position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: 'var(--color-text-muted)' }}>
          <X size={20} />
        </button>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
          {t('profile.edit')}
        </h3>

        {/* Photo Upload */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div
            onClick={() => photoRef.current?.click()}
            style={{
              width: 100, height: 100, borderRadius: '50%', cursor: 'pointer', position: 'relative',
              background: photoPreview ? 'none' : 'linear-gradient(135deg, var(--cyan), var(--magenta))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', boxShadow: 'var(--shadow-cyan)'
            }}
          >
            {photoPreview
              ? <img src={photoPreview} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', color: '#000' }}>{form.name[0]?.toUpperCase()}</span>
            }
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <Camera size={24} color="#fff" />
            </div>
          </div>
          <input type="file" accept="image/*" ref={photoRef} style={{ display: 'none' }} onChange={handlePhotoChange} />
          <button onClick={() => photoRef.current?.click()} style={{ color: 'var(--cyan)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            <Camera size={14} style={{ display: 'inline', marginRight: 4 }} /> {t('profile.change_photo')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('auth.name')}</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('auth.age')}</label>
              <input type="number" value={form.age} onChange={e => setForm(f => ({ ...f, age: +e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('auth.weight')}</label>
              <input type="number" value={form.weight} onChange={e => setForm(f => ({ ...f, weight: +e.target.value }))} style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('auth.height')}</label>
              <input type="number" value={form.height} onChange={e => setForm(f => ({ ...f, height: +e.target.value }))} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('profile.gender')}</label>
              <select value={form.gender || 'male'} onChange={e => setForm(f => ({ ...f, gender: e.target.value as 'male' | 'female' }))} style={{ width: '100%' }}>
                <option value="male">{t('profile.male')}</option>
                <option value="female">{t('profile.female')}</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('dash.level')}</label>
            <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} style={{ width: '100%' }}>
              {['Beginner', 'Intermediate', 'Advanced', 'Elite'].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('profile.activity_level')}</label>
            <select value={form.activityLevel || 'Moderate'} onChange={e => setForm(f => ({ ...f, activityLevel: e.target.value as any }))} style={{ width: '100%' }}>
              <option value="Sedentary">{t('profile.activity_sedentary')}</option>
              <option value="Light">{t('profile.activity_light')}</option>
              <option value="Moderate">{t('profile.activity_moderate')}</option>
              <option value="Active">{t('profile.activity_active')}</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>{t('profile.goals_label')}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
              {['bulk', 'cut', 'maintain', 'Strength', 'Athletic', 'Aesthetics', 'Rehab'].map(g => {
                const selected = (form.goals || []).includes(g);
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      goals: selected ? f.goals.filter(x => x !== g) : [...f.goals, g]
                    }))}
                    style={{
                      padding: '0.5rem', borderRadius: 8, fontSize: '0.75rem', textAlign: 'center',
                      border: `1px solid ${selected ? 'var(--cyan)' : 'rgba(255,255,255,0.1)'}`,
                      background: selected ? 'rgba(0,240,255,0.1)' : 'rgba(255,255,255,0.02)',
                      color: selected ? 'var(--cyan)' : 'var(--color-text-muted)'
                    }}
                  >
                    {t(`auth.goal.${g}` as any)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
          <button onClick={onClose} className="btn-secondary" style={{ flex: 1, padding: '0.9rem' }}>{t('common.cancel')}</button>
          <button onClick={handleSave} className="btn-primary" style={{ flex: 1, padding: '0.9rem' }}>
            <Save size={16} style={{ display: 'inline', marginRight: 4 }} /> {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

// ── Garmin BLE Connect ────────────────────────────────────────────────────────
const GarminConnectButton = () => {
  const navigate = useNavigate();
  const { isConnected, deviceName, setConnected, setCurrentHR } = useDeviceStore();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setScanning(true);
    try {
      const { connectHeartRateMonitor } = await import('../services/bleService');
      const { deviceId, deviceName } = await connectHeartRateMonitor(
        (hr) => setCurrentHR(hr),
        () => useDeviceStore.getState().setDisconnected()
      );
      setConnected(deviceName, deviceId);
      setScanning(false);
      navigate('/device-live');
    } catch (err: any) {
      setScanning(false);
      // User simply closed the device picker — not a real error.
      if (err?.name !== 'NotFoundError' && !/cancell?ed/i.test(err?.message || '')) {
        setError(t('profile.connection_failed') + ': ' + (err?.message || t('profile.unknown_error')));
      }
    }
  };

  const t = useT();
  if (isConnected) {
    return (
      <button onClick={() => navigate('/device-live')}
        style={{
          background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.75rem',
          color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer'
        }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
        {deviceName} · {t('common.open' as any) || 'Open'}
      </button>
    );
  }

  return (
    <div>
      <button onClick={handleConnect} disabled={scanning}
        style={{
          background: scanning ? 'rgba(0,240,255,0.05)' : 'rgba(0,240,255,0.1)',
          border: '1px solid rgba(0,240,255,0.3)',
          borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.75rem',
          color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem',
          cursor: scanning ? 'not-allowed' : 'pointer'
        }}>
        {scanning ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <HeartPulse size={14} />}
        {scanning ? t('common.loading') : t('profile.connect')}
      </button>
      {error && <div style={{ fontSize: '0.65rem', color: 'var(--magenta)', marginTop: '0.3rem', maxWidth: 200 }}>{error}</div>}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

// ── Apple Health / Health Connect Sync ─────────────────────────────────────────
const HealthSyncButton = () => {
  const { authorized, syncing, requestAccess, syncWeek, lastSyncedAt } = useHealthStore();
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  const handleSync = async () => {
    setError(null);
    try {
      if (!authorized) {
        const ok = await requestAccess();
        if (!ok) {
          setError(Capacitor.isNativePlatform() ? t('profile.connection_failed') : t('profile.health_native_only'));
        }
      } else {
        await syncWeek();
      }
    } catch {
      setError(t('profile.connection_failed'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <button onClick={handleSync} disabled={syncing}
        style={{
          background: syncing ? 'rgba(34,197,94,0.05)' : 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '8px', padding: '0.4rem 0.75rem', fontSize: '0.75rem',
          color: '#22c55e', display: 'flex', alignItems: 'center', gap: '0.4rem',
          cursor: syncing ? 'not-allowed' : 'pointer'
        }}>
        {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Activity size={14} />}
        {syncing ? t('profile.syncing') : authorized ? t('profile.sync_health') : t('profile.connect')}
      </button>
      {lastSyncedAt && <span style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{t('profile.last_sync')}: {new Date(lastSyncedAt).toLocaleTimeString()}</span>}
      {error && <span style={{ fontSize: '0.6rem', color: 'var(--magenta)', marginTop: '0.2rem', maxWidth: 160, textAlign: 'end' }}>{error}</span>}
    </div>
  );
};

// ── BMI Calculator & Nutrition Targets ───────────────────────────────────
const BMICalculatorSection = () => {
  const { profile } = useUserStore();
  const { getTargets } = useNutritionStore();
  const t = useT();

  const bmi = profile.height > 0
    ? parseFloat((profile.weight / ((profile.height / 100) ** 2)).toFixed(1))
    : 0;

  const bmiCategory = bmi < 18.5
    ? { key: 'profile.underweight', color: 'var(--cyan)', bg: 'rgba(0,240,255,0.08)' }
    : bmi < 25
      ? { key: 'profile.normal', color: '#22c55e', bg: 'rgba(34,197,94,0.08)' }
      : bmi < 30
        ? { key: 'profile.overweight', color: 'var(--gold)', bg: 'rgba(255,200,0,0.08)' }
        : { key: 'profile.obese', color: 'var(--magenta)', bg: 'rgba(255,0,85,0.08)' };

  const bmiPct = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));
  const targets = getTargets(profile.weight);

  const macros = [
    { label: t('dash.calories'), val: targets.calories, unit: 'kcal', color: 'var(--gold)' },
    { label: t('dash.protein'), val: targets.protein, unit: 'g', color: '#22c55e' },
    { label: t('nutrition.carbs'), val: targets.carbs, unit: 'g', color: 'var(--cyan)' },
    { label: t('nutrition.fats'), val: targets.fats, unit: 'g', color: 'var(--magenta)' },
    { label: t('nutrition.fiber'), val: targets.fiber, unit: 'g', color: '#a78bfa' },
    { label: t('nutrition.water'), val: (targets.water / 1000).toFixed(1), unit: 'L', color: '#60a5fa' },
  ];

  const minerals = [
    { label: t('nutrition.sodium'), val: targets.sodium, unit: 'mg', color: '#fb923c' },
    { label: t('nutrition.potassium'), val: targets.potassium, unit: 'mg', color: '#a78bfa' },
    { label: t('nutrition.iron'), val: targets.iron, unit: 'mg', color: '#f87171' },
    { label: t('nutrition.calcium'), val: targets.calcium, unit: 'mg', color: '#94a3b8' },
    { label: t('nutrition.vitaminA'), val: targets.vitaminA, unit: 'mcg', color: '#fbbf24' },
    { label: t('nutrition.vitaminC'), val: targets.vitaminC, unit: 'mg', color: '#f97316' },
    { label: t('nutrition.vitaminD'), val: targets.vitaminD, unit: 'IU', color: '#fde68a' },
    { label: t('nutrition.vitaminB12'), val: targets.vitaminB12, unit: 'mcg', color: '#e879f9' },
  ];

  return (
    <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--gold)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        🧠 {t('profile.bmi_calculator')}
      </h3>

      {/* BMI Gauge */}
      <div style={{ padding: '1rem', background: bmiCategory.bg, borderRadius: 10, border: `1px solid ${bmiCategory.color}30`, marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('profile.bmi')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 800, color: bmiCategory.color }}>
            {bmi}
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: bmiCategory.color, padding: '0.2rem 0.6rem', borderRadius: 6, background: `${bmiCategory.color}20` }}>
            {t(bmiCategory.key as any)}
          </span>
        </div>
        {/* BMI Progress bar */}
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', position: 'relative' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 999,
            width: `${bmiPct}%`,
            background: `linear-gradient(90deg, var(--cyan), ${bmiCategory.color})`,
            transition: 'width 0.8s var(--ease-out)'
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem', fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>
          <span>10</span><span>18.5</span><span>25</span><span>30</span><span>40</span>
        </div>
      </div>

      {/* Macro Targets */}
      <div className="section-label" style={{ marginBottom: '0.5rem' }}>{t('profile.macro_targets')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1rem' }}>
        {macros.map(m => (
          <div key={m.label} style={{ textAlign: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 8, padding: '0.6rem 0.4rem', border: `1px solid ${m.color}30` }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: m.color }}>{m.val}</div>
            <div style={{ fontSize: '0.55rem', color: m.color, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.unit}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>{m.label}</div>
          </div>
        ))}
      </div>

      {/* Mineral & Vitamin Targets */}
      <div className="section-label" style={{ marginBottom: '0.5rem' }}>{t('profile.micro_targets')}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.4rem' }}>
        {minerals.map(m => (
          <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.45rem 0.6rem', background: 'rgba(0,0,0,0.2)', borderRadius: 6, borderLeft: `3px solid ${m.color}` }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{m.label}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, color: m.color }}>{m.val}<span style={{ fontSize: '0.6rem', opacity: 0.7 }}>{m.unit}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Trophy Room ───────────────────────────────────────────────────────────────
const TrophyRoom = () => {
  const { badges, xp, level } = useGamificationStore();
  const t = useT();
  const unlockedBadges = badges.filter(b => b.unlocked);
  const lockedBadges = badges.filter(b => !b.unlocked);

  const levelNames = ['', t('dash.beginner'), t('dash.intermediate'), t('dash.advanced'), t('dash.elite'), t('dash.legend')];
  const levelName = levelNames[Math.min(level, 5)] || t('dash.legend');
  const xpForLevel = level * level * 100;
  const xpPrev = (level - 1) * (level - 1) * 100;
  const progress = ((xp - xpPrev) / (xpForLevel - xpPrev)) * 100;

  return (
    <div>
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem', textAlign: 'center' }}>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
          {t('profile.current_rank')}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', letterSpacing: '0.08em', lineHeight: 1 }} className="gradient-text">
          {levelName.toUpperCase()}
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', fontSize: '0.8rem', margin: '0.5rem 0 1rem' }}>
          {t('dash.level')} {level} · {xp.toLocaleString()} {t('profile.total_xp')}
        </div>
        <div className="xp-bar-track" style={{ height: 10, borderRadius: 'var(--radius-full)', overflow: 'visible' }}>
          <div className="xp-bar-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          <span>Lv {level}</span>
          <span>{xpForLevel.toLocaleString()} XP → Lv {level + 1}</span>
        </div>
      </div>

      {unlockedBadges.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div className="section-label" style={{ color: 'var(--gold)' }}>
            <Trophy size={12} style={{ display: 'inline', marginRight: '0.4rem', verticalAlign: 'middle' }} />
            {t('profile.unlocked')} — {unlockedBadges.length}/{badges.length}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
            {unlockedBadges.map((badge, i) => (
              <div key={badge.id} className="badge-card unlocked animate-badge-pop" style={{ animationDelay: `${i * 0.06}s` }}>
                <span className="badge-icon">{badge.icon}</span>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, fontFamily: 'var(--font-heading)', letterSpacing: '0.04em', textAlign: 'center', lineHeight: 1.3 }}>{badge.name}</div>
                {badge.unlockedAt && (
                  <div style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {format(new Date(badge.unlockedAt), 'MMM d')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="section-label">{t('profile.locked')} — {lockedBadges.length} {t('profile.remaining')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
          {lockedBadges.map(badge => (
            <div key={badge.id} className="badge-card locked">
              <span className="badge-icon-locked">{badge.icon}</span>
              <div className="badge-text-locked" style={{ fontSize: '0.68rem', fontWeight: 700, fontFamily: 'var(--font-heading)', textAlign: 'center', lineHeight: 1.3 }}>{badge.name}</div>
              <div className="badge-text-locked" style={{ fontSize: '0.58rem', color: 'var(--color-text-muted)', textAlign: 'center', lineHeight: 1.4 }}>{badge.description}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Workout History View ──────────────────────────────────────────────────────
const WorkoutHistoryView = () => {
  const t = useT();
  const history = useWorkoutStore(s => s.history);
  const updateHistoricalSession = useWorkoutStore(s => s.updateHistoricalSession);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // Identify the set being edited by stable IDs (sessionId + exerciseId + setNumber),
  // not array indices — indices shift once you filter to completed-only sets.
  const [editingSet, setEditingSet] = useState<{ sessionId: string; exerciseId: string; setNumber: number } | null>(null);
  const [editVals, setEditVals] = useState({ weight: 0, reps: 0, rpe: 0 });

  const reversedHistory = [...history].reverse();

  const handleSaveEdit = () => {
    if (!editingSet) return;
    const { sessionId, exerciseId, setNumber } = editingSet;
    const session = history.find(s => s.sessionId === sessionId);
    if (!session) return;

    const updatedExercises = session.exercises.map(ex => {
      if (ex.exerciseId !== exerciseId) return ex;
      const sets = ex.sets.map(st => st.setNumber !== setNumber ? st : { ...st, ...editVals });
      return { ...ex, sets };
    });

    // Recalculate total volume the same way Workout.tsx's history editor does.
    const newVolume = updatedExercises.reduce((sum, we) =>
      sum + we.sets.filter(s => s.completed).reduce((sSum, s) => sSum + (s.weight * s.reps), 0), 0);

    updateHistoricalSession(sessionId, { exercises: updatedExercises, totalVolume: newVolume });
    setEditingSet(null);
  };

  if (reversedHistory.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '2rem 0', fontSize: '0.9rem' }}>
        {t('profile.no_workout_history')}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '1.5rem' }}>
      {reversedHistory.map((session) => {
        const isExpanded = expandedId === session.sessionId;
        return (
          <div key={session.sessionId} className="glass-card animate-fade-up" style={{ marginBottom: '0.75rem' }}>
            <button
              onClick={() => setExpandedId(isExpanded ? null : session.sessionId)}
              style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', color: 'var(--color-text)' }}
            >
              <div>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: '1rem' }}>{session.type}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', marginTop: '0.15rem' }}>
                  {format(new Date(session.date), 'dd MMM yyyy')} · {session.totalVolume.toLocaleString()} kg
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--cyan)' }}>{session.exercises.length} {t('workout.exercises')}</span>
                {isExpanded ? <ChevronUp size={16} color="var(--color-text-muted)" /> : <ChevronDown size={16} color="var(--color-text-muted)" />}
              </div>
            </button>
            {isExpanded && (
              <div style={{ padding: '0 1.25rem 1rem' }}>
                {session.exercises.map((ex) => (
                  <div key={ex.exerciseId} style={{ marginBottom: '1rem' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--cyan)', fontFamily: 'var(--font-heading)', fontWeight: 700, marginBottom: '0.5rem' }}>{ex.exerciseId}</div>
                    {ex.sets.filter(s => s.completed).map((set) => {
                      const isEditing = editingSet?.sessionId === session.sessionId && editingSet?.exerciseId === ex.exerciseId && editingSet?.setNumber === set.setNumber;
                      return (
                        <div key={set.setNumber} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.8rem' }}>
                          <span style={{ color: 'var(--color-text-muted)', width: 40 }}>Set {set.setNumber}</span>
                          {isEditing ? (
                            <>
                              <input type="number" value={editVals.weight} onChange={e => setEditVals(v => ({ ...v, weight: +e.target.value }))} style={{ width: 56, textAlign: 'center', padding: '0.2rem' }} placeholder="kg" />
                              <span style={{ color: 'var(--color-text-muted)' }}>×</span>
                              <input type="number" value={editVals.reps} onChange={e => setEditVals(v => ({ ...v, reps: +e.target.value }))} style={{ width: 48, textAlign: 'center', padding: '0.2rem' }} placeholder="reps" />
                              <button onClick={handleSaveEdit} className="btn-primary" style={{ padding: '0.2rem 0.6rem', fontSize: '0.72rem' }}>✓</button>
                              <button onClick={() => setEditingSet(null)} style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>✕</button>
                            </>
                          ) : (
                            <>
                              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text)', flex: 1 }}>{set.weight}kg × {set.reps} <span style={{ color: 'var(--color-text-muted)' }}>RPE {set.rpe}</span></span>
                              <button onClick={() => { setEditingSet({ sessionId: session.sessionId, exerciseId: ex.exerciseId, setNumber: set.setNumber }); setEditVals({ weight: set.weight, reps: set.reps, rpe: set.rpe }); }} style={{ color: 'var(--cyan)', fontSize: '0.65rem', padding: '0.1rem 0.4rem', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 4 }}>{t('common.edit')}</button>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ── Profile Page ──────────────────────────────────────────────────────────────
// ── Body Measurements + Progress Photos ───────────────────────────────────────
const MEASUREMENT_FIELDS = ['waist', 'chest', 'arm', 'thigh', 'hips', 'neck', 'bodyFat'] as const;

const MeasurementsAndPhotos = () => {
  const t = useT();
  const measurements = useMeasurementsStore(s => s.measurements);
  const photos = useMeasurementsStore(s => s.photos);
  const addMeasurement = useMeasurementsStore(s => s.addMeasurement);
  const deleteMeasurement = useMeasurementsStore(s => s.deleteMeasurement);
  const addPhoto = useMeasurementsStore(s => s.addPhoto);
  const deletePhoto = useMeasurementsStore(s => s.deletePhoto);

  const [form, setForm] = useState<Record<string, string>>({});
  const [comparePhotos, setComparePhotos] = useState<[string | null, string | null]>([null, null]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSaveMeasurement = () => {
    const parsed: any = { date: Date.now() };
    let hasValue = false;
    MEASUREMENT_FIELDS.forEach(f => {
      if (form[f] && !isNaN(parseFloat(form[f]))) {
        parsed[f] = parseFloat(form[f]);
        hasValue = true;
      }
    });
    if (!hasValue) return;
    addMeasurement(parsed);
    setForm({});
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addPhoto({ date: Date.now(), photo: reader.result as string });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const latest = measurements[measurements.length - 1];
  const first = measurements[0];

  // Which measured fields actually have at least 2 data points to chart
  const chartableFields = MEASUREMENT_FIELDS.filter(f =>
    measurements.filter(m => m[f] != null).length >= 2
  );
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const activeMetric = selectedMetric && chartableFields.includes(selectedMetric as any)
    ? selectedMetric
    : chartableFields[0];

  const chartData = activeMetric
    ? measurements
        .filter(m => m[activeMetric as keyof MeasurementEntry] != null)
        .map(m => ({
          date: format(new Date(m.date), 'MMM d'),
          value: m[activeMetric as keyof MeasurementEntry] as number,
        }))
    : [];

  return (
    <>
      {/* Measurements */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="section-label">{t('profile.measurements') || 'Body Measurements'}</div>

        {latest && first && measurements.length > 1 && (
          <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1rem', paddingBottom: '0.25rem' }}>
            {MEASUREMENT_FIELDS.filter(f => latest[f] != null).map(f => {
              const delta = first[f] != null ? (latest[f]! - first[f]!) : null;
              return (
                <div key={f} style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '0.5rem 0.75rem', flexShrink: 0, minWidth: 72, textAlign: 'center' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>{f}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.95rem' }}>{latest[f]}</div>
                  {delta != null && delta !== 0 && (
                    <div style={{ fontSize: '0.65rem', color: delta > 0 ? 'var(--magenta)' : 'var(--cyan)' }}>
                      {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Measurement Trend Chart */}
        {chartableFields.length > 0 && (
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', marginBottom: '0.75rem', paddingBottom: '0.2rem' }}>
              {chartableFields.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedMetric(f)}
                  className={f === activeMetric ? 'btn-primary' : 'btn-secondary'}
                  style={{
                    padding: '0.35rem 0.75rem', fontSize: '0.7rem', textTransform: 'capitalize',
                    borderRadius: 'var(--radius-full)', flexShrink: 0,
                    background: f === activeMetric ? undefined : 'rgba(2,4,8,0.55)',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="date" tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} />
                  <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke="var(--cyan)" strokeWidth={2} dot={{ fill: 'var(--cyan)', r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
          {MEASUREMENT_FIELDS.map(f => (
            <input
              key={f}
              type="number"
              placeholder={f}
              value={form[f] || ''}
              onChange={e => setForm(prev => ({ ...prev, [f]: e.target.value }))}
              style={{ fontSize: '0.8rem', padding: '0.5rem' }}
            />
          ))}
        </div>
        <button onClick={handleSaveMeasurement} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.6rem', fontSize: '0.85rem' }}>
          <Save size={14} /> {t('profile.log_measurement') || 'Log Measurement'}
        </button>

        {measurements.length > 0 && (
          <div style={{ marginTop: '1rem', maxHeight: 180, overflowY: 'auto' }}>
            {[...measurements].reverse().map(m => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.75rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>{format(new Date(m.date), 'MMM d, yyyy')}</span>
                <span style={{ fontFamily: 'var(--font-mono)', flex: 1, textAlign: 'right', marginRight: '0.75rem' }}>
                  {MEASUREMENT_FIELDS.filter(f => m[f] != null).map(f => `${f}: ${m[f]}`).join('  ·  ')}
                </span>
                <button onClick={() => deleteMeasurement(m.id)} style={{ color: 'var(--magenta)', padding: '0.2rem' }}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress Photos */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{t('profile.progress_photos') || 'Progress Photos'}</span>
          <button onClick={() => fileInputRef.current?.click()} className="btn-secondary" style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem' }}>
            <Camera size={13} /> {t('profile.add_photo') || 'Add Photo'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" capture="user" onChange={handlePhotoUpload} style={{ display: 'none' }} />
        </div>

        {photos.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '1.5rem' }}>
            {t('profile.no_photos') || 'No progress photos yet.'}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', marginTop: '1rem', paddingBottom: '0.25rem' }}>
              {photos.map(p => {
                const isSelected = comparePhotos.includes(p.id);
                return (
                  <div key={p.id} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={p.photo}
                      onClick={() => setComparePhotos(([a, b]) => a === p.id ? [null, b] : b === p.id ? [a, null] : (a === null ? [p.id, b] : [a, p.id]))}
                      style={{ width: 80, height: 100, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: isSelected ? '2px solid var(--cyan)' : '2px solid transparent' }}
                    />
                    <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textAlign: 'center', marginTop: '0.2rem' }}>
                      {format(new Date(p.date), 'MMM d')}
                    </div>
                    <button onClick={() => deletePhoto(p.id)} style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.6)', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
              {t('profile.select_two_compare') || 'Tap two photos to compare side-by-side'}
            </div>
            {comparePhotos[0] && comparePhotos[1] && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                {comparePhotos.map(id => {
                  const p = photos.find(ph => ph.id === id)!;
                  return (
                    <div key={id} style={{ flex: 1 }}>
                      <img src={p.photo} style={{ width: '100%', borderRadius: 8, objectFit: 'cover' }} />
                      <div style={{ fontSize: '0.65rem', textAlign: 'center', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                        {format(new Date(p.date), 'MMM d, yyyy')}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};


// ── Biometric App Lock Toggle ───────────────────────────────────────────────
const BiometricLockToggle = () => {
  const t = useT();
  const { enabled, setEnabled } = useAppLockStore();
  const [busy, setBusy] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const isNative = Capacitor.isNativePlatform();

  const handleToggle = async () => {
    if (!isNative) {
      setUnavailableReason(t('lock.native_only'));
      return;
    }
    setUnavailableReason(null);
    if (enabled) {
      // Turning off never needs a fresh biometric check.
      setEnabled(false);
      return;
    }
    setBusy(true);
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      const status = await BiometricAuth.checkBiometry();
      if (!status.isAvailable) {
        setUnavailableReason(status.reason || t('lock.not_available'));
        return;
      }
      // Confirm biometry actually works before turning the lock on, so the
      // user never accidentally locks themselves out.
      await BiometricAuth.authenticate({ reason: t('lock.confirm_reason') });
      setEnabled(true);
    } catch {
      setUnavailableReason(t('lock.setup_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Fingerprint size={18} color="var(--cyan)" />
        <div>
          <div style={{ fontWeight: 600 }}>{t('lock.settings_label')}</div>
          {unavailableReason && <div style={{ fontSize: '0.65rem', color: 'var(--magenta)', marginTop: '0.2rem', maxWidth: 220 }}>{unavailableReason}</div>}
        </div>
      </div>
      <button onClick={handleToggle} disabled={busy}
        style={{
          width: 46, height: 26, borderRadius: 13, position: 'relative', flexShrink: 0,
          background: enabled ? 'var(--cyan)' : 'rgba(255,255,255,0.15)', transition: 'background 0.2s',
        }}>
        <span style={{
          position: 'absolute', top: 3, insetInlineStart: enabled ? 23 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'inset-inline-start 0.2s',
        }} />
      </button>
    </div>
  );
};

const Profile = () => {
  const userStore = useUserStore();
  const startWalkthrough = useOnboardingStore(s => s.startWalkthrough);
  const workoutStore = useWorkoutStore();
  const gamification = useGamificationStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT();
  const { lang, toggleLang } = useLanguageStore();

  const [newWeight, setNewWeight] = useState('');
  const [exportBusy, setExportBusy] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [tab, setTab] = useState<'stats' | 'trophies' | 'history'>('trophies');
  const [showEditModal, setShowEditModal] = useState(false);

  const [showAddInjury, setShowAddInjury] = useState(false);
  const [newInjury, setNewInjury] = useState({ part: '', severity: 5 });

  const [showAddSupplement, setShowAddSupplement] = useState(false);
  const [newSupplement, setNewSupplement] = useState({
    name: '', dose: '', timing: '', dailyDoses: 1,
    calories: '', protein: '', vitaminD: '', vitaminB12: '', magnesium: '', zinc: ''
  });
  const [showNutrientFields, setShowNutrientFields] = useState(false);

  const handleAddInjury = async () => {
    if (!newInjury.part) return;
    await userStore.addInjury({
      bodyPart: newInjury.part,
      severity: newInjury.severity,
      status: 'Active',
      notes: ''
    });
    setShowAddInjury(false);
    setNewInjury({ part: '', severity: 5 });
  };

  const handleDeleteInjury = async (id: string) => {
    if (confirm(t('profile.confirm_delete_injury'))) {
      await userStore.deleteInjury(id);
    }
  };

  const handleAddSupplement = async () => {
    if (!newSupplement.name) return;
    const dosesArray = Array(Number(newSupplement.dailyDoses) || 1).fill(false);
    const num = (v: string) => v.trim() === '' ? undefined : parseFloat(v);
    await userStore.addSupplement({
      id: Math.random().toString(36).substring(2, 9),
      name: newSupplement.name,
      dose: newSupplement.dose || '1 tab',
      timing: newSupplement.timing || 'Anytime',
      taken: dosesArray,
      calories: num(newSupplement.calories),
      protein: num(newSupplement.protein),
      vitaminD: num(newSupplement.vitaminD),
      vitaminB12: num(newSupplement.vitaminB12),
      magnesium: num(newSupplement.magnesium),
      zinc: num(newSupplement.zinc),
    });
    setShowAddSupplement(false);
    setNewSupplement({ name: '', dose: '', timing: '', dailyDoses: 1, calories: '', protein: '', vitaminD: '', vitaminB12: '', magnesium: '', zinc: '' });
  };

  const handleDeleteSupplement = async (id: string) => {
    if (confirm(t('profile.confirm_delete_supplement'))) {
      await userStore.deleteSupplement(id);
    }
  };

  const handleExport = async () => {
    const activeUserId = userStore.activeUserId || 'default_user';
    setExportBusy('json');
    try {
      const { exportUserDataJSON } = await import('../services/dataExportService');
      await exportUserDataJSON(activeUserId);
    } catch (err) {
      console.error('Export failed', err);
      alert(t('profile.export_failed'));
    } finally {
      setExportBusy(null);
    }
  };

  const handleExportCSV = async (kind: 'workouts' | 'nutrition' | 'measurements' | 'weight') => {
    const activeUserId = userStore.activeUserId || 'default_user';
    setExportBusy(kind);
    try {
      const svc = await import('../services/dataExportService');
      const fn = {
        workouts: svc.exportWorkoutsCSV,
        nutrition: svc.exportNutritionCSV,
        measurements: svc.exportMeasurementsCSV,
        weight: svc.exportWeightHistoryCSV,
      }[kind];
      await fn(activeUserId);
    } catch (err) {
      console.error('CSV export failed', err);
      alert(t('profile.export_failed'));
    } finally {
      setExportBusy(null);
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || importBusy) return;
    setImportBusy(true);
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        const { isValidUserDataExport, importUserDataJSON } = await import('../services/dataExportService');
        if (!isValidUserDataExport(data)) {
          alert(t('profile.import_invalid'));
          return;
        }
        const activeUserId = userStore.activeUserId || 'default_user';
        if (!confirm(t('profile.import_confirm'))) return;
        await importUserDataJSON(data, activeUserId);
        // Reload every store from the freshly-written Dexie tables so the
        // UI reflects the restored data immediately, without a manual reload.
        const { loadAllUserData } = await import('../store/sessionLoader');
        await loadAllUserData(activeUserId);
        alert(t('profile.import_success'));
      } catch (err) {
        console.error('Import failed', err);
        alert(t('profile.import_invalid'));
      } finally {
        setImportBusy(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => { setImportBusy(false); alert(t('profile.import_invalid')); };
    reader.readAsText(file);
  };

  const handleLogWeight = () => {
    const w = parseFloat(newWeight);
    if (!isNaN(w) && w > 0) { userStore.logWeight(w); setNewWeight(''); }
  };

  const chartData = userStore.weightHistory.map(e => ({
    date: format(new Date(e.date), 'MMM d'),
    weight: e.weight,
  }));

  const { profile } = userStore;
  const totalSessions = workoutStore.history.length;
  const totalVolume = workoutStore.history.reduce((a, s) => a + s.totalVolume, 0);

  const TabBtn = ({ id, label }: { id: 'stats' | 'trophies' | 'history'; label: string }) => (
    <button onClick={() => setTab(id)} style={{
      flex: 1, padding: '0.65rem', fontFamily: 'var(--font-heading)',
      fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.08em', textTransform: 'uppercase',
      background: tab === id ? 'rgba(0,240,255,0.1)' : 'transparent',
      color: tab === id ? 'var(--cyan)' : 'var(--color-text-muted)',
      borderBottom: `2px solid ${tab === id ? 'var(--cyan)' : 'transparent'}`,
      transition: 'all 0.2s',
    }}>{label}</button>
  );

  return (
    <div className="page">
      {showEditModal && <EditProfileModal onClose={() => setShowEditModal(false)} />}

      {/* Header */}
      <header style={{ marginBottom: '1.75rem' }}>
        <div className="section-label">{t('profile.athlete')}</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', letterSpacing: '0.06em' }}>
          <span className="gradient-text">{t('profile.title')}</span>
        </h1>
      </header>

      {/* Profile Card */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          {/* Avatar — shows photo if exists */}
          <div
            onClick={() => setShowEditModal(true)}
            style={{
              width: 70, height: 70, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
              background: profile.profilePhoto ? 'none' : 'linear-gradient(135deg, var(--cyan), var(--magenta))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-cyan)', overflow: 'hidden', position: 'relative',
            }}
          >
            {profile.profilePhoto
              ? <img src={profile.profilePhoto} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: '#000' }}>{profile.name[0].toUpperCase()}</span>
            }
            {/* Camera overlay hint */}
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <Camera size={20} color="#fff" />
            </div>
          </div>

          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700 }}>{profile.name}</div>
              <button
                onClick={() => setShowEditModal(true)}
                style={{ color: 'var(--cyan)', fontSize: '0.7rem', padding: '0.15rem 0.5rem', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 6, background: 'rgba(0,240,255,0.06)' }}
              >
                {t('profile.edit')}
              </button>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--cyan)', marginTop: '0.15rem' }}>
              {profile.age} {t('profile.age')} · {profile.weight}{t('common.kg')} · {profile.height}cm
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              {t('dash.level')} {t(`dash.${profile.level.toLowerCase()}` as any, profile.level)} · {profile.goals.map(g => t(`auth.goal.${g}` as any, g)).join(' · ')}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1.25rem' }}>
          {[
            { label: t('dash.sessions'), val: totalSessions },
            { label: t('dash.volume'), val: `${(totalVolume / 1000).toFixed(1)}T` },
            { label: 'XP', val: gamification.xp.toLocaleString() },
          ].map(({ label, val }) => (
            <div key={label} style={{ textAlign: 'center', background: 'rgba(0,240,255,0.04)', borderRadius: 'var(--radius-md)', padding: '0.75rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.2rem', fontWeight: 700, color: 'var(--cyan)' }}>{val}</div>
              <div style={{ fontSize: '0.62rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.2rem' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* BMI Calculator & Nutrition Targets */}
      <BMICalculatorSection />

      {/* Wearables Hub */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--cyan)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Watch size={18} /> {t('profile.wearables')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Activity size={16} /> {t('profile.apple_health')} / Google Fit</div>
            <HealthSyncButton />
          </div>
          {/* Garmin — Real BLE */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><HeartPulse size={16} /> {t('profile.garmin')}</div>
            <GarminConnectButton />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ShieldCheck size={16} /> {t('profile.whoop')}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{t('common.soon' as any) || 'Coming soon'}</span>
          </div>
        </div>
      </div>

      {/* Injury Management */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <ShieldAlert size={18} /> {t('profile.injuries')}
          </h3>
          <button onClick={() => setShowAddInjury(!showAddInjury)} style={{ background: 'none', border: 'none', color: 'var(--cyan)' }}><Plus size={18} /></button>
        </div>

        {showAddInjury && (
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: '1rem' }}>
            <input type="text" placeholder={t('profile.body_part')} value={newInjury.part}
              onChange={e => setNewInjury({ ...newInjury, part: e.target.value })}
              style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--magenta)', color: '#fff', borderRadius: 4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{t('profile.severity')}: {newInjury.severity}/10</span>
              <input type="range" min="1" max="10" value={newInjury.severity} onChange={e => setNewInjury({ ...newInjury, severity: parseInt(e.target.value) })} style={{ flex: 1 }} />
            </div>
            <button className="btn-primary" onClick={handleAddInjury} style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>{t('profile.log_injury')}</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {userStore.injuries.length === 0
            ? <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('profile.no_injuries')}</div>
            : userStore.injuries.map(inj => (
              <div key={inj.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8, borderLeft: `3px solid ${inj.status === 'Active' ? 'var(--magenta)' : 'var(--color-warning)'}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{inj.bodyPart}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{t('profile.severity')}: {inj.severity}/10</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button className="btn-secondary" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                    onClick={async () => {
                      const newStatus = inj.status === 'Active' ? 'Recovering' : 'Active';
                      await userStore.updateInjuryStatus(inj.id, newStatus);
                    }}>
                    {inj.status === 'Active' ? t('profile.active') : t('profile.recovering')}
                  </button>
                  <button className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--magenta)', border: '1px solid rgba(255,0,85,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    onClick={() => handleDeleteInjury(inj.id)}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      </div>

      {/* Supplements Management */}
      <div data-walkthrough="supplements-section" className="glass-card animate-fade-up" style={{ padding: '1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--gold)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <Pill size={18} /> {t('profile.supplements')}
          </h3>
          <button onClick={() => setShowAddSupplement(!showAddSupplement)} style={{ background: 'none', border: 'none', color: 'var(--cyan)' }}><Plus size={18} /></button>
        </div>

        {showAddSupplement && (
          <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8, marginBottom: '1rem' }}>
            <input type="text" placeholder={t('profile.supplement_name_placeholder')} value={newSupplement.name}
              onChange={e => setNewSupplement({ ...newSupplement, name: e.target.value })}
              style={{ width: '100%', marginBottom: '0.5rem', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--gold)', color: '#fff', borderRadius: 4 }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input type="text" placeholder={t('profile.supplement_dose_placeholder')} value={newSupplement.dose}
                onChange={e => setNewSupplement({ ...newSupplement, dose: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--gold)', color: '#fff', borderRadius: 4 }} />
              <input type="text" placeholder={t('profile.supplement_timing_placeholder')} value={newSupplement.timing}
                onChange={e => setNewSupplement({ ...newSupplement, timing: e.target.value })}
                style={{ width: '100%', padding: '0.5rem', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--gold)', color: '#fff', borderRadius: 4 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{t('profile.daily_doses_count')}: {newSupplement.dailyDoses}</span>
              <input type="range" min="1" max="5" value={newSupplement.dailyDoses} onChange={e => setNewSupplement({ ...newSupplement, dailyDoses: parseInt(e.target.value) })} style={{ flex: 1 }} />
            </div>

            <button onClick={() => setShowNutrientFields(v => !v)} style={{ fontSize: '0.72rem', color: 'var(--cyan)', marginBottom: showNutrientFields ? '0.5rem' : 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {showNutrientFields ? <ChevronUp size={12} /> : <ChevronDown size={12} />} {t('profile.nutrient_contribution')}
            </button>
            {showNutrientFields && (
              <div style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', marginBottom: '0.4rem' }}>{t('profile.nutrient_contribution_hint')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem' }}>
                  <input type="number" placeholder={t('nutrition.calories_short')} value={newSupplement.calories}
                    onChange={e => setNewSupplement({ ...newSupplement, calories: e.target.value })}
                    style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }} />
                  <input type="number" placeholder={`${t('nutrition.protein_short')} (g)`} value={newSupplement.protein}
                    onChange={e => setNewSupplement({ ...newSupplement, protein: e.target.value })}
                    style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }} />
                  <input type="number" placeholder="Vit D (IU)" value={newSupplement.vitaminD}
                    onChange={e => setNewSupplement({ ...newSupplement, vitaminD: e.target.value })}
                    style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }} />
                  <input type="number" placeholder="B12 (mcg)" value={newSupplement.vitaminB12}
                    onChange={e => setNewSupplement({ ...newSupplement, vitaminB12: e.target.value })}
                    style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }} />
                  <input type="number" placeholder="Mg (mg)" value={newSupplement.magnesium}
                    onChange={e => setNewSupplement({ ...newSupplement, magnesium: e.target.value })}
                    style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }} />
                  <input type="number" placeholder="Zn (mg)" value={newSupplement.zinc}
                    onChange={e => setNewSupplement({ ...newSupplement, zinc: e.target.value })}
                    style={{ padding: '0.4rem', background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 4, fontSize: '0.75rem' }} />
                </div>
              </div>
            )}
            <button className="btn-primary" onClick={handleAddSupplement} style={{ width: '100%', padding: '0.5rem', fontSize: '0.8rem' }}>{t('profile.add_supplement')}</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {userStore.supplements.length === 0
            ? <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>{t('profile.no_supplements')}</div>
            : userStore.supplements.map(sup => (
              <div key={sup.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8, borderLeft: '3px solid var(--gold)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{sup.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{sup.dose} · {sup.timing}</div>
                </div>
                <button className="btn-secondary" style={{ padding: '0.3rem', color: 'var(--magenta)', border: '1px solid rgba(255,0,85,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => handleDeleteSupplement(sup.id)}>
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          }
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,240,255,0.1)', marginBottom: '1.25rem' }}>
        <TabBtn id="trophies" label={`🏆 ${t('profile.trophies')}`} />
        <TabBtn id="stats" label={`📈 ${t('profile.progress')}`} />
        <TabBtn id="history" label={`📋 ${t('profile.history')}`} />
      </div>

      {tab === 'trophies' && <TrophyRoom />}

      {tab === 'stats' && (
        <div>
          <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
            <div className="section-label">{t('profile.weight_trend')}</div>
            <div style={{ height: 200, marginBottom: '1rem' }}>
              {chartData.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,240,255,0.06)" />
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--color-text-muted)' }} />
                    <YAxis stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 11, fontFamily: 'var(--font-mono)', fill: 'var(--color-text-muted)' }} domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="weight" stroke="var(--cyan)" strokeWidth={2.5}
                      dot={{ r: 5, fill: 'var(--bg-base)', stroke: 'var(--cyan)', strokeWidth: 2 }}
                      activeDot={{ r: 7, fill: 'var(--cyan)', stroke: 'var(--cyan)' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  {t('profile.log_weighins')}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <input type="number" placeholder={t('profile.enter_weight')} value={newWeight}
                onChange={e => setNewWeight(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogWeight()}
                style={{ flex: 1 }}
              />
              <button onClick={handleLogWeight} className="btn-primary" style={{ padding: '0.75rem 1.25rem', flexShrink: 0 }}>
                <Save size={18} />
              </button>
            </div>
          </div>
          <MeasurementsAndPhotos />
        </div>
      )}

      {tab === 'history' && <WorkoutHistoryView />}

      {/* App Settings */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="section-label">{t('profile.app_settings')}</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} color="var(--cyan)" />
            <span style={{ fontWeight: 600 }}>{t('common.language')}</span>
          </div>
          <button className="btn-secondary" onClick={toggleLang} style={{ padding: '0.4rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {lang === 'en' ? 'العربية' : 'English'}
          </button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <HelpCircle size={18} color="var(--cyan)" />
            <span style={{ fontWeight: 600 }}>{t('walkthrough.replay_label')}</span>
          </div>
          <button className="btn-secondary" onClick={startWalkthrough} style={{ padding: '0.4rem 1rem' }}>
            {t('walkthrough.replay_button')}
          </button>
        </div>
        <BiometricLockToggle />
      </div>

      {/* Data Management */}
      <div className="glass-card animate-fade-up" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
        <div className="section-label">{t('profile.data_backup')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <button onClick={handleExport} disabled={!!exportBusy || importBusy} className="btn-secondary" style={{ width: '100%', padding: '1rem' }}>
            {exportBusy === 'json' ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={18} />} {t('profile.export_json')}
          </button>
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} style={{ display: 'none' }} />
          <button onClick={() => fileInputRef.current?.click()} disabled={!!exportBusy || importBusy}
            style={{
              width: '100%', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 'var(--radius-md)',
              color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
            }}>
            {importBusy ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={18} />} {t('profile.import_json')}
          </button>

          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{t('profile.csv_hint')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            {([
              ['workouts', t('profile.csv_workouts')],
              ['nutrition', t('profile.csv_nutrition')],
              ['measurements', t('profile.csv_measurements')],
              ['weight', t('profile.csv_weight')],
            ] as const).map(([kind, label]) => (
              <button key={kind} onClick={() => handleExportCSV(kind)} disabled={!!exportBusy || importBusy}
                style={{
                  padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.15)', borderRadius: 8,
                  color: 'var(--cyan)', fontSize: '0.72rem', fontWeight: 600,
                }}>
                {exportBusy === kind ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={13} />} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

export default Profile;