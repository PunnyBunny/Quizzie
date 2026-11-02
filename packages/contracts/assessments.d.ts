import type { Gender, LanguageEntryDto } from "./common";

export interface AssessmentDto {
  id: string;
  name: string;
  birthDate: string;
  gender: Gender;
  grade: string;
  school: string;
  motherTongue: LanguageEntryDto;
  otherLanguages: LanguageEntryDto[];
  creatorEmail: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
  archived: boolean;
  createdAtIsoTimestamp: string;
}

export interface CreateAssessmentInput {
  name: string;
  birthDate: string;
  gender: Gender;
  grade: string;
  school: string;
  motherTongue: LanguageEntryDto;
  otherLanguages: LanguageEntryDto[];
}

export interface CreateAssessmentOutput {
  id: string;
}

export interface GetAssessmentsInput {
  finished?: boolean;
  archived?: boolean;
}

export interface GetAssessmentsOutput {
  assessments: AssessmentDto[];
}

export interface FinishAssessmentInput {
  assessmentId: string;
}

export interface SetAssessmentArchivedInput {
  assessmentId: string;
  archived: boolean;
}
