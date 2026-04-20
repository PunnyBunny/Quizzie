import type { ReactNode } from "react";

type Kind = "error" | "success" | "warning" | "info";

const kindClasses: Record<Kind, string> = {
  error: "bg-red-50 border-red-200 text-red-700",
  success: "bg-green-50 border-green-200 text-green-700",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-700",
  info: "bg-blue-50 border-blue-200 text-blue-700",
};

interface AlertProps {
  kind: Kind;
  children: ReactNode;
  className?: string;
}

export function Alert({ kind, children, className = "" }: AlertProps) {
  return (
    <div className={`p-4 border rounded-lg text-sm ${kindClasses[kind]} ${className}`}>
      {children}
    </div>
  );
}
