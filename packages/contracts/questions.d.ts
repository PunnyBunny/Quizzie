export interface SectionInstructionDto {
  audio: string;
  text: string;
}

export interface QuestionSectionDto {
  id: string;
  title: string;
  kind: "mc" | "audio" | "audio_mc";
  length: number;
  goal: string;
  questions: string[] | null;
  audios: string[];
  choicesAudios?: string[];
  choices?: Record<string, string>[];
  correctAnswers?: string[];
  images?: (string | null)[];
  instructions: SectionInstructionDto;
}

export interface GetQuestionsOutput {
  sections: QuestionSectionDto[];
}

export type AdminSaveQuestionSectionInput = QuestionSectionDto;

export interface AdminSaveQuestionSectionOutput {
  id: string;
}
