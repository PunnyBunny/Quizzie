import { useLocation, useParams } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { useEffect, useState } from "react";
import ScoreModal from "../components/ScoreModal";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert } from "../components/Alert";
import { Tooltip } from "../components/Tooltip";
import { CheckIcon, SpinnerIcon, XIcon } from "../components/icons";
import { INPUT_CLASSES } from "../lib/ui";
import type { HybridStudentResponseDto } from "../../../functions/src/types/models/student-responses-dto";
import { getQuestionScore, type QuizSection } from "../lib/scoring";
import { useTranslation } from "../hooks/useTranslation";

/**
 * Mirrors the server-side cap in `UpdateAudioTranscriptSchema`
 * (apps/functions/src/types/zod/routes/grading.ts). Duplicated rather than imported
 * because that module pulls in zod, which has no business in the browser bundle.
 */
const TRANSCRIPT_MAX_LENGTH = 5000;

interface LanguageEntry {
  language: "cantonese" | "mandarin" | "english" | "other";
  otherSpecify?: string;
}

interface Assessment {
  id: string;
  name: string;
  birthDate: string;
  gender: "male" | "female";
  grade: string;
  school: string;
  motherTongue: LanguageEntry;
  otherLanguages: LanguageEntry[];
  createdAtIsoTimestamp: string;
}

interface GetAssessmentStudentResponsesRequest {
  assessmentId: string;
}

interface MCStudentResponse {
  type: "mc";
  studentResponses: Record<string, string | null>;
}

interface AudioStudentResponse {
  type: "audio";
  files: Record<string, string | null>;
  transcripts: Record<string, string | null>;
  grades?: Record<string, number | null>;
}

interface GetAssessmentStudentResponsesResponse {
  assessment: Assessment;
  sections: QuizSection[];
  studentResponsesBySection: Record<
    string,
    MCStudentResponse | AudioStudentResponse | HybridStudentResponseDto
  >;
}

interface SubmitAudioGradeRequest {
  assessmentId: string;
  section: number;
  question: number;
  grade: number;
}

interface UpdateAudioTranscriptRequest {
  assessmentId: string;
  section: number;
  question: number;
  transcript: string;
}

