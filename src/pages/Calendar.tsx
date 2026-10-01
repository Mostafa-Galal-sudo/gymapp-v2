import type { DeviceSession } from '../store/useDeviceStore';
import type { WorkoutSession, ScheduledSession } from '../store/useWorkoutStore';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { useExerciseStore } from '../store/useExerciseStore';
import { useDeviceStore } from '../store/useDeviceStore';
import { useNutritionStore } from '../store/useNutritionStore';
import { startOfDay } from 'date-fns';
import { useT } from '../hooks/useT';
import { ChevronLeft, ChevronRight, Plus, X, Calendar as CalendarIcon, CheckCircle2, HeartPulse, Utensils, Activity } from 'lucide-react';

const CalendarPage = () => {
  const t = useT();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  const history = useWorkoutStore(s => s.history);
  const scheduledSessions = useWorkoutStore(s => s.scheduledSessions);
  const scheduleSession = useWorkoutStore(s => s.scheduleSession);
  const removeScheduledSession = useWorkoutStore(s => s.removeScheduledSession);
  const getAllTemplates = useExerciseStore(s => s.getAllTemplates);
  const deviceSessions = useDeviceStore(s => s.sessions);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatDateString = (d: Date) => {
    const y = d.getFullYear();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const getDayStatus = (d: Date) => {
    const dStr = formatDateString(d);
    const completed = history.filter(h => formatDateString(new Date(h.date)) === dStr);
    const scheduled = scheduledSessions.filter(s => s.date === dStr);
    const deviceDay = deviceSessions.filter(s => formatDateString(new Date(s.date)) === dStr);
    return { completed, scheduled, deviceSessions: deviceDay };
  };

  const handleDayClick = (day: number) => {
    setSelectedDate(new Date(year, month, day));
    setShowModal(true);
  };

  const renderDays = () => {
    const days = [];
    const todayStr = formatDateString(new Date());
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} style={{ opacity: 0.1 }} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dStr = formatDateString(d);
      const isToday = dStr === todayStr;
      const { completed, scheduled, deviceSessions: deviceDay } = getDayStatus(d);
      const hasCompleted = completed.length > 0;
      const hasScheduled = scheduled.length > 0;
      const hasDevice = deviceDay.length > 0;
      days.push(
        <div key={day} onClick={() => handleDayClick(day)}
          style={{
            aspectRatio: '1',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: isToday ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.02)',
            border: isToday ? '1px solid var(--cyan)' : '1px solid rgba(255,255,255,0.05)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer', position: 'relative',
            color: hasCompleted ? 'var(--cyan)' : 'var(--color-text)',
          }}
        >
          <span style={{ fontSize: '1rem', fontWeight: 600 }}>{day}</span>
          <div style={{ display: 'flex', gap: 3, position: 'absolute', bottom: '5px' }}>
            {hasCompleted && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--cyan)' }} />}
            {hasDevice && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--magenta)' }} />}
            {hasScheduled && !hasCompleted && <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--gold)' }} />}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <>
      <div className="page" style={{ padding: '1rem 1rem 7rem' }}>
        <header style={{ marginBottom: '2rem' }}>
          <div className="section-label">{t('nav.calendar')}</div>
          <h1 className="display" style={{ fontSize: '2.5rem' }}>{t('nav.calendar')}</h1>
        </header>

        <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button onClick={prevMonth} className="btn-secondary" style={{ padding: '0.5rem' }}><ChevronLeft size={20} /></button>
            <h2 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 700, margin: 0 }}>{monthNames[month]} {year}</h2>
            <button onClick={nextMonth} className="btn-secondary" style={{ padding: '0.5rem' }}><ChevronRight size={20} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.5rem', marginBottom: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '0.5rem' }}>
            {renderDays()}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--color-text-muted)', flexWrap: 'wrap' }}>
          {[['var(--cyan)', t('calendar.legend_completed')], ['var(--magenta)', t('calendar.legend_garmin')], ['var(--gold)', t('calendar.legend_scheduled')]].map(([bg, label]) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: bg }} />{label}
            </div>
          ))}
        </div>
      </div>

      {showModal && selectedDate && (
        <DayModal
          date={selectedDate}
          onClose={() => setShowModal(false)}
          dayStatus={getDayStatus(selectedDate)}
          scheduleSession={scheduleSession}
          removeScheduledSession={removeScheduledSession}
          templates={getAllTemplates()}
        />
      )}
    </>
  );
};

