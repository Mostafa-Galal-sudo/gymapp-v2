import type { TranslationKey } from '../i18n/translations';
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOnboardingStore } from '../store/useOnboardingStore';
import { useT } from '../hooks/useT';
import {
  Trophy, Dumbbell, SlidersHorizontal, Salad, Barcode, Camera,
  BookOpen, Accessibility, User, Pill
} from 'lucide-react';

interface WalkthroughStep {
  target: string; // matches a data-walkthrough="..." attribute in the DOM
  route?: string;  // navigate here first if the target lives on another page
  icon: React.ComponentType<{ size?: number; color?: string }>;
  titleKey: string;
  descKey: string;
}

const STEPS: WalkthroughStep[] = [
  { target: 'progress-card', icon: Trophy,             titleKey: 'walkthrough.step_progress_title',  descKey: 'walkthrough.step_progress_desc' },
  { target: 'nav-workout',   icon: Dumbbell,            titleKey: 'walkthrough.step_workout_title',   descKey: 'walkthrough.step_workout_desc' },
  { target: 'split-systems', route: '/workout',   icon: SlidersHorizontal, titleKey: 'walkthrough.step_splits_title',    descKey: 'walkthrough.step_splits_desc' },
  { target: 'nav-nutrition', icon: Salad,               titleKey: 'walkthrough.step_nutrition_title', descKey: 'walkthrough.step_nutrition_desc' },
  { target: 'barcode-button',route: '/nutrition', icon: Barcode,           titleKey: 'walkthrough.step_barcode_title',   descKey: 'walkthrough.step_barcode_desc' },
  { target: 'scan-button',   route: '/nutrition', icon: Camera,            titleKey: 'walkthrough.step_scan_title',      descKey: 'walkthrough.step_scan_desc' },
  { target: 'recipes-section',route: '/nutrition',icon: BookOpen,          titleKey: 'walkthrough.step_recipes_title',   descKey: 'walkthrough.step_recipes_desc' },
  { target: 'nav-muscles',   icon: Accessibility,       titleKey: 'walkthrough.step_muscles_title',   descKey: 'walkthrough.step_muscles_desc' },
  { target: 'nav-profile',   icon: User,                titleKey: 'walkthrough.step_profile_title',   descKey: 'walkthrough.step_profile_desc' },
  { target: 'supplements-section', route: '/profile', icon: Pill,         titleKey: 'walkthrough.step_supplements_title', descKey: 'walkthrough.step_supplements_desc' },
];

const PADDING = 8; // gap between the highlighted element and the cutout edge
const TOOLTIP_MARGIN = 14;

interface Rect { top: number; left: number; width: number; height: number; }

const getTargetRect = (target: string): Rect | null => {
  const el = document.querySelector(`[data-walkthrough="${target}"]`);
  if (!el || !document.contains(el)) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
};

