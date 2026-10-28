# VACA archive interaction contract

## Business sources

The assessment archiving request establishes a shared, reversible archive status
for completed and incomplete assessments. The owner-or-admin permission model is
implemented by `getAssessmentWithAuth` in the backend assessment model. API schemas
in `types/zod/routes/assessments.ts` define accepted archive requests.

## Canonical ownership

| Capability       | Owner                                      | Contract                                                                                                          |
| ---------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Archive mutation | useAssessmentArchive                       | Wait for server success, remove the record, announce success; retain on failure.                                  |
| Feedback         | AssessmentArchive + shadcn Alert           | Localized inline success/error in one polite live region; nested alerts use presentation roles.                   |
| Dialogs          | shadcn Dialog                              | Controlled dismissal; shared scrolling body with visible title/actions, localized close labels, and focus return. |
| Buttons          | shadcn Button + ButtonLink + ArchiveButton | Shared variant recipe; ghost archive actions, stable busy geometry, duplicate-submit protection, visible focus.   |
| Admin filtering  | AdminViewAssessments                       | Existing native selects; operating-system popup appearance is accepted.                                           |
| Navigation       | App route guards + PageHeader              | User archive is owner-scoped; admin archive requires admin claims.                                                |

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
