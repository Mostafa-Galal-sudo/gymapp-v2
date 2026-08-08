import { useState } from 'react';

const AVAILABLE_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5];

export const PlateCalculator = () => {
  const [targetWeight, setTargetWeight] = useState(100);
  const [barWeight, setBarWeight] = useState(20);
  const [includeCollars, setIncludeCollars] = useState(true);

  // Collars are usually 2.5kg each
  const totalBarWeight = barWeight + (includeCollars ? 5 : 0);
  const weightForPlates = Math.max(0, targetWeight - totalBarWeight);
  const weightPerSide = weightForPlates / 2;

  let remaining = weightPerSide;
  const platesPerSide: number[] = [];

  for (const plate of AVAILABLE_PLATES) {
    while (remaining >= plate) {
      platesPerSide.push(plate);
      remaining -= plate;
      // Handle floating point imprecision
      remaining = Math.round(remaining * 100) / 100;
    }
  }

  const achievableWeight = totalBarWeight + (platesPerSide.reduce((a, b) => a + b, 0) * 2);

  return (
    <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
      <div className="section-label">Plate Calculator</div>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Target Weight (kg)</label>
          <input type="number" value={targetWeight} onChange={e => setTargetWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }} />
        </div>
        <div>
          <label style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.2rem' }}>Bar Weight (kg)</label>
          <input type="number" value={barWeight} onChange={e => setBarWeight(parseFloat(e.target.value) || 0)} style={{ width: '100%', fontSize: '1.2rem', fontFamily: 'var(--font-mono)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.85rem' }}>
        <input type="checkbox" checked={includeCollars} onChange={e => setIncludeCollars(e.target.checked)} style={{ width: 'auto' }} />
        <label>Include Collars (5kg pair)</label>
      </div>

      {achievableWeight !== targetWeight && (
        <div className="alert-warning" style={{ marginBottom: '1rem', fontSize: '0.8rem' }}>
          Exact weight not possible with standard plates. Nearest achievable: {achievableWeight}kg
        </div>
      )}

      <div style={{ background: 'rgba(0,240,255,0.04)', borderRadius: 'var(--radius-md)', padding: '1.5rem', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 120 }}>
        {platesPerSide.length === 0 ? (
          <span style={{ color: 'var(--color-text-muted)' }}>Bar only</span>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
            {/* Bar sleeve */}
            <div style={{ width: 40, height: 20, background: 'linear-gradient(to bottom, #888, #ccc, #888)', borderRadius: '0 4px 4px 0', borderRight: '2px solid #555' }} />
            {/* Plates */}
            {platesPerSide.map((p, i) => {
              const height = p >= 20 ? 100 : p >= 10 ? 80 : p >= 5 ? 60 : 40;
              const width = p >= 25 ? 24 : p >= 15 ? 20 : p >= 5 ? 16 : 10;
              const color = p === 25 ? '#ef4444' : p === 20 ? '#3b82f6' : p === 15 ? '#eab308' : p === 10 ? '#22c55e' : '#334155';
              return (
                <div key={i} style={{ 
                  width, height, background: color, borderRadius: 4, 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: p >= 10 ? '#fff' : 'transparent', fontSize: '0.6rem', fontFamily: 'var(--font-mono)',
                  boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5), -2px 0 5px rgba(0,0,0,0.3)',
                  writingMode: 'vertical-rl', transform: 'rotate(180deg)'
                }}>
                  {p}
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {platesPerSide.length > 0 && (
        <div style={{ textAlign: 'center', marginTop: '1rem', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          Plates per side: {platesPerSide.join(', ')} kg
        </div>
      )}
    </div>
  );
};
