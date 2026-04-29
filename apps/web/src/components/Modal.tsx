import type { ReactNode } from "react";
import { CloseIcon } from "./icons";

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
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className={`relative bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-h-[90vh] overflow-y-auto ${widthClasses[maxWidth]}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
}
