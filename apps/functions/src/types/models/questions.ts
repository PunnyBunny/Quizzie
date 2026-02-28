import { BaseCollection } from "./base";

export interface SectionInstruction {
  audio: string;
  text: string;
}

/**
 * Question section document stored in Firestore.
 * Each document represents one section (doc ID = section index "0"–"6").
 */
export interface QuestionSectionDoc {
  title: string;
  kind: "mc" | "audio";
  length: number;
  goal: string;
  questions: string[] | null;
  audios: string[];
  choices?: Record<string, string>[];
  correctAnswers?: string[];
  images?: (string | null)[];
  instructions: SectionInstruction;
}

export type QuestionSectionDto = QuestionSectionDoc;

export const questionSections = new BaseCollection<QuestionSectionDoc>(
  "questions",
  (data) => data as QuestionSectionDoc,
);

export function toQuestionSectionDto(doc: QuestionSectionDoc): QuestionSectionDto {
  return doc;
}
