import type { Gender, LanguageEntry } from "../common";

/**
 * Assessment DTO with ID and ISO timestamp
 */
export interface AssessmentDto {
  id: string;
  name: string;
  birthDate: string;
  gender: Gender;
  grade: string;
  school: string;
  motherTongue: LanguageEntry;
  otherLanguages: LanguageEntry[];
  creatorEmail: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
  archived: boolean;
  createdAtIsoTimestamp: string;
}
