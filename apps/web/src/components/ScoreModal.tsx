import { useEffect, useState } from "react";
import { useCallable } from "../lib/firebase-hooks";
import { toUserMessage } from "../lib/errors";
import { Modal } from "./Modal";
import { Button } from "./Button";
import { Alert } from "./Alert";
import { useTranslation } from "../i18n/LanguageProvider";
import {
  type QuizSection,
  type StudentResponse,
  type SubtaskDef,
  getNormGrade,
  computeSubtaskScore,
  computeZScore,
  getQuestionMaxScore,
} from "../lib/scoring";

interface Assessment {
  id: string;
  name: string;
  grade: string;
  school: string;
}

interface GetAssessmentStudentResponsesResponse {
  assessment: Assessment;
  studentResponsesBySection: Record<string, StudentResponse>;
}

interface GetQuestionsResponse {
  sections: QuizSection[];
}

interface GetSubtasksResponse {
  subtasks: SubtaskDef[];
}

interface ScoreModalProps {
  assessmentId: string;
  onClose: () => void;
  onGoToGrading?: () => void;
}

export default function ScoreModal({ assessmentId, onClose, onGoToGrading }: ScoreModalProps) {
  const { t } = useTranslation();
  const [getResponses] = useCallable<
    { assessmentId: string },
    GetAssessmentStudentResponsesResponse
  >("api/get-assessment-student-responses");

  const [getQuestions] = useCallable<void, GetQuestionsResponse>("api/get-questions");

  const [getSubtasks] = useCallable<{}, GetSubtasksResponse>("api/get-subtasks");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [responsesBySection, setResponsesBySection] = useState<Record<
    string,
    StudentResponse
  > | null>(null);
  const [sections, setSections] = useState<QuizSection[] | null>(null);
  const [subtaskDefs, setSubtaskDefs] = useState<SubtaskDef[]>([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [responsesResult, questionsResult, subtasksResult] = await Promise.all([
          getResponses({ assessmentId }),
          getQuestions(),
          getSubtasks({}),
        ]);

        setAssessment(responsesResult.data.assessment);
        setResponsesBySection(responsesResult.data.studentResponsesBySection);
        setSections(questionsResult.data.sections);
        setSubtaskDefs(subtasksResult.data.subtasks);
      } catch (e) {
        setError(toUserMessage(e, t("scoreModal.errorLoad")));
      } finally {
        setLoading(false);
      }
    };

    void fetchAll();
  }, [assessmentId, getResponses, getQuestions, getSubtasks, t]);

  const normGrade = assessment ? getNormGrade(assessment.grade) : "S1";

  // Compute total score across all sections
  const computeTotalScore = () => {
    if (!sections || !responsesBySection) return { score: 0, maxScore: 0, ungradedCount: 0 };

    const allQuestionIds: { sectionIndex: number; questionIndex: number }[] = [];
    for (let s = 0; s < sections.length; s++) {
      for (let q = 0; q < sections[s].length; q++) {
        allQuestionIds.push({ sectionIndex: s, questionIndex: q });
      }
    }
    return computeSubtaskScore(allQuestionIds, responsesBySection, sections);
  };

  // Compute total max score
  const computeTotalMaxScore = () => {
    if (!sections) return 0;
    return sections.reduce(
      (sum, s) => sum + s.length * getQuestionMaxScore(s.kind),
      0,
    );
  };

  return (
    <Modal onClose={onClose}>
      {loading && <p className="text-gray-500 text-center py-8">{t("scoreModal.loading")}</p>}

      {error && <Alert kind="error">{error}</Alert>}

        {!loading && !error && assessment && sections && responsesBySection && (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold">{t("scoreModal.title")}</h2>
              <p className="text-gray-600 mt-1">
                {assessment.name} &bull; {assessment.school} &bull;{" "}
                {t("scoreModal.gradePrefix")} {assessment.grade}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {t("scoreModal.compareNorms", { norm: normGrade })}
              </p>
            </div>

            {subtaskDefs.length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                {t("scoreModal.noSubtasks")}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500">
                        <th className="pb-2 pr-4 font-medium">{t("scoreModal.col.subtask")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.score")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.maxScore")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.min")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.max")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.mean")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.sd")}</th>
                        <th className="pb-2 px-2 font-medium text-right">{t("scoreModal.col.n")}</th>
                        <th className="pb-2 pl-2 font-medium text-right">{t("scoreModal.col.z")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subtaskDefs.map((subtask) => {
                        const result = computeSubtaskScore(
                          subtask.questionIds,
                          responsesBySection,
                          sections,
                        );
                        const normRow = subtask.norms[normGrade];
                        const zScore =
                          normRow && result.ungradedCount === 0
                            ? computeZScore(result.score, normRow.mean, normRow.stdDev)
                            : null;

                        return (
                          <tr
                            key={subtask.id}
                            className="border-b border-gray-100 hover:bg-gray-50"
                          >
                            <td className="py-2 pr-4 font-medium text-gray-800">
                              {subtask.name}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {result.score}
                              {result.ungradedCount > 0 && (
                                <span className="text-amber-500">*</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-gray-500">
                              {result.maxScore}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {normRow ? normRow.min : "\u2014"}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {normRow ? normRow.max : "\u2014"}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {normRow ? normRow.mean.toFixed(1) : "\u2014"}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {normRow ? normRow.stdDev.toFixed(2) : "\u2014"}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {normRow ? normRow.n : "\u2014"}
                            </td>
                            <td className="py-2 pl-2 text-right tabular-nums font-medium">
                              {zScore !== null ? (
                                <span
                                  className={
                                    zScore >= 0 ? "text-green-600" : "text-red-600"
                                  }
                                >
                                  {zScore >= 0 ? "+" : ""}
                                  {zScore.toFixed(2)}
                                </span>
                              ) : (
                                "\u2014"
                              )}
                            </td>
                          </tr>
                        );
                      })}

                      {/* Total row */}
                      {(() => {
                        const total = computeTotalScore();
                        const totalMax = computeTotalMaxScore();
                        return (
                          <tr className="border-t-2 border-gray-300 font-semibold">
                            <td className="py-2 pr-4">{t("scoreModal.total")}</td>
                            <td className="py-2 px-2 text-right tabular-nums">
                              {total.score}
                              {total.ungradedCount > 0 && (
                                <span className="text-amber-500">*</span>
                              )}
                            </td>
                            <td className="py-2 px-2 text-right tabular-nums text-gray-500">
                              {totalMax}
                            </td>
                            <td className="py-2 px-2 text-right">{"\u2014"}</td>
                            <td className="py-2 px-2 text-right">{"\u2014"}</td>
                            <td className="py-2 px-2 text-right">{"\u2014"}</td>
                            <td className="py-2 px-2 text-right">{"\u2014"}</td>
                            <td className="py-2 px-2 text-right">{"\u2014"}</td>
                            <td className="py-2 pl-2 text-right">{"\u2014"}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

                {/* Ungraded footnote */}
                {subtaskDefs.some((st) => {
                  const r = computeSubtaskScore(
                    st.questionIds,
                    responsesBySection,
                    sections,
                  );
                  return r.ungradedCount > 0;
                }) && (
                  <p className="text-xs text-amber-600 mt-3">
                    {t("scoreModal.ungradedNote")}
                  </p>
                )}
              </>
            )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3 mt-6">
            {onGoToGrading && (
              <Button variant="primary" onClick={onGoToGrading}>
                {t("scoreModal.goToGrading")}
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              {t("common.close")}
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
