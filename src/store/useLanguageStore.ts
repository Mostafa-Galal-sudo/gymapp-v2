import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '../i18n/translations';

interface LanguageState {
  lang: Lang;
  hasSelectedLanguage: boolean;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  selectLanguage: (lang: Lang) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: 'en',
      hasSelectedLanguage: false,
      setLang: (lang) => {
        set({ lang });
        // Update html dir attribute
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
      },
      toggleLang: () => {
        const next: Lang = get().lang === 'en' ? 'ar' : 'en';
        get().setLang(next);
      },
      // Called once, from the first-launch language picker — separate from
      // setLang/toggleLang (used later, e.g. the in-app language switch)
      // so we only ever show that picker before the user has chosen once.
      selectLanguage: (lang) => {
        get().setLang(lang);
        set({ hasSelectedLanguage: true });
      },
    }),
    {
      name: 'omnibody-lang',
      onRehydrateStorage: () => (state) => {
        // Apply dir on app load from persisted state
        if (state?.lang) {
          document.documentElement.dir = state.lang === 'ar' ? 'rtl' : 'ltr';
          document.documentElement.lang = state.lang;
        }
      },
    }
  )
);
