import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth.tsx";
import { Button } from "../components/Button";
import {
  AddUserIcon,
  EyeIcon,
  PencilSquareIcon,
  ShieldCheckIcon,
} from "../components/icons";
import { useTranslation } from "../hooks/useTranslation";

interface HomeCard {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  variant?: "dark" | "primary";
}

export default function Home() {
  const navigate = useNavigate();
  const { loading, isAdmin } = useAuth();
  const { t } = useTranslation();

  if (loading) return <div>{t("common.loadingDots")}</div>;

  const cards: HomeCard[] = [
    {
      icon: <AddUserIcon />,
      title: t("home.startNew.title"),
      description: t("home.startNew.description"),
      buttonLabel: t("home.startNew.button"),
      onClick: () => window.open("/new-assessment", "_blank", "noopener,noreferrer"),
      variant: "dark",
    },
    {
      icon: <EyeIcon />,
      title: t("home.view.title"),
      description: t("home.view.description"),
      buttonLabel: t("home.view.button"),
      onClick: () => navigate("/view-assessments"),
      variant: "dark",
    },
    {
      icon: <PencilSquareIcon />,
      title: t("home.grade.title"),
      description: t("home.grade.description"),
      buttonLabel: t("home.grade.button"),
      onClick: () => navigate("/grade-assessments"),
      variant: "dark",
    },
  ];

  if (isAdmin) {
    cards.push({
      icon: <ShieldCheckIcon />,
      title: t("home.admin.title"),
      description: t("home.admin.description"),
      buttonLabel: t("home.admin.button"),
      onClick: () => navigate("/admin"),
      variant: "primary",
    });
  }

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden"
          >
            <div className="p-6 flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-gray-200 p-2">{card.icon}</div>
                <div>
                  <h2 className="text-2xl font-semibold">{card.title}</h2>
                  <p className="text-gray-600">{card.description}</p>
                </div>
              </div>
              <div>
                <Button variant={card.variant} onClick={card.onClick}>
                  {card.buttonLabel}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
