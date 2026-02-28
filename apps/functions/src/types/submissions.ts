import type { AssessmentDto } from "./models/assessments";
import type { StudentResponseDto } from "./models/student-responses";

export interface GetAssessmentStudentResponsesOutput {
  assessment: AssessmentDto;
  studentResponsesBySection: Record<string, StudentResponseDto>;
}
