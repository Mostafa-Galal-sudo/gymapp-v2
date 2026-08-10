import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Fingerprint, Lock, ShieldOff } from 'lucide-react';
import { useAppLockStore } from '../store/useAppLockStore';
import { useT } from '../hooks/useT';

// Error codes where retrying the same biometric prompt can never succeed —
// e.g. the user removed their fingerprint/Face ID, or the device has no
// passcode at all. Without an escape hatch here, a user who hits one of
// these after enabling the lock would be permanently locked out of the app.
const UNRECOVERABLE_CODES = new Set([
  'passcodeNotSet', 'biometryNotAvailable', 'biometryNotEnrolled', 'noDeviceCredential',
]);
const MAX_RETRY_FAILURES = 3;

const AppLockGate = ({ children }: { children: React.ReactNode }) => {
  const t = useT();
  const enabled = useAppLockStore(s => s.enabled);
  const setLockEnabled = useAppLockStore(s => s.setEnabled);
  const isNative = Capacitor.isNativePlatform();
  // Locked by default whenever the feature is on — the very first render
  // after a cold start (or a resume) must always require authentication.
  const [unlocked, setUnlocked] = useState(!enabled || !isNative);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEscapeHatch, setShowEscapeHatch] = useState(false);
  const attemptedRef = useRef(false);
  const failureCountRef = useRef(0);

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
      failureCountRef.current = 0;
      setShowEscapeHatch(false);
    } catch (err) {
      // userCancel / systemCancel just means they dismissed the prompt —
      // no need to show a scary error or count it as a failure for that.
      const code = (err as { code?: string })?.code;
      if (code === 'userCancel' || code === 'appCancel') {
        setAuthenticating(false);
        return;
      }
      setError(t('lock.failed'));
      failureCountRef.current += 1;
      if ((code && UNRECOVERABLE_CODES.has(code)) || failureCountRef.current >= MAX_RETRY_FAILURES) {
        setShowEscapeHatch(true);
      }
    } finally {
      setAuthenticating(false);
    }
  };

  const disableLockAndEnter = () => {
    setLockEnabled(false);
    setUnlocked(true);
  };

  // Prompt automatically once, right after the app becomes locked.
  useEffect(() => {
    if (enabled && isNative && !unlocked && !attemptedRef.current) {
      attemptedRef.current = true;
      attemptUnlock();
    }
    if (unlocked) { attemptedRef.current = false; failureCountRef.current = 0; }
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

  if (!enabled || !isNative || unlocked) return <>{children}</>;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
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
      {showEscapeHatch && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', maxWidth: 260 }}>{t('lock.escape_hint')}</div>
          <button
            onClick={disableLockAndEnter}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
              background: 'transparent', border: '1px solid var(--magenta)', borderRadius: 'var(--radius-md)',
              color: 'var(--magenta)', fontSize: '0.75rem', fontWeight: 600,
            }}
          >
            <ShieldOff size={14} /> {t('lock.escape_button')}
          </button>
        </div>
      )}
    </div>
  );
};

export default AppLockGate;
