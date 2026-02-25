import express from "express";
import { validate } from "../middleware/validation";
import { NotFoundError } from "../middleware/error";
import { FieldValue } from "../firebase";
import {
  findStudentResponseRef,
  getAssessmentWithAuth,
  getSignedUrl,
  isAudioStudentResponse,
  isMCStudentResponse,
  type StudentResponseDoc,
  studentResponsesCollection,
  toAssessmentResponse,
} from "../database";
import {
  type GetAssessmentStudentResponsesInput,
  GetAssessmentStudentResponsesSchema,
  type GetAssessmentStudentResponsesOutput,
  type SubmitAudioGradeInput,
  SubmitAudioGradeSchema,
} from "../validation";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../types";

export const router = express.Router();

// POST /get-assessment-student-responses
router.post(
  "/get-assessment-student-responses",
  validate(GetAssessmentStudentResponsesSchema),
  async (
    req: FirebaseFunctionRequest<GetAssessmentStudentResponsesInput>,
    res: FirebaseFunctionResponse<GetAssessmentStudentResponsesOutput>,
  ) => {
    const { assessmentId } = req.body.data;
    const { callerEmail } = res.locals;

    const assessmentDoc = await getAssessmentWithAuth(assessmentId, callerEmail);

    const assessment = toAssessmentResponse(assessmentDoc);
    if (!assessment) {
      throw new NotFoundError();
    }

    const studentResponsesSnapshot = await studentResponsesCollection()
      .where("assessment-id", "==", assessmentId)
      .get();

    const studentResponses: Record<string, StudentResponseDoc> = {};

    for (const doc of studentResponsesSnapshot.docs) {
      const data = doc.data();

      if (isMCStudentResponse(data)) {
        studentResponses[data.section.toString()] = {
          "assessment-id": data["assessment-id"],
          section: data.section,
          type: "mc",
          studentResponses: data.studentResponses,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      } else if (isAudioStudentResponse(data)) {
        const signedUrls: Record<string, string> = {};
        for (const [question, gsUri] of Object.entries(data.files)) {
          if (!gsUri) continue;
          signedUrls[question] = "";
          try {
            signedUrls[question] = await getSignedUrl(gsUri);
          } catch (error) {
            console.error(`Failed to generate signed URL for ${gsUri}:`, error);
          }
        }

        studentResponses[data.section.toString()] = {
          "assessment-id": data["assessment-id"],
          section: data.section,
          type: "audio",
          files: signedUrls,
          transcripts: data.transcripts,
          grades: data.grades,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        };
      }
    }

    res.status(200).json({
      data: {
        assessment,
        studentResponsesBySection: studentResponses,
      },
    });
  },
);

// POST /submit-audio-grade
router.post(
  "/submit-audio-grade",
  validate(SubmitAudioGradeSchema),
  async (
    req: FirebaseFunctionRequest<SubmitAudioGradeInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const { assessmentId, section, question, grade } = req.body.data;
    const { callerEmail } = res.locals;

    await getAssessmentWithAuth(assessmentId, callerEmail);

    const ref = await findStudentResponseRef(assessmentId, section);
    if (!ref) {
      throw new NotFoundError();
    }

    const now = FieldValue.serverTimestamp();

    await ref.update({
      [`grades.${question}`]: grade,
      updatedAt: now,
    });

    console.log(
      `Graded assessment ${assessmentId}, section ${section}, question ${question}: ${grade}/5`,
    );
    res.status(200).json({ data: { ok: true } });
  },
);
