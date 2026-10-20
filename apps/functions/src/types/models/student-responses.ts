import type { BaseStudentResponseDto, StudentResponseDto } from "./student-responses-dto";
export type {
  BaseStudentResponseDto,
  MCStudentResponseDto,
  AudioStudentResponseDto,
  HybridStudentResponseDto,
  StudentResponseDto,
} from "./student-responses-dto";
import type { HybridAttempt } from "./hybrid-response-dto";
import { ApiError } from "../../middleware/error";
import { assessments } from "./assessments";
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
export interface HybridStudentResponseDoc extends Omit<AudioStudentResponseDoc, "type"> {
  type: "audio_mc";
  attempts: Record<string, HybridAttempt>;
}
export type StudentResponseDoc =
  | MCStudentResponseDoc
  | AudioStudentResponseDoc
  | HybridStudentResponseDoc;

export const studentResponses = new BaseCollection<StudentResponseDoc>(
  "studentResponses",
  (data) => {
    if (data.type === "mc") return data as MCStudentResponseDoc;
    if (data.type === "audio_mc") return data as HybridStudentResponseDoc;
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

  if (doc.type === "audio_mc")
    return {
      ...base,
      type: "audio_mc",
      files: doc.files,
      transcripts: doc.transcripts,
      grades: doc.grades,
      attempts: doc.attempts,
    };
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

export function hasRecordedEvidence(response: StudentResponseDoc, question: number): boolean {
  return response.type === "audio_mc"
    ? Object.prototype.hasOwnProperty.call(response.attempts, question)
    : response.type === "audio" && Object.prototype.hasOwnProperty.call(response.files, question);
}

// Write question evidence and progress together. Use the original document when one
// exists, and a stable ID for new responses; transaction query prevents duplicate races.
export async function saveStudentAnswer(
  assessmentId: string,
  section: number,
  question: number,
  response: StudentResponseDoc,
  progress: { currentSection: number; currentQuestion: number },
): Promise<void> {
  await admin.firestore().runTransaction(async (transaction) => {
    const query = studentResponses
      .collection()
      .where("assessment-id", "==", assessmentId)
      .where("section", "==", section)
      .limit(1);
    const existing = await transaction.get(query);
    const target = existing.docs[0]?.ref ?? studentResponses.doc(`${assessmentId}-${section}`);
    const current = existing.docs[0] ?? (await transaction.get(target));
    const currentData = current.data();
    if (currentData && currentData.type !== response.type)
      throw new ApiError("Response type does not match assessment configuration", 409);
    if (!current.exists) transaction.set(target, response);
    else {
      const updates: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (response.type === "mc")
        updates[`studentResponses.${question}`] = response.studentResponses[question];
      else {
        updates[`files.${question}`] = response.files[question];
        updates[`transcripts.${question}`] = response.transcripts[question];
        // A retry of identical evidence must retain a grade; a changed attempt invalidates it.
        const sameRecording =
          currentData?.type !== "mc" &&
          currentData?.files[question] === response.files[question] &&
          currentData?.transcripts[question] === response.transcripts[question];
        const sameAttempt =
          response.type !== "audio_mc" ||
          (currentData?.type === "audio_mc" &&
            JSON.stringify(currentData.attempts[question]) ===
              JSON.stringify(response.attempts[question]));
        if (!sameRecording || !sameAttempt) updates[`grades.${question}`] = FieldValue.delete();
        if (response.type === "audio_mc")
          updates[`attempts.${question}`] = response.attempts[question];
      }
      transaction.update(target, updates as FirebaseFirestore.UpdateData<StudentResponseDoc>);
    }
    transaction.update(assessments.doc(assessmentId), {
      ...progress,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}
