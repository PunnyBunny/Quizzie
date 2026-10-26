import { Button } from "./Button";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { BackArrowIcon } from "./icons";
import { useTranslation } from "../hooks/useTranslation";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backTo?: string | (() => void);
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, backTo, actions }: PageHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const handleBack =
    typeof backTo === "function" ? backTo : backTo ? () => navigate(backTo) : undefined;

  return (
    <div className="mb-4 sm:mb-6 flex flex-wrap items-start gap-2 sm:gap-3">
      {handleBack && (
        <Button
          variant="ghost"
          size="icon"
          type="button"
          onClick={handleBack}
          className="shrink-0"
          aria-label={t("common.goHome")}
        >
          <BackArrowIcon />
        </Button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold wrap-break-word">{title}</h1>
        {subtitle && <p className="text-sm sm:text-base text-gray-600 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="w-full sm:w-auto flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
