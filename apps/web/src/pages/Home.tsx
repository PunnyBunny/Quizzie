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

interface HomeCard {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  onClick: () => void;
  variant?: "dark" | "primary";
}

// TODO: strip transcript
export default function Home() {
  const navigate = useNavigate();
  const { loading, isAdmin } = useAuth();

  if (loading) return <div>Loading...</div>;

  const cards: HomeCard[] = [
    {
      icon: <AddUserIcon />,
      title: "Start New Test",
      description: "Begin assessment for a new student",
      buttonLabel: "Start New Assessment",
      onClick: () => window.open("/new-assessment", "_blank", "noopener,noreferrer"),
      variant: "dark",
    },
    {
      icon: <EyeIcon />,
      title: "View existing assessments",
      description: "View unfinished assessments from previous sessions",
      buttonLabel: "View Assessments",
      onClick: () => navigate("/view-assessments"),
      variant: "dark",
    },
    {
      icon: <PencilSquareIcon />,
      title: "Grade finished assessments",
      description: "View and grade finished assessments from previous sessions",
      buttonLabel: "Grade Assessments",
      onClick: () => navigate("/grade-assessments"),
      variant: "dark",
    },
  ];

  if (isAdmin) {
    cards.push({
      icon: <ShieldCheckIcon />,
      title: "Admin Panel",
      description: "Manage users, view all results, and override grades",
      buttonLabel: "Open Admin Panel",
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
