import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { useLanguageStore } from './store/useLanguageStore';
import { useUserStore } from './store/useUserStore';
import { useOnboardingStore } from './store/useOnboardingStore';
import { loadAllUserData } from './store/sessionLoader';
import MainLayout from './components/layout/MainLayout';
import { MigrationGate } from './components/MigrationGate';
import Walkthrough from './components/Walkthrough';

import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Workout from './pages/Workout';
import Nutrition from './pages/Nutrition';
import Profile from './pages/Profile';
import CalendarPage from './pages/Calendar';
import DeviceLive from './pages/DeviceLive';
import MuscleMapPage from './pages/MuscleMapPage';
import ProgressPage from './pages/Progress';

function AppRouter() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const backListener = CapacitorApp.addListener('backButton', () => {
      // Allow back navigation to Dashboard, otherwise exit
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
    <Routes>
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="workout" element={<Workout />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="nutrition" element={<Nutrition />} />
        <Route path="profile" element={<Profile />} />
        <Route path="muscles" element={<MuscleMapPage />} />
        <Route path="device-live" element={<DeviceLive />} />
        <Route path="progress" element={<ProgressPage />} />
      </Route>
    </Routes>
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
    const storedId = localStorage.getItem('omni_active_user');
    if (storedId) {
      // Hydrates the user profile AND every secondary store (workouts,
      // nutrition, gamification, exercises). Previously this called
      // loadUser() alone, so auto-login left workouts/nutrition/XP/badges/
      // custom exercises empty until the user manually logged out and back in.
      loadAllUserData(storedId);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || hasSeenWalkthrough) return;
    // Small delay so MainLayout (and its bottom nav) has actually mounted
    // before the walkthrough looks for its target elements.
    const timer = setTimeout(() => startWalkthrough(), 600);
    return () => clearTimeout(timer);
  }, [isAuthenticated, hasSeenWalkthrough, startWalkthrough]);

  return (
    <MigrationGate>
      {!isAuthenticated ? (
        <div style={{ position: 'relative', minHeight: '100vh', background: 'var(--bg-base)' }}>
          <Auth />
        </div>
      ) : (
        <BrowserRouter>
          <AppRouter />
          <Walkthrough />
        </BrowserRouter>
      )}
    </MigrationGate>
  );
}

export default App;