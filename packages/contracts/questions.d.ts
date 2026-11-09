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
  /** Stable option keys mapped to optional admin hints, displayed only in Admin Questions. */
  choices?: Record<string, string>[];
  /** Audio asset paths by question and stable option key. */
  optionAudios?: Record<string, string>[];
  /** Maximum starts per option for one assessment. Defaults to 2. */
  maxOptionPlays?: number;
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
