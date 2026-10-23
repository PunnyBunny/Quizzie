import { z } from "zod";
import { GenderSchema, LanguageEntrySchema } from "../common";

export const AssessmentSchema = z.object({
  name: z.string().trim(),
  birthDate: z.string().trim(), // ISO date string
  gender: GenderSchema,
  grade: z.string().trim(),
  school: z.string().trim(),
  motherTongue: LanguageEntrySchema,
  otherLanguages: z.array(LanguageEntrySchema),
});

export const GetAssessmentsSchema = z.object({
  finished: z.boolean().optional(),
  archived: z.boolean().optional(),
});

export const FinishAssessmentSchema = z.object({
  assessmentId: z.string(),
});

export type AssessmentInput = z.infer<typeof AssessmentSchema>;
export type GetAssessmentsInput = z.infer<typeof GetAssessmentsSchema>;
export type FinishAssessmentInput = z.infer<typeof FinishAssessmentSchema>;

export const SetAssessmentArchivedSchema = z.object({
  assessmentId: z
    .string()
    .min(1)
    .refine((id) => !id.includes("/")),
  archived: z.boolean(),
});
export type SetAssessmentArchivedInput = z.infer<typeof SetAssessmentArchivedSchema>;
