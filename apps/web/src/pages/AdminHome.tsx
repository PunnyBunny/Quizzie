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

interface AdminSection {
  icon: ReactNode;
  title: string;
  description: string;
  buttonLabel: string;
  to: string;
}

export default function AdminHome() {
  const navigate = useNavigate();

  const sections: AdminSection[] = [
    {
      icon: <ChartBarIcon />,
      title: "Assessment Management",
      description: "View, filter, and grade all assessments across the platform",
      buttonLabel: "Manage Assessments",
      to: "/admin/assessments",
    },
    {
      icon: <PencilSquareIcon />,
      title: "User Management",
      description: "Manage users, reset passwords, and add new users",
      buttonLabel: "Manage Users",
      to: "/admin/users",
    },
    {
      icon: <ClipboardIcon />,
      title: "Subtasks & Norms",
      description: "Define scoring subtasks and enter normative data by grade",
      buttonLabel: "Manage Subtasks",
      to: "/admin/subtasks",
    },
    {
      icon: <ClipboardCheckIcon />,
      title: "Questions",
      description: "Edit assessment sections, questions, choices, and audio/image paths",
      buttonLabel: "Manage Questions",
      to: "/admin/questions",
    },
  ];

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">
        <PageHeader
          title="Admin Dashboard"
          subtitle="See or grade all assessments and manage users."
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
