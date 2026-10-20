import type { QuestionSectionDto } from "./models/questions-dto";
import type { AssessmentDto } from "./models/assessments";
import type { StudentResponseDto } from "./models/student-responses-dto";

export interface GetAssessmentStudentResponsesOutput {
  assessment: AssessmentDto;
  sections: QuestionSectionDto[];
  studentResponsesBySection: Record<string, StudentResponseDto>;
}
