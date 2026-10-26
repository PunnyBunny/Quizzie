import type { ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";

type Variant = "primary" | "dark" | "secondary" | "danger" | "success" | "muted" | "text";
type Size = "xs" | "sm" | "md";

const variantClasses: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  dark: "bg-black text-white hover:bg-gray-800",
  secondary: "bg-gray-100 text-gray-700 hover:bg-gray-200",
  danger: "bg-red-600 text-white hover:bg-red-700",
  success: "bg-green-600 text-white hover:bg-green-700",
  muted: "bg-gray-600 text-white hover:bg-gray-700",
  text: "bg-transparent text-black underline enabled:hover:text-gray-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600",
};

const sizeClasses: Record<Size, string> = {
  xs: "px-1 py-0.5 text-xs",
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-sm",
};

const baseClasses = "rounded-lg font-medium transition-colors";

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
      className={`${baseClasses} disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={`${baseClasses} inline-flex cursor-pointer items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 active:brightness-95 motion-reduce:transition-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  );
}
