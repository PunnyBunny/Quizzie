import type { QuestionSectionDto } from "./models/questions";

export interface GetQuestionsOutput {
  sections: QuestionSectionDto[];
}
