/**
 * Shared scoring utilities used by ScoreModal and GradeAssessment.
 */

import type { QuestionSectionDto } from "../../../functions/src/types/models/questions-dto";
import type {
  NormStats,
  SubtaskDto,
} from "../../../functions/src/types/models/subtasks-dto";

export type QuizSection = QuestionSectionDto;
export type SubtaskDef = SubtaskDto;
export type { NormStats };

export interface MCStudentResponse {
  type: "mc";
  studentResponses: Record<string, number | null>;
}

export interface AudioStudentResponse {
  type: "audio";
  files: Record<string, string | null>;
  transcripts: Record<string, string | null>;
  grades?: Record<string, number>;
}

export type StudentResponse = MCStudentResponse | AudioStudentResponse;

export type NormGrade = "S1" | "S3" | "S5";

/**
 * Map a student grade string to the corresponding norm group.
 * Grades 1–2 → S1, 3–4 → S3, 5+ → S5.
 */
export function getNormGrade(grade: string): NormGrade {
  const num = parseInt(grade.replace(/\D/g, ""));
  if (isNaN(num) || num <= 2) return "S1";
  if (num <= 4) return "S3";
  return "S5";
}

/** Max score for one question: MC = 1, audio = 5 */
export function getQuestionMaxScore(sectionKind: string): number {
  return sectionKind === "mc" ? 1 : 5;
}

/**
 * Get the score for a single question.
 * Returns null if no response or (for audio) not yet graded.
 */
export function getQuestionScore(
  sectionIndex: number,
  questionIndex: number,
  responsesBySection: Record<string, StudentResponse>,
  sections: QuizSection[],
): number | null {
  const section = sections[sectionIndex];
  if (!section) return null;

  const response = responsesBySection[sectionIndex.toString()];
  if (!response) return null;

  if (response.type === "mc") {
    const answerIdx = response.studentResponses[questionIndex.toString()];
    if (answerIdx === null || answerIdx === undefined) return null;
    const correctAnswerIdx = section.correctAnswers?.[questionIndex];
    if (correctAnswerIdx === undefined) return null;
    return answerIdx === Number(correctAnswerIdx) ? 1 : 0;
  }

  // Audio: use grade
  const grade = response.grades?.[questionIndex.toString()];
  if (grade === undefined || grade === null) return null;
  return grade;
}

export interface SubtaskScoreResult {
  score: number;
  maxScore: number;
  ungradedCount: number;
}

/**
 * Compute the total score for a subtask (a group of arbitrary questions).
 */
export function computeSubtaskScore(
  questionIds: Array<{ sectionIndex: number; questionIndex: number }>,
  responsesBySection: Record<string, StudentResponse>,
  sections: QuizSection[],
): SubtaskScoreResult {
  let score = 0;
  let maxScore = 0;
  let ungradedCount = 0;

  for (const { sectionIndex, questionIndex } of questionIds) {
    const section = sections[sectionIndex];
    if (!section) continue;

    maxScore += getQuestionMaxScore(section.kind);

    const qScore = getQuestionScore(sectionIndex, questionIndex, responsesBySection, sections);
    if (qScore !== null) {
      score += qScore;
    } else if (section.kind === "audio") {
      ungradedCount++;
    }
  }

  return { score, maxScore, ungradedCount };
}

/**
 * Compute the z-score: (score - mean) / stdDev.
 * Returns null if stdDev is 0.
 */
export function computeZScore(score: number, mean: number, stdDev: number): number | null {
  if (stdDev === 0) return null;
  return (score - mean) / stdDev;
}
