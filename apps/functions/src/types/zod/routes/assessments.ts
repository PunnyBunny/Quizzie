import { z } from "zod";
import type {
  CreateAssessmentInput,
  FinishAssessmentInput,
  GetAssessmentsInput,
  SetAssessmentArchivedInput,
} from "@vaca/contracts";
import { GenderSchema, LanguageEntrySchema } from "../common";

export const CreateAssessmentSchema = z.object({
  name: z.string().trim(),
  birthDate: z.string().trim(), // ISO date string
  gender: GenderSchema,
  grade: z.string().trim(),
  school: z.string().trim(),
  motherTongue: LanguageEntrySchema,
  otherLanguages: z.array(LanguageEntrySchema),
}) satisfies z.ZodType<CreateAssessmentInput>;

export const GetAssessmentsSchema = z.object({
  finished: z.boolean().optional(),
  archived: z.boolean().optional(),
}) satisfies z.ZodType<GetAssessmentsInput>;

export const FinishAssessmentSchema = z.object({
  assessmentId: z.string(),
}) satisfies z.ZodType<FinishAssessmentInput>;

export const SetAssessmentArchivedSchema = z.object({
  assessmentId: z
    .string()
    .min(1)
    .refine((id) => !id.includes("/")),
  archived: z.boolean(),
}) satisfies z.ZodType<SetAssessmentArchivedInput>;
