interface LogoProps {
  className?: string;
}

/** Brand accent. Fixed artwork colour, so it is not themed through Tailwind. */
const CINNABAR = "#B83227";

/**
 * The arc-and-dot mark: an open mouth mid-word, closing around the word being
 * defined. Doubles as the favicon. Strokes inherit the surrounding text colour.
 */
export function VacaMark({ className = "h-6 w-auto" }: LogoProps) {
  return (
    <svg viewBox="0 0 120 120" fill="none" className={className} aria-hidden="true">
      <path d="M89.6,29.4 A43,43 0 1,0 89.6,90.6" stroke="currentColor" strokeWidth={16} />
      <circle cx="97" cy="60" r="13" fill={CINNABAR} />
    </svg>
  );
}

/**
 * The VACA wordmark, drawn rather than typeset: V and A are the same chevron
 * inverted, C is a circle. Sidebearings are fitted by hand so the round C sits
 * between the diagonals and the whole thing reads as one word.
 */
export function VacaWordmark({ className = "h-5 w-auto" }: LogoProps) {
  return (
    <svg viewBox="-12 -28 414 166" fill="none" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth={18} strokeLinejoin="miter" strokeMiterlimit={3}>
        <path d="M0,0 L45,110 L90,0" />
        <path d="M85,110 L130,0 L175,110" />
        <path d="M100.5,72 L159.5,72" />
        <path d="M272.44,21.06 A48,48 0 1,0 272.44,88.94" />
        <path d="M302,110 L347,0 L392,110" />
        <path d="M317.5,72 L376.5,72" />
      </g>
    </svg>
  );
}

/** Horizontal lockup used in the app header. */
export function VacaLogo({ className = "" }: LogoProps) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <VacaMark className="h-6 w-auto sm:h-7" />
      <VacaWordmark className="h-4 w-auto sm:h-5" />
    </span>
  );
}
