import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import de from './de';
import en from './en';
import zh from './zh';

export const LANGUAGES = [
  { code: 'zh', name: '中文' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
] as const;
export type Language = (typeof LANGUAGES)[number]['code'];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en }, zh: { translation: zh }, de: { translation: de } },
    supportedLngs: LANGUAGES.map((l) => l.code),
    // zh-CN, de-AT, en-GB ... all map to the base language.
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'sudoku:lang',
      caches: ['localStorage'],
    },
  });

const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng.startsWith('zh') ? 'zh-CN' : lng;
};
syncHtmlLang(i18n.resolvedLanguage ?? 'en');
i18n.on('languageChanged', syncHtmlLang);

export default i18n;
