import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Lang } from '../i18n/translations';

interface LanguageState {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set, get) => ({
      lang: 'en',
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