export default function GradeAssessment() {
  const { t } = useTranslation();
  const { id = "" } = useParams<{ id: string }>();
  const location = useLocation();

  if (!id) throw new Error("Assessment ID not provided");

  const [getAssessmentStudentResponses, fetching] = useCallable<
    GetAssessmentStudentResponsesRequest,
    GetAssessmentStudentResponsesResponse
  >("api/get-assessment-student-responses");

  const [submitAudioGrade, submitting] =
    useCallable<SubmitAudioGradeRequest>("api/submit-audio-grade");

  const [updateAudioTranscript] = useCallable<UpdateAudioTranscriptRequest>(
    "api/update-audio-transcript",
  );

  const [studentResponseData, setStudentResponseData] =
    useState<GetAssessmentStudentResponsesResponse | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizSection[] | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [localAudioGrades, setLocalAudioGrades] = useState<Record<string, Record<string, number>>>(
    {},
  );
  const [showScore, setShowScore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);

  // Transcripts as last persisted, keyed [sectionIdx][questionIdx]
  const [savedTranscripts, setSavedTranscripts] = useState<Record<string, Record<string, string>>>(
    {},
  );
  // In-progress edits, keyed `${sectionIdx}:${questionIdx}`. Only holds questions the
  // grader has actually typed in, so drafts survive switching section tabs.
  const [transcriptDrafts, setTranscriptDrafts] = useState<Record<string, string>>({});
  const [savingTranscriptKey, setSavingTranscriptKey] = useState<string | null>(null);
  const [savedTranscriptKey, setSavedTranscriptKey] = useState<string | null>(null);

  useEffect(() => {
    void getAssessmentStudentResponses({ assessmentId: id })
      .then((httpResponse) => {
        setStudentResponseData(httpResponse.data);
        setQuizQuestions(httpResponse.data.sections);

        const initialAudioGrades: Record<string, Record<string, number>> = {};
        const initialTranscripts: Record<string, Record<string, string>> = {};
        for (const [sectionIdx, answers] of Object.entries(
          httpResponse.data.studentResponsesBySection,
        )) {
          if (answers.type !== "mc") {
            initialAudioGrades[sectionIdx] = Object.fromEntries(
              Object.entries(answers.grades ?? {}).filter(
                (entry): entry is [string, number] => entry[1] !== null,
              ),
            );
            initialTranscripts[sectionIdx] = Object.fromEntries(
              Object.entries(answers.transcripts ?? {}).map(([q, text]) => [q, text ?? ""]),
            );
          }
        }
        setLocalAudioGrades(initialAudioGrades);
        setSavedTranscripts(initialTranscripts);
      })
      .catch((err) => setLoadError(toUserMessage(err, t("gradeAssessment.errorAssessment"))));
  }, [id, getAssessmentStudentResponses, t]);

  if (fetching) {
    return (
      <div className="p-4 sm:p-6 flex justify-center">
        <div className="text-gray-500">{t("gradeAssessment.loading")}</div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6">
        <Alert kind="error">{loadError}</Alert>
      </div>
    );
  }

  if (!studentResponseData || !quizQuestions) {
    return (
      <div className="p-4 sm:p-6">
        <div className="text-gray-500">{t("gradeAssessment.notFound")}</div>
      </div>
    );
  }

  const changeGrade = async (section: number, question: number, grade: number) => {
    const previous = localAudioGrades[section]?.[question];
    setLocalAudioGrades((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [question]: grade,
      },
    }));
    setGradeError(null);

    try {
      await submitAudioGrade({
        assessmentId: id,
        section,
        question,
        grade,
      });
    } catch (err) {
      setGradeError(toUserMessage(err, t("gradeAssessment.errorSaveGrade")));
      setLocalAudioGrades((prev) => {
        const prevSection: Record<string, number> = { ...prev[section] };
        if (previous === undefined) {
          delete prevSection[question];
        } else {
          prevSection[question] = previous;
        }
        return { ...prev, [section]: prevSection };
      });
    }
  };

  const transcriptKey = (section: number, question: number) => `${section}:${question}`;

  const getSavedTranscript = (section: number, question: number) =>
    savedTranscripts[section]?.[question] ?? "";

  // A draft exists only while the question is open for editing, so its presence is the
  // "is editing" flag — no separate state to keep in sync.
  const isEditingTranscript = (section: number, question: number) =>
    transcriptKey(section, question) in transcriptDrafts;

  // The text currently in the box: the grader's draft if they've touched it, else what's saved.
  const getTranscriptValue = (section: number, question: number) =>
    transcriptDrafts[transcriptKey(section, question)] ?? getSavedTranscript(section, question);

  // Only one transcript may be open at a time: two in-flight saves against the same
  // student-response doc race each other, and the second write wins silently. Replacing
  // the map rather than adding to it makes a second draft impossible.
  const editingTranscriptKey = Object.keys(transcriptDrafts)[0] ?? null;

  const startEditTranscript = (section: number, question: number) => {
    setTranscriptDrafts({
      [transcriptKey(section, question)]: getSavedTranscript(section, question),
    });
    setSavedTranscriptKey(null);
  };

  const editTranscript = (section: number, question: number, text: string) => {
    setTranscriptDrafts((prev) => ({ ...prev, [transcriptKey(section, question)]: text }));
    setSavedTranscriptKey(null);
  };

  const cancelTranscript = (section: number, question: number) => {
    setTranscriptDrafts((prev) => {
      const next = { ...prev };
      delete next[transcriptKey(section, question)];
      return next;
    });
    setSavedTranscriptKey(null);
  };

  // Stays in edit mode until the request resolves, so the Save button (and its spinner)
  // is still mounted while the save is in flight.
  const saveTranscript = async (section: number, question: number) => {
    const key = transcriptKey(section, question);
    const transcript = getTranscriptValue(section, question);

    setSavingTranscriptKey(key);
    setGradeError(null);

    try {
      await updateAudioTranscript({ assessmentId: id, section, question, transcript });
      setSavedTranscripts((prev) => ({
        ...prev,
        [section]: { ...prev[section], [question]: transcript },
      }));
      cancelTranscript(section, question);
      setSavedTranscriptKey(key);
    } catch (err) {
      // Stay open with the typed text intact so the edit isn't lost.
      setGradeError(toUserMessage(err, t("gradeAssessment.errorSaveTranscript")));
    } finally {
      setSavingTranscriptKey(null);
    }
  };

  const getMcStudentResponse = (sectionIndex: number) => {
    const response = studentResponseData.studentResponsesBySection[sectionIndex.toString()];
    return response?.type === "mc" ? response : undefined;
  };

  // TODO: clean up DTOs
  const getAudioStudentResponse = (sectionIndex: number) => {
    const response = studentResponseData.studentResponsesBySection[sectionIndex.toString()];
    return response && response.type !== "mc" ? response : undefined;
  };

  // Calculate score for MC section
  const calculateMcScore = (sectionIndex: number) => {
    const quizSection = quizQuestions[sectionIndex];

    let correct = 0;
    for (let questionIndex = 0; questionIndex < quizSection.length; questionIndex++) {
      if (
        getQuestionScore(
          sectionIndex,
          questionIndex,
          studentResponseData.studentResponsesBySection,
          quizQuestions,
        ) === 1
      ) {
        correct++;
      }
    }

    return { correct, total: quizSection.length };
  };

  // Calculate score for audio section
  const calculateAudioScore = (sectionIndex: number) => {
    const quizSection = quizQuestions[sectionIndex];

    let numGraded = 0;
    let totalScore = 0;
    for (let questionIndex = 0; questionIndex < quizSection.length; questionIndex++) {
      const grade = localAudioGrades[sectionIndex]?.[questionIndex];
      if (grade === undefined) continue;
      ++numGraded;
      totalScore += grade;
    }

    return { numGraded, total: quizSection.length, totalScore };
  };

  const currentQuizSection = quizQuestions[activeSectionIdx];
  const isMcSection = currentQuizSection.kind === "mc";
  const mcStudentResponse = getMcStudentResponse(activeSectionIdx);
  const audioStudentResponse = getAudioStudentResponse(activeSectionIdx);

  // Determine the back path based on whether we're in admin mode
  const isAdminRoute = location.pathname.startsWith("/admin");
  const backPath = isAdminRoute ? "/admin/assessments" : "/grade-assessments";

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={t("gradeAssessment.title")}
          subtitle={`${studentResponseData.assessment.name} • ${studentResponseData.assessment.school} • ${t("gradeAssessments.grade")} ${studentResponseData.assessment.grade}`}
          backTo={backPath}
          actions={
            <Button variant="default" onClick={() => setShowScore(true)}>
              {t("gradeAssessment.viewScore")}
            </Button>
          }
        />

        {gradeError && (
          <Alert kind="error" className="mb-4">
            {gradeError}
          </Alert>
        )}

        {/* Section Tabs */}
        <div className="mb-6 border-b border-gray-200">
          {/* Wraps rather than scrolls: overflow-x on a flex row computes overflow-y to
              auto, which clips the lock tooltip out of existence. */}
          <div className="flex flex-wrap gap-1 pb-px">
            {quizQuestions.map((quizSection, sectionIdx) => {
              const isActive = activeSectionIdx === sectionIdx;
              const isMc = quizSection.kind === "mc";
              // Leaving the section would strand the open editor off-screen, so hold the
              // grader here until they save or cancel.
              const isLocked = editingTranscriptKey !== null && !isActive;

              return (
                <Tooltip
                  key={sectionIdx}
                  placement="bottom"
                  align="left"
                  label={isLocked ? t("gradeAssessment.editLockedHint") : undefined}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    aria-pressed={isActive}
                    onClick={() => setActiveSectionIdx(sectionIdx)}
                    disabled={isLocked}
                  >
                    <span>{quizSection.title}</span>
                    <span className="ml-2 text-xs">
                      {isMc
                        ? (() => {
                            const score = calculateMcScore(sectionIdx);
                            return `${score.correct}/${score.total}`;
                          })()
                        : (() => {
                            const score = calculateAudioScore(sectionIdx);
                            return `${t("gradeAssessment.tab.graded")} ${score.numGraded}/${score.total}`;
                          })()}
                    </span>
                  </Button>
                </Tooltip>
              );
            })}
          </div>
        </div>

        {/* Section Content */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold">{currentQuizSection.title}</h2>
            <p className="text-gray-600 text-sm mt-1">{currentQuizSection.goal}</p>
          </div>

          {isMcSection ? (
            <div className="divide-y divide-gray-100">
              {Array.from({ length: currentQuizSection.length }).map((_, questionIdx) => {
                const studentMcChoiceKey =
                  mcStudentResponse?.studentResponses[questionIdx.toString()];
                const choicesMap = currentQuizSection.choices?.[questionIdx] ?? {};
                const choiceEntries = Object.entries(choicesMap).sort(([a], [b]) =>
                  a.localeCompare(b),
                );
                const correctAnswerKey = currentQuizSection.correctAnswers?.[questionIdx];
                const hasAnswer = studentMcChoiceKey != undefined;
                const validAnswer = hasAnswer && studentMcChoiceKey in choicesMap;
                const isCorrect = hasAnswer && studentMcChoiceKey === correctAnswerKey;
                const questionText = currentQuizSection.questions?.[questionIdx];

                return (
                  <div key={questionIdx} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="font-medium text-gray-500 min-w-8">
                        {t("gradeAssessment.q.short")}
                        {questionIdx + 1}
                      </span>
                      <div className="flex-1">
                        {questionText && <p className="mb-3 text-gray-800">{questionText}</p>}
                        {!validAnswer && (
                          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                            {t(
                              hasAnswer
                                ? "gradeAssessment.invalidAnswer"
                                : "gradeAssessment.noAnswer",
                            )}
                          </div>
                        )}
                        <div className="grid gap-2">
                          {choiceEntries.map(([key, choice]) => {
                            const isUserChoice = validAnswer && key === studentMcChoiceKey;
                            const isCorrectChoice = key === correctAnswerKey;

                            let choiceClass = "bg-gray-50";
                            if (isCorrectChoice && validAnswer) {
                              choiceClass = "bg-green-50 border border-green-200";
                            } else if (isCorrectChoice && !validAnswer) {
                              choiceClass = "bg-amber-50 border border-amber-200";
                            } else if (isUserChoice && !isCorrect) {
                              choiceClass = "bg-red-50 border border-red-200";
                            }

                            return (
                              <div
                                key={key}
                                className={`flex items-center gap-2 p-2 rounded-md ${choiceClass}`}
                              >
                                <span className="font-medium text-gray-500">{key}.</span>
                                <span>{choice}</span>
                                {isCorrectChoice && validAnswer && (
                                  <CheckIcon className="w-5 h-5 text-green-600" />
                                )}
                                {isCorrectChoice && !validAnswer && (
                                  <span className="text-xs text-amber-700 ml-auto">
                                    {t("gradeAssessment.correctAnswer")}
                                  </span>
                                )}
                                {isUserChoice && !isCorrect && (
                                  <XIcon className="w-5 h-5 text-red-600" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            // Audio Section - Grading
            <div className="divide-y divide-gray-100">
              {Array.from({ length: currentQuizSection.length }).map((_, questionIdx) => {
                const fileUrl = audioStudentResponse?.files[questionIdx.toString()];
                const attempt =
                  audioStudentResponse?.type === "audio_mc"
                    ? audioStudentResponse.attempts[questionIdx]
                    : undefined;
                const submitted =
                  audioStudentResponse?.type === "audio_mc"
                    ? !!attempt
                    : Object.prototype.hasOwnProperty.call(
                        audioStudentResponse?.files ?? {},
                        questionIdx,
                      );
                const currentGrade = localAudioGrades[activeSectionIdx]?.[questionIdx];
                const questionText = currentQuizSection.questions?.[questionIdx];

                return (
                  <div key={questionIdx} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="font-medium text-gray-500 min-w-8">
                        {t("gradeAssessment.q.short")}
                        {questionIdx + 1}
                      </span>
                      <div className="flex-1">
                        {questionText && (
                          <p className="mb-3 text-gray-800 whitespace-pre-wrap">{questionText}</p>
                        )}

                        {currentQuizSection.kind === "audio_mc" && attempt && (
                          <div className="p-3 bg-gray-50 mb-3">
                            <p>
                              {t(
                                attempt.assistanceOffered
                                  ? "question.mcOffered"
                                  : "question.mcNotOffered",
                              )}
                            </p>
                            {attempt.assistanceOffered && (
                              <>
                                <p>
                                  {attempt.selectedOption === null
                                    ? t("gradeAssessment.noAnswer")
                                    : `${attempt.selectedOption}: ${currentQuizSection.choices?.[questionIdx]?.[attempt.selectedOption] ?? ""}`}
                                </p>
                                <p>
                                  {t("gradeAssessment.correctAnswer")}:{" "}
                                  {currentQuizSection.correctAnswers?.[questionIdx]}:{" "}
                                  {
                                    currentQuizSection.choices?.[questionIdx]?.[
                                      currentQuizSection.correctAnswers?.[questionIdx] ?? ""
                                    ]
                                  }
                                </p>
                              </>
                            )}
                          </div>
                        )}
                        {submitted ? (
                          <div className="space-y-3">
                            {/* Audio Player */}
                            {fileUrl ? (
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  {t("gradeAssessment.studentRecording")}
                                </label>
                                <audio controls src={fileUrl} className="w-full">
                                  {t("gradeAssessment.audioFallback")}
                                </audio>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-400 italic">
                                {t("gradeAssessment.noRecording")}
                              </p>
                            )}

                            {/* Transcript */}
                            {(() => {
                              const key = transcriptKey(activeSectionIdx, questionIdx);
                              const saved = getSavedTranscript(activeSectionIdx, questionIdx);
                              const isEditing = isEditingTranscript(activeSectionIdx, questionIdx);
                              const isSaving = savingTranscriptKey === key;
                              const labelClasses = "text-sm font-medium text-gray-700 mb-1 block";

                              if (!isEditing) {
                                return (
                                  <div>
                                    <span className={labelClasses}>
                                      {t("gradeAssessment.transcript")}
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <p className="flex-1 p-3 bg-gray-50 rounded-md text-gray-700 text-sm whitespace-pre-wrap">
                                        {saved || (
                                          <span className="italic text-gray-400">
                                            {t("gradeAssessment.noTranscript")}
                                          </span>
                                        )}
                                      </p>
                                      <Tooltip
                                        align="right"
                                        label={
                                          editingTranscriptKey !== null
                                            ? t("gradeAssessment.editLockedHint")
                                            : undefined
                                        }
                                      >
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          disabled={editingTranscriptKey !== null}
                                          onClick={() =>
                                            startEditTranscript(activeSectionIdx, questionIdx)
                                          }
                                        >
                                          {t("common.edit")}
                                        </Button>
                                      </Tooltip>
                                    </div>
                                    {savedTranscriptKey === key && (
                                      <span className="text-sm text-green-600 self-center py-4">
                                        {t("common.saved")}
                                      </span>
                                    )}
                                  </div>
                                );
                              }

                              const value = getTranscriptValue(activeSectionIdx, questionIdx);

                              return (
                                <div>
                                  <label htmlFor={`transcript-${key}`} className={labelClasses}>
                                    {t("gradeAssessment.transcript")}
                                  </label>
                                  <textarea
                                    id={`transcript-${key}`}
                                    rows={3}
                                    autoFocus
                                    maxLength={TRANSCRIPT_MAX_LENGTH}
                                    value={value}
                                    disabled={isSaving}
                                    placeholder={t("gradeAssessment.transcriptPlaceholder")}
                                    onChange={(e) =>
                                      editTranscript(activeSectionIdx, questionIdx, e.target.value)
                                    }
                                    className={INPUT_CLASSES}
                                  />
                                  <div className="flex items-center gap-2 mt-1">
                                    <Button
                                      variant="default"
                                      size="sm"
                                      disabled={isSaving || value === saved}
                                      aria-busy={isSaving}
                                      className="min-w-24"
                                      onClick={() =>
                                        void saveTranscript(activeSectionIdx, questionIdx)
                                      }
                                    >
                                      {isSaving ? (
                                        <span className="flex items-center gap-2">
                                          <SpinnerIcon />
                                          {t("common.saving")}
                                        </span>
                                      ) : (
                                        t("common.save")
                                      )}
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={isSaving}
                                      onClick={() =>
                                        cancelTranscript(activeSectionIdx, questionIdx)
                                      }
                                    >
                                      {t("common.cancel")}
                                    </Button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* Grade Input */}
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-2 block">
                                {t("gradeAssessment.gradeRange")}
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                {[0, 1, 2, 3, 4, 5].map((grade) => (
                                  <Button
                                    variant={currentGrade === grade ? "default" : "outline"}
                                    size="icon-lg"
                                    aria-pressed={currentGrade === grade}
                                    key={grade}
                                    onClick={() =>
                                      changeGrade(activeSectionIdx, questionIdx, grade)
                                    }
                                    disabled={submitting}
                                  >
                                    {grade}
                                  </Button>
                                ))}
                                {submitting && (
                                  <span className="text-sm text-gray-500 ml-2">
                                    {t("common.saving")}
                                  </span>
                                )}
                                {currentGrade !== undefined && !submitting && (
                                  <span className="text-sm text-green-600 ml-2">
                                    {t("common.saved")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            {t("gradeAssessment.noRecording")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showScore && <ScoreModal assessmentId={id} onClose={() => setShowScore(false)} />}
    </div>
  );
}
