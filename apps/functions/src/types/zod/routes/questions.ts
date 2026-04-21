import { z } from "zod";
import type { SaveQuestionSectionInput } from "../../questions-inputs";

const SectionInstructionSchema = z.object({
  audio: z.string(),
  text: z.string(),
});

export const SaveQuestionSectionSchema: z.ZodType<SaveQuestionSectionInput> = z.object({
  id: z.string().min(1),
  title: z.string(),
  kind: z.enum(["mc", "audio"]),
  length: z.number().int().min(0),
  goal: z.string(),
  questions: z.array(z.string()).nullable(),
  audios: z.array(z.string()),
  choices: z.array(z.record(z.string(), z.string())).optional(),
  correctAnswers: z.array(z.string()).optional(),
  images: z.array(z.string().nullable()).optional(),
  instructions: SectionInstructionSchema,
});

export type { SaveQuestionSectionInput };
