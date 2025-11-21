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
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";

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
  answer: number;
}

export default function AssessmentQuestion() {
  const {
    id = "",
    section: sectionIndexStr = "",
    question: questionIndexStr = "",
  } = useParams<{ id: string; section: string; question: string }>();

  const sectionIndex = parseInt(sectionIndexStr, 10);
  if (isNaN(sectionIndex)) {
    throw new Error("Invalid section index");
  }

  const questionIndex = parseInt(questionIndexStr, 10);
  if (isNaN(questionIndex)) {
    throw new Error("Invalid question index");
  }

  const { section, totalSections } = useSection(sectionIndex);

  const question = useQuestion(sectionIndex, questionIndex);

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
  const { startRecording, stopRecording, cleanup } = useRecordingControls();

  // Clean up recording session when component unmounts
  useEffect(() => {
    return cleanup;
  }, []);

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
  }, [sectionIndex, questionIndex]);

  const [submitting, setSubmitting] = useState(false);

  const isLastQuestion = questionIndex === totalQuestions - 1;
  const isLastQuestionInAssessment = sectionIndex === totalSections - 1 && isLastQuestion;

  const navigate = useNavigate();

  const [submitMcAnswerFunc] = useHttpsCallable<SubmitMcAnswerRequest>(
    functions,
    "api/submit-mc-answer",
  );
  interface SubmitAudioAnswerRequest {
    assessmentId: string;
    section: number;
    question: number;
    transcript: string;
  }
  const [submitAudioAnswerFunc] = useHttpsCallable<SubmitAudioAnswerRequest>(
    functions,
    "api/submit-audio-answer",
  );

  const onSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      setSubmitting(true);

      // TODO: print score
      if (question.kind === "mc") {
        if (selectedIndex == null) {
          alert("Please select an answer.");
          return;
        }

        await submitMcAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          answer: selectedIndex,
        });

        console.log("Answer saved: " + selectedIndex);
      } else if (question.kind === "audio") {
        console.log("here");
        // TODO: test submitting audio answer
        if (audioBlob == null) {
          alert("Please record your answer.");
          return;
        }

        await submitAudioAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          transcript: transcript ?? "",
        });

        console.log("Audio answer saved:", audioBlob);
      }

      if (isLastQuestionInAssessment) {
        navigate("/thank-you");
      } else if (isLastQuestion) {
        navigate(`/assessment/${id}/s/${sectionIndex + 1}/instruction`);
      } else {
        navigate(`/assessment/${id}/s/${sectionIndex}/q/${questionIndex + 1}`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const title = section?.title ?? "Section";
  const questionText = question.question ?? "";

  return (
    <div className="flex flex-col items-center bg-gray-50">
      {/* Header */}
      <header className="w-full flex flex-col gap-6 p-6 bg-white shadow">
        <div className="w-full flex justify-between mx-auto">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Assessment ID {id} • Section {sectionIndex + 1} • Question {questionIndex + 1}
            </p>
          </div>
          <div className="flex flex-col items-end self-end">
            <div className="text-md text-gray-600">
              Question {questionIndex + 1} of {section.questions.length}
            </div>
            <div className="text-sm text-gray-500">{progressPercentage}% complete</div>
          </div>
        </div>

        {/* Progress bar */}
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
      </header>

      <main className="w-full max-w-3xl flex flex-col p-6">
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          <section className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Image and audio, TODO: add heading to indicate this is question */}
            <section className="flex flex-col gap-4">
              {question.image != null && (
                <img
                  src={`/src/assets/images/${question.image}`}
                  alt={questionText ? questionText : "Question image"}
                  className="w-full max-h-72 object-contain"
                />
              )}
              {question.audio != null && (
                <audio controls src={`/src/assets/audios/${question!.audio}`} className="w-full">
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

                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-md">
                    {error}
                  </div>
                )}

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
                  /* placeholder */
                }}
              >
                Save & Exit
              </button>

              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50"
                disabled={
                  (question.kind === "mc" && selectedIndex == null) ||
                  (question.kind === "audio" && audioBlob == null) ||
                  submitting
                }
              >
                {!submitting ? "Next" : "Loading..."}
              </button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
