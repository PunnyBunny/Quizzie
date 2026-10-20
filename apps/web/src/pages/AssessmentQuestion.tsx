import { useNavigate, useParams } from "react-router-dom";
import { useQuestion, useSection } from "../providers/QuestionProvider.tsx";
import React, { useLayoutEffect, useRef, useState } from "react";
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
import { useTranslation } from "../hooks/useTranslation";

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

// TODO: document this
export function AssessmentQuestion() {
  // A unique key is given to the inner component so that its state is cleared
  // every time we switch to a new question.
  const { id, section, question } = useParams();
  return <AssessmentQuestionInner key={`${id}-${section}-${question}`} />;
}

function AssessmentQuestionInner() {
  const { t } = useTranslation();
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

  const [assistanceOffered, setAssistanceOffered] = useState(false);
  const choicesAudio = useStorageUrl(
    question.choicesAudio ? audioStoragePath(question.choicesAudio) : null,
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Recording session hooks
  const { status, error } = useRecordingState();
  const { transcript, interimTranscript } = useTranscriptText();
  const { audioBlob, audioBlobUrl } = useAudioRecording();
  const { startRecording, stopRecording, resetAudio } = useRecordingControls();

  // Reset before paint, so a new route never exposes the previous question's blob.
  useLayoutEffect(() => {
    resetAudio();
    return resetAudio;
  }, [resetAudio]);

  const handleStartRecording = async () => {
    try {
      document.querySelectorAll("audio").forEach((player) => player.pause());
      await startRecording();
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const handleStopRecording = () => {
    stopRecording();
  };

  const isLastQuestion = questionIndex === totalQuestions - 1;
  const isLastQuestionInAssessment = sectionIndex === totalSections - 1 && isLastQuestion;

  const navigate = useNavigate();

  const [submitMcAnswerFunc] = useCallable<SubmitMcAnswerRequest>("api/submit-mc-answer");

  const [submitAudioAnswerFunc] = useCallable<SubmitAudioAnswerRequest>("api/submit-audio-answer");

  const [finishAssessmentFunc] = useCallable<FinishAssessmentRequest>("api/finish-assessment");

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  // TODO: fix this type
  const [submitHybrid] = useCallable<
    import("../../../functions/src/types/zod/routes/submissions").HybridStudentResponseInput
  >("api/submit-audio-mc-answer");
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true); // Prevents further navigation if we left the page
  const uploaded = useRef<{ blob: Blob; uri: string } | null>(null);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const uploadRecordingIfNotAlready = async (): Promise<string | null> => {
    if (!audioBlob) return null;
    if (uploaded.current?.blob === audioBlob) return uploaded.current.uri;
    const extension = mime.getExtension(audioBlob.type) ?? "webm";
    const result = await uploadBytes(
      storageRef(
        storage,
        `assessments/${id}/${sectionIndex}/${questionIndex}.${crypto.randomUUID()}.${extension}`,
      ),
      audioBlob,
      { contentType: audioBlob.type },
    );
    const uri = `gs://${result.metadata.bucket}/${result.metadata.fullPath}`;
    uploaded.current = { blob: audioBlob, uri };
    return uri;
  };
  const recordingBusy = status === "starting" || status === "recording" || status === "finalizing";
  const busy = saving || recordingBusy;

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
    if (busy) return;
    if (!window.confirm(t("question.confirmSkip"))) {
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      if (question.kind === "audio_mc") {
        const gsUri = await uploadRecordingIfNotAlready();
        await submitHybrid({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          gsUri,
          transcript: audioBlob ? transcript : null,
          assistanceOffered,
          selectedOption: null,
          skipped: true,
        });
      } else if (question.kind === "mc") {
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

      if (mounted.current) navigateToNext();
    } catch (err) {
      console.error("Failed to skip question:", err);
      setSubmitError(toUserMessage(err, t("question.errorSkip")));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (
      question.kind === "audio_mc" &&
      (assistanceOffered ? selectedIndex === null : audioBlob === null)
    )
      return;

    if (question.kind === "mc" && selectedIndex == null) {
      alert(t("question.alertSelect"));
      return;
    }

    if (question.kind === "audio" && audioBlob == null) {
      alert(t("question.alertRecord"));
      return;
    }

    setSaving(true);
    setSubmitError(null);
    try {
      if (question.kind === "audio_mc") {
        const gsUri = await uploadRecordingIfNotAlready();
        await submitHybrid({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          gsUri,
          transcript: audioBlob ? transcript : null,
          assistanceOffered,
          selectedOption: selectedIndex === null ? null : question.choiceKeys[selectedIndex],
          skipped: false,
        });
      } else if (question.kind === "mc") {
        await submitMcAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          answer: selectedIndex,
        });
      } else if (question.kind === "audio" && audioBlob != null) {
        const gsUri = await uploadRecordingIfNotAlready();
        await submitAudioAnswerFunc({
          assessmentId: id,
          section: sectionIndex,
          question: questionIndex,
          transcript,
          gsUri,
        });
      }

      if (isLastQuestionInAssessment) {
        await finishAssessmentFunc({ assessmentId: id });
      }

      if (mounted.current) navigateToNext();
    } catch (err) {
      console.error("Failed to submit answer:", err);
      setSubmitError(toUserMessage(err, t("question.errorSubmit")));
    } finally {
      setSaving(false);
    }
  };

  const title = section?.title ?? t("instruction.section");
  const questionText = question.question ?? "";

  return (
    <div
      className="flex flex-col items-center bg-gray-50 min-h-screen"
      onPlayCapture={(event) => {
        const player = event.target;
        if (!(player instanceof HTMLAudioElement)) return;
        if (recordingBusy) player.pause();
        else
          document.querySelectorAll("audio").forEach((other) => {
            if (other !== player) other.pause();
          });
      }}
    >
      <AssessmentHeader
        title={title}
        assessmentId={id}
        sectionIndex={sectionIndex}
        questionIndex={questionIndex}
        right={
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="px-3 sm:px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm sm:text-base whitespace-nowrap self-start sm:self-auto"
            >
              {t("question.viewInstructions")}
            </button>
            <div className="flex flex-col sm:items-end">
              <div className="text-sm sm:text-md text-gray-600">
                {t("question.questionXofY", {
                  current: questionIndex + 1,
                  total: section.questions.length,
                })}
              </div>
              <div className="text-xs sm:text-sm text-gray-500">
                {t("question.percentComplete", { percent: progressPercentage })}
              </div>
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

      <main className="w-full max-w-3xl flex flex-col p-4 sm:p-6">
        <form className="flex flex-col gap-6" onSubmit={onSubmit}>
          {submitError && <Alert kind="error">{submitError}</Alert>}
          <section className="p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Image and audio, TODO: add heading to indicate this is question */}
            <section className="flex flex-col gap-4">
              {question.image != null && questionImage.url && (
                <img
                  src={questionImage.url}
                  alt={questionText ? questionText : t("question.questionImageAlt")}
                  className="w-full max-h-72 object-contain"
                />
              )}
              {question.audio != null && questionAudio.url && (
                <audio controls src={questionAudio.url} className="w-full">
                  {t("question.audioFallback")}
                </audio>
              )}
            </section>

            {/* Question text */}
            {questionText && (
              <section className="self-center w-full">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-800 whitespace-pre-wrap break-words">
                  {questionText}
                </h1>
              </section>
            )}
          </section>

          {/* Choices */}
          {question.kind === "audio_mc" && (
            <section className="space-y-3">
              <button
                type="button"
                disabled={busy || assistanceOffered}
                onClick={() => setAssistanceOffered(true)}
                className="px-4 py-2 border rounded disabled:opacity-50"
              >
                {t("question.offerMc")}
              </button>
              {assistanceOffered && (
                <>
                  <p>{t("question.mcOffered")}</p>
                  {choicesAudio.error && (
                    <Alert kind="error">{t("question.choicesAudioError")}</Alert>
                  )}
                  {choicesAudio.loading && <p>{t("common.loading")}</p>}
                  {choicesAudio.url && <audio controls src={choicesAudio.url} className="w-full" />}
                </>
              )}
            </section>
          )}
          {(question.kind === "mc" || (question.kind === "audio_mc" && assistanceOffered)) && (
            <section>
              <div className="flex flex-col gap-3">
                {(question.choices ?? []).map((choice, idx) => (
                  <label
                    key={question.choiceKeys[idx]}
                    className="flex items-center gap-3 p-3 bg-white rounded-md border-2 hover:border-blue-400 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="choice"
                      disabled={busy}
                      checked={selectedIndex === idx}
                      onChange={() => setSelectedIndex(idx)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span>
                      {question.kind === "audio_mc"
                        ? question.choiceKeys[idx]
                        : String.fromCharCode(65 + idx)}
                      . {choice}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}

          {/* Audio recording */}
          {question.kind !== "mc" && (
            <section className="flex flex-col gap-4 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row gap-3 sm:self-center">
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    disabled={busy || assistanceOffered}
                    className="px-4 py-2 rounded-md text-white shadow flex items-center justify-center gap-2 bg-gray-600 disabled:opacity-50"
                  >
                    <MicrophoneIcon />
                    {t("question.startRecording")}
                  </button>

                  <button
                    type="button"
                    onClick={handleStopRecording}
                    disabled={status !== "recording"}
                    className="px-4 py-2 rounded-md text-white shadow flex items-center justify-center gap-2 bg-red-600 disabled:opacity-50"
                  >
                    <StopIcon />
                    {t("question.stopRecording")}
                  </button>
                </div>

                {status === "finalizing" && <p>{t("question.finalizing")}</p>}
                {status === "starting" && <p>{t("question.starting")}</p>}
                {error && <Alert kind="error">{error}</Alert>}

                {/* Live transcription display */}
                <div className="mt-2">
                  <h3 className="font-medium text-gray-700 mb-2">{t("question.transcription")}</h3>
                  <div className="p-4 bg-gray-50 border border-gray-200 rounded-md min-h-[100px] max-h-[200px] overflow-y-auto">
                    {transcript && <p className="text-gray-800">{transcript}</p>}
                    {interimTranscript && (
                      <p className="text-gray-500 italic">{interimTranscript}</p>
                    )}
                    {!transcript && !interimTranscript && (
                      <p className="text-gray-400">
                        {status === "recording"
                          ? t("question.listening")
                          : t("question.recordingPlaceholder")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Display audio playback if available */}
                {audioBlob && !recordingBusy && (
                  <div className="mt-2">
                    <h3 className="font-medium text-gray-700 mb-2">
                      {t("question.yourRecording")}
                    </h3>
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
          <section className="w-full py-4 sm:py-6 flex flex-wrap gap-3 items-center justify-between">
            <button
              type="button"
              className="px-3 sm:px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm sm:text-base whitespace-nowrap"
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("common.confirmExit"))) {
                  navigate("/");
                }
              }}
            >
              {t("common.saveAndExit")}
            </button>

            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                className="px-3 sm:px-4 py-2 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 text-sm sm:text-base"
                onClick={handleSkip}
                disabled={busy}
              >
                {t("common.skip")}
              </button>

              <button
                type="submit"
                className="px-4 sm:px-6 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 shadow disabled:opacity-50 text-sm sm:text-base"
                disabled={
                  (question.kind === "audio_mc" &&
                    (assistanceOffered ? selectedIndex === null : audioBlob === null)) ||
                  (question.kind === "mc" && selectedIndex == null) ||
                  (question.kind === "audio" && audioBlob == null) ||
                  busy
                }
              >
                {busy ? t("common.loadingDots") : t("common.next")}
              </button>
            </div>
          </section>
        </form>
      </main>

      {showInstructions && (
        <Modal onClose={() => setShowInstructions(false)}>
          <div className="flex flex-col gap-4 pr-8">
            <h2 className="text-2xl font-bold text-gray-900">
              {t("question.sectionInstructions")}
            </h2>
            <SectionInstructionBody instruction={section.instruction} />
          </div>
        </Modal>
      )}
    </div>
  );
}