// ── Device Session Card ───────────────────────────────────────────────────────
const DeviceSessionCard = ({ session }: { session: DeviceSession }) => {
  const t = useT();
  const zonesWithTime = session.zones?.filter((z) => z.minutes > 0) ?? [];
  return (
    <div style={{ background: 'rgba(255,0,85,0.05)', border: '1px solid rgba(255,0,85,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--magenta)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <HeartPulse size={16} /> {session.deviceName}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{Math.floor(session.duration/60)}{t('device.min_short')} {session.duration%60}{t('device.sec_short')}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: zonesWithTime.length ? '0.75rem' : 0 }}>
        {[{ label: t('device.avg_hr'), val: session.avgHR, color:'var(--cyan)' },{ label: t('device.max_hr'), val: session.maxHR, color:'var(--magenta)' },{ label: t('device.min_hr'), val: session.minHR, color:'var(--gold)' }].map(({ label, val, color }) => (
          <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', padding: '0.4rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)' }}>{label} · bpm</div>
          </div>
        ))}
      </div>
      {zonesWithTime.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {zonesWithTime.map((z, i: number) => (
            <div key={i} style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '999px', background: `${z.color}20`, color: z.color, border: `1px solid ${z.color}40` }}>
              {z.name} · {z.minutes.toFixed(1)}{t('device.min_short')}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
import { useUserStore } from '../store/useUserStore';

// ── Day Modal (3 tabs: Workouts | Nutrition | Health) ─────────────────────────
const DayModal = ({ date, onClose, dayStatus, scheduleSession, removeScheduledSession, templates }: {date:Date;onClose:()=>void;dayStatus:{completed:WorkoutSession[];scheduled:ScheduledSession[];deviceSessions:DeviceSession[]};scheduleSession:(date:string,type:string,ids:string[])=>void;removeScheduledSession:(id:string)=>void;templates:Record<string,string[]>}) => {
  const t = useT();
  const [view, setView] = useState<'list' | 'add'>('list');
  const [activeTab, setActiveTab] = useState<'workouts' | 'nutrition' | 'health'>('workouts');
  const dStr = `${date.getFullYear()}-${(date.getMonth()+1).toString().padStart(2,'0')}-${date.getDate().toString().padStart(2,'0')}`;

  const getLogForDate = useNutritionStore(s => s.getLogForDate);
  const getTargets = useNutritionStore(s => s.getTargets);
  const profile = useUserStore(s => s.profile);
  const nutritionLog = getLogForDate(startOfDay(date).getTime());
  const targets = getTargets(profile.weight);

  let totalCal = 0, totalPro = 0, totalCarbs = 0, totalFats = 0;
  nutritionLog.meals.forEach(m => m.foods.forEach(f => {
    totalCal += f.calories; totalPro += f.protein; totalCarbs += f.carbs; totalFats += f.fats;
  }));

  const hasAnything = dayStatus.completed.length > 0 || dayStatus.scheduled.length > 0 || dayStatus.deviceSessions.length > 0;

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(2,4,8,0.85)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', animation: 'fadeIn 0.2s ease' }}>
      <div style={{ background: 'var(--bg-card)', borderTop: '1px solid rgba(0,240,255,0.1)', padding: '1.5rem', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', color: 'var(--color-text-muted)' }}><X size={20} /></button>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'var(--font-heading)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <CalendarIcon size={22} className="neon-cyan" />
          {date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </h3>

        {/* Tab Bar */}
        <div className="tab-bar" style={{ marginBottom: '1.25rem' }}>
          <button className={`tab-btn ${activeTab === 'workouts' ? 'active' : ''}`} onClick={() => setActiveTab('workouts')}>
            <Activity size={14} style={{ display: 'inline', marginInlineEnd: 4, verticalAlign: 'middle' }} />Workouts
          </button>
          <button className={`tab-btn ${activeTab === 'nutrition' ? 'active' : ''}`} onClick={() => setActiveTab('nutrition')}>
            <Utensils size={14} style={{ display: 'inline', marginInlineEnd: 4, verticalAlign: 'middle' }} />Nutrition
          </button>
          <button className={`tab-btn ${activeTab === 'health' ? 'active' : ''}`} onClick={() => setActiveTab('health')}>
            <HeartPulse size={14} style={{ display: 'inline', marginInlineEnd: 4, verticalAlign: 'middle' }} />Health
          </button>
        </div>

        {/* ── Workouts Tab ── */}
        {activeTab === 'workouts' && (
          <>
            {view === 'list' ? (
              <>
                {!hasAnything && (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                    {t('calendar.no_plans') || 'No workouts planned.'}
                  </div>
                )}
                {dayStatus.completed.map((session) => (
                  <div key={session.sessionId} style={{ background: 'rgba(0,240,255,0.05)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div style={{ fontWeight: 600, color: 'var(--cyan)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CheckCircle2 size={16} /> {session.type}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{session.exercises.length} ex · {session.totalVolume}kg</div>
                    </div>
                    {session.exercises.map((ex) => (
                      <div key={ex.exerciseId} style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', borderTop: '1px solid rgba(0,240,255,0.06)', paddingTop: '0.4rem', marginTop: '0.4rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{ex.exerciseId}</span>
                        {' '}{ex.sets.filter((s) => s.completed).length}/{ex.sets.length} sets
                      </div>
                    ))}
                  </div>
                ))}
                {dayStatus.scheduled.map((session) => (
                  <div key={session.id} style={{ background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'var(--gold)' }}>{session.type}</div>
                      <button onClick={() => removeScheduledSession(session.id)} style={{ color: 'var(--magenta)', fontSize: '0.8rem' }}>Remove</button>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>{session.exerciseIds.length} Exercises</div>
                  </div>
                ))}
                <button onClick={() => setView('add')} className="btn-primary" style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>
                  <Plus size={18} style={{ marginRight: '8px' }} />{t('calendar.schedule_workout') || 'Schedule Workout'}
                </button>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1.5rem', fontWeight: 600 }}>Select a template:</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(templates).map(([name, ids]) => (
                    <button key={name} onClick={() => { scheduleSession(dStr, name, ids); setView('list'); }}
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600 }}>{name}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{ids.length} exercises</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => setView('list')} className="btn-secondary" style={{ width: '100%', padding: '1rem', marginTop: '1rem' }}>{t('common.cancel')}</button>
              </>
            )}
          </>
        )}

        {/* ── Nutrition Tab ── */}
        {activeTab === 'nutrition' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
              {[
                { label: 'Calories', val: Math.round(totalCal), target: targets.calories, color: 'var(--cyan)', unit: 'kcal' },
                { label: 'Protein',  val: Math.round(totalPro),   target: targets.protein,  color: 'var(--color-success)', unit: 'g' },
                { label: 'Carbs',   val: Math.round(totalCarbs),  target: targets.carbs,    color: 'var(--color-warning)', unit: 'g' },
                { label: 'Fats',    val: Math.round(totalFats),   target: targets.fats,     color: 'var(--magenta)',       unit: 'g' },
              ].map(({ label, val, target, color, unit }) => (
                <div key={label} style={{ textAlign: 'center', background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '0.6rem 0.25rem' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: 700, color, lineHeight: 1 }}>{val}</div>
                  <div style={{ fontSize: '0.48rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>/{target}{unit}</div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--color-text-muted)', marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,240,255,0.04)', borderRadius: 10, padding: '0.6rem 1rem', marginBottom: '1rem', border: '1px solid rgba(0,240,255,0.1)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--cyan)' }}>💧 Water</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)' }}>{nutritionLog.waterMl}ml <span style={{ opacity: 0.5 }}>/ {targets.water}ml</span></span>
            </div>
            {nutritionLog.meals.every(m => m.foods.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No food logged for this day.</div>
            ) : nutritionLog.meals.map(meal => {
              if (meal.foods.length === 0) return null;
              return (
                <div key={meal.id} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>{meal.type}</div>
                  {meal.foods.map((food, fi) => (
                    <div key={fi} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem' }}>
                      <span>{food.nameAr || food.name} <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem' }}>({food.amount}{food.unit})</span></span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--cyan)', fontSize: '0.75rem' }}>{food.calories}kcal</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* ── Health Tab ── */}
        {activeTab === 'health' && (
          <>
            {dayStatus.deviceSessions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No wearable data for this day.</div>
            ) : dayStatus.deviceSessions.map((session) => (
              <DeviceSessionCard key={session.id} session={session} />
            ))}
          </>
        )}
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default CalendarPage;
