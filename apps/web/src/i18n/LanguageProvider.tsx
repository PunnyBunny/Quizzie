import { createContext, useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { LANGUAGES, TRANSLATIONS, type Language } from "./translations";
import { storageKeys } from "../lib/storage-keys";

export interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const DEFAULT_LANGUAGE: Language = "en";

export const LanguageContext = createContext<LanguageContextValue | null>(null);

function detectInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;
  const stored = window.localStorage.getItem(storageKeys.language);
  if (stored && LANGUAGES.some((l) => l.code === stored)) {
    return stored as Language;
  }
  const nav = window.navigator.language?.toLowerCase() ?? "";
  if (nav.startsWith("zh")) return "zh-Hant";
  return DEFAULT_LANGUAGE;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match: string, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : `{{${key}}}`,
  );
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => detectInitialLanguage());

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKeys.language, language);
    } catch {
      // ignore storage errors
    }
    if (typeof document !== "undefined") {
      document.documentElement.lang = language === "zh-Hant" ? "zh-Hant" : "en";
    }
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const dict = TRANSLATIONS[language];
      const fallback = TRANSLATIONS.en;
      const template = dict[key] ?? fallback[key] ?? key;
      return interpolate(template, vars);
    },
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}
