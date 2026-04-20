import { z } from "zod";
import type { SaveSubtaskInput, DeleteSubtaskInput } from "../../subtasks-inputs";

const NormStatsSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    n: z.number(),
    stdDev: z.number(),
    mean: z.number(),
  })
  .nullable();

export const SaveSubtaskSchema: z.ZodType<SaveSubtaskInput> = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  questionIds: z.array(
    z.object({
      sectionIndex: z.number().int().min(0),
      questionIndex: z.number().int().min(0),
    }),
  ),
  norms: z.object({
    S1: NormStatsSchema,
    S3: NormStatsSchema,
    S5: NormStatsSchema,
  }),
});

export const DeleteSubtaskSchema: z.ZodType<DeleteSubtaskInput> = z.object({
  id: z.string(),
});

export type { SaveSubtaskInput, DeleteSubtaskInput };
