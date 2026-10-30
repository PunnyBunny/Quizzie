export interface SubmitAudioGradeInput {
  assessmentId: string;
  section: number;
  question: number;
  grade: number;
}

export interface UpdateAudioTranscriptInput {
  assessmentId: string;
  section: number;
  question: number;
  transcript: string;
}
