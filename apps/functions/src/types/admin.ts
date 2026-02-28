import type { AssessmentDto } from "./models/assessments";

export interface AdminGetAssessmentsOutput {
  assessments: AssessmentDto[];
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
