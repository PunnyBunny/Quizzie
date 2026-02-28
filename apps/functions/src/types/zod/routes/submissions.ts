import { z } from "zod";

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

export const GetAssessmentStudentResponsesSchema = z.object({
  assessmentId: z.string(),
});

export type MCStudentResponseInput = z.infer<typeof MCStudentResponseSchema>;
export type AudioStudentResponseInput = z.infer<typeof AudioStudentResponseSchema>;
export type GetAssessmentStudentResponsesInput = z.infer<
  typeof GetAssessmentStudentResponsesSchema
>;
