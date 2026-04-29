import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import {
  ChartBarIcon,
  PencilSquareIcon,
  ClipboardIcon,
  ClipboardCheckIcon,
} from "../components/icons";
import { useTranslation } from "../i18n/LanguageProvider";

interface AdminSection {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
}

export default function AdminHome() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const sections: AdminSection[] = [
    {
      icon: <ChartBarIcon />,
      title: t("admin.assessments.title"),
      description: t("admin.assessments.description"),
      buttonLabel: t("admin.assessments.button"),
      to: "/admin/assessments",
    },
    {
      icon: <PencilSquareIcon />,
      title: t("admin.users.title"),
      description: t("admin.users.description"),
      buttonLabel: t("admin.users.button"),
      to: "/admin/users",
    },
    {
      icon: <ClipboardIcon />,
      title: t("admin.subtasks.title"),
      description: t("admin.subtasks.description"),
      buttonLabel: t("admin.subtasks.button"),
      to: "/admin/subtasks",
    },
    {
      icon: <ClipboardCheckIcon />,
      title: t("admin.questions.title"),
      description: t("admin.questions.description"),
      buttonLabel: t("admin.questions.button"),
      to: "/admin/questions",
    },
  ];

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <PageHeader
          title={t("admin.title")}
          subtitle={t("admin.subtitle")}
          backTo="/"
        />

        {sections.map((section) => (
          <div
            key={section.to}
            className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gray-200 p-2">{section.icon}</div>
                <div>
                  <h2 className="text-2xl font-semibold">{section.title}</h2>
                  <p className="text-gray-600">{section.description}</p>
                </div>
              </div>
              <div>
                <Button onClick={() => navigate(section.to)}>{section.buttonLabel}</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
