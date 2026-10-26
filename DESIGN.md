---
version: alpha
name: VACA
description: Bilingual assessment workspace with quiet cards and dense administrative tables.
colors:
  primary: "oklch(54.6% 0.245 262.881)"
  background: "oklch(98.5% 0.002 247.839)"
  surface: "#ffffff"
  text: "oklch(21% 0.034 264.665)"
  border: "oklch(92.8% 0.006 264.531)"
  success: "oklch(52.7% 0.154 150.069)"
  danger: "oklch(50.5% 0.213 27.518)"
typography:
  sans:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
rounded:
  DEFAULT: "0.5rem"
  lg: "0.75rem"
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
English and Traditional Chinese use the existing language provider and system font
fallbacks. Locale alone does not establish a target market.

## Runtime ownership

This document records existing styling; it does not generate tokens. Tailwind 4's
default theme, `apps/web/src/index.css`, and shared `Button`, `Alert`, and
`PageHeader` components remain canonical. Blue denotes primary actions; gray
secondary actions; green completion/success; red failure. Archive and Unarchive
use the shared underlined text-button variant with transparent background and
black text because both are reversible. The variant owns hover and focus styling;
size remains independently selectable, with archive controls using xs.

Tailwind is compiled by `@tailwindcss/vite` from the CSS import in
`apps/web/src/index.css`. The web workspace owns both Tailwind development
dependencies. There is no project PostCSS pipeline or JavaScript Tailwind config.
The CSS base layer preserves the v3 default border color for existing components.
The palette above records Tailwind 4's default blue-600, gray-50, gray-900,
gray-200, green-700, and red-700 tokens, replacing the v3 hex equivalents.

## Layout and typography

Use the existing 64rem dashboard shell with 1rem mobile and 1.5rem larger-screen
padding. Headings use bold system sans; metadata uses smaller gray text. Cards
use rounded-lg or rounded-xl corners, light borders, and restrained shadows.
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
region. Keyboard focus remains visible. No new animation or font assets are
required. See UX-CONTRACT.md for archive behavior and verification.
