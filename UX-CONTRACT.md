# VACA archive interaction contract

## Business sources

The assessment archiving request establishes a shared, reversible archive status
for completed and incomplete assessments. The owner-or-admin permission model is
implemented by `getAssessmentWithAuth` in the backend assessment model. API schemas
in `types/zod/routes/assessments.ts` define accepted archive requests.

## Canonical ownership

| Capability       | Owner                            | Contract                                                                                            |
| ---------------- | -------------------------------- | --------------------------------------------------------------------------------------------------- |
| Archive mutation | useAssessmentArchive             | Wait for server success, remove the record, announce success; retain on failure.                    |
| Feedback         | AssessmentArchive + shared Alert | Localized inline success/error in a polite live region.                                             |
| Buttons          | shared Button + ArchiveButton    | Text variant for archive actions, stable busy geometry, duplicate-submit protection, visible focus. |
| Admin filtering  | AdminViewAssessments             | Existing native selects; operating-system popup appearance is accepted.                             |
| Navigation       | App route guards + PageHeader    | User archive is owner-scoped; admin archive requires admin claims.                                  |

## Flow

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

## Verification

Run both workspace builds/lints and the web formatting check. The in-memory
regression script verifies archive authorization, filtering, legacy documents,
validation, repeated updates, and retention without cloud writes. Browser checks
cover both languages, keyboard operation, mobile layout, success, failure, and
empty archives when an authenticated environment is available.
