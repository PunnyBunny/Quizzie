import express from "express";
import { validate } from "../middleware/validation";
import { NotFoundError } from "../middleware/error";
import { FieldValue } from "../firebase";
import type { Timestamp } from "firebase-admin/firestore";
import { getAssessmentWithAuth, toAssessmentDto } from "../models/assessments";
import {
  findStudentResponseRef,
  getSignedUrl,
  isAudioStudentResponse,
  isMCStudentResponse,
  type StudentResponseDto,
  studentResponses as studentResponsesDb,
} from "../models/student-responses";
import {
  type GetAssessmentStudentResponsesInput,
  GetAssessmentStudentResponsesSchema,
  type GetAssessmentStudentResponsesOutput,
  type SubmitAudioGradeInput,
  SubmitAudioGradeSchema,
} from "../validation";
import { type FirebaseFunctionRequest, type FirebaseFunctionResponse } from "../utils/express";

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

    const assessment = toAssessmentDto(assessmentDoc);
    if (!assessment) {
      throw new NotFoundError();
    }

    const studentResponsesSnapshot = await studentResponsesDb
      .collection()
      .where("assessment-id", "==", assessmentId)
      .get();

    const studentResponses: Record<string, StudentResponseDto> = {};

    for (const doc of studentResponsesSnapshot.docs) {
      const data = doc.data();

      if (isMCStudentResponse(data)) {
        const createdAt = data.createdAt as Timestamp;
        studentResponses[data.section.toString()] = {
          assessmentId: data["assessment-id"],
          section: data.section,
          type: "mc",
          studentResponses: data.studentResponses,
          createdAtIsoTimestamp: createdAt.toDate().toISOString(),
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

        const createdAt = data.createdAt as Timestamp;
        studentResponses[data.section.toString()] = {
          assessmentId: data["assessment-id"],
          section: data.section,
          type: "audio",
          files: signedUrls,
          transcripts: data.transcripts,
          grades: data.grades,
          createdAtIsoTimestamp: createdAt.toDate().toISOString(),
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
