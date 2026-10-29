import type { AssessmentDto } from "./models/assessments-dto";
import type { QuestionSectionDto } from "./models/questions-dto";
import type { StudentResponseDto } from "./models/student-responses-dto";
import type { SubtaskDto } from "./models/subtasks-dto";

export interface AdminGetAssessmentsOutput {
  assessments: AssessmentDto[];
}

export interface ExportAssessmentDto extends AssessmentDto {
  updatedAtIsoTimestamp: string | null;
  finishedAtIsoTimestamp: string | null;
}

export interface AdminExportAssessmentsOutput {
  exportedAtIsoTimestamp: string;
  assessments: ExportAssessmentDto[];
  responses: StudentResponseDto[];
  sections: QuestionSectionDto[];
  subtasks: SubtaskDto[];
}

export interface UserRecord {
  email?: string;
  isAdmin: boolean;
}

export interface AdminGetUsersOutput {
  users: UserRecord[];
}

export interface AdminCreateUserOutput {
  uid: string;
  email: string;
  resetLink: string;
}

export interface AdminResetPasswordOutput {
  email: string;
  resetLink: string;
}

export interface AdminRemoveUserOutput {
  email: string;
}
