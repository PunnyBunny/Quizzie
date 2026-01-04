import express, { Request, Response } from "express";
import {
  AssessmentInput,
  AssessmentSchema,
  AudioAnswerInput,
  MCAnswerInput,
  MCAnswerSchema,
  FinishAssessmentInput,
  FinishAssessmentSchema,
  GetAssessmentAnswersInput,
  GetAssessmentAnswersSchema,
  SubmitAudioGradeInput,
  SubmitAudioGradeSchema,
} from "./schemas";
import { validate } from "./middleware/validation";
import { db, FieldValue, admin } from "./firebase";

export const router = express.Router();

// Firebase wraps the actual payload with {"data": ...}
type FirebaseFunctionRequest<T> = Request<{}, {}, { data: T }>;
type FirebaseFunctionResponse<T> = Response<{ data: T }, { callerEmail: string }>;

// Helper functions

/**
 * Find existing answer doc ref for assessmentId and section
 * @param assessmentId
 * @param section
 */
const findAnswerDocRef = async (
  assessmentId: string,
  section: number,
): Promise<FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData> | null> => {
  const snap = await db
    .collection("answers")
    .where("assessment-id", "==", assessmentId)
    .where("section", "==", section)
    .limit(1)
    .get();
  if (!snap.empty) {
    return snap.docs[0].ref;
  }
  return null;
};

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

    const doc = {
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

    const ref = await db.collection("assessments").add(doc);

    console.info("Created assessment", ref.id);
    res.status(201).json({ data: { id: ref.id } });
  },
);

interface GetAssessmentsInput {
  finished: boolean;
}

interface Assessment {
  id: string;
  age: number;
  grade: string;
  name: string;
  school: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
  creatorEmail: string;
  createdAtIsoTimestamp: string;
}
interface GetAssessmentsOutput {
  assessments: Assessment[];
}

// TODO: this shouldn't really be a POST request, but Firebase Functions has limitations with GET requests
router.post(
  "/get-assessments",
  async (
    req: FirebaseFunctionRequest<GetAssessmentsInput>,
    res: FirebaseFunctionResponse<GetAssessmentsOutput>,
  ) => {
    console.log("in /get-assessments");
    const { finished } = req.body.data;
    const { callerEmail } = res.locals;
    const allAssessments = await db
      .collection("assessments")
      .where("creatorEmail", "==", callerEmail)
      .get();
    const unfinishedAssessments = allAssessments.docs
      .map((doc) => {
        const data = doc.data();
        const createdAt = data.createdAt as FirebaseFirestore.Timestamp;
        return {
          ...data,
          id: doc.id,
          createdAtIsoTimestamp: createdAt.toDate().toISOString() ?? "",
        } as Assessment;
      })
      .filter((assessment) => assessment.finished === finished);
    console.log("found assessments:", unfinishedAssessments);
    res.status(200).json({ data: { assessments: unfinishedAssessments } });
  },
);

// 2) Submit Multiple-Choice Answers
router.post(
  "/submit-mc-answer",
  validate(MCAnswerSchema),
  async (req: FirebaseFunctionRequest<MCAnswerInput>, res: Response) => {
    const { assessmentId, section, question, answer } = req.body.data;
    const now = FieldValue.serverTimestamp();

    // Upsert logic
    let ref = await findAnswerDocRef(assessmentId, section);
    ref ??= await db.collection("answers").add({
      "assessment-id": assessmentId,
      section,
      type: "mc",
      answers: {},
      createdAt: FieldValue.serverTimestamp(),
    });

    await ref.update({ [`answers.${question}`]: answer, updatedAt: now });

    // Update assessment counters
    const assessmentRef = db.collection("assessments").doc(assessmentId);
    await assessmentRef.update({
      currentSection: section,
      currentQuestion: question + 1,
      updatedAt: now,
    });

    res.status(200).json({ data: { ok: true } });
  },
);

