import { Link } from "react-router-dom";
import useAuth from "../hooks/useAuth.tsx";
import { ButtonLink } from "../components/Button";
import { PageHeader } from "../components/PageHeader";
import {
  AddUserIcon,
  BackArrowIcon,
  EyeIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
} from "../components/icons";
import { useTranslation } from "../hooks/useTranslation";

const navigationClasses =
  "cursor-pointer rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 motion-reduce:transition-none";

export default function Home() {
  const { loading, isAdmin } = useAuth();
  const { t } = useTranslation();

  const tasks = [
    {
      id: "view",
      icon: <EyeIcon />,
      title: t("home.view.title"),
      description: t("home.view.description"),
      to: "/view-assessments",
    },
    {
      id: "grade",
      icon: <PencilSquareIcon />,
      title: t("home.grade.title"),
      description: t("home.grade.description"),
      to: "/grade-assessments",
    },
  ];

  return (
    <main className="p-4 sm:p-6" aria-label={t("home.title")}>
      <div className="mx-auto max-w-5xl">
        <PageHeader title={t("home.title")} subtitle={t("home.subtitle")} />

        {loading ? (
          <div role="status" className="flex min-h-80 items-center justify-center text-gray-600">
            {t("common.loading")}
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            <section
              aria-labelledby="home-start-title"
              className="rounded-xl border border-blue-100 bg-blue-50 p-5 sm:p-6"
            >
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <div
                    aria-hidden="true"
                    className="shrink-0 rounded-lg bg-white p-3 text-blue-700"
                  >
                    <AddUserIcon />
                  </div>
                  <div className="min-w-0">
                    <h2 id="home-start-title" className="text-xl font-semibold text-gray-900">
                      {t("home.startNew.title")}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-gray-600">
                      {t("home.startNew.description")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:items-end">
                  <ButtonLink
                    to="/new-assessment"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-describedby="home-new-tab"
                    className="min-h-11 w-full md:w-auto"
                  >
                    {t("home.startNew.button")}
                    <span aria-hidden="true">
                      <BackArrowIcon className="size-4 rotate-180" />
                    </span>
                  </ButtonLink>
                  <p id="home-new-tab" className="text-center text-xs text-gray-600 md:text-right">
                    {t("home.opensNewTab")}
                  </p>
                </div>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
              {tasks.map((task) => (
                <Link
                  key={task.id}
                  to={task.to}
                  aria-labelledby={`home-${task.id}-title`}
                  aria-describedby={`home-${task.id}-description`}
                  className={`${navigationClasses} group border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:bg-blue-50 active:bg-blue-100 sm:p-6`}
                >
                  <div aria-hidden="true" className="mb-5 flex items-center justify-between">
                    <span className="rounded-lg bg-gray-100 p-2.5 text-gray-700 group-hover:bg-white group-hover:text-blue-700">
                      {task.icon}
                    </span>
                    <BackArrowIcon className="size-5 rotate-180 text-gray-400 group-hover:text-blue-700" />
                  </div>
                  <h2 id={`home-${task.id}-title`} className="text-lg font-semibold text-gray-900">
                    {task.title}
                  </h2>
                  <p
                    id={`home-${task.id}-description`}
                    className="mt-2 text-sm leading-6 text-gray-600"
                  >
                    {task.description}
                  </p>
                </Link>
              ))}
            </div>

            <nav
              aria-label={t("home.moreOptions")}
              className="flex flex-col gap-1 border-t border-gray-200 pt-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
            >
              <Link
                to="/archived-assessments"
                className={`${navigationClasses} inline-flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200`}
              >
                {t("archive.title")}
                <span aria-hidden="true">
                  <BackArrowIcon className="size-4 rotate-180" />
                </span>
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className={`${navigationClasses} inline-flex min-h-11 items-center justify-between gap-3 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 active:bg-gray-200`}
                >
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true">
                      <ShieldCheckIcon className="size-4" />
                    </span>
                    {t("home.admin.title")}
                  </span>
                  <span aria-hidden="true">
                    <BackArrowIcon className="size-4 rotate-180" />
                  </span>
                </Link>
              )}
            </nav>
          </div>
        )}
      </div>
    </main>
  );
}
