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
    <div className="mb-4 sm:mb-6 flex flex-wrap items-start gap-2 sm:gap-3">
      {handleBack && (
        <button
          type="button"
          onClick={handleBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
          aria-label="Go back"
        >
          <BackArrowIcon />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold break-words">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="w-full sm:w-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
