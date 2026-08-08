interface LogoProps {
  className?: string;
}

/** Brand accent. Fixed artwork colour, so it is not themed through Tailwind. */
const CINNABAR = "#B83227";

/**
 * The arc-and-dot icon on its own — the favicon's twin. Strokes inherit the
 * surrounding text colour.
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
 * inverted with chisel-cut apexes, so every letter sits flush on the same cap
 * line and baseline. The C carries the brand dot in its mouth — the mark is
 * embedded in the word, not locked up beside it.
 */
export function VacaWordmark({ className = "h-5 w-auto" }: LogoProps) {
  return (
    <svg viewBox="-2 -2 384 114" className={className} aria-hidden="true">
      <g fill="currentColor">
        <path d="M0,0 L18.9,0 L45,82.1 L71.1,0 L90,0 L55,110 L35,110 Z" />
        <path d="M120,0 L140,0 L175,110 L156.1,110 L130,27.9 L103.9,110 L85,110 Z M111,63 h38 v18 h-38 Z" />
        <path d="M325,0 L345,0 L380,110 L361.1,110 L335,27.9 L308.9,110 L290,110 Z M316,63 h38 v18 h-38 Z" />
      </g>
      <path
        d="M265.03,22.47 A46,46 0 1 0 265.03,87.53"
        fill="none"
        stroke="currentColor"
        strokeWidth={18}
      />
      <circle cx="272.5" cy="55" r="14" fill={CINNABAR} />
    </svg>
  );
}

/** The header logo — the wordmark alone, since the mark lives inside its C. */
export function VacaLogo({ className = "" }: LogoProps) {
  return <VacaWordmark className={`h-5 w-auto sm:h-6 ${className}`} />;
}
