export interface SectionInstruction {
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
  instructions: SectionInstruction;
}
