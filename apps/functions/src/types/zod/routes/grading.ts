import { z } from "zod";

export const SubmitAudioGradeSchema = z.object({
  assessmentId: z.string(),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  grade: z.coerce.number().int().min(0).max(5),
});

export type SubmitAudioGradeInput = z.infer<typeof SubmitAudioGradeSchema>;

// Mirrored as TRANSCRIPT_MAX_LENGTH in apps/web/src/pages/GradeAssessment.tsx.
export const TRANSCRIPT_MAX_LENGTH = 5000;

export const UpdateAudioTranscriptSchema = z.object({
  assessmentId: z.string(),
  section: z.coerce.number().int(),
  question: z.coerce.number().int(),
  transcript: z.string().max(TRANSCRIPT_MAX_LENGTH),
});

export type UpdateAudioTranscriptInput = z.infer<typeof UpdateAudioTranscriptSchema>;
