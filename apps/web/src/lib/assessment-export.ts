import type { AdminExportAssessmentsOutput } from "../../../functions/src/types/admin";
import type { StudentResponseDto } from "../../../functions/src/types/models/student-responses-dto";
import {
  computeSubtaskScore,
  computeZScore,
  getNormGrade,
  getQuestionMaxScore,
  getQuestionScore,
} from "./scoring";

type Value = string | number | null | undefined;
export interface ExportSheet {
  name: string;
  headers: string[];
  rows: Value[][];
}
interface QuestionCoordinate {
  sectionIndex: number;
  questionIndex: number;
}
type ItemField = "answer" | "transcript" | "choice" | "help";
const SECTION_FIELDS: Record<StudentResponseDto["type"], ItemField[]> = {
  mc: ["answer"],
  audio: ["transcript"],
  audio_mc: ["transcript", "choice", "help"],
};

function responseKeys(response: StudentResponseDto): string[] {
  return response.type === "mc"
    ? Object.keys(response.studentResponses)
    : [
        ...new Set([
          ...Object.keys(response.files),
          ...Object.keys(response.transcripts),
          ...Object.keys(response.grades ?? {}),
          ...(response.type === "audio_mc" ? Object.keys(response.attempts) : []),
        ]),
      ];
}
function flag(value: boolean | undefined): number | null {
  return value === undefined ? null : Number(value);
}
function sectionName(id: string, title: string | undefined, usedNames: Set<string>): string {
  const label = (title?.trim() ? id + " - " + title : id)
    .replace(/[\\/?*[\]:']/g, " ")
    .replace(/\p{C}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const base = label || "Section";
  let name = base.slice(0, 31).trim();
  for (let suffix = 2; usedNames.has(name.toLowerCase()); suffix++) {
    const ending = " (" + suffix + ")";
    name = base.slice(0, 31 - ending.length).trim() + ending;
  }
  usedNames.add(name.toLowerCase());
  return name;
}

/** One assessment per row on Demographics and each section; all sheets join on id. */
export function buildAssessmentWorkbook(data: AdminExportAssessmentsOutput): ExportSheet[] {
  const assessments = [...data.assessments].sort((a, b) => a.id.localeCompare(b.id, "en"));
  const questionsBySection = new Map<number, Set<number>>();
  data.sections.forEach((section, index) => {
    questionsBySection.set(index, new Set(Array.from({ length: section.length }, (_, q) => q)));
  });
  const responsesByAssessment = new Map<string, Record<string, StudentResponseDto>>();
  const kindsBySection = new Map<number, Set<StudentResponseDto["type"]>>();
  for (const response of data.responses) {
    const responses = responsesByAssessment.get(response.assessmentId) ?? {};
    responses[String(response.section)] = response;
    responsesByAssessment.set(response.assessmentId, responses);
    const kinds = kindsBySection.get(response.section) ?? new Set<StudentResponseDto["type"]>();
    kinds.add(response.type);
    kindsBySection.set(response.section, kinds);
    const questions = questionsBySection.get(response.section) ?? new Set<number>();
    for (const key of responseKeys(response)) {
      if (/^\d+$/.test(key) && Number.isSafeInteger(Number(key))) questions.add(Number(key));
    }
    questionsBySection.set(response.section, questions);
  }
  const configuredQuestions = data.sections.flatMap((section, sectionIndex) =>
    Array.from({ length: section.length }, (_, questionIndex) => ({ sectionIndex, questionIndex })),
  );
  const responsesFor = (id: string) => responsesByAssessment.get(id) ?? {};
  const scoredCount = (id: string, items: QuestionCoordinate[]) =>
    items.reduce(
      (count, { sectionIndex, questionIndex }) =>
        count +
        Number(
          getQuestionScore(sectionIndex, questionIndex, responsesFor(id), data.sections) !== null,
        ),
      0,
    );
  const languageCount = assessments.reduce(
    (max, assessment) => Math.max(max, assessment.otherLanguages?.length ?? 0),
    0,
  );
  const demographics: ExportSheet = {
    name: "Demographics",
    headers: [
      "name",
      "id",
      "birth_date",
      "gender",
      "grade",
      "school",
      "mother_tongue",
      "mother_other",
      "creator",
      "created",
      "updated",
      "completed",
      "finished",
      "archived",
      "section",
      "question",
      "exported",
      "norm_group",
      "score",
      "max_score",
      "scored",
      "ungraded",
    ],
    rows: [],
  };
  for (let i = 1; i <= languageCount; i++)
    demographics.headers.push("lang" + i, "lang" + i + "_other");
  for (const assessment of assessments) {
    const total = computeSubtaskScore(
      configuredQuestions,
      responsesFor(assessment.id),
      data.sections,
    );
    const row: Value[] = [
      assessment.name,
      assessment.id,
      assessment.birthDate,
      assessment.gender,
      assessment.grade,
      assessment.school,
      assessment.motherTongue?.language,
      assessment.motherTongue?.otherSpecify,
      assessment.creatorEmail,
      assessment.createdAtIsoTimestamp,
      assessment.updatedAtIsoTimestamp,
      assessment.finishedAtIsoTimestamp,
      flag(assessment.finished),
      flag(assessment.archived),
      assessment.currentSection,
      assessment.currentQuestion,
      data.exportedAtIsoTimestamp,
      getNormGrade(assessment.grade),
      total.score,
      total.maxScore,
      scoredCount(assessment.id, configuredQuestions),
      total.ungradedCount,
    ];
    for (let i = 0; i < languageCount; i++)
      row.push(
        assessment.otherLanguages?.[i]?.language,
        assessment.otherLanguages?.[i]?.otherSpecify,
      );
    demographics.rows.push(row);
  }
  const questionGuide: ExportSheet = {
    name: "Questions",
    headers: ["section", "sec_id", "sheet", "title", "q", "type", "text", "correct", "max"],
    rows: [],
  };
  const sectionSheets: ExportSheet[] = [];
  const usedNames = new Set(["demographics", "subtasks", "questions", "history"]);
  for (const [sectionIndex, questionSet] of [...questionsBySection].sort(([a], [b]) => a - b)) {
    const section = data.sections[sectionIndex];
    const questions = [...questionSet].sort((a, b) => a - b);
    const name = sectionName(
      section?.id ?? "Historical " + sectionIndex,
      section?.title,
      usedNames,
    );
    const kinds = section ? [section.kind] : [...(kindsBySection.get(sectionIndex) ?? [])];
    const fields = [...new Set(kinds.flatMap((kind) => SECTION_FIELDS[kind]))];
    const sheet: ExportSheet = {
      name,
      headers: ["name", "id"],
      rows: [],
    };
    for (const q of questions) {
      sheet.headers.push(
        ...fields.map((field) => "q" + (q + 1) + (fields.length === 1 ? "" : "_" + field)),
      );
      const current = section && q < section.length;
      questionGuide.rows.push([
        sectionIndex + 1,
        section?.id,
        name,
        section?.title,
        q + 1,
        current ? section.kind : null,
        current ? section.questions?.[q] : null,
        current ? section.correctAnswers?.[q] : null,
        current ? getQuestionMaxScore(section.kind) : null,
      ]);
    }
    for (const assessment of assessments) {
      const responses = responsesFor(assessment.id);
      const response = responses[String(sectionIndex)];
      const row: Value[] = [assessment.name, assessment.id];
      for (const q of questions) {
        const key = String(q);
        const attempt = response?.type === "audio_mc" ? response.attempts[key] : undefined;
        const values: Record<ItemField, Value> = {
          answer: response?.type === "mc" ? response.studentResponses[key] : null,
          transcript: response && response.type !== "mc" ? response.transcripts[key] : null,
          choice: attempt?.selectedOption,
          help: flag(attempt?.assistanceOffered),
        };
        row.push(...fields.map((field) => values[field]));
      }
      sheet.rows.push(row);
    }
    sectionSheets.push(sheet);
  }
  const subtaskSheet: ExportSheet = {
    name: "Subtasks",
    headers: [
      "name",
      "id",
      "subtask",
      "subtask_name",
      "score",
      "max_score",
      "scored",
      "ungraded",
      "norm_group",
      "min",
      "max",
      "n",
      "mean",
      "sd",
      "z",
    ],
    rows: [],
  };
  const subtasks = [...data.subtasks].sort((a, b) => a.id.localeCompare(b.id, "en"));
  for (const assessment of assessments)
    for (const subtask of subtasks) {
      const normGroup = getNormGrade(assessment.grade);
      const result = computeSubtaskScore(
        subtask.questionIds,
        responsesFor(assessment.id),
        data.sections,
      );
      const norms = subtask.norms[normGroup];
      subtaskSheet.rows.push([
        assessment.name,
        assessment.id,
        subtask.id,
        subtask.name,
        result.score,
        result.maxScore,
        scoredCount(assessment.id, subtask.questionIds),
        result.ungradedCount,
        normGroup,
        norms?.min,
        norms?.max,
        norms?.n,
        norms?.mean,
        norms?.stdDev,
        norms && norms.stdDev > 0 ? computeZScore(result.score, norms.mean, norms.stdDev) : null,
      ]);
    }
  return [demographics, ...sectionSheets, subtaskSheet, questionGuide];
}

export async function createWorkbookBlob(sheets: ExportSheet[]): Promise<Blob> {
  const { default: writeXlsxFile } = await import("write-excel-file/universal");
  return writeXlsxFile(
    sheets.map((sheet) => ({
      sheet: sheet.name,
      stickyRowsCount: 1,
      stickyColumnsCount: sheet.headers[0] === "name" ? 1 : 0,
      columns: sheet.headers.map((header) => ({
        width: header === "id" ? 28 : header.endsWith("transcript") ? 40 : 20,
      })),
      data: [
        sheet.headers.map((value) => ({ value, type: String, fontWeight: "bold" as const })),
        ...sheet.rows.map((row) =>
          row.map((value) =>
            typeof value === "string" ? { type: String, value } : (value ?? null),
          ),
        ),
      ],
    })),
  ).toBlob();
}

export async function downloadAssessmentWorkbook(
  data: AdminExportAssessmentsOutput,
): Promise<void> {
  const blob = await createWorkbookBlob(buildAssessmentWorkbook(data));
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "vaca-assessments-" + data.exportedAtIsoTimestamp.replace(/[:.]/g, "-") + ".xlsx";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
