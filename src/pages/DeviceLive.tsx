import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useDeviceStore, HR_ZONES } from '../store/useDeviceStore';
import { Heart, Wifi, WifiOff, StopCircle, Play, Activity } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine
} from 'recharts';
import { useT } from '../hooks/useT';

// Colors and min/max ranges come from useDeviceStore's HR_ZONES (single
// source of truth) — display labels are translated via useT() below.
const ZONE_COLORS = HR_ZONES.map(z => z.color);
const ZONE_KEYS = ['device.zone_rest', 'device.zone_fatburn', 'device.zone_cardio', 'device.zone_peak'] as const;
const ZONE_RANGES = HR_ZONES.map(z => [z.min, z.max]);

const getZone = (hr: number) => {
  for (let i = ZONE_RANGES.length - 1; i >= 0; i--) {
    if (hr >= ZONE_RANGES[i][0]) return i;
  }
  return 0;
};

const SessionSummaryModal = ({ session, onClose }: any) => {
  const t = useT();
  const ZONE_NAMES = ZONE_KEYS.map(k => t(k as any));
  const content = (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(2,4,8,0.92)', backdropFilter: 'blur(16px)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '1.5rem', animation: 'fadeIn 0.3s ease'
    }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 440, padding: '2rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700 }}>
            {t('device.session_summary')}
          </h2>
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {session.deviceName} · {Math.floor(session.duration / 60)}{t('device.min_short')} {session.duration % 60}{t('device.sec_short')}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { label: t('device.avg_hr'), val: session.avgHR, unit: 'bpm', color: 'var(--cyan)' },
            { label: t('device.max_hr'), val: session.maxHR, unit: 'bpm', color: 'var(--magenta)' },
            { label: t('device.min_hr'), val: session.minHR, unit: 'bpm', color: 'var(--gold)' },
          ].map(({ label, val, unit, color }) => (
            <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '1rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.6rem', fontWeight: 700, color }}>{val}</div>
              <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.2rem' }}>{label}</div>
              <div style={{ fontSize: '0.65rem', color }}>{unit}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('device.time_in_zone')}</div>
          {session.zones.filter((z: any) => z.minutes > 0).map((zone: any, i: number) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: zone.color }} />
                <span style={{ fontSize: '0.85rem' }}>{ZONE_NAMES[ZONE_RANGES.findIndex(r => r[0] === zone.min)] || zone.name}</span>
              </div>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: zone.color }}>{zone.minutes.toFixed(1)} {t('device.minutes_unit')}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: '0.75rem', background: 'rgba(0,240,255,0.05)', borderRadius: '8px', fontSize: '0.8rem', color: 'var(--cyan)', textAlign: 'center', marginBottom: '1.5rem' }}>
          ✅ {t('device.session_saved')}
        </div>

        <button onClick={onClose} className="btn-primary" style={{ width: '100%', padding: '1rem' }}>
          {t('common.close')}
        </button>
      </div>
    </div>
  );
  return createPortal(content, document.body);
};

