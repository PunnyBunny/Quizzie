import type { ReactNode } from "react";

type Placement = "top" | "bottom";
/** Which edge of the bubble is pinned to the trigger. Pick the one that keeps a wide
 *  bubble inside the viewport: "right" for triggers near the right edge, and so on. */
type Align = "left" | "center" | "right";

const placementClasses: Record<Placement, string> = {
  top: "bottom-full mb-2",
  bottom: "top-full mt-2",
};

const arrowClasses: Record<Placement, string> = {
  top: "top-full -mt-1",
  bottom: "bottom-full -mb-1",
};

const alignClasses: Record<Align, string> = {
  left: "left-0",
  center: "left-1/2 -translate-x-1/2",
  right: "right-0",
};

const arrowAlignClasses: Record<Align, string> = {
  left: "left-4",
  center: "left-1/2 -translate-x-1/2",
  right: "right-4",
};

interface TooltipProps {
  /** Tooltip text. When omitted, the trigger renders with no bubble attached. */
  label?: string;
  placement?: Placement;
  align?: Align;
  children: ReactNode;
  className?: string;
}

/**
 * Hover tooltip for a wrapped trigger.
 *
 * The wrapper — not the trigger — owns the hover, because a disabled button
 * swallows its own pointer events and would never fire one.
 */
export function Tooltip({
  label,
  placement = "top",
  align = "center",
  children,
  className = "",
}: TooltipProps) {
  return (
    <span className={`relative inline-flex group ${className}`}>
      {children}
      {label && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute z-20 w-max max-w-[15rem] rounded-md bg-gray-900 px-2 py-1 text-center text-xs font-medium leading-snug text-white shadow-lg opacity-0 transition-opacity duration-150 group-hover:opacity-100 ${placementClasses[placement]} ${alignClasses[align]}`}
        >
          {label}
          <span
            aria-hidden="true"
            className={`absolute rotate-45 w-2 h-2 bg-gray-900 ${arrowClasses[placement]} ${arrowAlignClasses[align]}`}
          />
        </span>
      )}
    </span>
  );
}
