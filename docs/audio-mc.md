# Audio-first questions with optional MC

Admins can choose `audio_mc` when creating or editing any section. The intended
sections s02/s05 (stored section IDs `1` and `4`) can be configured individually. Each
question requires question and choices audio clips (which may use the same file),
at least two labeled options with stable keys, and a correct key. Choosing the hybrid type enables the
required option/key fields.

The tester can record a spontaneous response or directly offer MC choices. Offering
choices retains any recording and transcript. The button toggles the choices and
their audio player; collapsing returns to audio-only submission, records assistance
as not offered, and omits the MC answer. Recording is available with choices open or closed.
Assisted submission requires an option. Skip stores a null MC response
while retaining initial evidence. Option labels display their actual configured keys.
Only a manual 0–5 grade awards points; MC correctness never assigns a score.

## Configuration

Assessment playback, submission validation, grading, totals, subtasks, and z-scores
use the current section configuration maintained in Admin Questions.

## Responses and recording lifecycle

The hybrid endpoint accepts `assistanceOffered`, `selectedOption`, and `skipped`
alongside a recording URI and transcript. Hybrid section responses retain `files`,
`transcripts`, and optional `grades`, and add `attempts` keyed by question. Existing
MC/audio persisted shapes are preserved. Ownership/admin access, question bounds,
response mode, option membership, recording path, and uploaded-file existence are
validated before saving. Answer evidence and assessment progress are written together.
Identical save retries retain a grade; changing evidence invalidates the old grade.

Recording startup, capture, and finalization keep submission disabled. Recorder errors
wait for the final blob instead of enabling actions early. Speech final results are
accepted before submission; a four-second speech-service timeout retains the finalized
recording and available transcript. Cancelling or navigating invalidates every old
success/error callback. Playback is isolated across question, choices, recording, and
instruction players. Recordings use immutable filenames; successful uploads are reused after a failed API
save, while a new recording has a new URI and invalidates its previous grade.

Grading controls require evidence for that specific question, including submitted skips
and direct MC fallback. A fallback without audio shows “no recording” and no empty
player. The grade and transcript APIs reject nonexistent evidence and MC-only records.

## Verification

From the repository root:

```sh
node scripts/verify-audio-mc.cjs
npm run build --workspace apps/functions
npm run build --workspace apps/web
npm run lint --workspace apps/functions
npm run lint --workspace apps/web
```

The local regression script executes source with in-memory Firestore transactions,
real Express router mounting, and fake React/media APIs. It covers configuration
creation and editing, MC/audio submission and scoring, spontaneous-only, assisted
correct/incorrect answers, direct MC fallback, skips retaining audio, stable displayed
keys, evidence-only grading, access and validation, atomic save failures/retries,
upload reuse, recording finalization/errors/timeouts, and navigation cleanup. It opens
no network listeners and makes no cloud requests. These simulated checks do not replace
browser testing of media APIs.

## Browser verification still required

Use Chrome or Edge with microphone and Cantonese recognition support in an explicitly
isolated test setup. Local web development otherwise uses cloud Auth and Storage.

- Configure/reload s02 and s05 with nonsequential option keys and separate or shared audio clips.
- Submit spontaneous-only audio; offer choices after recording; offer choices directly;
  select an incorrect option; and skip an assisted question after recording.
- Expand and collapse choices, record with choices visible, and confirm collapsed
  submission saves audio-only evidence even when an MC option was previously selected.
- Check that evidence survives revealing choices, every player is blocked during
  recording, and submission waits for final audio/transcript events.
- Interrupt an upload or save and retry; inspect saved evidence and progress.
- Navigate while a permission request or save is pending; confirm the next question
  has no stale recording, transcript, selection, assistance state, or errors.
- Grade direct fallback and skips, verify unanswered questions have no grade controls,
  then reload and check totals, subtasks, and z-scores.
