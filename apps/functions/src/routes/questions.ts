import express from "express";
import { validate } from "../middleware/validation";
import { questionSections, getQuestionSections } from "../types/models/questions";
import type { QuestionSectionDoc } from "../types/models/questions";
import { type GetQuestionsOutput, type SaveQuestionSectionOutput } from "../types/questions";
import {
  type SaveQuestionSectionInput,
  SaveQuestionSectionSchema,
} from "../types/zod/routes/questions";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../utils/express";
import { adminHandler } from "../middleware/admin";

export const router = express.Router();

// POST /get-questions
router.post(
  "/get-questions",
  async (
    _req: FirebaseFunctionRequest<void>,
    res: FirebaseFunctionResponse<GetQuestionsOutput>,
  ) => {
    const sections = await getQuestionSections();

    res.status(200).json({ data: { sections } });
  },
);

// POST /admin/save-question-section (admin only)
router.post(
  "/admin/save-question-section",
  adminHandler,
  validate(SaveQuestionSectionSchema),
  async (
    req: FirebaseFunctionRequest<SaveQuestionSectionInput>,
    res: FirebaseFunctionResponse<SaveQuestionSectionOutput>,
  ) => {
    const {
      id,
      title,
      kind,
      length,
      goal,
      questions,
      audios,
      choicesAudios,
      choices,
      correctAnswers,
      images,
      instructions,
    } = req.body.data;
    console.log("here");

    const data: QuestionSectionDoc = {
      title,
      kind,
      length,
      goal,
      questions,
      audios,
      instructions,
    };
    if (choicesAudios !== undefined) data.choicesAudios = choicesAudios;
    if (choices !== undefined) data.choices = choices;
    if (correctAnswers !== undefined) data.correctAnswers = correctAnswers;
    if (images !== undefined) data.images = images;

    const docRef = questionSections.doc(id);
    const existed = (await docRef.get()).exists;
    await docRef.set(data);

    res.status(existed ? 200 : 201).json({ data: { id } });
  },
);
