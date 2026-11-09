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

## Audio playback

The shared `AudioPlayer` uses a native audio element with app-owned controls at every playback location.
Question, assistance, instruction, recording, and upload previews use the simple
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
