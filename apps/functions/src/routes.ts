import express, { Request, Response } from "express";
import {
  AssessmentInput,
  AssessmentSchema,
  AudioStudentResponseInput,
  FinishAssessmentInput,
  FinishAssessmentSchema,
  GetAssessmentStudentResponsesInput,
  GetAssessmentStudentResponsesSchema,
  MCStudentResponseInput,
  MCStudentResponseSchema,
  SubmitAudioGradeInput,
  SubmitAudioGradeSchema,
} from "./schemas";
import { validate } from "./middleware/validation";
import { admin, FieldValue } from "./firebase";
import {
  type AssessmentDoc,
  type AssessmentResponse,
  assessmentsCollection,
  findStudentResponseRef,
  getAssessmentWithAuth,
  isAudioStudentResponse,
  isMCStudentResponse,
  type StudentResponseDoc,
  studentResponsesCollection,
  toAssessmentResponse,
  updateAssessmentProgress,
  upsertAudioStudentResponseRef,
  upsertMCStudentResponseRef,
} from "./database";
import { handleError } from "./utils/errors";

export const router = express.Router();

// Firebase wraps the actual payload with {"data": ...}
type FirebaseFunctionRequest<T> = Request<{}, {}, { data: T }>;
type FirebaseFunctionResponse<T> = Response<{ data: T }, { callerEmail: string }>;

// 1) Create Assessment
router.post(
  "/create-assessment",
  validate(AssessmentSchema),
  async (
    req: FirebaseFunctionRequest<AssessmentInput>,
    res: FirebaseFunctionResponse<{ id: string }>,
  ) => {
    const { age, grade, name, school } = req.body.data;
    const { callerEmail } = res.locals;

    const doc: AssessmentDoc = {
      age,
      grade,
      name,
      school,
      creatorEmail: callerEmail,
      currentSection: 0,
      currentQuestion: 0,
      finished: false,
      createdAt: FieldValue.serverTimestamp(),
    };

    const ref = await assessmentsCollection().add(doc);

    console.info("Created assessment", ref.id);
    res.status(201).json({ data: { id: ref.id } });
  },
);

interface GetAssessmentsInput {
  finished: boolean;
}

interface GetAssessmentsOutput {
  assessments: AssessmentResponse[];
}

// TODO: this shouldn't really be a POST request, but Firebase Functions has limitations with GET requests
router.post(
  "/get-assessments",
  async (
    req: FirebaseFunctionRequest<GetAssessmentsInput>,
    res: FirebaseFunctionResponse<GetAssessmentsOutput>,
  ) => {
    const { finished } = req.body.data;
    const { callerEmail } = res.locals;

    const allAssessments = await assessmentsCollection()
      .where("creatorEmail", "==", callerEmail)
      .get();

    const assessments = allAssessments.docs
      .map((doc) => toAssessmentResponse(doc))
      .filter(
        (assessment): assessment is AssessmentResponse =>
          assessment !== null && assessment.finished === finished,
      );

    console.log("found assessments:", assessments);
    res.status(200).json({ data: { assessments } });
  },
);

