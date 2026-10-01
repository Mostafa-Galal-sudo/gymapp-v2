import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Salad, User, ChartNoAxesCombined } from 'lucide-react';
import styles from './MainLayout.module.css';
import { useT } from '../../hooks/useT';
import { OfflineStatus } from '../OfflineStatus';
import { useLanguageStore } from '../../store/useLanguageStore';
import { ModelPreloader } from '../ModelPreloader';

const MainLayout = () => {
  const t = useT();
  const ar = useLanguageStore(s=>s.lang)==='ar';
  const NAV = [
    { to: '/dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard, walkId: undefined },
    { to: '/workout',   labelKey: 'nav.workout',   Icon: Dumbbell,        walkId: 'nav-workout' },
    { to: '/nutrition', labelKey: 'nav.nutrition', Icon: Salad,           walkId: 'nav-nutrition' },
    { to: '/insights', labelKey: 'nav.calendar', Icon: ChartNoAxesCombined, walkId: undefined },
    { to: '/profile',   labelKey: 'nav.profile',   Icon: User,            walkId: 'nav-profile' },
  ] as const;

  return (
    <div className={styles.layout}>
      <OfflineStatus />
      <ModelPreloader />
      <main className={styles.main}>
        <Outlet />
      </main>

      <nav className={styles.nav}>
        {NAV.map(({ to, labelKey, Icon, walkId }) => (
          <NavLink
            key={to}
            to={to}
            data-walkthrough={walkId}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
          >
            <span className={styles.navIcon}>
              <Icon size={22} strokeWidth={2} />
            </span>
            {to === '/insights' ? (ar ? 'التحليلات' : 'Insights') : t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default MainLayout;
