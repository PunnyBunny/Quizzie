import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "./icons";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string | (() => void);
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  const handleBack =
    typeof backTo === "function" ? backTo : backTo ? () => navigate(backTo) : undefined;

  return (
    <div className="mb-6 flex items-center gap-3">
      {handleBack && (
        <button
          type="button"
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Go back"
        >
          <BackArrowIcon />
        </button>
      )}
      <div className="flex-1">
        <h1 className="text-3xl font-bold">{title}</h1>
        {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
