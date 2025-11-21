import express, { Request, Response } from "express";
import {
  AssessmentInput,
  AssessmentSchema,
  AudioAnswerInput,
  MCAnswerInput,
  MCAnswerSchema,
} from "./schemas";
import { upload } from "./middleware/upload";
import { validate } from "./middleware/validation";
import { bucket, db, FieldValue } from "./firebase";

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

const buildStoragePath = (assessmentId: string, section: number, question: number, ext: string) =>
  `assessments/${assessmentId}/${section}/${question}.${ext}`;

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
    if (!ref) {
      ref = await db.collection("answers").add({
        "assessment-id": assessmentId,
        section,
        type: "mc",
        answers: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await ref.update({ [`answers.${question}`]: answer, updatedAt: now });

    res.status(200).json({ data: { ok: true } });
  },
);

// 3) Submit Audio Answer (multipart/form-data)
router.post(
  "/submit-audio-answer",
  upload.single("file"),
  async (req: FirebaseFunctionRequest<AudioAnswerInput>, res: Response) => {
    const { assessmentId, section, question, transcript } = req.body.data;
    const file = (req as unknown as { file?: Express.Multer.File }).file;

    if (!file) {
      res.status(400).json({ ok: false, error: "file is required (multipart/form-data)" });
      return;
    }

    // Upload to Storage
    const ext = file.originalname.split(".").pop() || "wav";
    const storagePath = buildStoragePath(assessmentId, section, question, ext);
    const gcsFile = bucket.file(storagePath);

    await gcsFile.save(file.buffer);

    const now = FieldValue.serverTimestamp();

    // Upsert Firestore doc for audio type
    let ref = await findAnswerDocRef(assessmentId, section);
    if (!ref) {
      ref = await db.collection("answers").add({
        "assessment-id": assessmentId,
        section,
        type: "audio",
        files: {},
        transcripts: {},
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    await ref.update({
      [`files.${question}`]: storagePath,
      [`transcripts.${question}`]: transcript,
      updatedAt: now,
    });

    res.sendStatus(200);
  },
);
