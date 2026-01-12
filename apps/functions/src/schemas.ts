import { z } from "zod";

export const LanguageSchema = z.enum(["cantonese", "mandarin", "english", "other"]);
export const GenderSchema = z.enum(["male", "female"]);

export const LanguageEntrySchema = z.object({
  language: LanguageSchema,
  otherSpecify: z.string().optional(),
});

export const AssessmentSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  birthDate: z.string().trim().min(1, "birth date is required"), // ISO date string
  gender: GenderSchema,
  grade: z.string().trim().min(1, "grade is required"),
  school: z.string().trim().min(1, "school is required"),
  motherTongue: LanguageEntrySchema,
  otherLanguages: z.array(LanguageEntrySchema),
});

export const MCStudentResponseSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  answer: z.coerce.number().int().nullable(),
});

export const AudioStudentResponseSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  transcript: z.string().nullable(),
  gsUri: z.string().nullable(),
});

export const FinishAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
});

export const GetAssessmentStudentResponsesSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
});

export const SubmitAudioGradeSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  grade: z.coerce.number().int().min(0).max(5),
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
