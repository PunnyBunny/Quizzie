import express from "express";
import { validate } from "../middleware/validation";
import { FieldValue } from "../firebase";
import { updateAssessmentProgress } from "../types/models/assessments";
import {
  upsertAudioStudentResponseRef,
  upsertMCStudentResponseRef,
} from "../types/models/student-responses";
import {
  type AudioStudentResponseInput,
  AudioStudentResponseSchema,
  type MCStudentResponseInput,
  MCStudentResponseSchema,
} from "../types/zod/routes/submissions";
import type { FirebaseFunctionRequest } from "../utils/express";

export const router = express.Router();

// POST /submit-mc-answer
router.post(
  "/submit-mc-answer",
  validate(MCStudentResponseSchema),
  async (req: FirebaseFunctionRequest<MCStudentResponseInput>, res) => {
    const { assessmentId, section, question, answer } = req.body.data;

    const ref = await upsertMCStudentResponseRef(assessmentId, section);
    await ref.update({
      [`studentResponses.${question}`]: answer,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await updateAssessmentProgress(assessmentId, section, question + 1);

    res.status(200).json({ data: { ok: true } });
  },
);

// POST /submit-audio-answer
router.post(
  "/submit-audio-answer",
  validate(AudioStudentResponseSchema),
  async (req: FirebaseFunctionRequest<AudioStudentResponseInput>, res) => {
    const { assessmentId, section, question, transcript, gsUri } = req.body.data;

    const ref = await upsertAudioStudentResponseRef(assessmentId, section);

    await ref.update({
      [`files.${question}`]: gsUri,
      [`transcripts.${question}`]: transcript,
      updatedAt: FieldValue.serverTimestamp(),
    });

    await updateAssessmentProgress(assessmentId, section, question);

    res.status(200).json({ data: { ok: true } });
  },
);
