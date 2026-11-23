export interface SectionInstructionDto {
  audio: string;
  text: string;
}

export interface QuestionSectionDto {
  id: string;
  title: string;
  kind: "mc" | "audio" | "audio_mc";
  mcOptionFormat?: "text_option" | "audio_option";
  length: number;
  goal: string;
  questions: string[] | null;
  audios: string[];
  choicesAudios?: string[];
  /**
   * Stable option keys mapped to student-visible text in text mode (the default),
   * or optional hints for admins and markers in audio mode. Grading shows both.
   * TODO: separate hints and choices
   */
  choices?: Record<string, string>[];
  /** Audio asset paths by question and stable option key. */
  optionAudios?: Record<string, string>[];
  /** Maximum starts per audio option for one assessment. Defaults to 2; unused in text mode. */
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
