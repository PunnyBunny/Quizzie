import express, { Request, Response } from "express";
import {
  AssessmentInput,
  AssessmentSchema,
  AudioAnswerInput,
  MCAnswerInput,
  MCAnswerSchema,
} from "./schemas";
import { validate } from "./middleware/validation";
import { db, FieldValue } from "./firebase";

export const router = express.Router();

// Firebase wraps the actual payload with {"data": ...}
type FirebaseFunctionRequest<T> = Request<{}, {}, { data: T }>;
type FirebaseFunctionResponse<T> = Response<{ data: T }>;

// Helper functions

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
    console.log("Received audio answer:", req.body.data);
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

    res.status(200).json({ data: { ok: true } });
  },
);
