import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import zhCN from "./locales/zh-CN.json";

/**
 * i18n configuration for cotab.
 *
 * Uses bundled JSON resources (no HTTP fetching) so translations are
 * available synchronously on first render.
 *
 * To add a new language:
 *   1. Create src/i18n/locales/<lang>.json (copy en.json as a template)
 *   2. Add the resource below under `resources.<lang>`
 *   3. Add an entry to SUPPORTED_LANGUAGES in Toolbar.tsx
 */

/** All supported languages — used by the language selector in the toolbar. */
export const SUPPORTED_LANGUAGES: Record<string, string> = {
  en: "English",
  "zh-CN": "简体中文",
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false, // React already escapes by default
  },
});

export default i18n;
