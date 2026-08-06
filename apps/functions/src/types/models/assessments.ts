import { FieldValue } from "../../firebase";
import type { Timestamp } from "firebase-admin/firestore";
import type { Gender, LanguageEntry } from "../common";
import { ForbiddenError, NotFoundError } from "../../middleware/error";
import { BaseCollection } from "./base";

/**
 * Assessment document stored in Firestore
 * Represents a student assessment/quiz
 */
export interface AssessmentDoc {
  name: string;
  birthDate: string; // ISO date string
  gender: Gender;
  grade: string;
  school: string;
  motherTongue: LanguageEntry;
  otherLanguages: LanguageEntry[];
  creatorEmail: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  finishedAt?: Timestamp | FieldValue;
}

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
  createdAtIsoTimestamp: string;
}

export const assessments = new BaseCollection<AssessmentDoc>(
  "assessments",
  (data) => data as AssessmentDoc,
);

/**
 * Convert AssessmentDoc to AssessmentDto with ID and ISO timestamp
 */
export function toAssessmentDto(
  doc: FirebaseFirestore.DocumentSnapshot<AssessmentDoc>,
): AssessmentDto | null {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  const createdAt = data.createdAt as FirebaseFirestore.Timestamp;

  return {
    id: doc.id,
    name: data.name,
    birthDate: data.birthDate,
    gender: data.gender,
    grade: data.grade,
    school: data.school,
    motherTongue: data.motherTongue,
    otherLanguages: data.otherLanguages,
    creatorEmail: data.creatorEmail,
    currentSection: data.currentSection,
    currentQuestion: data.currentQuestion,
    finished: data.finished,
    createdAtIsoTimestamp: createdAt.toDate().toISOString(),
  };
}

/**
 * Get assessment and verify ownership. Admins may access any assessment.
 * @throws NotFoundError if the assessment does not exist
 * @throws ForbiddenError if the caller neither created it nor is an admin
 */
export async function getAssessmentWithAuth(
  assessmentId: string,
  callerEmail: string,
  isAdmin = false,
): Promise<FirebaseFirestore.DocumentSnapshot<AssessmentDoc>> {
  const doc = await assessments.doc(assessmentId).get();

  if (!doc.exists) {
    throw new NotFoundError("Assessment not found");
  }

  const data = doc.data()!;
  if (!isAdmin && data.creatorEmail !== callerEmail) {
    throw new ForbiddenError();
  }

  return doc;
}

/**
 * Update assessment progress (current section and question)
 */
export async function updateAssessmentProgress(
  assessmentId: string,
  section: number,
  question: number,
): Promise<void> {
  const assessmentRef = assessments.doc(assessmentId);
  await assessmentRef.update({
    currentSection: section,
    currentQuestion: question,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