const Walkthrough = () => {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const isOpen = useOnboardingStore(s => s.isWalkthroughOpen);
  const closeWalkthrough = useOnboardingStore(s => s.closeWalkthrough);
  const markWalkthroughSeen = useOnboardingStore(s => s.markWalkthroughSeen);

  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const finish = useCallback(() => {
    markWalkthroughSeen();
    closeWalkthrough();
  }, [markWalkthroughSeen, closeWalkthrough]);

  // Reset to step 0 every time the walkthrough is (re)opened — otherwise a
  // replay from Profile would resume wherever the last session left off.
  useEffect(() => {
    if (isOpen) {
      const frame = requestAnimationFrame(() => { setStepIndex(0); setRect(null); });
      return () => cancelAnimationFrame(frame);
    }
  }, [isOpen]);

  // Resolve the current step's target: navigate to its route if needed,
  // otherwise look it up directly; skip forward (or finish) if it's not
  // mounted/visible even after navigating, per spec.
  useEffect(() => {
    if (!isOpen) return;
    const step = STEPS[stepIndex];

    if (step.route && location.pathname !== step.route) {
      navigate(step.route);
      return; // re-run once location.pathname updates below
    }

    let cancelled = false;
    let cleanupScrollWait: (() => void) | undefined;

    // Page content scrolls inside a nested `.main` div (overflow-y: auto),
    // not the window — so we can't just wait a fixed number of ms and hope
    // the scroll (which may need to travel a long way, e.g. past the whole
    // Health dashboard section) has actually finished. Wait for the
    // scrollend event where supported, with a timeout fallback for browsers
    // that don't support it yet.
    const waitForScrollSettle = (onSettled: () => void) => {
      const scrollContainer = document.querySelector('main') || window;
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        cleanupScrollWait?.();
        onSettled();
      };
      if ('onscrollend' in window) {
        scrollContainer.addEventListener('scrollend', finish, { once: true });
        cleanupScrollWait = () => scrollContainer.removeEventListener('scrollend', finish);
      }
      // Always also set a fallback timer — covers browsers without
      // scrollend support, and the case where nothing needed to scroll at
      // all (scrollend never fires if there's no scrolling to do).
      const fallback = setTimeout(finish, 220);
      const prevCleanup = cleanupScrollWait;
      cleanupScrollWait = () => { prevCleanup?.(); clearTimeout(fallback); };
    };

    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-walkthrough="${step.target}"]`);
      if (!el || !document.contains(el)) {
        if (stepIndex < STEPS.length - 1) setStepIndex(i => i + 1);
        else finish();
        return;
      }

      // Bring the target into view first (it may be well below the fold —
      // e.g. progress-card now sits below the whole Health dashboard
      // section), then measure its on-screen position once scrolling
      // has actually settled.
      el.scrollIntoView({ behavior: 'instant' as ScrollBehavior, block: 'center' });
      waitForScrollSettle(() => {
        if (cancelled) return;
        const r = getTargetRect(step.target);
        if (r) setRect(r);
        // One more measurement shortly after — catches late layout shifts
        // (e.g. web fonts finishing, an image loading in) that would
        // otherwise leave the cutout slightly misaligned from the target.
        setTimeout(() => {
          if (cancelled) return;
          const r2 = getTargetRect(step.target);
          if (r2) setRect(r2);
        }, 200);
      });
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      cleanupScrollWait?.();
    };
  }, [isOpen, stepIndex, location.pathname, navigate, finish]);

  // Recompute the cutout position on resize/scroll so it tracks the target.
  useEffect(() => {
    if (!isOpen) return;
    const recompute = () => {
      const r = getTargetRect(STEPS[stepIndex].target);
      if (r) setRect(r);
    };
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [isOpen, stepIndex]);

  // Escape key skips the walkthrough entirely.
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, finish]);

  if (!isOpen || !rect) return null;

  const isLastStep = stepIndex >= STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      finish();
    } else {
      setRect(null); // avoids briefly showing the old cutout at the wrong spot
      setStepIndex(i => i + 1);
    }
  };

  const step = STEPS[stepIndex];
  const cutout = {
    top: rect.top - PADDING,
    left: rect.left - PADDING,
    width: rect.width + PADDING * 2,
    height: rect.height + PADDING * 2,
  };

  // Position the tooltip: prefer above the cutout (bottom nav items sit at
  // the bottom of the screen), fall back to below when there isn't room.
  // Tooltip width adapts to narrow phone screens so it never overflows.
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const tooltipWidth = Math.min(300, viewportW - TOOLTIP_MARGIN * 2);
  const spaceAbove = cutout.top;
  const spaceBelow = viewportH - (cutout.top + cutout.height);
  const placeAbove = spaceAbove > spaceBelow;

  const tooltipLeftRaw = cutout.left + cutout.width / 2 - tooltipWidth / 2;
  const tooltipLeft = Math.min(Math.max(tooltipLeftRaw, TOOLTIP_MARGIN), viewportW - tooltipWidth - TOOLTIP_MARGIN);
  // When placing above the cutout, anchor by `bottom` (not `top`) so the box
  // grows upward from that point regardless of its actual rendered height —
  // anchoring by `top` here made the box extend downward past the cutout
  // and off the bottom of the screen (past the bottom nav), hiding the
  // Next button entirely.
  const tooltipBottom = placeAbove ? viewportH - cutout.top + TOOLTIP_MARGIN : undefined;
  const tooltipTop = placeAbove ? undefined : cutout.top + cutout.height + TOOLTIP_MARGIN;

  const content = (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }}>
      {/* Four dimming strips surrounding the cutout — keeps the highlighted
          element itself fully visible/interactive-looking without needing
          CSS mask/clip-path support. */}
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 0, left: 0, right: 0, height: Math.max(0, cutout.top), background: 'rgba(2,4,8,0.86)', backdropFilter: 'blur(1px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: cutout.top + cutout.height, left: 0, right: 0, bottom: 0, background: 'rgba(2,4,8,0.86)', backdropFilter: 'blur(1px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: cutout.top, left: 0, width: Math.max(0, cutout.left), height: cutout.height, background: 'rgba(2,4,8,0.86)', backdropFilter: 'blur(1px)' }} />
      <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: cutout.top, left: cutout.left + cutout.width, right: 0, height: cutout.height, background: 'rgba(2,4,8,0.86)', backdropFilter: 'blur(1px)' }} />

      {/* Glowing cutout border, matching the app's cyan-glow aesthetic */}
      <div style={{
        position: 'fixed',
        top: cutout.top, left: cutout.left, width: cutout.width, height: cutout.height,
        borderRadius: 'var(--radius-md)',
        border: '2px solid var(--cyan)',
        boxShadow: 'var(--shadow-cyan)',
        pointerEvents: 'none',
      }} />

      {/* Tooltip */}
      <div
        className="glass-card animate-fade-up"
        style={{
          position: 'fixed',
          top: tooltipTop,
          bottom: tooltipBottom,
          left: tooltipLeft,
          width: tooltipWidth,
          maxHeight: `calc(100vh - ${TOOLTIP_MARGIN * 2}px)`,
          overflowY: 'auto',
          padding: '1.25rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <div style={{
            width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--cyan), var(--magenta))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--shadow-cyan)',
          }}>
            <step.icon size={15} color="#000" />
          </div>
          <button onClick={finish} style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-heading)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {t('walkthrough.skip')}
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.85rem' }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= stepIndex ? 'var(--cyan)' : 'rgba(255,255,255,0.12)',
            }} />
          ))}
        </div>

        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.4rem' }}>
          {t(step.titleKey as TranslationKey)}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.4, margin: '0 0 1rem' }}>
          {t(step.descKey as TranslationKey)}
        </p>

        <button onClick={handleNext} className="btn-primary" style={{ width: '100%', padding: '0.6rem', fontSize: '0.85rem' }}>
          {isLastStep ? t('walkthrough.start') : t('walkthrough.next')}
        </button>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Walkthrough;
