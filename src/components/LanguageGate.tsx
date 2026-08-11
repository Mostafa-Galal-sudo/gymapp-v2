import { useLanguageStore } from '../store/useLanguageStore';

const LanguageGate = ({ children }: { children: React.ReactNode }) => {
  const hasSelectedLanguage = useLanguageStore(s => s.hasSelectedLanguage);
  const selectLanguage = useLanguageStore(s => s.selectLanguage);

  if (hasSelectedLanguage) return <>{children}</>;

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)', padding: '2rem', gap: '3rem', textAlign: 'center',
    }}>
      <div>
        <h1 className="display" style={{ fontSize: '2.5rem', letterSpacing: '0.1em' }}>
          <span className="neon-cyan">OMNI</span>BODY
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', marginTop: '0.75rem' }}>
          Choose your language · اختر لغتك
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: 340 }}>
        <button
          onClick={() => selectLanguage('en')}
          className="glass-card"
          style={{ padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', cursor: 'pointer', border: '1px solid rgba(0,240,255,0.25)' }}
        >
          English
        </button>
        <button
          onClick={() => selectLanguage('ar')}
          className="glass-card"
          style={{ padding: '1.25rem', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-heading)', cursor: 'pointer', border: '1px solid rgba(255,0,153,0.25)' }}
        >
          العربية
        </button>
      </div>
    </div>
  );
};

export default LanguageGate;
