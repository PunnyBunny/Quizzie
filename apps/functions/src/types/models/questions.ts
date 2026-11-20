import { BaseCollection } from "./base";
import { ApiError } from "../../middleware/error";
import type { QuestionSectionDto } from "@vaca/contracts";

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
  const data = doc.data();
  return { id: doc.id, ...data, optionAudios: data.optionAudios ?? [] };
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