// 3) Submit Audio Answer (multipart/form-data)
router.post(
  "/submit-audio-answer",
  async (req: FirebaseFunctionRequest<AudioAnswerInput>, res: Response) => {
    const { assessmentId, section, question, transcript, gsUri } = req.body.data;

    // Upsert Firestore doc for audio type
    let ref = await findAnswerDocRef(assessmentId, section);
    ref ??= await db.collection("answers").add({
      "assessment-id": assessmentId,
      section,
      type: "audio",
      files: {},
      transcripts: {},
      createdAt: FieldValue.serverTimestamp(),
    });

    const now = FieldValue.serverTimestamp();

    await ref.update({
      [`files.${question}`]: gsUri,
      [`transcripts.${question}`]: transcript,
      updatedAt: now,
    });

    // Update assessment counters
    const assessmentRef = db.collection("assessments").doc(assessmentId);
    await assessmentRef.update({
      currentSection: section,
      currentQuestion: question,
      updatedAt: now,
    });

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

    const assessmentRef = db.collection("assessments").doc(assessmentId);

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

// 6) Get Assessment Answers (for grading)
// TODO: type the database schema, and rename routes schema
interface MCStudentResponse {
  type: "mc";
  studentResponses: Record<string, number>;
}

interface AudioStudentResponse {
  type: "audio";
  files: Record<string, string>;
  transcripts: Record<string, string>;
  grades?: Record<string, number>;
}

interface GetAssessmentAnswersOutput {
  assessment: Assessment;
  studentResponsesBySection: Record<string, MCStudentResponse | AudioStudentResponse>;
}

router.post(
  "/get-assessment-answers",
  validate(GetAssessmentAnswersSchema),
  async (
    req: FirebaseFunctionRequest<GetAssessmentAnswersInput>,
    res: FirebaseFunctionResponse<GetAssessmentAnswersOutput>,
  ) => {
    const { assessmentId } = req.body.data;
    const { callerEmail } = res.locals;

    // Get the assessment
    const assessmentDoc = await db.collection("assessments").doc(assessmentId).get();
    if (!assessmentDoc.exists) {
      res.status(404).json();
      return;
    }

    const assessmentData = assessmentDoc.data()!;

    // Verify ownership
    if (assessmentData.creatorEmail !== callerEmail) {
      res.status(403).json();
      return;
    }

    const createdAt = assessmentData.createdAt as FirebaseFirestore.Timestamp;
    const assessment: Assessment = {
      ...assessmentData,
      id: assessmentDoc.id,
      createdAtIsoTimestamp: createdAt.toDate().toISOString() ?? "",
    } as Assessment;

    // Get all answers for this assessment
    const answersSnapshot = await db
      .collection("answers")
      .where("assessment-id", "==", assessmentId)
      .get();

    const answers: Record<string, MCStudentResponse | AudioStudentResponse> = {};

    const bucket = admin.storage().bucket();

    for (const doc of answersSnapshot.docs) {
      const data = doc.data();

      if (data.type === "mc") {
        answers[data.section as string] = {
          type: "mc",
          studentResponses: data.answers as Record<string, number>,
        };
      } else if (data.type === "audio") {
        // TODO: see what gsurl is happening. now all fail to sign the url
        // seems need to add perms to service account by creating a new one
        // see https://github.com/googleapis/nodejs-storage/issues/360

        // Convert gs:// URIs to signed URLs
        const signedUrls: Record<string, string> = {};
        for (const [question, gsUri] of Object.entries(data.files as Record<string, string>)) {
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

        answers[data.section as string] = {
          type: "audio",
          files: signedUrls,
          transcripts: data.transcripts as Record<string, string>,
          grades: data.grades as Record<string, number> | undefined,
        };
      }
    }

    res.status(200).json({
      data: {
        assessment,
        studentResponsesBySection: answers,
      },
    });
  },
);

// 7) Submit Audio Grade
router.post(
  "/submit-audio-grade",
  validate(SubmitAudioGradeSchema),
  async (
    req: FirebaseFunctionRequest<SubmitAudioGradeInput>,
    res: FirebaseFunctionResponse<{ ok: boolean }>,
  ) => {
    const { assessmentId, section, question, grade } = req.body.data;
    const { callerEmail } = res.locals;
    // TODO: deduplicate

    // Verify assessment ownership
    const assessmentDoc = await db.collection("assessments").doc(assessmentId).get();
    if (!assessmentDoc.exists) {
      res.status(404).json();
      return;
    }

    const assessmentData = assessmentDoc.data()!;
    if (assessmentData.creatorEmail !== callerEmail) {
      res.status(403).json();
      return;
    }

    // Find the answer doc for this section
    const ref = await findAnswerDocRef(assessmentId, section);
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
