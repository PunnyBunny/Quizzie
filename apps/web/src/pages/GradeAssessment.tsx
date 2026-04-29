import { useParams, useLocation } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { useEffect, useState } from "react";
import ScoreModal from "../components/ScoreModal";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { CheckIcon, XIcon } from "../components/icons";
import type { QuizSection } from "../lib/scoring";
import { useTranslation } from "../hooks/useTranslation";

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
  studentResponses: Record<string, number | null>;
}

interface AudioStudentResponse {
  type: "audio";
  files: Record<string, string | null>;
  transcripts: Record<string, string | null>;
  grades?: Record<string, number>;
}

interface GetAssessmentStudentResponsesResponse {
  assessment: Assessment;
  studentResponsesBySection: Record<string, MCStudentResponse | AudioStudentResponse>;
}

interface SubmitAudioGradeRequest {
  assessmentId: string;
  section: number;
  question: number;
  grade: number;
}

interface GetQuestionsResponse {
  sections: QuizSection[];
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

  const [getQuestions, fetchingQuestions] = useCallable<void, GetQuestionsResponse>(
    "api/get-questions",
  );

  const [submitAudioGrade, submitting] = useCallable<SubmitAudioGradeRequest>(
    "api/submit-audio-grade",
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

  useEffect(() => {
    void getQuestions()
      .then((result) => setQuizQuestions(result.data.sections))
      .catch((err) => setLoadError(toUserMessage(err, t("gradeAssessment.errorQuestions"))));
  }, [getQuestions, t]);

  useEffect(() => {
    void getAssessmentStudentResponses({ assessmentId: id })
      .then((httpResponse) => {
        setStudentResponseData(httpResponse.data);

        const initialAudioGrades: Record<string, Record<string, number>> = {};
        for (const [sectionIdx, answers] of Object.entries(
          httpResponse.data.studentResponsesBySection,
        )) {
          if (answers.type === "audio") {
            initialAudioGrades[sectionIdx] = answers.grades ?? {};
          }
        }
        setLocalAudioGrades(initialAudioGrades);
      })
      .catch((err) => setLoadError(toUserMessage(err, t("gradeAssessment.errorAssessment"))));
  }, [id, getAssessmentStudentResponses, t]);

  if (fetching || fetchingQuestions) {
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

  const getMcStudentResponse = (sectionIndex: number) => {
    return studentResponseData.studentResponsesBySection[sectionIndex.toString()] as
      | MCStudentResponse
      | undefined;
  };

  const getAudioStudentResponse = (sectionIndex: number) => {
    return studentResponseData.studentResponsesBySection[sectionIndex.toString()] as
      | AudioStudentResponse
      | undefined;
  };

  // Calculate score for MC section
  const calculateMcScore = (sectionIndex: number) => {
    const mcStudentResponse = getMcStudentResponse(sectionIndex);
    const quizSection = quizQuestions[sectionIndex];
    if (!mcStudentResponse || !quizSection.correctAnswers) return { correct: 0, total: 0 };

    let correct = 0;
    Object.entries(mcStudentResponse.studentResponses).forEach(([q, answerIndex]) => {
      const questionIndex = parseInt(q);
      const correctAnswerIdx = quizSection.correctAnswers?.[questionIndex];
      if (correctAnswerIdx !== undefined && answerIndex !== null && answerIndex === Number(correctAnswerIdx)) {
        correct++;
      }
    });

    return { correct, total: quizSection.length };
  };

  // Calculate score for audio section
  const calculateAudioScore = (sectionIndex: number) => {
    const quizSection = quizQuestions[sectionIndex];

    let numGraded = 0;
    let totalScore = 0;
    Object.entries(localAudioGrades[sectionIndex] ?? {}).forEach(([, grade]) => {
      ++numGraded;
      totalScore += grade;
    });

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
            <Button variant="primary" onClick={() => setShowScore(true)}>
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
          <div className="flex gap-1 overflow-x-auto pb-px">
            {quizQuestions.map((quizSection, sectionIdx) => {
              const isActive = activeSectionIdx === sectionIdx;
              const isMc = quizSection.kind === "mc";

              return (
                <button
                  key={sectionIdx}
                  onClick={() => setActiveSectionIdx(sectionIdx)}
                  className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
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
                </button>
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
                const studentMcChoiceIdx =
                  mcStudentResponse?.studentResponses[questionIdx.toString()];
                const hasAnswer =
                  studentMcChoiceIdx !== undefined && studentMcChoiceIdx !== null;
                const choicesMap = currentQuizSection.choices?.[questionIdx] ?? {};
                const choiceEntries = Object.entries(choicesMap).sort(([a], [b]) => Number(a) - Number(b));
                const correctAnswerIdx = currentQuizSection.correctAnswers?.[questionIdx];
                const correctIdx = correctAnswerIdx !== undefined ? Number(correctAnswerIdx) : -1;
                const isCorrect = hasAnswer && studentMcChoiceIdx === correctIdx;
                const questionText = currentQuizSection.questions?.[questionIdx];

                return (
                  <div key={questionIdx} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="font-medium text-gray-500 min-w-[2rem]">
                        {t("gradeAssessment.q.short")}{questionIdx + 1}
                      </span>
                      <div className="flex-1">
                        {questionText && <p className="mb-3 text-gray-800">{questionText}</p>}
                        {!hasAnswer && (
                          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
                            {t("gradeAssessment.noAnswer")}
                          </div>
                        )}
                        <div className="grid gap-2">
                          {choiceEntries.map(([key, choice]) => {
                            const cIdx = Number(key);
                            const isUserChoice = hasAnswer && studentMcChoiceIdx === cIdx;
                            const isCorrectChoice = cIdx === correctIdx;

                            let choiceClass = "bg-gray-50";
                            if (isCorrectChoice && hasAnswer) {
                              choiceClass = "bg-green-50 border border-green-200";
                            } else if (isCorrectChoice && !hasAnswer) {
                              choiceClass = "bg-amber-50 border border-amber-200";
                            } else if (isUserChoice && !isCorrect) {
                              choiceClass = "bg-red-50 border border-red-200";
                            }

                            return (
                              <div
                                key={cIdx}
                                className={`flex items-center gap-2 p-2 rounded-md ${choiceClass}`}
                              >
                                <span className="font-medium text-gray-500">
                                  {String.fromCharCode(65 + cIdx)}.
                                </span>
                                <span>{choice}</span>
                                {isCorrectChoice && hasAnswer && (
                                  <CheckIcon className="w-5 h-5 text-green-600" />
                                )}
                                {isCorrectChoice && !hasAnswer && (
                                  <span className="text-xs text-amber-700 ml-auto">{t("gradeAssessment.correctAnswer")}</span>
                                )}
                                {isUserChoice && !isCorrect && <XIcon className="w-5 h-5 text-red-600" />}
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
                const transcript = audioStudentResponse?.transcripts[questionIdx.toString()];
                const currentGrade = localAudioGrades[activeSectionIdx]?.[questionIdx];
                const questionText = currentQuizSection.questions?.[questionIdx];

                return (
                  <div key={questionIdx} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="font-medium text-gray-500 min-w-[2rem]">
                        {t("gradeAssessment.q.short")}{questionIdx + 1}
                      </span>
                      <div className="flex-1">
                        {questionText && (
                          <p className="mb-3 text-gray-800 whitespace-pre-wrap">{questionText}</p>
                        )}

                        {fileUrl ? (
                          <div className="space-y-3">
                            {/* Audio Player */}
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-1 block">
                                {t("gradeAssessment.studentRecording")}
                              </label>
                              <audio controls src={fileUrl} className="w-full">
                                {t("gradeAssessment.audioFallback")}
                              </audio>
                            </div>

                            {/* Transcript */}
                            {transcript && (
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  {t("gradeAssessment.transcript")}
                                </label>
                                <p className="p-3 bg-gray-50 rounded-md text-gray-700 text-sm">
                                  {transcript || (
                                    <span className="italic text-gray-400">
                                      {t("gradeAssessment.noTranscript")}
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}

                            {/* Grade Input */}
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-2 block">
                                {t("gradeAssessment.gradeRange")}
                              </label>
                              <div className="flex flex-wrap items-center gap-2">
                                {[0, 1, 2, 3, 4, 5].map((grade) => (
                                  <button
                                    key={grade}
                                    onClick={() =>
                                      changeGrade(activeSectionIdx, questionIdx, grade)
                                    }
                                    disabled={submitting}
                                    className={`w-10 h-10 rounded-full font-medium transition-colors flex-shrink-0 ${
                                      currentGrade === grade
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    } ${submitting ? "opacity-50" : ""}`}
                                  >
                                    {grade}
                                  </button>
                                ))}
                                {submitting && (
                                  <span className="text-sm text-gray-500 ml-2">{t("common.saving")}</span>
                                )}
                                {currentGrade !== undefined && !submitting && (
                                  <span className="text-sm text-green-600 ml-2">{t("common.saved")}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">{t("gradeAssessment.noRecording")}</p>
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

      {showScore && (
        <ScoreModal assessmentId={id} onClose={() => setShowScore(false)} />
      )}
    </div>
  );
}
