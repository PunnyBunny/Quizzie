import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "dark" | "secondary" | "danger" | "success" | "muted";
type Size = "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  dark: "bg-black text-white hover:bg-gray-800",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-green-600 text-white hover:bg-green-700",
  muted: "bg-gray-600 text-white hover:bg-gray-700",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
