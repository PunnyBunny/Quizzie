import { BaseCollection } from "./base";
import type { QuestionSectionDto } from "./questions-dto";

export type { SectionInstruction, QuestionSectionDto } from "./questions-dto";

/**
 * Question section document stored in Firestore.
 * Each document represents one section (doc ID = section index "0"–"6").
 */
export type QuestionSectionDoc = QuestionSectionDto;

export const questionSections = new BaseCollection<QuestionSectionDoc>(
  "questions",
  (data) => data as QuestionSectionDoc,
);

export function toQuestionSectionDto(doc: QuestionSectionDoc): QuestionSectionDto {
  return doc;
}
