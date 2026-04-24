import { useNavigate, useParams } from "react-router-dom";
import { useQuestion, useSection } from "../providers/QuestionProvider.tsx";
import React, { useEffect, useState } from "react";
import {
  useAudioRecording,
  useRecordingControls,
  useRecordingState,
  useTranscriptText,
} from "../providers/RecordingSessionProvider.tsx";
import H5AudioPlayer, { RHAP_UI } from "react-h5-audio-player";
import "react-h5-audio-player/lib/styles.css";
import { useCallable } from "../lib/firebase-hooks.ts";
import { storage } from "../lib/firebase.ts";
import { ref as storageRef, uploadBytes } from "firebase/storage";
import mime from "mime";
import { toUserMessage } from "../lib/errors.ts";
import { Alert } from "../components/Alert";
import { AssessmentHeader } from "../components/AssessmentHeader";
import { Modal } from "../components/Modal";
import { SectionInstructionBody } from "../components/SectionInstructionBody";
import { useStorageUrl } from "../hooks/useStorageUrl.ts";
import { audioStoragePath, imageStoragePath } from "../lib/asset-paths.ts";

function MicrophoneIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z"
      />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5.25 7.5A2.25 2.25 0 0 1 7.5 5.25h9a2.25 2.25 0 0 1 2.25 2.25v9a2.25 2.25 0 0 1-2.25 2.25h-9a2.25 2.25 0 0 1-2.25-2.25v-9Z"
      />
    </svg>
  );
}

interface SubmitMcAnswerRequest {
  assessmentId: string;
  section: number;
  question: number;
  answer: number | null;
}

interface SubmitAudioAnswerRequest {
  assessmentId: string;
  section: number;
  question: number;
  transcript: string | null;
  gsUri: string | null;
}

interface FinishAssessmentRequest {
  assessmentId: string;
}

