export interface SectionInstruction {
  audio: string;
  text: string;
}

export interface QuestionSectionDto {
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