// 2) Submit Multiple-Choice Student Response
router.post(
  "/submit-mc-answer",
  validate(MCStudentResponseSchema),
  async (req: FirebaseFunctionRequest<MCStudentResponseInput>, res: Response) => {
    const { assessmentId, section, question, answer } = req.body.data;

    // Upsert student response document
    const ref = await upsertMCStudentResponseRef(assessmentId, section);
    await ref.update({
      [`studentResponses.${question}`]: answer,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update assessment progress
    await updateAssessmentProgress(assessmentId, section, question + 1);

    res.status(200).json({ data: { ok: true } });
  },
);

// 3) Submit Audio Student Response
router.post(
  "/submit-audio-answer",
  async (req: FirebaseFunctionRequest<AudioStudentResponseInput>, res: Response) => {
    const { assessmentId, section, question, transcript, gsUri } = req.body.data;

    // Upsert audio student response document
    const ref = await upsertAudioStudentResponseRef(assessmentId, section);

    await ref.update({
      [`files.${question}`]: gsUri,
      [`transcripts.${question}`]: transcript,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Update assessment progress
    await updateAssessmentProgress(assessmentId, section, question);

    res.status(200).json({ data: { ok: true } });
  },
);

// 4) Mark Assessment as Finished
router.post(
  "/finish-assessment",
  validate(FinishAssessmentSchema),
  async (req: FirebaseFunctionRequest<FinishAssessmentInput>, res: Response) => {
    const { assessmentId } = req.body.data;
    const now = FieldValue.serverTimestamp();

    const assessmentRef = assessmentsCollection().doc(assessmentId);

    // Check if assessment exists
    const assessmentDoc = await assessmentRef.get();
    if (!assessmentDoc.exists) {
      res.status(404).json({ error: "Assessment not found" });
      return;
    }

    // Mark assessment as finished
    await assessmentRef.update({
      finished: true,
      finishedAt: now,
      updatedAt: now,
    });

    res.status(200).json({ data: { ok: true } });
  },
);

// 5) Get Assessment Student Responses (for grading)
interface GetAssessmentStudentResponsesOutput {
  assessment: AssessmentResponse;
  studentResponsesBySection: Record<string, StudentResponseDoc>;
}

router.post(
  "/get-assessment-student-responses",
  validate(GetAssessmentStudentResponsesSchema),
  async (
    req: FirebaseFunctionRequest<GetAssessmentStudentResponsesInput>,
    res: FirebaseFunctionResponse<GetAssessmentStudentResponsesOutput>,
  ) => {
    const { assessmentId } = req.body.data;
    const { callerEmail } = res.locals;

    // Get the assessment with auth check
    let assessmentDoc;
    try {
      assessmentDoc = await getAssessmentWithAuth(assessmentId, callerEmail);
    } catch (error) {
      handleError(error, res);
      return;
    }

    const assessment = toAssessmentResponse(assessmentDoc);
    if (!assessment) {
      res.status(404).json();
      return;
    }

    // Get all student responses for this assessment
    const studentResponsesSnapshot = await studentResponsesCollection()
      .where("assessment-id", "==", assessmentId)
      .get();

    const studentResponses: Record<string, StudentResponseDoc> = {};

    const bucket = admin.storage().bucket();

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
        // TODO: see what gsurl is happening. now all fail to sign the url
        // seems need to add perms to service account by creating a new one
        // see https://github.com/googleapis/nodejs-storage/issues/360

        // Convert gs:// URIs to signed URLs
        const signedUrls: Record<string, string> = {};
        for (const [question, gsUri] of Object.entries(data.files)) {
          signedUrls[question] = "";
          try {
            // Parse gs://bucket/path format
            const pathMatch = /^gs:\/\/[^/]+\/(.+)$/.exec(gsUri);
            if (pathMatch) {
              const filePath = pathMatch[1];
              const file = bucket.file(filePath);
              const [signedUrl] = await file.getSignedUrl({
                action: "read",
                expires: Date.now() + 60 * 1000, // 1 minute
              });
              signedUrls[question] = signedUrl;
            }
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

// 6) Submit Audio Grade
router.post(
  "/submit-audio-grade",
  validate(SubmitAudioGradeSchema),
  async (
    req: FirebaseFunctionRequest<SubmitAudioGradeInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const { assessmentId, section, question, grade } = req.body.data;
    const { callerEmail } = res.locals;

    // Verify assessment ownership
    try {
      await getAssessmentWithAuth(assessmentId, callerEmail);
    } catch (error) {
      handleError(error, res);
      return;
    }

    // Find the student response doc for this section
    const ref = await findStudentResponseRef(assessmentId, section);
    if (!ref) {
      res.status(404).json();
      return;
    }

    const now = FieldValue.serverTimestamp();

    // Update the grade
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

interface AdminGetAssessmentsOutput {
  assessments: AssessmentResponse[];
}

router.post(
  "/admin/get-assessments",
  async (
    _req: FirebaseFunctionRequest<{}>,
    res: FirebaseFunctionResponse<AdminGetAssessmentsOutput>,
  ) => {
    const allAssessments = await assessmentsCollection().get();

    const assessments = allAssessments.docs.reduce((acc, doc) => {
      const assessment = toAssessmentResponse(doc);
      if (assessment) {
        acc.push(assessment);
      }
      return acc;
    }, [] as AssessmentResponse[]);

    res.status(200).json({ data: { assessments } });
  },
);

interface UserRecord {
  email?: string;
  isAdmin: boolean;
}

interface AdminGetUsersOutput {
  users: UserRecord[];
}

router.post(
  "/admin/get-users",
  async (_req: FirebaseFunctionRequest<{}>, res: FirebaseFunctionResponse<AdminGetUsersOutput>) => {
    try {
      const listUsersResult = await admin.auth().listUsers();

      const users: UserRecord[] = listUsersResult.users.map((userRecord) => ({
        email: userRecord.email,
        isAdmin: (userRecord.customClaims?.isAdmin as boolean) ?? false,
      }));

      console.log(`Retrieved ${users.length} users`);
      res.status(200).json({ data: { users } });
    } catch (error) {
      console.error("Error fetching users:", error);
      handleError(error, res);
    }
  },
);

interface AdminCreateUserInput {
  email: string;
}

interface AdminCreateUserOutput {
  uid: string;
  email: string;
  resetLink: string;
}

router.post(
  "/admin/create-user",
  async (
    req: FirebaseFunctionRequest<AdminCreateUserInput>,
    res: FirebaseFunctionResponse<AdminCreateUserOutput>,
  ) => {
    try {
      const { email } = req.body.data;

      // Create user with temporary password
      const userRecord = await admin.auth().createUser({
        email,
        password: Math.random().toString(36).slice(-12), // Random temporary password
        emailVerified: false,
      });

      // Set custom claims - always create as regular user (not admin)
      await admin.auth().setCustomUserClaims(userRecord.uid, { isAdmin: false });

      // Generate password reset link
      const resetLink = await admin.auth().generatePasswordResetLink(email);

      console.log(`Created user ${userRecord.uid} with email ${email}`);
      res.status(201).json({
        data: {
          uid: userRecord.uid,
          email: userRecord.email ?? email,
          resetLink,
        },
      });
    } catch (error) {
      console.error("Error creating user:", error);
      handleError(error, res);
    }
  },
);

interface AdminResetPasswordInput {
  email: string;
}

interface AdminResetPasswordOutput {
  email: string;
  resetLink: string;
}

router.post(
  "/admin/reset-password",
  async (
    req: FirebaseFunctionRequest<AdminResetPasswordInput>,
    res: FirebaseFunctionResponse<AdminResetPasswordOutput>,
  ) => {
    try {
      const { email } = req.body.data;

      // Generate password reset link
      const resetLink = await admin.auth().generatePasswordResetLink(email);

      console.log(`Generated password reset link for ${email}`);
      res.status(200).json({
        data: {
          email,
          resetLink,
        },
      });
    } catch (error) {
      console.error("Error generating password reset link:", error);
      handleError(error, res);
    }
  },
);

interface AdminRemoveUserInput {
  email: string;
}

interface AdminRemoveUserOutput {
  email: string;
}

router.post(
  "/admin/remove-user",
  async (
    req: FirebaseFunctionRequest<AdminRemoveUserInput>,
    res: FirebaseFunctionResponse<AdminRemoveUserOutput>,
  ) => {
    try {
      const { email } = req.body.data;

      // Get user by email
      const userRecord = await admin.auth().getUserByEmail(email);

      // Delete the user
      await admin.auth().deleteUser(userRecord.uid);

      console.log(`Deleted user ${userRecord.uid} with email ${email}`);
      res.status(200).json({
        data: {
          email,
        },
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      handleError(error, res);
    }
  },
);
