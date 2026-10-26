import type { VariantProps } from "class-variance-authority";
import { Link, type LinkProps } from "react-router-dom";
import { cn } from "../lib/utils";
import { buttonVariants } from "./ui/button-variants";

export { Button } from "./ui/button";

type ButtonLinkProps = LinkProps & VariantProps<typeof buttonVariants>;

export function ButtonLink({
  variant = "default",
  size = "default",
  className,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      data-slot="button"
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
