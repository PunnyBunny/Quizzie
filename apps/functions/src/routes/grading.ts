import express from "express";
import { validate } from "../middleware/validation";
import { NotFoundError } from "../middleware/error";
import { FieldValue } from "../firebase";
import { admin } from "../firebase";
import { ApiError } from "../middleware/error";
import { getQuestionSections } from "../types/models/questions";
import { getAssessmentWithAuth, toAssessmentDto } from "../types/models/assessments";
import {
  findStudentResponseRef,
  getSignedUrl,
  hasRecordedEvidence,
  toStudentResponseDto,
  type StudentResponseDto,
  studentResponses as studentResponsesDb,
} from "../types/models/student-responses";
import {
  type GetAssessmentStudentResponsesInput,
  GetAssessmentStudentResponsesSchema,
} from "../types/zod/routes/submissions";
import { type GetAssessmentStudentResponsesOutput } from "../types/submissions";
import {
  type SubmitAudioGradeInput,
  SubmitAudioGradeSchema,
  type UpdateAudioTranscriptInput,
  UpdateAudioTranscriptSchema,
} from "../types/zod/routes/grading";
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
    const { callerEmail, callerClaims } = res.locals;

    const assessmentDoc = await getAssessmentWithAuth(
      assessmentId,
      callerEmail,
      callerClaims?.isAdmin === true,
    );

    const sections = await getQuestionSections();
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

      const dto = toStudentResponseDto(data);
      if (dto.type !== "mc") {
        const signedUrls: Record<string, string | null> = {};
        for (const [question, gsUri] of Object.entries(dto.files)) {
          signedUrls[question] = null;
          if (!gsUri) continue;
          try {
            signedUrls[question] = await getSignedUrl(gsUri);
          } catch (error) {
            console.error("Failed to generate recording URL", {
              assessmentId,
              section: data.section,
              question,
              error: error instanceof Error ? error.message : "Unknown signing error",
            });
          }
        }
        dto.files = signedUrls;
      }
      studentResponses[data.section.toString()] = dto;
    }

    res.status(200).json({
      data: {
        assessment,
        sections,
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
    const { callerEmail, callerClaims } = res.locals;

    await getAssessmentWithAuth(assessmentId, callerEmail, callerClaims?.isAdmin === true);

    const ref = await findStudentResponseRef(assessmentId, section);
    if (!ref) {
      throw new NotFoundError();
    }

    const now = FieldValue.serverTimestamp();

    await admin.firestore().runTransaction(async (transaction) => {
      const response = (await transaction.get(ref)).data();
      if (!response || !hasRecordedEvidence(response, question))
        throw new ApiError("No submitted evidence for this question", 400);
      transaction.update(ref, { [`grades.${question}`]: grade, updatedAt: now });
    });

    console.log(
      `Graded assessment ${assessmentId}, section ${section}, question ${question}: ${grade}/5`,
    );
    res.status(200).json({ data: { ok: true } });
  },
);

// POST /update-audio-transcript
router.post(
  "/update-audio-transcript",
  validate(UpdateAudioTranscriptSchema),
  async (
    req: FirebaseFunctionRequest<UpdateAudioTranscriptInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const { assessmentId, section, question, transcript } = req.body.data;
    const { callerEmail, callerClaims } = res.locals;

    await getAssessmentWithAuth(assessmentId, callerEmail, callerClaims?.isAdmin === true);

    const ref = await findStudentResponseRef(assessmentId, section);
    if (!ref) {
      throw new NotFoundError();
    }

    await admin.firestore().runTransaction(async (transaction) => {
      const response = (await transaction.get(ref)).data();
      if (!response || !hasRecordedEvidence(response, question))
        throw new ApiError("No submitted evidence for this question", 400);
      transaction.update(ref, {
        [`transcripts.${question}`]: transcript,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    console.log(
      `Updated transcript for assessment ${assessmentId}, section ${section}, question ${question}`,
    );
    res.status(200).json({ data: { ok: true } });
  },
);
