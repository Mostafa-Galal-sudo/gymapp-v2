import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Dumbbell, Salad, User, Accessibility, CalendarDays } from 'lucide-react';
import styles from './MainLayout.module.css';
import { useT } from '../../hooks/useT';
import AmbientBackground from '../AmbientBackground';

const MainLayout = () => {
  const t = useT();
  const NAV = [
    { to: '/dashboard', labelKey: 'nav.dashboard', Icon: LayoutDashboard, walkId: undefined },
    { to: '/workout',   labelKey: 'nav.workout',   Icon: Dumbbell,        walkId: 'nav-workout' },
    { to: '/calendar',  labelKey: 'nav.calendar',  Icon: CalendarDays,    walkId: undefined },
    { to: '/muscles',   labelKey: 'nav.muscles',   Icon: Accessibility,   walkId: 'nav-muscles' },
    { to: '/nutrition', labelKey: 'nav.nutrition', Icon: Salad,           walkId: 'nav-nutrition' },
    { to: '/profile',   labelKey: 'nav.profile',   Icon: User,            walkId: 'nav-profile' },
  ] as const;

  return (
    <div className={styles.layout}>
      <AmbientBackground />
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
            {t(labelKey)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
};

export default MainLayout;
