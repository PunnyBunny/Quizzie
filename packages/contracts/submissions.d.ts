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
}

export interface McStudentResponseDto extends BaseStudentResponseDto {
  type: "mc";
  studentResponses: Record<string, string | null>;
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
}

export type StudentResponseDto =
  | McStudentResponseDto
  | AudioStudentResponseDto
  | AudioMcStudentResponseDto;

export interface SubmitMcAnswerInput {
  assessmentId: string;
  section: number;
  question: number;
  answer: string | null;
}

export interface SubmitAudioAnswerInput {
  assessmentId: string;
  section: number;
  question: number;
  transcript: string | null;
  gsUri: string | null;
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
