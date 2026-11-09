import express from "express";
import type {
  OkOutput,
  SubmitAudioAnswerInput,
  SubmitAudioMcAnswerInput,
  SubmitMcAnswerInput,
  GetOptionAudioPlaybackInput,
  GetOptionAudioPlaybackOutput,
  UpdateOptionAudioPlaybackInput,
  UpdateOptionAudioPlaybackOutput,
  QuestionSectionDto,
} from "@vaca/contracts";
import { validate } from "../middleware/validation";
import { ApiError } from "../middleware/error";
import { admin, FieldValue } from "../firebase";
import { getAssessmentWithAuth } from "../types/models/assessments";
import { getQuestionSections, getConfiguredQuestion } from "../types/models/questions";
import {
  findStudentResponseRef,
  getOptionPlayCounts,
  saveStudentAnswer,
} from "../types/models/student-responses";
import {
  DEFAULT_MAX_OPTION_PLAYS,
  initialOptionPlaybackIds,
  updateOptionAudioPlayback,
} from "../types/models/option-playbacks";
import {
  SubmitMcAnswerSchema,
  SubmitAudioAnswerSchema,
  SubmitAudioMcAnswerSchema,
  GetOptionAudioPlaybackSchema,
  UpdateOptionAudioPlaybackSchema,
} from "../types/zod/routes/submissions";
import type { FirebaseFunctionRequest, FirebaseFunctionResponse } from "../utils/express";

export const router = express.Router();
async function getAuthorizedOptionAudioSection(
  input: GetOptionAudioPlaybackInput,
  res: FirebaseFunctionResponse<GetOptionAudioPlaybackOutput>,
): Promise<QuestionSectionDto> {
  await getAssessmentWithAuth(
    input.assessmentId,
    res.locals.callerEmail,
    res.locals.callerClaims?.isAdmin === true,
  );
  const sections = await getQuestionSections();
  const kind = sections[input.section]?.kind;
  if (kind !== "mc" && kind !== "audio_mc")
    throw new ApiError("Invalid question or response type", 400);
  return getConfiguredQuestion(sections, input.section, input.question, kind);
}
router.post(
  "/get-option-audio-playback",
  validate(GetOptionAudioPlaybackSchema),
  async (
    req: FirebaseFunctionRequest<GetOptionAudioPlaybackInput>,
    res: FirebaseFunctionResponse<GetOptionAudioPlaybackOutput>,
  ) => {
    const input = req.body.data;
    const section = await getAuthorizedOptionAudioSection(input, res);
    const ref = await findStudentResponseRef(input.assessmentId, input.section);
    const response = ref ? (await ref.get()).data() : undefined;
    res.status(200).json({
      data: {
        counts: getOptionPlayCounts(response)[input.question] ?? {},
        maxPlays: section.maxOptionPlays ?? DEFAULT_MAX_OPTION_PLAYS,
      },
    });
  },
);
router.post(
  "/update-option-audio-playback",
  validate(UpdateOptionAudioPlaybackSchema),
  async (
    req: FirebaseFunctionRequest<UpdateOptionAudioPlaybackInput>,
    res: FirebaseFunctionResponse<UpdateOptionAudioPlaybackOutput>,
  ) => {
    const input = req.body.data;
    const section = await getAuthorizedOptionAudioSection(input, res);
    if (
      !Object.prototype.hasOwnProperty.call(
        section.choices?.[input.question] ?? {},
        input.optionKey,
      ) ||
      !Object.prototype.hasOwnProperty.call(
        section.optionAudios?.[input.question] ?? {},
        input.optionKey,
      ) ||
      !section.optionAudios?.[input.question]?.[input.optionKey]?.trim()
    )
      throw new ApiError("Option recording not configured", 400);
    res.status(200).json({ data: await updateOptionAudioPlayback(input, section) });
  },
);
async function configuration(
  input: SubmitMcAnswerInput | SubmitAudioAnswerInput,
  kind: "mc" | "audio" | "audio_mc",
  res: FirebaseFunctionResponse<OkOutput>,
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
async function validateRecording(input: SubmitAudioAnswerInput) {
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
  validate(SubmitMcAnswerSchema),
  async (
    req: FirebaseFunctionRequest<SubmitMcAnswerInput>,
    res: FirebaseFunctionResponse<OkOutput>,
  ) => {
    const input = req.body.data;
    const { config, progress } = await configuration(input, "mc", res);
    if (
      input.answer !== null &&
      !Object.prototype.hasOwnProperty.call(config.choices?.[input.question] ?? {}, input.answer)
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
        ...initialOptionPlaybackIds(config, input.question),
      },
      progress,
    );
    res.status(200).json({ data: { ok: true } });
  },
);
router.post(
  "/submit-audio-answer",
  validate(SubmitAudioAnswerSchema),
  async (
    req: FirebaseFunctionRequest<SubmitAudioAnswerInput>,
    res: FirebaseFunctionResponse<OkOutput>,
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
  validate(SubmitAudioMcAnswerSchema),
  async (
    req: FirebaseFunctionRequest<SubmitAudioMcAnswerInput>,
    res: FirebaseFunctionResponse<OkOutput>,
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
        ...initialOptionPlaybackIds(config, input.question),
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
