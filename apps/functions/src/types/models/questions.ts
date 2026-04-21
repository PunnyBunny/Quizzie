import { BaseCollection } from "./base";
import type { QuestionSectionDto } from "./questions-dto";

export type { SectionInstruction, QuestionSectionDto } from "./questions-dto";

/**
 * Question section document stored in Firestore.
 * Each document represents one section (doc ID = section index "0"–"6").
 * The id lives on the DTO (from doc.id), not in the stored document.
 */
export type QuestionSectionDoc = Omit<QuestionSectionDto, "id">;

export const questionSections = new BaseCollection<QuestionSectionDoc>(
  "questions",
  (data) => data as QuestionSectionDoc,
);

export function toQuestionSectionDto(
  doc: FirebaseFirestore.QueryDocumentSnapshot<QuestionSectionDoc>,
): QuestionSectionDto {
  return { id: doc.id, ...doc.data() };
}
