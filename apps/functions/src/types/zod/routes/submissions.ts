import { z } from "zod";
import type {
  GetAssessmentStudentResponsesInput,
  SubmitAudioAnswerInput,
  SubmitAudioMcAnswerInput,
  SubmitMcAnswerInput,
} from "@vaca/contracts";

const QuestionAddressSchema = z.object({
  assessmentId: z
    .string()
    .min(1)
    .regex(/^[^/]+$/),
  section: z.number().int().nonnegative(),
  question: z.number().int().nonnegative(),
});
export const SubmitMcAnswerSchema = QuestionAddressSchema.extend({
  answer: z.string().min(1).nullable(),
}) satisfies z.ZodType<SubmitMcAnswerInput>;
export const SubmitAudioAnswerSchema = QuestionAddressSchema.extend({
  transcript: z.string().nullable(),
  gsUri: z.string().min(1).nullable(),
}) satisfies z.ZodType<SubmitAudioAnswerInput>;
export const SubmitAudioMcAnswerSchema = SubmitAudioAnswerSchema.extend({
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
}) satisfies z.ZodType<SubmitAudioMcAnswerInput>;
export const GetAssessmentStudentResponsesSchema = z.object({
  assessmentId: z
    .string()
    .min(1)
    .regex(/^[^/]+$/),
}) satisfies z.ZodType<GetAssessmentStudentResponsesInput>;
