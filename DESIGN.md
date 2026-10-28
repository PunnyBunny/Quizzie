---
version: alpha
name: VACA
description: Bilingual assessment workspace with quiet cards and dense administrative tables.
colors:
  primary: "oklch(0.553 0.195 38.402)"
  background: "oklch(1 0 0)"
  surface: "#ffffff"
  text: "oklch(0.145 0 0)"
  border: "oklch(0.922 0 0)"
  success: "oklch(52.7% 0.154 150.069)"
  warning: "oklch(47.3% 0.137 46.201)"
  danger: "oklch(0.577 0.245 27.325)"
typography:
  sans:
    fontFamily: "'Geist Variable', sans-serif"
  heading:
    fontFamily: "'Raleway Variable', sans-serif"
rounded:
  DEFAULT: "0.625rem"
  lg: "0.625rem"
  xl: "0.875rem"
spacing:
  page-max: "64rem"
  page-padding: "1rem"
components:
  button: {}
  card: {}
  table: {}
  alert: {}
  dialog: {}
---

# VACA design context

## Product and visual direction

VACA supports assessors recording student answers and administrators reviewing
assessments. The visual reference is an organized assessment folder: white cards,
clear student identifiers, quiet metadata, and explicit task controls. Preserve
this established product register rather than introducing marketing treatments.
English and Traditional Chinese use the existing language provider and available
sans-serif fallbacks for scripts absent from the bundled fonts. Locale alone does
not establish a target market.

## Runtime ownership

This document records existing styling; it does not generate tokens. Tailwind 4's
default theme, `apps/web/src/index.css`, and shared `Button`, `Alert`, `Dialog`, and
`PageHeader` components remain canonical. The selected shadcn preset is
`b1vtHrSz68`: Nova with Base UI (`base-nova`), neutral base and chart colors, orange
theme, Geist body font, Raleway heading font, Lucide icons, default menu color,
and subtle menu accent.

The frontmatter mirrors the light semantic tokens in `src/index.css`, except
success and warning, which use Tailwind's canonical green-700 and amber-800
theme colors in the shared Alert recipe. The mapping is `primary` to
`--primary`, `background` to `--background`, `surface` to `--card`, `text` to
`--foreground`, `border` to `--border`, and `danger` to `--destructive`.
`@theme inline` exposes these through semantic Tailwind utilities consumed by
`src/components/ui/button.tsx` and `src/components/ui/alert.tsx`. The stylesheet also owns the dark token values;
the application does not yet offer a complete dark-mode interface.

The application `Button` module re-exports `src/components/ui/button.tsx`, using
the shadcn Base UI primitive. `ButtonLink` renders a native router link with the
same variant recipe from `src/components/ui/button-variants.ts`. That recipe
owns button colors, geometry, hover, keyboard focus, disabled states, and reduced
motion. Every application-authored button uses this owner; native browser/media
controls and the audio-player library retain their own implementations.

Use orange `default` for the main action, `outline` for secondary actions,
`secondary` for selected section controls, `ghost` for utilities, and
`destructive` for removal or stopping recording. Selected grade and question
buttons expose `aria-pressed` and use the primary variant. Archive and Unarchive
are reversible utility actions with the compact ghost variant; their saving
labels retain stable button geometry.

Inline feedback uses the shadcn Nova `Alert` in `src/components/ui/alert.tsx`,
with `AlertDescription` for messages and `AlertTitle` for existing headings.
Errors use `destructive`; completed actions use the green `success` variant;
recoverable conditions use the amber `warning` variant. Success and warning
descriptions inherit their status color. `default` is reserved for neutral information.
Archive feedback keeps one polite live region and uses presentation roles on
its nested alerts. Retry and recovery buttons use `AlertAction`: actions stack below
the message on narrow screens and sit beside it on wider screens. The shared grid
reserves space for action groups without overlapping text. Error and neutral alerts use the preset
card background; success and warning use Tailwind green/amber-50 backgrounds,
200 borders, and 700/800 text, with 950 backgrounds, 800 borders, and 200 text
in dark mode. Status colors are owned by the shared Alert recipe and Tailwind's theme.
Alerts persist until a relevant action replaces them or the user navigates away;
they never disappear on a timer. Transcription failures that leave audio usable
are warnings; capture failures remain errors. A successful user mutation followed
by a failed list refresh produces a warning confirming the completed action.

Modal content uses the shadcn Nova `Dialog` in `src/components/ui/dialog.tsx`.
`DialogHeader`, `DialogTitle`, and `DialogFooter` provide the preset structure;
the shared `DialogBody` scrolls long content while headers and actions stay visible.
The surface stays within the dynamic viewport. Existing editors, score reports,
and assessment instructions use the 3xl width; password-link dialogs use lg.
The primitive owns the overlay, Escape/backdrop dismissal, focus handling, and
localized close labels. The question editor's existing discard guard applies to
every dismissal route. Overlay animations respect reduced motion.

The primary hover background mixes 8% black into the preset primary color to
retain readable text contrast with the orange palette.

Default buttons are 36px high; compact table actions are 32px, extra-small
controls are 28px, and form/assessment primary actions are 44px. Icon sizes
follow the same scale. Keep page-specific overrides for placement, full width,
and genuinely different geometry such as full-width sorting headers.

Tailwind is compiled by `@tailwindcss/vite` from the CSS import in
`apps/web/src/index.css`. The web workspace owns both Tailwind development
dependencies. There is no project PostCSS pipeline or JavaScript Tailwind config.
The CSS base layer preserves the v3 default border color for existing components.
Existing page surfaces and text may likewise retain explicit Tailwind gray
utilities instead of the semantic preset palette.

## Layout and typography

Use the existing 64rem dashboard shell with 1rem mobile and 1.5rem larger-screen
padding. Body text uses Geist; h1, h2, and h3 use Raleway through the shared base
layer's `font-heading` utility. Both fonts are bundled locally through Fontsource imports in
`apps/web/src/index.css`. Metadata uses smaller gray text. Cards
use rounded-lg or rounded-xl corners, light borders, and restrained shadows.
The stylesheet owns the default `--radius` of 0.625rem, with `rounded-lg` using
that value and `rounded-xl` using 1.4 times it (0.875rem).
User records stack as cards; administrative comparisons use semantic tables with
horizontal overflow. Long names and Chinese labels wrap without hiding actions.

The home page is a task hub: an orange-tinted new-assessment panel carries the primary
action, View and Grade share a two-column row on wider screens, and Archive and
Administration use compact utility links. Mobile layouts stack in task order.
Navigation styled as a button uses the shared ButtonLink, which derives its color,
size, and radius from the same variants as Button.

## Interaction states

Reuse shared loading, error, and success treatments. Archive controls retain their
geometry while saving and expose busy state. Feedback uses an accessible live
region. Keyboard focus remains visible. The preset adds no new motion behavior.
See UX-CONTRACT.md for archive behavior and verification.