export function AssessmentQuestion() {
  const {
    id = "",
    section: sectionIndexStr = "",
    question: questionIndexStr = "",
  } = useParams<{ id: string; section: string; question: string }>();

  const sectionIndex = parseInt(sectionIndexStr, 10);
  if (isNaN(sectionIndex)) {
    throw new Error("Invalid section index");
  }

  const { section, totalSections } = useSection(sectionIndex);

  if (!section) {
    throw new Error(`Section ${sectionIndex} not found in assessment ${id}.`);
  }

  const questionIndex = parseInt(questionIndexStr, 10);
  if (isNaN(questionIndex)) {
    throw new Error("Invalid question index");
  }

  const question = useQuestion(sectionIndex, questionIndex);

  if (!question) {
    throw new Error(
      `Question ${questionIndex} not found in section ${sectionIndex} of assessment ${id}.`,
    );
  }

  const questionImage = useStorageUrl(question.image ? imageStoragePath(question.image) : null);
  const questionAudio = useStorageUrl(question.audio ? audioStoragePath(question.audio) : null);

  const totalQuestions = section?.questions?.length ?? 0;
  const progressPercentage =
    totalQuestions > 0
      ? Math.min(100, Math.max(0, Math.round(((questionIndex + 1) / totalQuestions) * 100)))
      : 0;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Recording session hooks
  const { status, error } = useRecordingState();
  const { transcript, interimTranscript } = useTranscriptText();
  const { audioBlob, audioBlobUrl } = useAudioRecording();
  const { startRecording, stopRecording, resetAudio } = useRecordingControls();

  // Clean up recording session when component unmounts
  useEffect(() => {
    return resetAudio;
  }, [resetAudio]);

  const handleStartRecording = async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  // Reset selected answer and recording state when question changes (since component doesn't unmount)
  useEffect(() => {
    setSelectedIndex(null);
    resetAudio();
  }, [sectionIndex, questionIndex, resetAudio]);

  const isLastQuestion = questionIndex === totalQuestions - 1;
  const isLastQuestionInAssessment = sectionIndex === totalSections - 1 && isLastQuestion;

  const navigate = useNavigate();

  const [submitMcAnswerFunc, submittingMcAnswer] = useCallable<SubmitMcAnswerRequest>(
    "api/submit-mc-answer",
  );

  const [submitAudioAnswerFunc, submittingAudioAnswer] = useCallable<SubmitAudioAnswerRequest>(
    "api/submit-audio-answer",
  );

  const [finishAssessmentFunc, finishingAssessment] = useCallable<FinishAssessmentRequest>(
    "api/finish-assessment",
  );

  const [uploading, setUploading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  const busy =
    submittingMcAnswer || submittingAudioAnswer || uploading || finishingAssessment;

  const navigateToNext = () => {
    if (isLastQuestionInAssessment) {
      navigate(`/thank-you/${id}`);
    } else if (isLastQuestion) {
      navigate(`/assessment/${id}/s/${sectionIndex + 1}/instruction`);
    } else {
      navigate(`/assessment/${id}/s/${sectionIndex}/q/${questionIndex + 1}`);
    }
  };

  const handleSkip = async () => {
    if (!window.confirm("Are you sure you want to skip this question? You can't go back.")) {
      return;
    }

    setSubmitError(null);
    try {
      if (question.kind === "mc") {
        await submitMcAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          answer: null,
        });
      } else if (question.kind === "audio") {
        await submitAudioAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          transcript: null,
          gsUri: null,
        });
      }

      if (isLastQuestionInAssessment) {
        await finishAssessmentFunc({ assessmentId: id });
      }

      navigateToNext();
    } catch (err) {
      console.error("Failed to skip question:", err);
      setSubmitError(toUserMessage(err, "Could not skip this question."));
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (question.kind === "mc" && selectedIndex == null) {
      alert("Please select an answer.");
      return;
    }

    if (question.kind === "audio" && audioBlob == null) {
      alert("Please record your answer.");
      return;
    }

    setSubmitError(null);
    try {
      if (question.kind === "mc") {
        await submitMcAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          answer: selectedIndex,
        });
      } else if (question.kind === "audio" && audioBlob != null) {
        const path = `assessments/${id}/${sectionIndex}/${questionIndex}.${mime.getExtension(audioBlob.type)}`;
        const fileRef = storageRef(storage, path);
        setUploading(true);
        let uploadResult;
        try {
          uploadResult = await uploadBytes(fileRef, audioBlob, {
            contentType: audioBlob.type,
          });
        } finally {
          setUploading(false);
        }

        await submitAudioAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          transcript: transcript ?? "",
          gsUri: `gs://${uploadResult.metadata.bucket}/${uploadResult.metadata.fullPath}`,
        });
      }

      if (isLastQuestionInAssessment) {
        await finishAssessmentFunc({ assessmentId: id });
      }

      navigateToNext();
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setSubmitError(toUserMessage(err, "Could not submit your answer."));
    }
  };

  const title = section?.title ?? "Section";
  const questionText = question.question ?? "";

  return (
    <div className="flex flex-col items-center bg-gray-50">
      <AssessmentHeader
        title={title}
        assessmentId={id}
        sectionIndex={sectionIndex}
        questionIndex={questionIndex}
        right={
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            >
              View Instructions
            </button>
            <div className="flex flex-col items-end self-end">
              <div className="text-md text-gray-600">
                Question {questionIndex + 1} of {section.questions.length}
              </div>
              <div className="text-sm text-gray-500">{progressPercentage}% complete</div>
            </div>
          </div>
        }
        below={
          <div className="w-full">
            <div className="mx-auto w-full">
              <div className="h-2 rounded bg-gray-300 overflow-hidden">
                <div
                  className="h-2 bg-blue-600 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                  role="progressbar"
                />
              </div>
            </div>
          </div>
        }
      />

      <main className="w-full max-w-3xl flex flex-col p-6">
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          {submitError && <Alert kind="error">{submitError}</Alert>}
          <section className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Image and audio, TODO: add heading to indicate this is question */}
            <section className="flex flex-col gap-4">
              {question.image != null && questionImage.url && (
                <img
                  src={questionImage.url}
                  alt={questionText ? questionText : "Question image"}
                  className="w-full max-h-72 object-contain"
                />
              )}
              {question.audio != null && questionAudio.url && (
                <audio controls src={questionAudio.url} className="w-full">
                  Your browser does not support the audio element.
                </audio>
              )}
            </section>

            {/* Question text */}
            {questionText && (
              <section className="self-center">
                <h1 className="text-3xl font-semibold text-gray-800 whitespace-pre-wrap">
                  {questionText}
                </h1>
              </section>
            )}
          </section>

          {/* Choices */}
          {question.kind == "mc" && (
            <section>
              <div className="flex flex-col gap-3">
                {(question.choices ?? []).map((choice, idx) => (
                  <label
                    key={idx}
                    className="flex items-center gap-3 p-3 bg-white rounded-md border-2 hover:border-blue-400 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="choice"
                      checked={selectedIndex === idx}
                      onChange={() => setSelectedIndex(idx)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span>
                      {String.fromCharCode(65 + idx)}. {choice}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Audio recording */}
          {question.kind == "audio" && (
            <section className="flex flex-col gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex gap-3 self-center">
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={status === "recording"}
                    className="px-4 py-2 rounded-md text-white shadow flex items-center justify-center gap-2 bg-gray-600 disabled:opacity-50"
                  >
                    <MicrophoneIcon />
                    Start Recording
                  </button>

                  <button
                    type="button"
                    onClick={handleStopRecording}
                    disabled={status !== "recording"}
                    className="px-4 py-2 rounded-md text-white shadow flex items-center justify-center gap-2 bg-red-600 disabled:opacity-50"
                  >
                    <StopIcon />
                    Stop Recording
                  </button>
                </div>

                {error && <Alert kind="error">{error}</Alert>}

                {/* Live transcription display */}
                <div className="mt-2">
                  <h3 className="font-medium text-gray-700 mb-2">Transcription:</h3>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md min-h-[100px] max-h-[200px] overflow-y-auto">
                    {transcript && <p className="text-gray-800">{transcript}</p>}
                    {interimTranscript && (
                      <p className="text-gray-500 italic">{interimTranscript}</p>
                    )}
                    {!transcript && !interimTranscript && (
                      <p className="text-gray-400">
                        {status === "recording"
                          ? "Listening... Start speaking to see transcription."
                          : "Recording will appear here..."}
                      </p>
                    )}
                  </div>
                </div>

                {/* Display audio playback if available */}
                {audioBlob && (
                  <div className="mt-2">
                    <h3 className="font-medium text-gray-700 mb-2">Your Recording:</h3>
                    <H5AudioPlayer
                      src={audioBlobUrl}
                      showSkipControls
                      customProgressBarSection={[]}
                      customControlsSection={[<div />, RHAP_UI.MAIN_CONTROLS, <div />]}
                    />
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Bottom actions */}
          <section className="w-full max-w-2xl py-6 flex items-center justify-between">
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  if (
                    window.confirm("Are you sure you want to exit? Your progress will be saved.")
                  ) {
                    navigate("/");
                  }
                }}
              >
                Save & Exit
              </button>

              <div className="flex gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  onClick={handleSkip}
                  disabled={busy}
                >
                  Skip
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50"
                  disabled={
                    (question.kind === "mc" && selectedIndex == null) ||
                    (question.kind === "audio" && audioBlob == null) ||
                    busy
                  }
                >
                  {busy ? "Loading..." : "Next"}
                </button>
              </div>
            </div>
          </section>
        </form>
      </main>

      {showInstructions && (
        <Modal onClose={() => setShowInstructions(false)}>
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="text-2xl font-bold text-gray-900">Section Instructions</h2>
            <SectionInstructionBody instruction={section.instruction} />
          </div>
        </Modal>
      )}
    </div>
  );
}
