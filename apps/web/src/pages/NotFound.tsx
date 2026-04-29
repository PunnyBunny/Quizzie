import { Link } from 'react-router-dom'
import { useTranslation } from "../i18n/LanguageProvider";

export default function NotFound() {
  const { t } = useTranslation();
  return (
    <div className="p-6 text-center">
      <h2 className="text-2xl font-semibold mb-2">{t("notFound.title")}</h2>
      <p className="text-gray-600 mb-4">{t("notFound.description")}</p>
      <Link to="/" className="text-indigo-600 hover:underline">{t("notFound.back")}</Link>
    </div>
  )
}
