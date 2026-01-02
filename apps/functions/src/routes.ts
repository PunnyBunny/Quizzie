import express, { Request, Response } from "express";
import {
  AssessmentInput,
  AssessmentSchema,
  AudioAnswerInput,
  MCAnswerInput,
  MCAnswerSchema,
  FinishAssessmentInput,
  FinishAssessmentSchema,
} from "./schemas";
import { validate } from "./middleware/validation";
import { db, FieldValue } from "./firebase";

export const router = express.Router();

// Firebase wraps the actual payload with {"data": ...}
type FirebaseFunctionRequest<T> = Request<{}, {}, { data: T }>;
type FirebaseFunctionResponse<T> = Response<{ data: T }, { callerEmail: string }>;

// Helper functions

/**
 * Find existing answer doc ref for assessmentId and section
 * @param assessmentId
 * @param section
 */
const findAnswerDocRef = async (
  assessmentId: string,
  section: number,
): Promise<FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null> => {
  const snap = await db
    .collection("answers")
    .where("assessment-id", "==", assessmentId)
    .where("section", "==", section)
    .limit(1)
    .get();
  if (!snap.empty) {
    return snap.docs[0].ref;
  }
  return null;
};

// 1) Create Assessment
router.post(
  "/create-assessment",
  validate(AssessmentSchema),
  async (
    req: FirebaseFunctionRequest<AssessmentInput>,
    res: FirebaseFunctionResponse<{ id: string }>,
  ) => {
    const { age, grade, name, school } = req.body.data;

    const doc = {
      age,
      grade,
      name,
      school,
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await db.collection("assessments").add(doc);

    console.info("Created assessment", ref.id);
    res.status(201).json({ data: { id: ref.id } });
  },
);

// 2) Submit Multiple-Choice Answers
router.post(
  "/submit-mc-answer",
  validate(MCAnswerSchema),
  async (req: FirebaseFunctionRequest<MCAnswerInput>, res: Response) => {
    const { assessmentId, section, question, answer } = req.body.data;
    const now = FieldValue.serverTimestamp();

    // Upsert logic
    let ref = await findAnswerDocRef(assessmentId, section);
    ref ??= await db.collection("answers").add({
      "assessment-id": assessmentId,
      section,
      type: "mc",
      answers: {},
      createdAt: FieldValue.serverTimestamp(),
    });

    await ref.update({ [`answers.${question}`]: answer, updatedAt: now });

    res.status(200).json({ data: { ok: true } });
  },
);

// 3) Submit Audio Answer (multipart/form-data)
router.post(
  "/submit-audio-answer",
  async (req: FirebaseFunctionRequest<AudioAnswerInput>, res: Response) => {
    const { assessmentId, section, question, transcript, gsUri } = req.body.data;

    // Upsert Firestore doc for audio type
    let ref = await findAnswerDocRef(assessmentId, section);
    ref ??= await db.collection("answers").add({
      "assessment-id": assessmentId,
      section,
      type: "audio",
      files: {},
      transcripts: {},
      createdAt: FieldValue.serverTimestamp(),
    });

    const now = FieldValue.serverTimestamp();

    await ref.update({
      [`files.${question}`]: gsUri,
      [`transcripts.${question}`]: transcript,
      updatedAt: now,
    });

    // Update assessment counters
    const assessmentRef = db.collection("assessments").doc(assessmentId);
    await assessmentRef.update({
      currentSection: section,
      currentQuestion: question,
      updatedAt: now,
    });

    res.status(200).json({ data: { ok: true } });
  },
);

// 4) Mark Assessment as Finished
router.post(
  "/finish-assessment",
  validate(FinishAssessmentSchema),
  async (req: FirebaseFunctionRequest<FinishAssessmentInput>, res: Response) => {
    const { assessmentId } = req.body.data;
    const now = FieldValue.serverTimestamp();

    const assessmentRef = db.collection("assessments").doc(assessmentId);

    // Check if assessment exists
    const assessmentDoc = await assessmentRef.get();
    if (!assessmentDoc.exists) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }

    // Mark assessment as finished
    await assessmentRef.update({
      finished: true,
      finishedAt: now,
      updatedAt: now,
    });

    res.status(200).json({ data: { ok: true } });
  },
);
