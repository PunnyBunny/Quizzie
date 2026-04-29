import { useTranslation } from "../hooks/useTranslation";
import { LANGUAGES, type Language } from "./translations";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useTranslation();
  return (
    <label className={`flex items-center gap-2 text-sm ${className}`}>
      <span className="sr-only">{t("lang.label")}</span>
      <select
        aria-label={t("lang.label")}
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.label}
          </option>
        ))}
      </select>
    </label>
  );
}
