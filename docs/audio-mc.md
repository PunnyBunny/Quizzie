# Recorded answers with optional MC

Admins can choose `audio_mc` when creating or editing any section. The intended
sections s02/s05 (stored section IDs `1` and `4`) can be configured individually. Each
question requires at least two options with stable keys and a correct key.
Audio uploads are optional when saving: sections can have no recordings or only
some option recordings while content is being prepared. Choosing the hybrid type
enables the required option/key fields. The `audio_mc` kind describes the answer
and assistance flow, independently of whether the MC options use text or audio.

The tester can record a spontaneous response or directly offer MC choices. Offering
choices retains any recording and transcript. The button toggles the configured
text or audio options; collapsing returns to audio-only submission, records assistance
as not offered, and omits the MC answer. Recording is available with choices open or closed.
Assisted submission requires an option. Skip stores a null MC response
while retaining initial evidence. Text options show their configured keys and option
text; audio options show keys with individual recordings and reveal available
choice text from each option’s second successful play onwards.
Only a manual 0–5 grade awards points; MC correctness never assigns a score.

## Configuration

Assessment playback, submission validation, grading, totals, subtasks, and z-scores
use the current section configuration maintained in Admin Questions.

MC options use their configured string keys, such as `A`, `B`, or `D`, for submission.
Ordinary MC grading compares the submitted key with the configured
correct key; hybrid questions continue to use one manual 0–5 grade.

Admin Questions offers a section-level **MC option format** choice for `mc` and
`audio_mc`: **Text** (`text_option`) or **Audio** (`audio_option`). New sections default to Text. Existing sections
without `mcOptionFormat` also use Text. Plain `audio` sections have no option format.
This choice does not change answer keys, scoring, timing, recording, or assistance.

`choices` maps stable option keys to strings. In Text mode the editor labels them
**Option text**; every option requires nonblank text, displayed to students and in
grading. Text options mount no playback hook/player, request no option audio assets
or counts, and log no playback events. In Audio mode the same strings are optional
**Option text**, revealed to students from the second successful play of that
option onwards and always shown in Admin Questions and grading. Markers see available option
text for both formats, including hybrid selected and correct answers. The editor reveals individual
recording uploaders and the section play limit. Both modes require at least two
unique nonblank keys and a matching correct key; Audio option text and recordings remain
optional when saving.

`optionAudios` maps option keys to asset paths in the existing question-audio area.
Switching format preserves both choice strings and option recordings, plus the
play limit, through saving and reopening. It never deletes uploaded assets.
Audio mode needs individual recordings before students can listen; missing audio
is reported without bypassing the text reveal threshold. Legacy `choicesAudios` remains stored
but is not played during assessment in either format.

`AssetUploader` offers a file picker and a preview. It generates a unique storage
filename for each selection, retaining the selected file's extension. Replacing
an asset uploads a new file and updates the editor's path, so the previous saved
file stays available while the edit is pending. The filename is handled internally.
Remove clears the editor's file selection while retaining the stored asset.
Save remains disabled throughout any concurrent uploads and URL lookups, even if
the format changes to Text and hides the option uploader. Successful uploads still
update the retained path before saving is enabled.

In Audio mode, `maxOptionPlays` is a section-level integer from 1 to 20, defaulting
to **2**. Text mode preserves the last valid limit without using or validating an
unfinished edit to that setting.
Every new start counts, including starting again after Stop or interruption by
another player. Each start plays from the beginning; option players have no seek
or pause/resume shortcut. Once exhausted, the student can still select the option.
The frontend checks this limit and calls native `audio.play()` immediately when
Play is pressed. Playback does not wait for a backend request. A successful start
increments the local count; a failed start leaves the count unchanged. Counts are
cached in browser storage so hiding choices or reloading preserves the allowance.
The section's limit comes from the question configuration already loaded by the app.

`AudioMcOptions` uses the same counts to reveal each option’s `choices` text at two
or more successful starts. The second play reveals text immediately, without waiting
for its background save. Cached counts restore it after remounting or reloading;
stored counts restore it when loaded from the backend. Failed starts and save retries
do not reveal text early. A failed save does not hide text already revealed. Empty
or missing choice text remains audio only; a one-play limit never reveals text.

`get-option-audio-playback` loads stored counts in the background and merges them
with local counts without reducing plays recorded meanwhile. A failed read does
not disable playback. `update-option-audio-playback` records successful starts
asynchronously. Both endpoints retain owner/admin access and question/option
validation. The backend stores reported plays without enforcing the playback limit;
the frontend is responsible for that check. A delayed save can finish after answer
submission, assessment completion, or a format switch to Text. A format change
alone must not reject an event already in flight. Listening alone creates no answer
and advances no progress. Grading and XLSX retain historical counts in either format;
XLSX adds `q1_plays_A`, etc., where Audio configuration or playback history warrants it.

## Playback IDs and counting

In Audio mode, after native playback starts successfully, `McOptions` creates a `playbackId` UUID
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
Audio-mode submission initializes unplayed options to zero while retaining recorded
plays. New Text answers do not initialize `optionPlaybackIds` or zero play counts.
Saving a Text answer preserves any existing tracking and historical counts; late
Audio events merge without overwriting answers or grades.

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

- Verify new sections and existing sections without a format open in Text mode.
  Check Text options and grading show keys plus option text, reject blank text on
  save, and make no option-recording or playback-count requests. Confirm hybrid
  recording and assistance still work with Text options.
- Configure/reload s02 and s05 with nonsequential option keys. Switch Text → Audio
  → Text → Audio and verify strings, uploaded recordings, and play limits survive
  both toggling and save/reopening. Plain Audio sections have no format selector.
  Toggle to Text during an upload and confirm Save waits and retains the result.
- In Audio format, upload individual option recordings. Play one twice and confirm a third start
  is blocked while selecting it remains possible. Confirm its text is hidden on the
  first play and appears when the second starts, including while its save is pending
  or failing. Reload and confirm the text stays visible. Verify another option still
  has its own allowance, and that reload, assistance toggling, and another tab
  preserve counts. Delay or fail playback-count requests and confirm audio starts
  immediately, the frontend limit still applies, and Retry saves each play once.
  Switch the section to Text with an event in flight and confirm it is retained
  once, with historical counts still available in grading and XLSX.
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
