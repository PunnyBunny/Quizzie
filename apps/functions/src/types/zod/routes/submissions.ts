import { z } from "zod";

const QuestionAddress = z.object({
  assessmentId: z
    .string()
    .min(1)
    .regex(/^[^/]+$/),
  section: z.number().int().nonnegative(),
  question: z.number().int().nonnegative(),
});
export const MCStudentResponseSchema = QuestionAddress.extend({
  answer: z.string().min(1).nullable(),
});
export const AudioStudentResponseSchema = QuestionAddress.extend({
  transcript: z.string().nullable(),
  gsUri: z.string().min(1).nullable(),
});
export const HybridStudentResponseSchema = AudioStudentResponseSchema.extend({
  assistanceOffered: z.boolean(),
  selectedOption: z.string().min(1).nullable(),
  skipped: z.boolean(),
}).superRefine((value, ctx) => {
  if (
    (!value.assistanceOffered && value.selectedOption !== null) ||
    (value.skipped && value.selectedOption !== null) ||
    (!value.skipped && value.assistanceOffered && value.selectedOption === null) ||
    (!value.skipped && !value.assistanceOffered && value.gsUri === null) ||
    (value.gsUri === null && value.transcript !== null)
  ) {
    ctx.addIssue({ code: "custom", message: "Invalid hybrid evidence" });
  }
});
export const GetAssessmentStudentResponsesSchema = z.object({
  assessmentId: z
    .string()
    .min(1)
    .regex(/^[^/]+$/),
});
export type MCStudentResponseInput = z.infer<typeof MCStudentResponseSchema>;
export type AudioStudentResponseInput = z.infer<typeof AudioStudentResponseSchema>;
export type HybridStudentResponseInput = z.infer<typeof HybridStudentResponseSchema>;
export type GetAssessmentStudentResponsesInput = z.infer<
  typeof GetAssessmentStudentResponsesSchema
>;
