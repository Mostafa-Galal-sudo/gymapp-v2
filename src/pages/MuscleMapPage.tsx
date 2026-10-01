import type { TranslationKey } from '../i18n/translations';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, Play, ChevronRight } from 'lucide-react';
import { MuscleMap3D } from '../components/MuscleMap3D';
import { useWorkoutStore } from '../store/useWorkoutStore';
import { EXERCISE_DATABASE } from '../data/exercises';
import { useT } from '../hooks/useT';

const MuscleMapPage = () => {
  const t = useT();
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const navigate = useNavigate();

  // Returns every muscleGroup tag relevant to a clicked 3D mesh — some
  // meshes should surface exercises from more than one specific tag
  // (e.g. clicking "brachialis" should show both 'Biceps' and 'Brachialis'
  // tagged exercises, not just the generic one).
  const mapMuscleToGroups = (m: string): string[] => {
    if (m.includes('chest')) return ['Chest'];
    if (m === 'shoulders_rear') return ['Rear Delts', 'Shoulders'];
    if (m.includes('shoulder')) return ['Shoulders'];
    if (m === 'abs' || m === 'obliques') return ['Core'];
    if (m.includes('back') || m === 'lats' || m === 'traps') return ['Back'];
    if (m === 'brachialis') return ['Brachialis', 'Biceps'];
    if (m === 'biceps') return ['Biceps'];
    if (m === 'triceps') return ['Triceps'];
    if (m === 'forearms') return ['Forearms'];
    if (m === 'quads' || m === 'adductors') return ['Quads'];
    if (m === 'hamstrings') return ['Hamstrings'];
    if (m === 'glutes') return ['Glutes'];
    if (m === 'calves') return ['Calves'];
    return [];
  };

  const filteredExercises = selectedMuscle 
    ? EXERCISE_DATABASE.filter(e => mapMuscleToGroups(selectedMuscle).includes(e.muscleGroup))
    : [];

  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', padding: 0, animation: 'fadeUp 0.4s ease-out' }}>
      {/* Header */}
      <header style={{ padding: '1.5rem 1.5rem 0', display: 'flex', alignItems: 'center', gap: '1rem', zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '50%', border: '1px solid rgba(0,240,255,0.2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ArrowLeft size={20} color="var(--cyan)" />
        </button>
        <div>
          <h1 className="display" style={{ fontSize: '1.5rem', margin: 0 }}>{t('muscle.title')}</h1>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{t('muscle.subtitle')}</div>
        </div>
      </header>

      {/* 3D Map Container - Takes remaining height */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <MuscleMap3D onMuscleClick={setSelectedMuscle} />
      </div>

      {/* Exercise Modal */}
      {selectedMuscle && (
        <div 
          onClick={() => setSelectedMuscle(null)} 
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
        >
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '400px', maxHeight: '80vh', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 700, textTransform: 'capitalize', color: 'var(--cyan)' }}>
                {t(`muscle.${selectedMuscle}` as TranslationKey, selectedMuscle.replace('_', ' '))} {t('muscle.exercises')}
              </h3>
              <button onClick={() => setSelectedMuscle(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            
            {filteredExercises.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <button 
                  onClick={() => {
                    const store = useWorkoutStore.getState();
                    store.startSession(`${selectedMuscle.replace('_', ' ')} Routine`, filteredExercises.slice(0, 5).map(e => e.id));
                    navigate('/workout');
                  }}
                  className="btn-primary"
                  style={{ marginBottom: '0.5rem', padding: '0.5rem', fontSize: '0.85rem' }}
                >
                  <Play size={14} style={{ display: 'inline', marginRight: '4px' }} />
                  {t('muscle.start_routine')}
                </button>
                {filteredExercises.map(ex => (
                  <div 
                    key={ex.id} 
                    onClick={() => {
                      useWorkoutStore.getState().startSession(ex.name, [ex.id]);
                      navigate('/workout');
                    }}
                    style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.05)', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', transition: 'background 0.2s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{ex.name}</div>
                      <ChevronRight size={16} color="var(--cyan)" />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                      {ex.category} • {ex.muscleGroup}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                {t('muscle.no_exercises')}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MuscleMapPage;
