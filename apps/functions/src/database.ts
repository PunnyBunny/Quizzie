import { db, FieldValue } from "./firebase";
import type { Timestamp } from "firebase-admin/firestore";

// ============================================================================
// Type Definitions for Firestore Documents
// ============================================================================

/**
 * Assessment document stored in Firestore
 * Represents a student assessment/quiz
 */
export interface AssessmentDoc {
  age: number;
  grade: string;
  name: string;
  school: string;
  creatorEmail: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
  finishedAt?: Timestamp | FieldValue;
}

/**
 * Assessment API response with ID and ISO timestamp
 */
export interface AssessmentResponse {
  id: string;
  age: number;
  grade: string;
  name: string;
  school: string;
  creatorEmail: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
  createdAtIsoTimestamp: string;
}

/**
 * Base student response document structure
 */
interface BaseStudentResponseDoc {
  "assessment-id": string;
  section: number;
  createdAt: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

/**
 * Multiple choice student response document
 */
export interface MCStudentResponseDoc extends BaseStudentResponseDoc {
  type: "mc";
  studentResponses: Record<string, number | null>;
}

/**
 * Audio student response document
 */
export interface AudioStudentResponseDoc extends BaseStudentResponseDoc {
  type: "audio";
  files: Record<string, string | null>;
  transcripts: Record<string, string | null>;
  grades?: Record<string, number | null>;
}

/**
 * Union type for all student response document types
 */
export type StudentResponseDoc = MCStudentResponseDoc | AudioStudentResponseDoc;

// ============================================================================
// Firestore Data Converters
// ============================================================================

/**
 * Converter for Assessment documents
 * Handles serialization/deserialization between TypeScript and Firestore
 */
const assessmentConverter: FirebaseFirestore.FirestoreDataConverter<AssessmentDoc> = {
  toFirestore(assessment: AssessmentDoc): FirebaseFirestore.DocumentData {
    return assessment;
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): AssessmentDoc {
    const data = snapshot.data();
    return data as AssessmentDoc;
  },
};

/**
 * Converter for StudentResponse documents (both MC and Audio types)
 */
const studentResponseConverter: FirebaseFirestore.FirestoreDataConverter<StudentResponseDoc> = {
  toFirestore(response: StudentResponseDoc): FirebaseFirestore.DocumentData {
    return response;
  },
  fromFirestore(snapshot: FirebaseFirestore.QueryDocumentSnapshot): StudentResponseDoc {
    const data = snapshot.data();

    if (data.type === "mc") {
      return data as MCStudentResponseDoc;
    } else if (data.type === "audio") {
      return data as AudioStudentResponseDoc;
    }

    throw new Error(`Unknown student response type: ${data.type}`);
  },
};

// ============================================================================
// Typed Collection References
// ============================================================================

/**
 * Get a typed reference to the assessments collection
 */
export function assessmentsCollection() {
  return db.collection("assessments").withConverter(assessmentConverter);
}

/**
 * Get a typed reference to the studentResponses collection
 */
export function studentResponsesCollection() {
  return db.collection("studentResponses").withConverter(studentResponseConverter);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a student response is a multiple choice response
 */
export function isMCStudentResponse(
  response: StudentResponseDoc,
): response is MCStudentResponseDoc {
  return response.type === "mc";
}

/**
 * Type guard to check if a student response is an audio response
 */
export function isAudioStudentResponse(
  response: StudentResponseDoc,
): response is AudioStudentResponseDoc {
  return response.type === "audio";
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert AssessmentDoc to AssessmentResponse with ID and ISO timestamp
 */
export function toAssessmentResponse(
  doc: FirebaseFirestore.DocumentSnapshot<AssessmentDoc>,
): AssessmentResponse | null {
  if (!doc.exists) {
    return null;
  }

  const data = doc.data()!;
  const createdAt = data.createdAt as FirebaseFirestore.Timestamp;

  return {
    id: doc.id,
    age: data.age,
    grade: data.grade,
    name: data.name,
    school: data.school,
    creatorEmail: data.creatorEmail,
    currentSection: data.currentSection,
    currentQuestion: data.currentQuestion,
    finished: data.finished,
    createdAtIsoTimestamp: createdAt.toDate().toISOString(),
  };
}

/**
 * Find existing student response document reference for assessmentId and section
 */
export async function findStudentResponseRef(
  assessmentId: string,
  section: number,
): Promise<FirebaseFirestore.DocumentReference<StudentResponseDoc> | null> {
  const snap = await studentResponsesCollection()
    .where("assessment-id", "==", assessmentId)
    .where("section", "==", section)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].ref;
}

/**
 * Get assessment and verify ownership
 * @throws Error if assessment not found or unauthorized
 */
export async function getAssessmentWithAuth(
  assessmentId: string,
  callerEmail: string,
): Promise<FirebaseFirestore.DocumentSnapshot<AssessmentDoc>> {
  const doc = await assessmentsCollection().doc(assessmentId).get();

  if (!doc.exists) {
    throw new Error("Assessment not found");
  }

  const data = doc.data()!;
  if (data.creatorEmail !== callerEmail) {
    throw new Error("Unauthorized");
  }

  return doc;
}

/**
 * Create or get existing MC student response document reference
 */
export async function upsertMCStudentResponseRef(
  assessmentId: string,
  section: number,
): Promise<FirebaseFirestore.DocumentReference<StudentResponseDoc>> {
  let ref = await findStudentResponseRef(assessmentId, section);

  if (!ref) {
    const newDoc: MCStudentResponseDoc = {
      "assessment-id": assessmentId,
      section,
      type: "mc",
      studentResponses: {},
      createdAt: FieldValue.serverTimestamp(),
    };
    ref = await studentResponsesCollection().add(newDoc);
  }

  return ref;
}

/**
 * Create or get existing audio student response document reference
 */
export async function upsertAudioStudentResponseRef(
  assessmentId: string,
  section: number,
): Promise<FirebaseFirestore.DocumentReference<StudentResponseDoc>> {
  let ref = await findStudentResponseRef(assessmentId, section);

  if (!ref) {
    const newDoc: AudioStudentResponseDoc = {
      "assessment-id": assessmentId,
      section,
      type: "audio",
      files: {},
      transcripts: {},
      createdAt: FieldValue.serverTimestamp(),
    };
    ref = await studentResponsesCollection().add(newDoc);
  }

  return ref;
}

/**
 * Update assessment progress (current section and question)
 */
export async function updateAssessmentProgress(
  assessmentId: string,
  section: number,
  question: number,
): Promise<void> {
  const assessmentRef = assessmentsCollection().doc(assessmentId);
  await assessmentRef.update({
    currentSection: section,
    currentQuestion: question,
    updatedAt: FieldValue.serverTimestamp(),
  });
}
