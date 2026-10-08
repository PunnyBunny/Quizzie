# Audio-first questions with optional MC

Admins can select `audio_mc` for s02 and s05 (stored section IDs `1` and `4`). Each
question requires its question audio, a separate choices audio clip, at least two
labeled options, and a correct option key. The save API validates this configuration.
Option keys are preserved in submissions; labels and the answer key are snapshotted
with the evidence so later configuration edits do not change the assisted attempt.

The tester can record a spontaneous response or directly offer MC choices. Revealing
choices records assistance offered without discarding the initial recording or
transcript. An assisted normal submission requires an option; Skip saves a null MC
answer and retains initial evidence. Recording is disabled after assistance is offered.
Submission and assistance wait for both recorder and speech recognition finalization.

`/submit-audio-mc-answer` validates ownership/admin access, question configuration,
option membership, recording path, and evidence combinations. Hybrid records retain
`files`, `transcripts`, and `grades`, and add an `assistance` map keyed by question.
Each entry stores `offered`, `selectedOption`, `choices`, and `correctAnswer`.
One manual 0–5 grade determines totals, subtasks, and z-scores. MC correctness is
shown as evidence and never awards points automatically. Grading uses the saved
response type when section configuration changes. Existing MC/audio documents retain
their shapes; mixed response types in a single section are rejected.

Run local checks from the repository root:

```sh
node scripts/verify-audio-mc.cjs
npm run build --workspace apps/functions
npm run build --workspace apps/web
npm run lint --workspace apps/functions
npm run lint --workspace apps/web
```

The local verification script uses fake media APIs and in-memory backend dependencies;
it makes no network requests. It checks configuration, evidence combinations,
authorization, invalid options and recording paths, skipped evidence, snapshots,
historical response types, manual scoring, finalization, and stale navigation events.

## Browser verification still required

Use Chrome or Edge with microphone and Cantonese recognition support, against an
explicitly isolated test setup. Local web development otherwise connects Auth and
Storage to the configured cloud project. Do not perform these checks against
production data.

- Configure and reload s02/s05 with nonnumeric option keys and distinct question/choices clips.
- Submit spontaneous-only audio; offer choices after a recording; offer choices directly;
  select an incorrect option; and skip an assisted question after recording.
- Confirm initial playback/transcript survives revealing choices, choices cannot play
  during capture, and submissions remain disabled until final audio/transcript events.
- Interrupt an upload/save, retry, and confirm evidence remains available and saves once.
- Navigate during capture/startup, then verify the next question has no stale audio,
  transcript, assistance state, selection, or error.
- Grade recorded and direct-fallback attempts, reload, and check totals/subtasks/z-scores.
- Inspect historical MC/audio assessments after changing section configuration.
