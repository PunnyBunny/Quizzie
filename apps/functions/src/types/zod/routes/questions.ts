import { DocumentIdSchema } from "../common";
import { z } from "zod";
import type { AdminSaveQuestionSectionInput, SectionInstructionDto } from "@vaca/contracts";

const SectionInstructionSchema = z.object({
  audio: z.string(),
  text: z.string(),
}) satisfies z.ZodType<SectionInstructionDto>;

export const AdminSaveQuestionSectionSchema = z
  .object({
    id: DocumentIdSchema,
    title: z.string(),
    kind: z.enum(["mc", "audio", "audio_mc"]),
    length: z.number().int().min(0),
    goal: z.string(),
    questions: z.array(z.string()).nullable(),
    audios: z.array(z.string()),
    choicesAudios: z.array(z.string()).optional(),
    choices: z.array(z.record(z.string(), z.string())).optional(),
    optionAudios: z.array(z.record(z.string(), z.string())).optional(),
    maxOptionPlays: z.number().int().min(1).max(20).optional(),
    correctAnswers: z.array(z.string()).optional(),
    images: z.array(z.string().nullable()).optional(),
    instructions: SectionInstructionSchema,
  })
  .superRefine((section, ctx) => {
    if (section.kind === "audio") return;
    for (let i = 0; i < section.length; i++) {
      const choices = section.choices?.[i];
      const correct = section.correctAnswers?.[i];
      if (
        !choices ||
        Object.keys(choices).length < 2 ||
        Object.keys(choices).some((key) => !key.trim()) ||
        !correct ||
        !Object.prototype.hasOwnProperty.call(choices, correct)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", i],
          message: `Question ${i + 1} requires at least two options and a valid answer key`,
        });
      }
      if (
        Object.keys(section.optionAudios?.[i] ?? {}).some(
          (key) => !Object.prototype.hasOwnProperty.call(choices ?? {}, key),
        )
      )
        ctx.addIssue({
          code: "custom",
          path: ["optionAudios", i],
          message: `Question ${i + 1} recordings must use configured option keys`,
        });
    }
  }) satisfies z.ZodType<AdminSaveQuestionSectionInput>;
