import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";
import { useEffect, useState } from "react";
import quizQuestions from "../assets/questions.json" with { type: "json" };

function BackArrowIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-5 h-5 text-green-600"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className="w-5 h-5 text-red-600"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

interface Assessment {
  id: string;
  name: string;
  age: number;
  grade: string;
  school: string;
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

export default function GradeAssessment() {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  if (!id) throw new Error("Assessment ID not provided");

  const [getAssessmentStudentResponses, fetching, fetchError] = useHttpsCallable<
    GetAssessmentStudentResponsesRequest,
    GetAssessmentStudentResponsesResponse
  >(functions, "api/get-assessment-student-responses");

  const [submitAudioGrade, submitting, submitError] = useHttpsCallable<SubmitAudioGradeRequest>(
    functions,
    "api/submit-audio-grade",
  );

  const [studentResponseData, setStudentResponseData] =
    useState<GetAssessmentStudentResponsesResponse | null>(null);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [localAudioGrades, setLocalAudioGrades] = useState<Record<string, Record<string, number>>>(
    {},
  );

  useEffect(() => {
    void getAssessmentStudentResponses({ assessmentId: id }).then((httpResponse) => {
      if (httpResponse?.data) {
        setStudentResponseData(httpResponse.data);

        // Initialize local audio grades from server data
        const initialAudioGrades: Record<string, Record<string, number>> = {};
        for (const [sectionIdx, answers] of Object.entries(
          httpResponse.data.studentResponsesBySection,
        )) {
          if (answers.type === "audio") {
            initialAudioGrades[sectionIdx] = answers.grades ?? {};
          }
        }
        setLocalAudioGrades(initialAudioGrades);
      }
    });
  }, [id, getAssessmentStudentResponses]);

  if (fetching) {
    return (
      <div className="p-6 flex justify-center">
        <div className="text-gray-500">Loading assessment...</div>
      </div>
    );
  }

  if (fetchError || submitError) {
    return (
      <div className="p-6">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {fetchError && <div>Error loading assessment: {fetchError.message}</div>}
          {submitError && <div>Error saving grade: {submitError.message}</div>}
        </div>
      </div>
    );
  }

  if (!studentResponseData) {
    return (
      <div className="p-6">
        <div className="text-gray-500">Assessment not found.</div>
      </div>
    );
  }

  const changeGrade = async (section: number, question: number, grade: number) => {
    setLocalAudioGrades((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [question]: grade,
      },
    }));

    await submitAudioGrade({
      assessmentId: id,
      section,
      question,
      grade,
    });
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
      const choices = quizSection.choices?.[questionIndex];
      const correctAnswer = quizSection.correctAnswers?.[questionIndex];
      if (
        choices &&
        correctAnswer &&
        answerIndex !== null &&
        choices[answerIndex] === correctAnswer
      ) {
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
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(backPath)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <BackArrowIcon />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Grade Assessment</h1>
              <p className="text-gray-600 mt-1">
                {studentResponseData.assessment.name} • {studentResponseData.assessment.school} •
                Grade {studentResponseData.assessment.grade}
              </p>
            </div>
          </div>
        </div>

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
                          return `Graded ${score.numGraded}/${score.total}`;
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
                // TODO: document the structure of studentResponses (currently, scetion index (string) -> response (string))
                const choices = currentQuizSection.choices?.[questionIdx] ?? [];
                const correctAnswer = currentQuizSection.correctAnswers?.[questionIdx];
                const correctIdx = choices.findIndex((c) => c === correctAnswer);
                const isCorrect = studentMcChoiceIdx === correctIdx;
                const questionText = currentQuizSection.questions?.[questionIdx];

                return (
                  <div key={questionIdx} className="p-4">
                    <div className="flex items-start gap-3">
                      <span className="font-medium text-gray-500 min-w-[2rem]">
                        Q{questionIdx + 1}
                      </span>
                      <div className="flex-1">
                        {questionText && <p className="mb-3 text-gray-800">{questionText}</p>}
                        <div className="grid gap-2">
                          {choices.map((choice, cIdx) => {
                            const isUserChoice = studentMcChoiceIdx === cIdx;
                            const isCorrectChoice = cIdx === correctIdx;

                            return (
                              <div
                                key={cIdx}
                                className={`flex items-center gap-2 p-2 rounded-md ${
                                  isCorrectChoice
                                    ? "bg-green-50 border border-green-200"
                                    : isUserChoice && !isCorrect
                                      ? "bg-red-50 border border-red-200"
                                      : "bg-gray-50"
                                }`}
                              >
                                <span className="font-medium text-gray-500">
                                  {String.fromCharCode(65 + cIdx)}.
                                </span>
                                <span>{choice}</span>
                                {isCorrectChoice && <CheckIcon />}
                                {isUserChoice && !isCorrect && <XIcon />}
                              </div>
                            );
                          })}
                        </div>
                        {(studentMcChoiceIdx === undefined || studentMcChoiceIdx === null) && (
                          <p className="mt-2 text-sm text-gray-400 italic">No answer provided</p>
                        )}
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
                        Q{questionIdx + 1}
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
                                Student Recording:
                              </label>
                              <audio controls src={fileUrl} className="w-full">
                                Your browser does not support the audio element.
                              </audio>
                            </div>

                            {/* Transcript */}
                            {transcript && (
                              <div>
                                <label className="text-sm font-medium text-gray-700 mb-1 block">
                                  Transcript:
                                </label>
                                <p className="p-3 bg-gray-50 rounded-md text-gray-700 text-sm">
                                  {transcript || (
                                    <span className="italic text-gray-400">
                                      No transcript available
                                    </span>
                                  )}
                                </p>
                              </div>
                            )}

                            {/* Grade Input */}
                            <div>
                              <label className="text-sm font-medium text-gray-700 mb-2 block">
                                Grade (0-5):
                              </label>
                              <div className="flex items-center gap-2">
                                {[0, 1, 2, 3, 4, 5].map((grade) => (
                                  <button
                                    key={grade}
                                    onClick={() =>
                                      changeGrade(activeSectionIdx, questionIdx, grade)
                                    }
                                    disabled={submitting}
                                    className={`w-10 h-10 rounded-full font-medium transition-colors ${
                                      currentGrade === grade
                                        ? "bg-blue-600 text-white"
                                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    } ${submitting ? "opacity-50" : ""}`}
                                  >
                                    {grade}
                                  </button>
                                ))}
                                {submitting && (
                                  <span className="text-sm text-gray-500 ml-2">Saving...</span>
                                )}
                                {currentGrade !== undefined && !submitting && (
                                  <span className="text-sm text-green-600 ml-2">✓ Saved</span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 italic">No recording provided</p>
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
    </div>
  );
}
