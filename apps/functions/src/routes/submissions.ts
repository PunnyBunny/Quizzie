import express from "express";
import { validate } from "../middleware/validation";
import { ApiError } from "../middleware/error";
import { admin, FieldValue } from "../firebase";
import { getAssessmentWithAuth } from "../types/models/assessments";
import { getQuestionSections, getConfiguredQuestion } from "../types/models/questions";
import { saveStudentAnswer } from "../types/models/student-responses";
import {
  MCStudentResponseSchema,
  AudioStudentResponseSchema,
  HybridStudentResponseSchema,
  type MCStudentResponseInput,
  type AudioStudentResponseInput,
  type HybridStudentResponseInput,
} from "../types/zod/routes/submissions";
import type { FirebaseFunctionRequest, FirebaseFunctionResponse } from "../utils/express";

export const router = express.Router();
async function configuration(
  input: MCStudentResponseInput | AudioStudentResponseInput,
  kind: "mc" | "audio" | "audio_mc",
  res: FirebaseFunctionResponse<{ ok: boolean }>,
) {
  await getAssessmentWithAuth(
    input.assessmentId,
    res.locals.callerEmail,
    res.locals.callerClaims?.isAdmin === true,
  );
  const sections = await getQuestionSections();
  const config = getConfiguredQuestion(sections, input.section, input.question, kind);
  const lastQuestion = input.question === config.length - 1;
  const nextSection = lastQuestion && input.section < sections.length - 1;
  return {
    config,
    progress: {
      currentSection: nextSection ? input.section + 1 : input.section,
      currentQuestion: nextSection ? 0 : lastQuestion ? input.question : input.question + 1,
    },
  };
}
async function validateRecording(input: AudioStudentResponseInput) {
  if (input.gsUri === null) return;
  const bucket = admin.storage().bucket();
  const path = `assessments/${input.assessmentId}/${input.section}/${input.question}.`;
  const prefix = `gs://${bucket.name}/${path}`;
  if (
    !input.gsUri.startsWith(prefix) ||
    !/^(?:[a-z0-9-]+\.)?[a-z0-9]+$/i.test(input.gsUri.slice(prefix.length))
  )
    throw new ApiError("Invalid recording URI", 400);
  const [exists] = await bucket.file(input.gsUri.slice(`gs://${bucket.name}/`.length)).exists();
  if (!exists) throw new ApiError("Recording not found", 400);
}
router.post(
  "/submit-mc-answer",
  validate(MCStudentResponseSchema),
  async (
    req: FirebaseFunctionRequest<MCStudentResponseInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const input = req.body.data;
    const { config, progress } = await configuration(input, "mc", res);
    // MC submissions store the displayed ordinal.
    if (
      input.answer !== null &&
      input.answer >= Object.keys(config.choices?.[input.question] ?? {}).length
    )
      throw new ApiError("Invalid option", 400);
    await saveStudentAnswer(
      input.assessmentId,
      input.section,
      input.question,
      {
        "assessment-id": input.assessmentId,
        section: input.section,
        type: "mc",
        createdAt: FieldValue.serverTimestamp(),
        studentResponses: { [input.question]: input.answer },
      },
      progress,
    );
    res.status(200).json({ data: { ok: true } });
  },
);
router.post(
  "/submit-audio-answer",
  validate(AudioStudentResponseSchema),
  async (
    req: FirebaseFunctionRequest<AudioStudentResponseInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const input = req.body.data;
    const { progress } = await configuration(input, "audio", res);
    await validateRecording(input);
    await saveStudentAnswer(
      input.assessmentId,
      input.section,
      input.question,
      {
        "assessment-id": input.assessmentId,
        section: input.section,
        type: "audio",
        createdAt: FieldValue.serverTimestamp(),
        files: { [input.question]: input.gsUri },
        transcripts: { [input.question]: input.transcript },
      },
      progress,
    );
    res.status(200).json({ data: { ok: true } });
  },
);
router.post(
  "/submit-audio-mc-answer",
  validate(HybridStudentResponseSchema),
  async (
    req: FirebaseFunctionRequest<HybridStudentResponseInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const input = req.body.data;
    const { config, progress } = await configuration(input, "audio_mc", res);
    const choices = config.choices?.[input.question] ?? {};
    if (
      input.selectedOption !== null &&
      !Object.prototype.hasOwnProperty.call(choices, input.selectedOption)
    )
      throw new ApiError("Invalid option", 400);
    await validateRecording(input);
    await saveStudentAnswer(
      input.assessmentId,
      input.section,
      input.question,
      {
        "assessment-id": input.assessmentId,
        section: input.section,
        type: "audio_mc",
        createdAt: FieldValue.serverTimestamp(),
        files: { [input.question]: input.gsUri },
        transcripts: { [input.question]: input.transcript },
        attempts: {
          [input.question]: {
            assistanceOffered: input.assistanceOffered,
            selectedOption: input.selectedOption,
            skipped: input.skipped,
          },
        },
      },
      progress,
    );
    res.status(200).json({ data: { ok: true } });
  },
);
