import { useTranslation } from "../hooks/useTranslation";
import { LANGUAGES, type Language } from "./translations";
import { LanguageIcon } from "../components/icons";

interface LanguageSwitcherProps {
  className?: string;
}

export function LanguageSwitcher({ className = "" }: LanguageSwitcherProps) {
  const { language, setLanguage, t } = useTranslation();
  return (
    <label
      className={`relative inline-flex items-center text-sm text-gray-700 ${className}`}
      title={t("lang.label")}
    >
      <span className="sr-only">{t("lang.label")}</span>
      <LanguageIcon className="pointer-events-none absolute left-2 w-4 h-4 text-gray-500" />
      <select
        aria-label={t("lang.label")}
        value={language}
        onChange={(e) => setLanguage(e.target.value as Language)}
        className="appearance-none rounded-md border border-gray-300 bg-white pl-7 pr-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500"
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