const DeviceLive = () => {
  const t = useT();
  const navigate = useNavigate();
  const ZONE_NAMES = ZONE_KEYS.map(k => t(k as any));
  const {
    isConnected, deviceName, currentHR,
    sessionActive, liveHRData,
    startSession, endSession, setDisconnected
  } = useDeviceStore();

  const [elapsed, setElapsed] = useState(0);
  const [finishedSession, setFinishedSession] = useState<any>(null);
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isConnected) navigate('/profile');
  }, [isConnected, navigate]);

  useEffect(() => {
    if (sessionActive) {
      intervalRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [sessionActive]);

  useEffect(() => {
    return () => { clearInterval(intervalRef.current); };
  }, []);

  const handleEndSession = () => {
    const session = endSession();
    if (session) setFinishedSession(session);
  };

  const handleDisconnect = () => {
    setDisconnected();
    navigate('/profile');
  };

  const zoneIdx = currentHR ? getZone(currentHR) : 0;
  const zoneColor = ZONE_COLORS[zoneIdx];
  const zoneName = ZONE_NAMES[zoneIdx];

  const chartData = liveHRData.slice(-60).map(d => ({
    t: `${Math.floor(d.time / 60)}:${(d.time % 60).toString().padStart(2, '0')}`,
    hr: d.hr
  }));

  const formatTime = (s: number) =>
    `${Math.floor(s / 3600).toString().padStart(2, '0')}:${Math.floor((s % 3600) / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="page" style={{ padding: '1rem 1rem 7rem' }}>
      {finishedSession && (
        <SessionSummaryModal
          session={finishedSession}
          onClose={() => { setFinishedSession(null); navigate('/profile'); }}
        />
      )}

      <header style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="section-label">{t('device.garmin_bluetooth')}</div>
          <h1 className="display" style={{ fontSize: '1.8rem' }}>
            <span className="neon-cyan">Live</span> {t('device.heart_rate')}
          </h1>
        </div>
        <button onClick={handleDisconnect} style={{ color: 'var(--magenta)', padding: '0.5rem', background: 'rgba(255,0,85,0.1)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem' }}>
          <WifiOff size={16} /> {t('device.disconnect')}
        </button>
      </header>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--cyan)', fontSize: '0.85rem' }}>
        <Wifi size={14} />
        <span>{deviceName}</span>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
      </div>

      <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem', textAlign: 'center', border: `1px solid ${zoneColor}40`, boxShadow: `0 0 30px ${zoneColor}20` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Heart size={28} fill={zoneColor} color={zoneColor} style={{ animation: currentHR ? 'heartbeat 0.8s ease infinite' : 'none' }} />
          <span style={{ fontSize: '0.75rem', color: zoneColor, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{zoneName}</span>
        </div>

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '5rem', fontWeight: 900, color: zoneColor, lineHeight: 1, filter: `drop-shadow(0 0 20px ${zoneColor})`, transition: 'color 0.5s' }}>
          {currentHR ?? '--'}
        </div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{t('device.bpm_label')}</div>

        {/* Zone Bars — _ because value unused here */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '1.5rem' }}>
          {ZONE_NAMES.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              background: i <= zoneIdx ? ZONE_COLORS[i] : 'rgba(255,255,255,0.08)',
              transition: 'background 0.5s',
              boxShadow: i === zoneIdx ? `0 0 8px ${ZONE_COLORS[i]}` : 'none'
            }} />
          ))}
        </div>
        {/* Zone Labels — name used here */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem', marginTop: '0.3rem' }}>
          {ZONE_NAMES.map((name, i) => (
            <div key={i} style={{ fontSize: '0.55rem', color: i === zoneIdx ? ZONE_COLORS[i] : 'var(--color-text-muted)', textAlign: 'center' }}>{name}</div>
          ))}
        </div>
      </div>

      {chartData.length > 1 && (
        <div className="glass-card" style={{ padding: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Activity size={14} /> {t('device.last_minute')}
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={chartData}>
              <XAxis dataKey="t" tick={false} axisLine={false} tickLine={false} />
              <YAxis domain={[40, 220]} hide />
              <Tooltip
                contentStyle={{ background: 'rgba(6,9,15,0.95)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 8, fontSize: '0.8rem' }}
                formatter={(v: any) => [`${v} bpm`, 'HR']}
              />
              <ReferenceLine y={130} stroke="rgba(251,191,36,0.3)" strokeDasharray="4 4" />
              <ReferenceLine y={160} stroke="rgba(248,113,113,0.3)" strokeDasharray="4 4" />
              <Line type="monotone" dataKey="hr" stroke={zoneColor} strokeWidth={2} dot={false} style={{ filter: `drop-shadow(0 0 4px ${zoneColor})` }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{t('device.session_duration')}</div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2rem', fontWeight: 700, color: 'var(--cyan)' }}>
            {formatTime(elapsed)}
          </div>
        </div>
        {!sessionActive ? (
          <button onClick={() => { startSession(); setElapsed(0); }} className="btn-primary" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Play size={18} /> {t('device.start_session')}
          </button>
        ) : (
          <button onClick={handleEndSession} style={{ padding: '0.75rem 1.5rem', background: 'var(--magenta)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-heading)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <StopCircle size={18} /> {t('device.end_session')}
          </button>
        )}
      </div>

      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15% { transform: scale(1.25); }
          30% { transform: scale(1); }
          45% { transform: scale(1.15); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
};

export default DeviceLive;