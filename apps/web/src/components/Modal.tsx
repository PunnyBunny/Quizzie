import type { ReactNode } from "react";

type MaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const widthClasses: Record<MaxWidth, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
};

interface ModalProps {
  onClose: () => void;
  children: ReactNode;
  maxWidth?: MaxWidth;
}

export function Modal({ onClose, children, maxWidth = "3xl" }: ModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-lg shadow-xl p-6 w-full mx-4 max-h-[90vh] overflow-y-auto ${widthClasses[maxWidth]}`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
