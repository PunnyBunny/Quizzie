# Audio-first questions with optional MC

Admins can choose `audio_mc` when creating or editing any section. The intended
sections s02/s05 (stored section IDs `1` and `4`) can be configured individually. Each
question requires at least two options with stable keys and a correct key.
Audio uploads are optional when saving: sections can have no recordings or only
some option recordings while content is being prepared. Choosing the hybrid type
enables the required option/key fields.

The tester can record a spontaneous response or directly offer MC choices. Offering
choices retains any recording and transcript. The button toggles the options and
their audio players; collapsing returns to audio-only submission, records assistance
as not offered, and omits the MC answer. Recording is available with choices open or closed.
Assisted submission requires an option. Skip stores a null MC response
while retaining initial evidence. Only the configured option keys are displayed;
students hear the answer content through each option's recording.
Only a manual 0–5 grade awards points; MC correctness never assigns a score.

## Configuration

Assessment playback, submission validation, grading, totals, subtasks, and z-scores
use the current section configuration maintained in Admin Questions.

MC options use their configured string keys, such as `A`, `B`, or `D`, for display
and submission. Ordinary MC grading compares the submitted key with the configured
correct key; hybrid questions continue to use one manual 0–5 grade.

Admin Questions uploads a recording per option to the existing question-audio
asset area. `optionAudios` maps option keys to asset paths for each question;
`choices` maps option keys to optional admin hints. These hints can be edited and
displayed only in Admin Questions; assessment and grading show option keys without
hint text. Existing values are preserved. Existing sections need
their individual recordings configured before students can listen. Missing audio
is reported explicitly without displaying the answer text. Legacy `choicesAudios`
is retained in stored sections but no longer played during assessment.

`AssetUploader` offers a file picker and a preview. It generates a unique storage
filename for each selection, retaining the selected file's extension. Replacing
an asset uploads a new file and updates the editor's path, so the previous saved
file stays available while the edit is pending. The filename is handled internally.
Remove clears the editor's file selection while retaining the stored asset.

`maxOptionPlays` is a section-level integer from 1 to 20, defaulting to **2**.
Every new start counts, including starting again after Stop or interruption by
another player. Each start plays from the beginning; option players have no seek
or pause/resume shortcut. Once exhausted, the student can still select the option.
The frontend checks this limit and calls native `audio.play()` immediately when
Play is pressed. Playback does not wait for a backend request. A successful start
increments the local count; a failed start leaves the count unchanged. Counts are
cached in browser storage so hiding choices or reloading preserves the allowance.
The section's limit comes from the question configuration already loaded by the app.

`get-option-audio-playback` loads stored counts in the background and merges them
with local counts without reducing plays recorded meanwhile. A failed read does
not disable playback. `update-option-audio-playback` records successful starts
asynchronously. Both endpoints retain owner/admin access and question/option
validation. The backend stores reported plays without enforcing the playback limit;
the frontend is responsible for that check. A delayed save can finish after answer
submission or assessment completion. Listening alone creates no answer and advances
no progress. Grading displays counts and XLSX adds `q1_plays_A`, etc.

## Playback IDs and counting

After native playback starts successfully, `McOptions` creates a `playbackId` UUID
and sends it with the assessment ID, section, question, and option key. This ID
identifies an audible play for background-save retries. A retry reuses the same ID,
so a lost response cannot cause the server to count that play twice.

`optionPlaybackIds` is stored on the section's student response document as
`question index -> option key -> UUID[]`. For example, question 0 with options A
and B starts as `{ "0": { "A": [], "B": [] } }`. `initialOptionPlaybackIds` builds
these empty lists. An empty list records zero plays; an absent tracking field on a
historical response means the count is unknown. Response DTOs, grading, and exports
expose each list's length through `optionPlayCounts`.

A failed background save shows Retry and keeps its event ID in memory for the
current options component. Playback and answer submission stay available while
saves are pending or failing. Retry sends unsaved events again and refreshes stored
counts. The local count continues to enforce the limit during an outage. Once a
recording starts, it counts even when the student stops early. Failed audio starts
produce no event and need no cancellation or refund.

`updateOptionAudioPlayback` uses a Firestore transaction to add the event ID once
and preserve existing answers, grades, and other questions' counts. Answer saving
shares the response lookup so both flows retain older documents with generated IDs.
Submission initializes unplayed options to zero while retaining recorded plays.

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
- Upload individual option recordings. Play one twice and confirm a third start
  is blocked while selecting it remains possible. Verify another option still
  has its own allowance, and that reload, assistance toggling, and another tab
  preserve counts. Delay or fail playback-count requests and confirm audio starts
  immediately, the frontend limit still applies, and Retry saves each play once.
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
