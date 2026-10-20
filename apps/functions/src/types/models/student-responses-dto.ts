import type { HybridAttempt } from "./hybrid-response-dto";
/**
 * Base student response DTO structure
 */
export interface BaseStudentResponseDto {
  assessmentId: string;
  section: number;
  createdAtIsoTimestamp: string;
}

/**
 * Multiple choice student response DTO
 */
export interface MCStudentResponseDto extends BaseStudentResponseDto {
  type: "mc";
  studentResponses: Record<string, string | null>;
}

/**
 * Audio student response DTO
 */
export interface AudioStudentResponseDto extends BaseStudentResponseDto {
  type: "audio";
  files: Record<string, string | null>;
  transcripts: Record<string, string | null>;
  grades?: Record<string, number | null>;
}

/**
 * Union type for all student response DTO types
 */
export interface HybridStudentResponseDto extends Omit<AudioStudentResponseDto, "type"> {
  type: "audio_mc";
  attempts: Record<string, HybridAttempt>;
}
export type StudentResponseDto =
  | MCStudentResponseDto
  | AudioStudentResponseDto
  | HybridStudentResponseDto;
