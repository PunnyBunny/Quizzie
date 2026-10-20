# Repository guide

## Project and layout

This repository is VACA (the directory and Firebase project retain the Quizzie name),
an assessment application with multiple-choice and recorded audio answers, grading,
subtask scores, and admin management of users, questions, and assessments.

- npm workspaces: `apps/web` and `apps/functions`; use Node.js 22 and the root
  `package-lock.json`.
- `apps/web`: React 19, TypeScript, Vite 8, React Router 6, Tailwind CSS 3, and
  the Firebase browser SDK. `src/main.tsx` installs the language provider, error
  boundary, and router; `src/App.tsx` defines routes and authentication/admin guards.
- Web `src/pages` contains assessment, grading, and admin screens; `src/components`
  contains shared UI. `src/providers` manages questions, last answered question,
  and microphone recording/speech recognition across assessment routes.
- Web `src/lib/firebase-hooks.ts` provides `useCallable` and `useAuthState`;
  `src/lib/errors.ts` formats user-facing errors; `src/lib/scoring.ts` handles
  question/subtask totals and norm-based z-scores.
- `apps/functions`: TypeScript, Express 5, Firebase Functions v2, Firebase Admin,
  and Zod 4. `src/index.ts` exports the HTTP function `api`; `src/routes/index.ts`
  mounts assessment, submission, grading, admin, question, and subtask routers.
- Functions `src/types/models` contains typed Firestore collections and DTO
  conversions. `src/types/zod/routes` contains request schemas; other files in
  `src/types` expose request/response types used by frontend type-only imports.
- Root `firebase.json`, `firestore.rules`, `firestore.indexes.json`, and
  `storage.rules` configure Firebase hosting, functions, data rules, and indexes.
  Generated output goes to `apps/web/dist` and `apps/functions/lib`.

## Development commands

Run from the repository root unless otherwise noted:

```sh
npm ci
npm run dev --workspace apps/web
npm run build --workspace apps/web
npm run build --workspace apps/functions
npm run lint --workspace apps/web
npm run lint --workspace apps/functions
npm run format:check --workspace apps/web
npm run preview --workspace apps/web
```

The root package has no development/build/test scripts. The web dev server defaults
to port 5173, listens on `0.0.0.0`, and accepts a `PORT` override. Both builds check
TypeScript; the web build also bundles with Vite. There is no workspace test script.
Run `node scripts/verify-audio-mc.cjs` for local hybrid-question regression checks
using fake data and media APIs. For code changes, run the relevant build and lint,
and manually exercise the affected UI/API flow when feasible. Report any existing
failures separately from failures introduced by the change. Documentation-only
changes do not require application builds.

For the backend emulator, run `npm run serve --workspace apps/functions`. This
builds the backend and starts **only** the Functions emulator, using the local
ignored `apps/functions/firebase-service-account-key.json`. It requires the
Firebase CLI and valid local credentials. `build:watch` is also available in this
workspace. Firebase config lists Functions port 5001, Firestore 8080, and Storage
9199, but the serve script does not start Firestore or Storage.

## API and data conventions

- The browser calls names such as `api/get-questions` through `useCallable`.
  The server implements Express POST routes under the `api` HTTP function, with
  callable-compatible `{ data: ... }` request and success-response envelopes.
  Preserve this contract when changing both ends.
- Global `authHandler` verifies Firebase Bearer ID tokens and sets
  `res.locals.callerEmail` and `callerClaims`. `adminHandler` checks the `isAdmin`
  custom claim. Trace router mounting and middleware order when changing access
  control; a router-level middleware can affect subsequent mounted routers.
- Follow existing Zod validation and typed Express request/response helpers.
  The validation middleware checks the payload but does not replace it with the
  parsed/transformed result; do not assume schema defaults/transforms were applied.
- Use existing model helpers for Firestore access and DTO conversion.
  Assessments track creator email, section/question progress, and completion;
  `getAssessmentWithAuth` checks ownership or admin access. Student response
  documents use the stored field `assessment-id` and per-question string keys,
  with discriminated `mc`, `audio`, and `audio_mc` response types. Preserve persisted
  shapes; hybrid evidence lives in the per-question `attempts` map.
- Assessment, submission, grading, and scoring flows use the current question
  configuration. Use `getQuestionSections` to load it on the server.
- Audio responses store files, transcripts, and grades. Question assets use
  `question-assets/audios` and `question-assets/images`; browser path helpers live
  in `src/lib/asset-paths.ts`. Storage rules distinguish question assets from
  assessment files.
- Update request schemas, API types/DTOs, and frontend consumers together when
  changing contracts. Prefer type-only imports of backend types in browser code;
  avoid importing Firebase Admin or server runtime modules into the web bundle.

## UI and code conventions

- Follow nearby React components/hooks and shared `Button`, `Alert`, `Modal`,
  and other UI components. Styling uses Tailwind plus `src/index.css`.
- Use `useTranslation` for new user-facing text and update both English and
  Traditional Chinese dictionaries in `src/i18n/translations.ts`.
  The language provider stores the preference under `quizzie.language`.
- Preserve provider lifecycle and media cleanup when editing recording flows;
  verify microphone capture, stopping, transcript handling, and navigation in
  a browser that supports the relevant APIs.
- TypeScript is strict in both apps. Root ESLint uses type-aware TypeScript rules
  and React Hooks checks. Prettier uses two spaces, semicolons, trailing commas,
  double quotes by default, a 100-column width, and LF line endings.
- Keep edits focused and preserve existing user changes. Edit source files rather
  than generated build output; update this guide when its commands or architecture
  become inaccurate.

## Configuration facts to check before local verification

- `README.md` contains outdated placeholder Firebase/auth instructions and
  non-workspace command examples; use the current code and package scripts.
- Browser Firebase settings live in `apps/web/src/lib/firebase-config.ts` and
  currently target `quizzie-hku`; they are not loaded from Vite environment variables.
- `apps/web/src/lib/firebase.ts` connects Functions to `127.0.0.1:5001` only when
  the page hostname is exactly `localhost`. Auth uses the configured cloud project,
  and Storage emulator connection is commented out. Local development is therefore
  not automatically isolated from cloud services; confirm connections before
  running flows that write data.
- Firestore rules currently have a temporary access cutoff of 2025-10-27, so
  direct client Firestore access is denied after that date. Firebase Admin backend
  access uses IAM rather than those client rules. Do not assume local rules match
  the deployed version.
- Keep service account credentials and local environment files out of commits and
  logs. Treat deployment as a separate requested operation, not a verification
  command; Functions deployment runs lint and build via Firebase predeploy hooks.
