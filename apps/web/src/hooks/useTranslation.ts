import { useContext } from "react";
import {
  LanguageContext,
  type LanguageContextValue,
} from "../i18n/LanguageProvider";

/**
 * Access the active language and translation function.
 *
 * Returns `{ language, setLanguage, t }`. Must be used inside a `LanguageProvider`.
 *
 * ## Adding a new sentence
 *
 * 1. Pick a key in `src/i18n/translations.ts` following the namespacing
 *    convention `<page>.<descriptive-name>` (e.g. `home.welcome`,
 *    `adminUsers.errorReset`). Reuse `common.*` (cancel, save, close, next,
 *    edit, delete, loading, …) before adding new keys.
 *
 * 2. Add the key to BOTH dictionaries (`en` and `zh`) under the matching
 *    section comment. Use `{{var}}` for interpolation:
 *
 *    ```ts
 *    // en
 *    "home.welcome": "Welcome back, {{name}}!",
 *    // zh
 *    "home.welcome": "歡迎回來,{{name}}!",
 *    ```
 *
 * 3. Use it in the component:
 *
 *    ```tsx
 *    const { t } = useTranslation();
 *    return <h1>{t("home.welcome", { name: user.name })}</h1>;
 *    ```
 *
 * ## Behaviour notes
 *
 * - Missing key in active locale falls back to `en`, then to the key string
 *   itself — so missing keys are visible during dev.
 * - Don't translate dynamic data (student names, schools, emails); only the
 *   surrounding chrome.
 * - For new pages you can ship the English keys alone; the fallback covers
 *   you until the zh translation lands.
 */
export function useTranslation(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useTranslation must be used within a LanguageProvider");
  }
  return ctx;
}
