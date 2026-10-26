# Tailwind 4 migration review

Date: 2026-10-26. Scope: the uncommitted migration, followed by the requested
removal of the explicit PostCSS pipeline. No changes were staged or committed.

## Assessment

The Vite integration now builds successfully and resolves one Tailwind version,
4.3.3. One visual regression remains in the shared modal; enabled buttons also
lost their previous pointer cursor.

## Scope and method

- Inspected every application-source hunk in the migration diff, manifests,
  root lockfile, CSS entry, Vite integration, and existing PostCSS configuration.
- Initially reproduced the stock build failure caused by running the v3 PostCSS
  plugin over the v4 stylesheet.
- After the user requested removal of PostCSS, removed the old configuration and
  direct PostCSS/Autoprefixer dependencies, placed both Tailwind packages in web
  devDependencies, synchronized the root lockfile, and removed obsolete ESLint
  exclusions. Updated AGENTS.md and DESIGN.md to describe runtime ownership and
  the v4 default palette.
- Used Chromium against the normal Vite configuration after that correction.
  Authentication and callable responses were intercepted with local fixtures;
  cloud requests were blocked. No assessment, account, or question was saved.
- Compiled v3 comparison CSS from the source at commit 88d6280 using the available
  v3.4.19 compiler before removing that dependency. This establishes utility
  comparisons, rather than a byte-identical copy of an older production build.

## What works

- Tailwind is compiled by the dedicated Vite plugin. npm resolves Tailwind 4.3.3
  once; Autoprefixer is absent. PostCSS remains only as a dependency of Vite.
- The home-page hierarchy, navigation targets, role-dependent Administration
  link, and new-tab assessment behavior are preserved.
- The sampled radius, shrink, word-wrapping, shadow, minimum-width, and
  maximum-width replacements preserve their corresponding v3 appearance or
  computed dimensions. Extra transparent shadow layers in v4 are harmless.
- The base border compatibility layer is present.
- English and Traditional Chinese layouts wrap within the document at the
  tested widths; wide admin tables retain local horizontal scrolling.
- Home navigation has visible keyboard focus. The migrated login email input
  retains a solid 2px focus outline under emulated forced colors.

## Scorecard

These scores describe only the migration and inspected states.

| Dimension                    | Score | Evidence                                                           |
| ---------------------------- | ----- | ------------------------------------------------------------------ |
| Build integration            | 3/4   | Both workspace builds pass after pipeline correction.              |
| Visual consistency           | 2/4   | Shared modal backdrop regression remains.                          |
| Responsive/localized layouts | 3/4   | Sampled routes fit at mobile and desktop widths in both languages. |
| Keyboard adaptation          | 3/4   | Home focus, reduced motion, and forced-colors email focus checked. |

## Findings

| ID    | Severity | Location / evidence                                                                                            | Behavior and impact                                                                                                                                                                                                                           | Correction / status                                                                                                                                                                                                               |
| ----- | -------- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TW-01 | HIGH     | Former apps/web/postcss.config.mjs:3; former apps/web/package.json v3 declaration; root dependency declaration | The stock build failed with `@layer base is used but no matching @tailwind base directive is present`. Both v3 and v4 were installed, and the old PostCSS plugin processed v4 CSS.                                                            | **Resolved** after the explicit request to remove PostCSS. Web devDependencies own both v4 packages; the old configuration and direct PostCSS/Autoprefixer dependencies were removed.                                             |
| TW-02 | MEDIUM   | apps/web/src/components/Modal.tsx:26; /admin/questions, New Section, 1280px Chromium                           | `bg-black bg-opacity-50` computes to opaque `rgb(0, 0, 0)` with opacity 1. The same classes compute to `rgba(0, 0, 0, 0.5)` under v3. All shared-modal consumers lose the surrounding page context. Screenshot: /tmp/vaca-tailwind-modal.png. | Replace the obsolete pair with `bg-black/50`. Left unchanged as a review finding.                                                                                                                                                 |
| TW-03 | LOW      | apps/web/src/components/Button.tsx:23; migrated default stylesheet                                             | Enabled buttons now compute to `cursor: default`; their previous v3 cursor was `pointer`. Button-styled links still use `cursor-pointer`, creating an inconsistent interaction cue. Controls remain functional.                               | To retain the established behavior, add a shared enabled-button cursor rule or a Button variant with `enabled:cursor-pointer`; include literal action buttons if using a component-level fix. Left unchanged as a review finding. |

