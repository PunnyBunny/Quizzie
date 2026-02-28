import { z } from "zod";

export const SubmitAudioGradeSchema = z.object({
  assessmentId: z.string(),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  grade: z.coerce.number().int().min(0).max(5),
});

export type SubmitAudioGradeInput = z.infer<typeof SubmitAudioGradeSchema>;
