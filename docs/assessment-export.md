# Assessment Excel export

Administrators can use **Export all data (XLSX)** on the active or archived
assessment page. The workbook includes every assessment, including unfinished
and archived records, independently of table filters and the Load more limit.
The admin-only `api/admin/export-assessments` endpoint loads the dataset;
the browser builds the `.xlsx` download without changing stored data.

## Sheets

- **Demographics**: one row per assessment, with demographics, language entries,
  progress, timestamps, archive/completion flags, and overall scores. Short headers
  include `id`, `name`, `birth_date`, `mother_tongue`, `score`, and `max_score`.
  Additional languages use `lang1` / `lang1_other`, `lang2` / `lang2_other`, etc.
- **Section ID - Section title** (for example, **3 - Vocabulary**): one sheet per
  assessment section, named by its stored ID and title, with one row per assessment.
  `name` and `id` identify the student.
  MC sheets have `q1`, `q2`, etc., containing the selected answer keys. Audio
  sheets use those same short headers for transcripts. Audio MC sheets have
  `q1_transcript`, `q1_choice`, `q1_help`, etc. Choices are blank when none were
  selected; help uses `1`/`0`, or is blank when no attempt was stored. Skipped
  and unanswered MC questions are blank. Scores stay in the summary sheets.
  No recording/Storage links are exported.
- **Subtasks**: one row per assessment and subtask, linked by `id`. Columns include
  `subtask`, `subtask_name`, `score`, `max_score`, `scored`, `ungraded`, `norm_group`,
  and norm values `min`, `max`, `n`, `mean`, `sd`, and `z`.
- **Questions**: a guide mapping `section`, `sheet`, and `q` to full section titles,
  question text, configured kind, correct answer, and maximum score. This keeps
  descriptive text out of the section sheets' column names.

`id` is the assessment ID and joins the demographic, section, and subtask data.
Section tab names use stored IDs and titles, independent of their position. Question labels
are **one-based**: q1 corresponds to stored question index 0. The Questions guide's
`section` column is the one-based position and `sec_id` is the stored ID.
Demographics `section` and `question` retain the stored zero-based progress indices.
Worksheet names remove Excel's invalid characters and fit the 31-character limit;
names that collide after sanitization, truncation, or case folding get a numeric
suffix. Historical sections without a current ID use `Historical <stored index>`.
Sections/items outside the current configuration are retained. Historical
section columns follow the stored response kinds, combining fields if multiple
kinds were recorded; unavailable configuration fields in Questions remain blank.

Numbers are native Excel numbers, flags use numeric `1`/`0`, and missing values
are blank. Dates retain their stored ISO text and UTC timestamps; month-only
birth dates keep that precision. Text, including Chinese, quotes, backslashes,
and newlines, stays intact in a single Excel cell. Text beginning with `=` is
stored as text, never as a formula. Header rows are frozen. The Name column comes
first and is the only frozen column on assessment sheets; ID remains in column B.
The Questions guide has no frozen columns. The XLSX writer loads only when exporting.

Scores use the same helpers and current configuration as the score dialog.
Totals sum available scores; `scored` and `ungraded` identify partial results.
Ungraded counts follow the score dialog's audio-only definition. Z-scores are
blank when norms are absent or standard deviation is not positive. Plain audio
responses do not store a separate skipped flag, so that field remains blank.

The export timestamp records when the server finished loading the data; reads
are not a database transaction. Empty datasets still produce headers and the
current Questions guide. New sections/items/languages may add sheets or columns.
