import { z } from "zod";
import type {
  CreateAssessmentInput,
  FinishAssessmentInput,
  GetAssessmentsInput,
  SetAssessmentArchivedInput,
} from "@vaca/contracts";
import {
  DocumentIdSchema,
  GenderSchema,
  LanguageEntrySchema,
  SpecialEducationalNeedsSchema,
} from "../common";

export const CreateAssessmentSchema = z.object({
  name: z.string().trim(),
  birthDate: z.string().trim(), // ISO date string
  gender: GenderSchema,
  specialEducationalNeeds: SpecialEducationalNeedsSchema,
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
  assessmentId: DocumentIdSchema,
}) satisfies z.ZodType<FinishAssessmentInput>;

export const SetAssessmentArchivedSchema = z.object({
  assessmentId: DocumentIdSchema,
  archived: z.boolean(),
}) satisfies z.ZodType<SetAssessmentArchivedInput>;
