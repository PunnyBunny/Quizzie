import type { QuestionSectionDto } from "./models/questions-dto";

export interface GetQuestionsOutput {
  sections: QuestionSectionDto[];
}

export interface SaveQuestionSectionOutput {
  id: string;
}
