---
version: alpha
name: VACA
description: Bilingual assessment workspace with quiet cards and dense administrative tables.
colors:
  primary: "oklch(0.52 0.105 223.128)"
  background: "oklch(1 0 0)"
  surface: "#ffffff"
  text: "oklch(0.145 0 0)"
  border: "oklch(0.922 0 0)"
  success: "oklch(52.7% 0.154 150.069)"
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
default theme, `apps/web/src/index.css`, and shared `Button`, `Alert`, and
`PageHeader` components remain canonical. The selected shadcn preset is
`b1vtHplOJk`: Nova with Base UI (`base-nova`), neutral base and chart colors, cyan
theme, Geist body font, Raleway heading font, Lucide icons, default menu color,
and subtle menu accent.

The frontmatter mirrors the light semantic tokens in `src/index.css`, except
success, which retains Tailwind green-700. The mapping is `primary` to
`--primary`, `background` to `--background`, `surface` to `--card`, `text` to
`--foreground`, `border` to `--border`, and `danger` to `--destructive`.
`@theme inline` exposes these through semantic Tailwind utilities consumed by
`src/components/ui/button.tsx`. The stylesheet also owns the dark token values;
the application does not yet offer a complete dark-mode interface.

The existing application `Button` and `ButtonLink` still use explicit blue primary,
gray secondary, green success, and red danger utilities. The preset switch does
not migrate their public API or consumers to the registry Button. Archive and Unarchive
use the shared underlined text-button variant with transparent background and
black text because both are reversible. The variant owns hover and focus styling;
size remains independently selectable, with archive controls using xs.

Tailwind is compiled by `@tailwindcss/vite` from the CSS import in
`apps/web/src/index.css`. The web workspace owns both Tailwind development
dependencies. There is no project PostCSS pipeline or JavaScript Tailwind config.
The CSS base layer preserves the v3 default border color for existing components.
Existing page surfaces and text may likewise retain explicit Tailwind gray
utilities instead of the semantic preset palette.

## Layout and typography

Use the existing 64rem dashboard shell with 1rem mobile and 1.5rem larger-screen
padding. Body text and existing headings use Geist; `font-heading` opts into
Raleway. Both fonts are bundled locally through Fontsource imports in
`apps/web/src/index.css`. Metadata uses smaller gray text. Cards
use rounded-lg or rounded-xl corners, light borders, and restrained shadows.
The stylesheet owns the default `--radius` of 0.625rem, with `rounded-lg` using
that value and `rounded-xl` using 1.4 times it (0.875rem).
User records stack as cards; administrative comparisons use semantic tables with
horizontal overflow. Long names and Chinese labels wrap without hiding actions.

The home page is a task hub: a blue-tinted new-assessment panel carries the primary
action, View and Grade share a two-column row on wider screens, and Archive and
Administration use compact utility links. Mobile layouts stack in task order.
Navigation styled as a button uses the shared ButtonLink, which derives its color,
size, and radius from the same variants as Button.

## Interaction states

Reuse shared loading, error, and success treatments. Archive controls retain their
geometry while saving and expose busy state. Feedback uses an accessible live
region. Keyboard focus remains visible. The preset adds no new motion behavior.
See UX-CONTRACT.md for archive behavior and verification.
