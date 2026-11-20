import { DocumentIdSchema } from "../common";
import { z } from "zod";
import type { AdminDeleteSubtaskInput, AdminSaveSubtaskInput, NormStatsDto } from "@vaca/contracts";

const NormStatsSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    n: z.number(),
    stdDev: z.number(),
    mean: z.number(),
  })
  .nullable() satisfies z.ZodType<NormStatsDto | null>;

export const AdminSaveSubtaskSchema = z.object({
  id: DocumentIdSchema.optional(),
  name: z.string().min(1),
  questionIds: z.array(
    z.object({
      sectionIndex: z.number().int().min(0),
      questionIndex: z.number().int().min(0),
    }),
  ),
  norms: z.object({
    S1: NormStatsSchema,
    S2: NormStatsSchema,
    S3: NormStatsSchema,
    S4: NormStatsSchema,
    S5: NormStatsSchema,
    S6: NormStatsSchema,
  }),
}) satisfies z.ZodType<AdminSaveSubtaskInput>;

export const AdminDeleteSubtaskSchema = z.object({
  id: DocumentIdSchema,
}) satisfies z.ZodType<AdminDeleteSubtaskInput>;
