# VACA archive interaction contract

## Business sources

The assessment archiving request establishes a shared, reversible archive status
for completed and incomplete assessments. The owner-or-admin permission model is
implemented by `getAssessmentWithAuth` in the backend assessment model. API schemas
in `types/zod/routes/assessments.ts` define accepted archive requests.

## Canonical ownership

| Capability       | Owner                                       | Contract                                                                                                          |
| ---------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Archive mutation | useAssessmentArchive                        | Wait for server success, remove the record, announce success; retain on failure.                                  |
| Feedback         | AssessmentArchive + shadcn Alert            | Localized inline success/error in one polite live region; nested alerts use presentation roles.                   |
| Dialogs          | shadcn Dialog                               | Controlled dismissal; shared scrolling body with visible title/actions, localized close labels, and focus return. |
| Buttons          | shadcn Button + ButtonLink + ArchiveButton  | Shared variant recipe; ghost archive actions, stable busy geometry, duplicate-submit protection, visible focus.   |
| Admin filtering  | AdminViewAssessments                        | Existing native selects; operating-system popup appearance is accepted.                                           |
| Demographics     | shadcn Input + AssessmentSelect             | Authored popup; delayed aria-invalid state, linked errors, and localized clearing placeholders.                   |
| Navigation       | App route guards + PageHeader               | User archive is owner-scoped; admin archive requires admin claims.                                                |
| Excel export     | AdminViewAssessments + assessment-export.ts | Admin-only complete dataset; shared score helpers, guarded retries, and a localized download action.              |
| MC option format | AdminQuestions + native radio group         | Section-level Text/Audio; Text by default; switching preserves values, recordings, and play limits.               |

## Flow

Inline alerts never expire on a timer. Success uses the shared green Alert variant,
and recoverable conditions use amber warning. Retry and recovery controls belong
to `AlertAction`, which stacks below the message on narrow screens and sits beside
it on wider screens. Their existing reload, retry, reset, and navigation behavior
is preserved. Recording notices carry severity
from the provider: transcription failures preserve audio and appear as warnings;
capture failures remain errors. User creation/removal and the subsequent list
refresh are handled separately so a refresh failure produces a warning confirming
the completed action. Confirmed removals leave the local list immediately.

Question/subtask editors, password links, score reports, and section instructions
use the shared Dialog primitives. Direct open buttons use `DialogTrigger`;
password links open programmatically after their API call succeeds. Editor
triggers prepare the selected form before opening, and score dialogs fetch only
when opened, refreshing their data on each reopening. Footer dismissal uses
`DialogClose`; Escape and backdrop dismissal follow the same Dialog close path.
The question editor retains its discard
confirmation and remains open when the user cancels it. Save errors remain in the
open editor. Score dialogs keep their title and close action during loading and
failure. Long bodies scroll independently of the header and footer; dialog widths
preserve the previous wide-editor and compact-password-link layouts.

Archive from an active list; restore from its archive page. Both actions stay on
the current page. Completed records return to completed lists; incomplete records
return to ongoing lists. Archive pages provide restoration, with resume/grading
available from active lists. Existing direct URLs retain their access behavior.
The status is shared between owners and admins and persists in Firestore.
Sections, answers, grades, and files are retained. No confirmation is needed for
these reversible list-organizing actions.

The current API returns complete lists. Archive lists and admin tables use Load more in batches
of 20; admin tables preserve existing filters and sorting. Server pagination and
live cross-tab subscriptions are outside this feature. Reloading a list retrieves
current persisted status.

## Assessment Excel export

The admin assessment pages expose a shared **Export all data (XLSX)** action.
It requests the complete dataset through the admin-guarded export endpoint,
including active, archived, finished, and unfinished records regardless of list
filters or visible row count. The workbook has a Demographics sheet, one sheet per section, a Subtasks sheet,
and a Questions guide, linked by assessment ID. Section tabs use stored section
IDs and titles. Each section follows its kind's schema: MC answers and audio transcripts
use `q1`, `q2`, etc.; audio MC
uses `q1_transcript`, `q1_choice`, and `q1_help`. Only Name is frozen, and Storage
links are omitted. Scores remain in the summary sheets. It uses the
current score helpers; `docs/assessment-export.md` records the column contract.
The button retains its width while busy and prevents repeated requests. Failures
remain inline with an export-specific Retry action; success reports the exported
assessment count. Both messages persist until another export or navigation.

## Home navigation

