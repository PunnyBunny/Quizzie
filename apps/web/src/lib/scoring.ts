/**
 * Shared scoring utilities used by ScoreModal and GradeAssessment.
 */

import type { QuestionSectionDto, StudentResponseDto, SubtaskDto } from "@vaca/contracts";

export type NormGrade = keyof SubtaskDto["norms"];

/**
 * Map a student grade string to the corresponding norm group.
 * Each form S1–S6 uses its own normative data.
 */
export function getNormGrade(grade: string): NormGrade {
  const num = parseInt(grade.replace(/\D/g, ""));
  if (isNaN(num) || num <= 1) return "S1";
  if (num >= 6) return "S6";
  return `S${num}` as NormGrade;
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
  responsesBySection: Record<string, StudentResponseDto>,
  sections: QuestionSectionDto[],
): number | null {
  const section = sections[sectionIndex];
  if (!section || questionIndex < 0 || questionIndex >= section.length) return null;

  const response = responsesBySection[sectionIndex.toString()];
  if (!response) return null;

  if (section.kind === "mc") {
    if (response.type !== "mc") return null;
    const answerKey = response.studentResponses[questionIndex.toString()];
    if (answerKey === null || answerKey === undefined) return null;
    const correctAnswerKey = section.correctAnswers?.[questionIndex];
    if (correctAnswerKey === undefined) return null;
    return answerKey === correctAnswerKey ? 1 : 0;
  }

  // Audio: use grade
  if (response.type === "mc") return null;
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
  questionIds: { sectionIndex: number; questionIndex: number }[],
  responsesBySection: Record<string, StudentResponseDto>,
  sections: QuestionSectionDto[],
): SubtaskScoreResult {
  let score = 0;
  let maxScore = 0;
  let ungradedCount = 0;

  for (const { sectionIndex, questionIndex } of questionIds) {
    const section = sections[sectionIndex];
    if (!section || questionIndex < 0 || questionIndex >= section.length) continue;

    maxScore += getQuestionMaxScore(section.kind);

    const qScore = getQuestionScore(sectionIndex, questionIndex, responsesBySection, sections);
    if (qScore !== null) {
      score += qScore;
    } else if (section.kind !== "mc") {
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
