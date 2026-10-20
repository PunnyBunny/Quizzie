import { BaseCollection } from "./base";
import { ApiError } from "../../middleware/error";
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

export async function getQuestionSections(): Promise<QuestionSectionDto[]> {
  const snapshot = await questionSections.collection().orderBy("__name__").get();
  return snapshot.docs.map(toQuestionSectionDto);
}

export function getConfiguredQuestion(
  sections: QuestionSectionDto[],
  section: number,
  question: number,
  kind: QuestionSectionDto["kind"],
): QuestionSectionDto {
  const config = sections[section];
  if (config?.kind !== kind || question < 0 || question >= config.length)
    throw new ApiError("Invalid question or response type", 400);
  return config;
}