Home uses native links for View, Grade, Archive, and Administration. The existing
admin claim determines whether Administration is shown; route guards remain the
authorization owner. Starting an assessment opens `/new-assessment` in a new tab,
with that behavior explained next to the link. ButtonLink in the shared Button
module owns button-styled navigation. See DESIGN.md for the task-hub layout.

## Verification

Run both workspace builds/lints and the web formatting check. The in-memory
regression script verifies archive authorization, filtering, legacy documents,
validation, repeated updates, and retention without cloud writes. Browser checks
cover both languages, keyboard operation, mobile layout, success, failure, and
empty archives when an authenticated environment is available.

## Question timing

`useQuestionTime` owns elapsed timing for each question visit. It checkpoints every
10 seconds. Closing or leaving the page does not trigger an extra save.
Hidden tabs keep accumulating time. Elapsed timestamps, rather than callback counts,
allow a delayed background checkpoint to include the full interval. Navigating away
stops timing; a back/forward-cache restoration resumes it. No timing is persisted
in browser storage. Abrupt shutdown retains the last successful checkpoint;
failed checkpoints are retried with the latest cumulative total while the page stays open.

Next and confirmed Skip stop timing before uploading or saving; their final timing
is committed in the answer transaction. Failed submissions resume timing, excluding
the upload/save wait. Confirmed Save and Exit waits for its timing save and stays on
the question with an error if saving fails. Skip and exit confirmations use the
shared Dialog with Cancel as the first action. Background failures show a localized
warning and Retry without blocking answering or recording.

Timing loads opening question, section, and overall totals once per question mount.
The client saves opening question seconds plus elapsed seconds; the server keeps
`max(stored, incoming)`. Failed reads retain elapsed time in memory and retry before
saving; answers can still submit without timing. No baseline is assumed to be zero.
This supports supervised single-tab use. Refreshing with a delayed save can undercount;
the checkpoint interval is not a maximum loss guarantee.

The header timer is visible only in debug mode for verified authenticated admins,
and is off by default. For admins on any route, including login, `?debug=1` enables
it and `?debug=0` disables it. Shared `DebugProvider` state remembers the choice
across navigation and refresh for the current browser tab using `sessionStorage`
key `quizzie.debug`. Missing or invalid values leave the preference unchanged.
If storage is unavailable, the preference still survives in-app navigation;
refresh requires the URL flag again.
Debug stays hidden while auth/admin verification is loading; URL flags wait for
verification and survive in-app redirects. Signed-out/non-admin users and auth
failures disable debug, clear its stored/in-memory preference, and replace the
current URL without all `debug` parameters. The pathname, other query parameters,
hash, and navigation state are preserved. A user switch requires fresh admin
verification; stale claims and late results from a previous user cannot enable debug.
`useQuestionTime` stays mounted and checkpoints in both modes. The progress bar
and timing failure warning/Retry remain visible in normal mode.

In debug mode, the header adds live elapsed seconds to opening section/overall
totals, without adding checkpoints again. Its separate one-second tick preserves
recording controls and audio players. Values use `HH:MM:SS`, tabular digits, and
no per-tick announcements.
Unknown totals show placeholders; timing failures show a warning and Retry.
Instructions and upload/save waits are excluded. Grading and XLSX expose saved whole
seconds; historical missing timing stays unavailable. Timing saves preserve evidence,
grades, and playback counts and never advance assessment progress.

## Audio playback

Question asset uploads use `AssetUploader` with a file picker and the shared media
preview. A selected file receives a unique generated filename. A replacement is
uploaded separately and its path updates the editor only after upload succeeds;
failed uploads retain the previous value and show an inline error. The previous
saved asset stays available while an edit is pending. No filename entry is required.
Remove clears the form value and preview, retaining the stored file; saving the
editor applies that removal to the question.
MC and hybrid sections use `mcOptionFormat` (`text_option` or `audio_option`), with Text as the default for both new
sections and missing historical values. Plain audio sections have no option-format
UI. The hybrid kind continues to mean recorded-answer plus optional MC assistance;
the format controls only the offered options. `packages/contracts/questions.d.ts`
and the question-save schema define this configuration contract.

