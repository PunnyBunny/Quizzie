import { z } from "zod";

export const LanguageSchema = z.enum(["cantonese", "mandarin", "english", "other"]);
export const GenderSchema = z.enum(["male", "female"]);

export const LanguageEntrySchema = z.object({
  language: LanguageSchema,
  otherSpecify: z.string().optional(),
});

export const AssessmentSchema = z.object({
  name: z.string().trim(),
  birthDate: z.string().trim(), // ISO date string
  gender: GenderSchema,
  grade: z.string().trim(),
  school: z.string().trim(),
  motherTongue: LanguageEntrySchema,
  otherLanguages: z.array(LanguageEntrySchema),
});

export const MCStudentResponseSchema = z.object({
  assessmentId: z.string(),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  answer: z.coerce.number().int().nullable(),
});

export const AudioStudentResponseSchema = z.object({
  assessmentId: z.string(),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  transcript: z.string().nullable(),
  gsUri: z.string().nullable(),
});

export const FinishAssessmentSchema = z.object({
  assessmentId: z.string(),
});

export const GetAssessmentStudentResponsesSchema = z.object({
  assessmentId: z.string(),
});

export const SubmitAudioGradeSchema = z.object({
  assessmentId: z.string(),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  grade: z.coerce.number().int().min(0).max(5),
});

export const GetAssessmentsSchema = z.object({
  finished: z.boolean(),
});

export const AdminCreateUserSchema = z.object({
  email: z.email(),
});

export const AdminResetPasswordSchema = z.object({
  email: z.email(),
});

export const AdminRemoveUserSchema = z.object({
  email: z.email(),
});

export type AssessmentInput = z.infer<typeof AssessmentSchema>;
export type LanguageEntry = z.infer<typeof LanguageEntrySchema>;
export type Language = z.infer<typeof LanguageSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type MCStudentResponseInput = z.infer<typeof MCStudentResponseSchema>;
export type AudioStudentResponseInput = z.infer<typeof AudioStudentResponseSchema>;
export type FinishAssessmentInput = z.infer<typeof FinishAssessmentSchema>;
export type GetAssessmentStudentResponsesInput = z.infer<
  typeof GetAssessmentStudentResponsesSchema
>;
export type SubmitAudioGradeInput = z.infer<typeof SubmitAudioGradeSchema>;
export type GetAssessmentsInput = z.infer<typeof GetAssessmentsSchema>;
export type AdminCreateUserInput = z.infer<typeof AdminCreateUserSchema>;
export type AdminResetPasswordInput = z.infer<typeof AdminResetPasswordSchema>;
export type AdminRemoveUserInput = z.infer<typeof AdminRemoveUserSchema>;

// Request/response types for route handlers
import type { AssessmentDto } from "./models/assessments";
import type { StudentResponseDto } from "./models/student-responses";

export interface GetAssessmentsOutput {
  assessments: AssessmentDto[];
}

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

export interface GetAssessmentStudentResponsesOutput {
  assessment: AssessmentDto;
  studentResponsesBySection: Record<string, StudentResponseDto>;
}
