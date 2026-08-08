import { useLanguageStore } from '../store/useLanguageStore';
import { translations, type TranslationKey } from '../i18n/translations';

export function useT() {
  const lang = useLanguageStore((s) => s.lang);
  return (key: TranslationKey, fallback?: string): string => {
    const dict = translations[lang] as Record<string, string>;
    return dict[key] ?? fallback ?? key;
  };
}
