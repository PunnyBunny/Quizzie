import express from "express";
import { questionSections, toQuestionSectionDto } from "../types/models/questions";
import { type GetQuestionsOutput } from "../types/questions";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../utils/express";

export const router = express.Router();

// POST /get-questions
router.post(
  "/get-questions",
  async (
    _req: FirebaseFunctionRequest<void>,
    res: FirebaseFunctionResponse<GetQuestionsOutput>,
  ) => {
    const snapshot = await questionSections.collection().orderBy("__name__").get();

    const sections = snapshot.docs.map((doc) => toQuestionSectionDto(doc.data()));

    res.status(200).json({ data: { sections } });
  },
);