## Verification performed

| Check                                                           | Result                                                                                                                                                             |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| npm run build --workspace apps/web                              | PASS after pipeline correction. Existing React/Vite deprecation and large-bundle warnings remain.                                                                  |
| npm run build --workspace apps/functions                        | PASS.                                                                                                                                                              |
| npm run lint --workspace apps/web                               | PASS with the same 10 existing Fast Refresh warnings.                                                                                                              |
| npm run lint --workspace apps/functions                         | PASS.                                                                                                                                                              |
| node scripts/verify-audio-mc.cjs                                | PASS after dependency cleanup: archive/access/scoring/evidence and recording finalization/error/navigation checks.                                                 |
| npm ls tailwindcss @tailwindcss/vite autoprefixer postcss --all | One Tailwind version, 4.3.3. No Autoprefixer; PostCSS is transitive through Vite.                                                                                  |
| Targeted Prettier checks on files edited for pipeline removal   | PASS.                                                                                                                                                              |
| npm run format:check --workspace apps/web                       | FAIL: 26 existing formatting warnings, including generated dist files. No broad formatting rewrite was performed.                                                  |
| DESIGN.md official lint                                         | PASS with zero errors and four existing unused-token warnings.                                                                                                     |
| Strict premium project audit                                    | Same 12 findings as the pre-review baseline; no new rule/file pairs. Includes existing form/select ownership gaps and a shared Button spread-props false positive. |
| git diff --check                                                | PASS.                                                                                                                                                              |

Browser coverage:

- Home: 320, 375, 768, and 1280px; both languages; administrator and ordinary
  user fixtures. Checked link targets, document overflow, card stacking, visible
  keyboard focus, locale switching, reduced motion, and new-tab opener isolation.
- Login, View assessments, Grade assessments, Admin assessments, Admin questions,
  and New assessment: 375 and 1280px in both languages, with the intended route
  asserted after rendering. No document overflow.
- View assessments: empty and failed-request fixtures.
- Admin questions: open New Section modal, computed backdrop, screenshot.
- Login: forced-colors email focus.
- Final browser runs reported no page exceptions.

Raw evidence: /tmp/vaca-home-browser-report.json,
/tmp/vaca-tailwind-visual-review.json, and
/tmp/vaca-tailwind-review-audit-final.json. Temporary browser scripts and evidence
are outside the repository.

## Prioritized action plan

1. Now: correct TW-02 and verify the shared backdrop in admin editing and score
   dialogs.
2. Next: decide whether to preserve the previous pointer cursor (TW-03).
3. Later: address the existing formatting and static-audit baseline separately.

## Verification gaps and rejected candidates

- Live Firebase authentication, production data, cloud writes, physical
  microphone recording, Firefox, Safari, screen-reader output, a full 200% zoom
  matrix, and every permission/error state were not exercised.
- The existing fake-media regression script is not a physical microphone test.
- The inspection covers migration-related behavior, not a complete accessibility
  audit of legacy modals, forms, or tooltips.
- `wrap-break-word` is valid in the installed v4.3.3 and computes to
  `overflow-wrap: break-word`; it is not a typo.
- `outline-hidden` differs from v3's transparent outline in normal mode, but the
  tested input regains a solid 2px outline in forced-colors mode. No focus-loss
  regression was established for that change.
- Palette differences follow the adopted Tailwind 4 defaults and are now
  documented; they were not classified as accidental token drift.

## Verdict

**Needs changes** for the full migration because TW-02 remains. The requested
removal of the explicit PostCSS pipeline is complete and verified. No commit was
created.
