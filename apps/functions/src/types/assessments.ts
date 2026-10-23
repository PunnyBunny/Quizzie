import type { AssessmentDto } from "./models/assessments-dto";

export interface GetAssessmentsOutput {
  assessments: AssessmentDto[];
}

export interface SetAssessmentArchivedOutput {
  ok: true;
}
