import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useLanguageStore } from './store/useLanguageStore';
import { useUserStore } from './store/useUserStore';
import { useOnboardingStore } from './store/useOnboardingStore';

import MainLayout from './components/layout/MainLayout';
import { MigrationGate } from './components/MigrationGate';
import LanguageGate from './components/LanguageGate';
import AppLockGate from './components/AppLockGate';
import Walkthrough from './components/Walkthrough';

import Auth from './pages/Auth';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Workout = lazy(() => import('./pages/Workout'));
const Nutrition = lazy(() => import('./pages/Nutrition'));
const Profile = lazy(() => import('./pages/Profile'));
const CalendarPage = lazy(() => import('./pages/Calendar'));
const DeviceLive = lazy(() => import('./pages/DeviceLive'));
const MuscleMapPage = lazy(() => import('./pages/MuscleMapPage'));
const ProgressPage = lazy(() => import('./pages/Progress'));

const Today = lazy(() => import('./pages/Today'));
const Measurements = lazy(() => import('./pages/Measurements'));
const Insights = lazy(() => import('./pages/Insights'));

function AppRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      const dialog = document.querySelector('dialog[open]');
      if (dialog) { dialog.dispatchEvent(new Event('cancel', { cancelable: true })); return; }
      if (document.activeElement instanceof HTMLElement && ['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { document.activeElement.blur(); return; }
      if (location.pathname === '/dashboard' || location.pathname === '/' || location.pathname === '/auth') {
        CapacitorApp.exitApp();
      } else {
        // From any other tab, pressing back goes to dashboard
        navigate('/dashboard', { replace: true });
      }
    });

    return () => {
      backListener.then(l => l.remove());
    };
  }, [location.pathname, navigate]);

  return (
    <Suspense fallback={<div className="skeleton" role="status">Loading / جار التحميل…</div>}><Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Today />} />
        <Route path="daily-detail" element={<Dashboard />} />
        <Route path="workout" element={<Workout />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="profile" element={<Profile />} />
        <Route path="muscles" element={<MuscleMapPage />} />
        <Route path="device-live" element={<DeviceLive />} />
        <Route path="measurements" element={<Measurements />} />
        <Route path="insights" element={<Insights />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
        <Route path="progress" element={<ProgressPage />} />
      </Route>
    </Routes></Suspense>
  );
}

function App() {
  const lang = useLanguageStore(s => s.lang);
  const isAuthenticated = useUserStore(s => s.isAuthenticated);
  const hasSeenWalkthrough = useOnboardingStore(s => s.hasSeenWalkthrough);
  const startWalkthrough = useOnboardingStore(s => s.startWalkthrough);

  useEffect(() => {
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);



  useEffect(() => {
    if (!isAuthenticated || hasSeenWalkthrough) return;
    // Small delay so MainLayout (and its bottom nav) has actually mounted
    // before the walkthrough looks for its target elements.
    const timer = setTimeout(() => startWalkthrough(), 600);
    return () => clearTimeout(timer);
  }, [isAuthenticated, hasSeenWalkthrough, startWalkthrough]);

  return (
    <LanguageGate>
      <MigrationGate>
        {!isAuthenticated ? (
          <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg-base)' }}>
            <Auth />
          </div>
        ) : (
          <AppLockGate>
            <BrowserRouter>
              <AppRouter />
              <Walkthrough />
            </BrowserRouter>
          </AppLockGate>
        )}
      </MigrationGate>
    </LanguageGate>
  );
}

export default App;