import { useEffect, useState, type ReactNode } from 'react';
import { migrateLegacyData } from '../db/legacyMigration';
import { loadAllUserData } from '../store/sessionLoader';
import { useLanguageStore } from '../store/useLanguageStore';
import { useAppLockStore } from '../store/useAppLockStore';
import { migrateRecipeFoods } from '../food/migrateRecipes';
export function MigrationGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false), [error, setError] = useState(false), [attempt, setAttempt] = useState(0);
  const ar = useLanguageStore(s => s.lang === 'ar');
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await Promise.all([useAppLockStore.persist.rehydrate(), useLanguageStore.persist.rehydrate()]);
        await migrateLegacyData();
        await migrateRecipeFoods();
        const id = localStorage.getItem('omni_active_user');
        if (id) await loadAllUserData(id);
        if (alive) setReady(true);
      } catch { if (alive) setError(true); }
    })();
    return () => { alive = false; };
  }, [attempt]);
  if (!ready) return <div className="page" role="status"><h1>OmniBody</h1><p>{error ? (ar ? 'تعذر فتح بياناتك. بياناتك القديمة محفوظة.' : 'Could not open your data. Your original data is preserved.') : (ar ? 'جاري فتح سجلك…' : 'Opening your journal…')}</p>{error && <button className="btn-primary" onClick={() => { setError(false); setAttempt(n => n + 1); }}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>}</div>;
  return children;
}
