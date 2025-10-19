import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import express, { Request } from "express";
import multer from "multer";

admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
app.use(express.json());

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only audio files are allowed"));
    }
  },
});

interface CreateAssessmentRequest {
  age: number;
  grade: string;
  name: string;
  school: string;
}

app.post("/create-assessment", async (req: Request<{}, {}, CreateAssessmentRequest>, res) => {
  try {
    const { age, grade, name, school } = req.body;

    const assessmentRef = db.collection("assessments").doc();

    await assessmentRef.set({
      age,
      grade: grade.trim(),
      name: name.trim(),
      school: school.trim(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Return success response with the generated ID
    res.status(200).json({
      success: true,
      message: "Assessment created successfully",
      id: assessmentRef.id,
    });
  } catch (error) {
    console.error("Error creating assessment:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to create assessment",
    });
  }
});

interface SubmitMcAnswerRequest {
  assessmentId: string;
  sectionIndex: number;
  questionIndex: number;
  selectedIndex: number;
}

app.post("/submit-mc-answer", async (req: Request<{}, {}, SubmitMcAnswerRequest>, res) => {
  try {
    const { assessmentId, sectionIndex, questionIndex, selectedIndex } = req.body;

    const answersQuery = db
      .collection("answers")
      .where("assessment-id", "==", assessmentId)
      .where("section", "==", sectionIndex)
      .limit(1);

    const querySnapshot = await answersQuery.get();

    let docRef: admin.firestore.DocumentReference;
    if (!querySnapshot.empty) {
      docRef = querySnapshot.docs[0].ref;
    } else {
      docRef = db.collection("answers").doc();
      await docRef.set({
        answers: {},
        "assessment-id": assessmentId,
        section: sectionIndex,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "mc",
      });
    }
    await docRef.update({
      [`answers.${questionIndex}`]: selectedIndex,
    });

    res.status(200).json({
      success: true,
      message: "MC answer submitted successfully",
      assessmentId: assessmentId,
    });
  } catch (error) {
    console.error("Error submitting MC answer:", error);
    res.status(500).json({
      error: "Internal server error",
      message: "Failed to submit MC answer",
    });
  }
});

interface SubmitAudioAnswerRequest {
  assessmentId: string;
  sectionIndex: number;
  questionIndex: number;
  transcript: string;
}

app.post(
  "/submit-audio-answer",
  upload.single("audio"),
  async (req: Request<{}, {}, SubmitAudioAnswerRequest>, res) => {
    try {
      const { assessmentId, sectionIndex, questionIndex, transcript } = req.body;
      const audioFile = req.file;

      if (!audioFile) {
        res.status(400).json({
          error: "No audio file provided",
        });
        return;
      }

      const fileExtension = audioFile.originalname.split(".").pop() || "mp3";
      const storagePath = `${assessmentId}/${sectionIndex}/${questionIndex}.${fileExtension}`;

      // Upload file to Firebase Storage
      const file = bucket.file(storagePath);
      const stream = file.createWriteStream({
        metadata: {
          contentType: audioFile.mimetype,
          metadata: {
            assessmentId: assessmentId,
            sectionIndex: sectionIndex.toString(),
            questionIndex: questionIndex.toString(),
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      await new Promise<void>((resolve, reject) => {
        stream.on("error", reject);
        stream.on("finish", resolve);
        stream.end(audioFile.buffer);
      });

      const gsLink = `gs://your-bucket-name/${storagePath}`;

      // Check if answers document exists for this section
      const answersQuery = db
        .collection("answers")
        .where("assessment-id", "==", assessmentId)
        .where("section", "==", sectionIndex)
        .limit(1);

      const querySnapshot = await answersQuery.get();

      let docRef: admin.firestore.DocumentReference;
      if (!querySnapshot.empty) {
        docRef = querySnapshot.docs[0].ref;
      } else {
        docRef = db.collection("answers").doc();
        await docRef.set({
          "assessment-id": assessmentId,
          section: sectionIndex,
          type: "audio",
          audioAnswers: {},
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await docRef.update({
        [`audioAnswers.${questionIndex}`]: {
          audioUrl: gsLink,
          transcript: transcript,
        },
      });

      res.status(200).json({
        success: true,
        message: "Audio answer submitted successfully",
        assessmentId: assessmentId,
      });
    } catch (error) {
      console.error("Error submitting audio answer:", error);
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to submit audio answer",
      });
    }
  },
);

export const api = functions.https.onRequest({ cors: true }, app);
