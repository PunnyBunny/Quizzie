import { z } from "zod";

export const AssessmentSchema = z.object({
  age: z.number(),
  grade: z.string().trim().min(1, "grade is required"),
  name: z.string().trim().min(1, "name is required"),
  school: z.string().trim().min(1, "school is required"),
});

export const MCAnswerSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  answer: z.coerce.number().int(),
});

export const AudioAnswerSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  transcript: z.string(),
  gsUri: z.string(),
});

export const FinishAssessmentSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
});

export const GetAssessmentAnswersSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
});

export const SubmitAudioGradeSchema = z.object({
  assessmentId: z.string().trim().min(1, "assessmentId is required"),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  grade: z.coerce.number().int().min(0).max(5),
});

export type AssessmentInput = z.infer<typeof AssessmentSchema>;
export type MCAnswerInput = z.infer<typeof MCAnswerSchema>;
export type AudioAnswerInput = z.infer<typeof AudioAnswerSchema>;
export type FinishAssessmentInput = z.infer<typeof FinishAssessmentSchema>;
export type GetAssessmentAnswersInput = z.infer<typeof GetAssessmentAnswersSchema>;
export type SubmitAudioGradeInput = z.infer<typeof SubmitAudioGradeSchema>;