Both formats require at least two unique nonblank option keys and a correct key
from those options. In Text mode, `choices` values are required nonblank option text,
displayed beside the keys during assessment and grading. In Audio mode, the same
values are optional text; students initially see keys with recordings and see the
text from each option’s second successful play onwards.
Grading always shows available option text beside the keys in both formats,
including hybrid selected and correct answers.
Question and option recordings may be missing while content is being prepared.
Audio-mode missing recordings remain explicit and do not bypass the text reveal threshold.
Text mode mounts no option player/playback hook, fetches no option audio assets or
playback counts, logs no playback events, and initializes no tracking for new answers.

Changing format changes labels and visible controls while retaining `choices`,
`optionAudios`, uploaded files, and `maxOptionPlays` through save and reopening.
Audio mode exposes and validates an integer play limit from 1 to 20; Text mode
preserves the last valid limit without validating or using an unfinished numeric edit.
Admin Questions disables Save while any uploader is active, including instruction,
question, option, and image uploads. It waits for all concurrent uploads and their
URL lookups to finish; success updates the file path before enabling Save, and
failure enables Save with the previous path retained. Toggling format while an
option upload is in flight keeps Save disabled until it finishes and keeps its
successful path even after the uploader is hidden. Form submission also checks
the active uploads so Enter cannot save an unfinished upload.

The shared `AudioPlayer` uses a native audio element with app-owned controls at every playback location.
Audio-format MC option recordings use its `option` variant through `McOptions` for
both ordinary MC and assisted hybrid questions. Play and answer selection are separate controls;
option text appears in its radio label once that option has at least two successful
starts. Cached and saved counts restore revealed text on revisits. Failed starts
do not reveal text; a delayed or failed count save does not hide it. Missing text
leaves the option audio only. With a one-play limit, text stays hidden.
The default allowance is two starts per option per
assessment. Admin Questions can set a section's limit from 1 to 20. Stop ends the
current listening; starting again counts another play and restarts from the beginning.
There is no seeking or uncounted resume/replay. Exhaustion leaves selection available.
The frontend checks the allowance and starts native audio immediately. A successful
start increments a locally cached count and is saved in the background; failed
starts produce no count. Recording event IDs make background-save retries idempotent.
Stored counts load in the background and merge with newer local counts without
reducing them. Playback and answer submission remain available while count requests
are pending or failing. The backend records events without enforcing the play limit,
including late events saved after submission or a switch to Text format. Grading
and XLSX retain historical counts after a format switch; new Text answers have no
playback tracking unless historical tracking already exists.
Missing option recordings show an error; text visibility still depends on the
option’s successful play count. Legacy shared choices clips remain stored but are no longer offered during
assessment. API contracts are declared in `packages/contracts/submissions.d.ts`;
ownership uses `getAssessmentWithAuth`.

Question, instruction, recording, and upload previews use the simple
variant without seeking or hidden seek shortcuts. Grading uses the grading variant
with seeking and ten-second jumps. Both expose localized play/pause and Replay.
Grading downloads recordings as blobs only when their section is opened. Each
recording has its own loading or error state; questions, grades, transcripts, and
other recordings remain usable. Completed blob URLs stay cached for the assessment
page's lifetime. Switching away ignores unfinished results; downloads can finish
in the background and have their own 60-second fetch timeout. Each uncached
section load or Retry fetches fresh signed URLs; Retry keeps successful downloads.
The hook owns blob URLs and revokes them when leaving the assessment. Storage CORS
allows the deployed app and the documented local origins in `storage.cors.json`.
The player owns its native audio element and reads duration from `loadedmetadata`;
it does not probe media duration by seeking or wait for browser buffering ranges.
Finalized recordings expose duration before Play once metadata has loaded.
Grades and transcript drafts are preserved through loading, failure, and retry.
Playback never autostarts on mount or source replacement. A replacement source
starts fresh; language changes preserve playback. Replay returns the current clip
to the beginning and leaves it paused. Loading/buffering and recoverable playback
failures appear inline; Play retries a media failure. Unmounting pauses audio, including hidden assistance,
closed instruction dialogs, replaced upload previews, and route changes. Cleanup
remains safe under React Strict Mode.

Assessment recording retains its existing capture guard: starting recording pauses
all players, playback during recording is paused immediately, and starting one
assessment player pauses the others. Media providers and blob URL ownership remain
unchanged. After capture stops, WebM recordings are decoded to measure duration and
their container metadata is finalized before preview or upload. The finalizing
state covers this work as well as transcription completion. MP4 and WebM files
with valid duration metadata pass through. A repair failure preserves the original
audio with a localized warning; stale completions cannot replace a new recording.
See `docs/webm-recordings.md` for the existing-recording repair and rollout procedure.
