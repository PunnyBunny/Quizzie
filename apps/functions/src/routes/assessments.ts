import express from "express";
import { validate } from "../middleware/validation";
import { NotFoundError } from "../middleware/error";
import { FieldValue } from "../firebase";
import {
  type AssessmentDoc,
  type AssessmentDto,
  assessments as assessmentsDb,
  toAssessmentDto,
} from "../types/models/assessments";
import {
  type AssessmentInput,
  AssessmentSchema,
  type FinishAssessmentInput,
  FinishAssessmentSchema,
  type GetAssessmentsInput,
  GetAssessmentsSchema,
} from "../types/zod/routes/assessments";
import { type GetAssessmentsOutput } from "../types/assessments";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../utils/express";

export const router = express.Router();

// POST /create-assessment
router.post(
  "/create-assessment",
  validate(AssessmentSchema),
  async (
    req: FirebaseFunctionRequest<AssessmentInput>,
    res: FirebaseFunctionResponse<{ id: string }>,
  ) => {
    const { name, birthDate, gender, grade, school, motherTongue, otherLanguages } = req.body.data;
    const { callerEmail } = res.locals;

    const doc: AssessmentDoc = {
      name,
      birthDate,
      gender,
      grade,
      school,
      motherTongue,
      otherLanguages,
      creatorEmail: callerEmail,
      currentSection: 0,
      currentQuestion: 0,
      finished: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await assessmentsDb.collection().add(doc);

    console.info("Created assessment", ref.id);
    res.status(201).json({ data: { id: ref.id } });
  },
);

// POST /get-assessments
// TODO: this shouldn't really be a POST request, but Firebase Functions has limitations with GET requests
router.post(
  "/get-assessments",
  validate(GetAssessmentsSchema),
  async (
    req: FirebaseFunctionRequest<GetAssessmentsInput>,
    res: FirebaseFunctionResponse<GetAssessmentsOutput>,
  ) => {
    const { finished } = req.body.data;
    const { callerEmail } = res.locals;

    const allAssessments = await assessmentsDb
      .collection()
      .where("creatorEmail", "==", callerEmail)
      .get();

    const assessments = allAssessments.docs
      .map((doc) => toAssessmentDto(doc))
      .filter(
        (assessment): assessment is AssessmentDto =>
          assessment !== null && assessment.finished === finished,
      );

    console.log("found assessments:", assessments);
    res.status(200).json({ data: { assessments } });
  },
);

// POST /finish-assessment
router.post(
  "/finish-assessment",
  validate(FinishAssessmentSchema),
  async (req: FirebaseFunctionRequest<FinishAssessmentInput>, res) => {
    const { assessmentId } = req.body.data;
    const now = FieldValue.serverTimestamp();

    const assessmentRef = assessmentsDb.doc(assessmentId);

    const assessmentDoc = await assessmentRef.get();
    if (!assessmentDoc.exists) {
      throw new NotFoundError("Assessment not found");
    }

    await assessmentRef.update({
      finished: true,
      finishedAt: now,
      updatedAt: now,
    });

    res.status(200).json({ data: { ok: true } });
  },
);
