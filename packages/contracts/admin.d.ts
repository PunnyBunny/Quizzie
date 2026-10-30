import type { AssessmentDto } from "./assessments";
import type { QuestionSectionDto } from "./questions";
import type { StudentResponseDto } from "./submissions";
import type { SubtaskDto } from "./subtasks";

export interface AdminGetAssessmentsInput {
  archived?: boolean;
}

export interface AdminGetAssessmentsOutput {
  assessments: AssessmentDto[];
}

export type AdminExportAssessmentsInput = Record<string, never>;

export interface ExportedAssessmentDto extends AssessmentDto {
  updatedAtIsoTimestamp: string | null;
  finishedAtIsoTimestamp: string | null;
}

export interface AdminExportAssessmentsOutput {
  exportedAtIsoTimestamp: string;
  assessments: ExportedAssessmentDto[];
  responses: StudentResponseDto[];
  sections: QuestionSectionDto[];
  subtasks: SubtaskDto[];
}

export interface UserDto {
  email?: string;
  isAdmin: boolean;
}

export interface AdminGetUsersOutput {
  users: UserDto[];
}

export interface AdminCreateUserInput {
  email: string;
}

export interface AdminCreateUserOutput {
  uid: string;
  email: string;
  resetLink: string;
}

export interface AdminResetPasswordInput {
  email: string;
}

export interface AdminResetPasswordOutput {
  email: string;
  resetLink: string;
}

export interface AdminRemoveUserInput {
  email: string;
}

export interface AdminRemoveUserOutput {
  email: string;
}
