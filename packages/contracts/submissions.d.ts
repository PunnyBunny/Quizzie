import type { AssessmentDto } from "./assessments";
import type { QuestionSectionDto } from "./questions";

export interface AudioMcAttemptDto {
  assistanceOffered: boolean;
  selectedOption: string | null;
  skipped: boolean;
}

export interface BaseStudentResponseDto {
  assessmentId: string;
  section: number;
  createdAtIsoTimestamp: string;
  questionTimeSeconds?: Record<string, number>;
}

export interface UpdateQuestionTimeInput {
  assessmentId: string;
  section: number;
  question: number;
  totalSeconds: number; // Cumulative
}

export interface GetAssessmentTimeInput {
  assessmentId: string;
  section: number;
  question: number;
}

export interface GetAssessmentTimeOutput {
  questionSeconds: number;
  sectionSeconds: number;
  overallSeconds: number;
}

export interface McStudentResponseDto extends BaseStudentResponseDto {
  type: "mc";
  studentResponses: Record<string, string | null>;
  optionPlayCounts?: Record<string, Record<string, number>>;
}

// Files contain stored gs:// URIs in exports and signed playback URLs in grading responses.
export interface AudioStudentResponseDto extends BaseStudentResponseDto {
  type: "audio";
  files: Record<string, string | null>;
  transcripts: Record<string, string | null>;
  grades?: Record<string, number | null>;
}

export interface AudioMcStudentResponseDto extends Omit<AudioStudentResponseDto, "type"> {
  type: "audio_mc";
  attempts: Record<string, AudioMcAttemptDto>;
  optionPlayCounts?: Record<string, Record<string, number>>;
}

export interface GetOptionAudioPlaybackInput {
  assessmentId: string;
  section: number;
  question: number;
}

export interface GetOptionAudioPlaybackOutput {
  /** Successful playback starts per option key. */
  counts: Record<string, number>;
  maxPlays: number;
}

export interface UpdateOptionAudioPlaybackInput extends GetOptionAudioPlaybackInput {
  optionKey: string;
  /**
   * Client-generated UUID for one successful playback start.
   * Reuse it when retrying the background save to avoid counting the play twice.
   */
  playbackId: string;
}

export type UpdateOptionAudioPlaybackOutput = GetOptionAudioPlaybackOutput;

export type StudentResponseDto =
  | McStudentResponseDto
  | AudioStudentResponseDto
  | AudioMcStudentResponseDto;

export interface SubmitMcAnswerInput {
  assessmentId: string;
  section: number;
  question: number;
  answer: string | null;
  /** Saved atomically with the answer; omission preserves existing timing. */
  totalSeconds?: number;
}

export interface SubmitAudioAnswerInput {
  assessmentId: string;
  section: number;
  question: number;
  transcript: string | null;
  gsUri: string | null;
  /** Saved atomically with the answer; omission preserves existing timing. */
  totalSeconds?: number;
}

export interface SubmitAudioMcAnswerInput extends SubmitAudioAnswerInput, AudioMcAttemptDto {}

export interface GetAssessmentStudentResponsesInput {
  assessmentId: string;
}

export interface GetAssessmentStudentResponsesOutput {
  assessment: AssessmentDto;
  sections: QuestionSectionDto[];
  studentResponsesBySection: Record<string, StudentResponseDto>;
}
