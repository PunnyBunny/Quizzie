import { z } from "zod";
import type { SaveQuestionSectionInput } from "../../questions-inputs";

const SectionInstructionSchema = z.object({
  audio: z.string(),
  text: z.string(),
});

export const SaveQuestionSectionSchema: z.ZodType<SaveQuestionSectionInput> = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    kind: z.enum(["mc", "audio", "audio_mc"]),
    length: z.number().int().min(0),
    goal: z.string(),
    questions: z.array(z.string()).nullable(),
    audios: z.array(z.string()),
    choicesAudios: z.array(z.string()).optional(),
    choices: z.array(z.record(z.string(), z.string())).optional(),
    correctAnswers: z.array(z.string()).optional(),
    images: z.array(z.string().nullable()).optional(),
    instructions: SectionInstructionSchema,
  })
  .superRefine((section, ctx) => {
    if (section.kind !== "audio_mc") return;
    // TODO: add other kinds
    for (let i = 0; i < section.length; i++) {
      const choices = section.choices?.[i];
      const correct = section.correctAnswers?.[i];
      if (
        !section.audios[i]?.trim() ||
        !section.choicesAudios?.[i]?.trim() ||
        !choices ||
        Object.keys(choices).length < 2 ||
        Object.keys(choices).some((key) => !key.trim()) ||
        Object.values(choices).some((label) => !label.trim()) ||
        !correct ||
        !Object.prototype.hasOwnProperty.call(choices, correct)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["choices", i],
          message: `Question ${i + 1} requires at least two labeled options, and a valid answer key`,
        });
      }
    }
  });

export type { SaveQuestionSectionInput };
