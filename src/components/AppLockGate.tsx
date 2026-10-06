import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Fingerprint, Lock } from 'lucide-react';
import { useAppLockStore } from '../store/useAppLockStore';
import { useT } from '../hooks/useT';

const AppLockGate = ({ children }: { children: React.ReactNode }) => {
  const t = useT();
  const enabled = useAppLockStore(s => s.enabled);
  const isNative = Capacitor.isNativePlatform();
  // Locked by default whenever the feature is on — the very first render
  // after a cold start (or a resume) must always require authentication.
  const [unlocked, setUnlocked] = useState(!enabled || !isNative);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef(false);

  const attemptUnlock = async () => {
    if (!isNative) { setUnlocked(true); return; }
    setAuthenticating(true);
    setError(null);
    try {
      const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
      await BiometricAuth.authenticate({
        reason: t('lock.reason'),
        cancelTitle: t('common.cancel'),
        allowDeviceCredential: true,
        androidTitle: t('lock.android_title'),
        androidSubtitle: t('lock.android_subtitle'),
      });
      setUnlocked(true);
    } catch (err) {
      // userCancel / systemCancel just means they dismissed the prompt —
      // no need to show a scary error or count it as a failure for that.
      const code = (err as { code?: string })?.code;
      if (code === 'userCancel' || code === 'appCancel') {
        setAuthenticating(false);
        return;
      }
      setError(t('lock.failed'));
    } finally {
      setAuthenticating(false);
    }
  };

  // Prompt automatically once, right after the app becomes locked.
  useEffect(() => {
    if (enabled && isNative && !unlocked && !attemptedRef.current) {
      attemptedRef.current = true;
      attemptUnlock();
    }
    if (unlocked) { attemptedRef.current = false; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isNative, unlocked]);

  // Re-lock whenever the app is backgrounded, so returning to it always
  // requires a fresh biometric check.
  useEffect(() => {
    if (!enabled || !isNative) return;
    const listener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) setUnlocked(false);
    });
    return () => { listener.then(l => l.remove()); };
  }, [enabled, isNative]);

  if (!enabled || !isNative) return <><div inert={!unlocked}>{children}</div></>;

  return (
    <>
      {/* Children stay mounted at all times — locking must never unmount the
          app tree, or every page's local component state (open modals, an
          in-progress form, the walkthrough's current step, a running workout
          timer, etc.) would reset on every background/foreground cycle. The
          lock screen is an opaque overlay on top, not a replacement — and its
          z-index (10001) is deliberately above every other overlay in the app
          (Walkthrough uses 10000) so the lock screen always wins if the app
          is backgrounded while something else is open. */}
      {children}
      {!unlocked && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10001,
          background: 'var(--bg-base, #0a0e1a)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: '1.25rem', padding: '2rem', textAlign: 'center',
        }}>
          <div style={{
            width: 84, height: 84, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--cyan), var(--magenta))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-cyan)',
          }}>
            <Lock size={36} color="#000" />
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.4rem' }}>
              {t('lock.title')}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{t('lock.subtitle')}</div>
          </div>
          {error && <div style={{ fontSize: '0.75rem', color: 'var(--magenta)' }}>{error}</div>}
          <button
            onClick={attemptUnlock}
            disabled={authenticating}
            className="btn-primary"
            style={{ padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Fingerprint size={18} />
            {authenticating ? t('common.loading') : t('lock.unlock_button')}
          </button>

        </div>
      )}
    </>
  );
};

export default AppLockGate;
