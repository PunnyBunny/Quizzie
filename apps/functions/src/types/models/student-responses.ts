import { FieldValue, admin } from "../../firebase";
import type { Timestamp } from "firebase-admin/firestore";
import { BaseCollection } from "./base";

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
  studentResponses: Record<string, number | null>;
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
export type StudentResponseDto = MCStudentResponseDto | AudioStudentResponseDto;

export const studentResponses = new BaseCollection<StudentResponseDoc>(
  "studentResponses",
  (data) => {
    if (data.type === "mc") return data as MCStudentResponseDoc;
    if (data.type === "audio") return data as AudioStudentResponseDoc;
    throw new Error(`Unknown student response type: ${data.type}`);
  },
);

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

/**
 * Convert StudentResponseDoc to StudentResponseDto
 * Note: For audio responses, the files field will still contain gs:// URIs.
 * Use getSignedUrl() to convert them to signed URLs if needed.
 */
export function toStudentResponseDto(doc: StudentResponseDoc): StudentResponseDto {
  const createdAt = doc.createdAt as FirebaseFirestore.Timestamp;
  const base: BaseStudentResponseDto = {
    assessmentId: doc["assessment-id"],
    section: doc.section,
    createdAtIsoTimestamp: createdAt.toDate().toISOString(),
  };

  if (isMCStudentResponse(doc)) {
    return {
      ...base,
      type: "mc",
      studentResponses: doc.studentResponses,
    };
  }

  return {
    ...base,
    type: "audio",
    files: doc.files,
    transcripts: doc.transcripts,
    grades: doc.grades,
  };
}

/**
 * Find existing student response document reference for assessmentId and section
 */
export async function findStudentResponseRef(
  assessmentId: string,
  section: number,
): Promise<FirebaseFirestore.DocumentReference<StudentResponseDoc> | null> {
  const snap = await studentResponses
    .collection()
    .where("assessment-id", "==", assessmentId)
    .where("section", "==", section)
    .limit(1)
    .get();

  return snap.empty ? null : snap.docs[0].ref;
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
    ref = await studentResponses.collection().add(newDoc);
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
    ref = await studentResponses.collection().add(newDoc);
  }

  return ref;
}

/**
 * Convert a gs:// URI to a short-lived signed URL
 */
export async function getSignedUrl(gsUri: string): Promise<string> {
  const pathMatch = /^gs:\/\/[^/]+\/(.+)$/.exec(gsUri);
  if (!pathMatch) return "";
  const [signedUrl] = await admin
    .storage()
    .bucket()
    .file(pathMatch[1])
    .getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 1000,
    });
  return signedUrl;
}
