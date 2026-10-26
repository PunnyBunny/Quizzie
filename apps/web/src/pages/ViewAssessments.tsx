import { ArchiveButton, ArchiveFeedback } from "../components/AssessmentArchive";
import { useAssessmentArchive } from "../hooks/useAssessmentArchive";
import { useNavigate } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { useEffect, useState } from "react";
import ScoreModal from "../components/ScoreModal";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ClipboardIcon } from "../components/icons";
import { useTranslation } from "../hooks/useTranslation";

import type { AssessmentDto } from "../../../functions/src/types/models/assessments-dto";
import type { GetAssessmentsInput } from "../../../functions/src/types/zod/routes/assessments";
import type { GetAssessmentsOutput } from "../../../functions/src/types/assessments";

export default function ViewAssessments() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [getAssessments, loading] = useCallable<GetAssessmentsInput, GetAssessmentsOutput>(
    "api/get-assessments",
  );

  const [assessments, setAssessments] = useState<AssessmentDto[]>([]);
  const [scoreModalId, setScoreModalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const archive = useAssessmentArchive((id) => {
    setAssessments((items) => items.filter((item) => item.id !== id));
  });

  useEffect(() => {
    let active = true;
    setError(null);
    void getAssessments({ finished: false, archived: false })
      .then((response) => {
        if (active) setAssessments(response.data.assessments);
      })
      .catch((err) => {
        if (active) setError(toUserMessage(err, t("viewAssessments.errorLoad")));
      });
    return () => {
      active = false;
    };
  }, [getAssessments, t]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(language === "zh-Hant" ? "zh-Hant" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={t("viewAssessments.title")}
          subtitle={t("viewAssessments.subtitle")}
          actions={
            <Button variant="secondary" onClick={() => navigate("/archived-assessments")}>
              {t("archive.title")}
            </Button>
          }
          backTo="/"
        />

        <ArchiveFeedback error={archive.error} message={archive.message} />

        {error && (
          <Alert kind="error" className="mb-4">
            <p className="font-medium">{t("viewAssessments.errorTitle")}</p>
            <p className="text-sm mt-1">{error}</p>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              {t("common.retry")}
            </Button>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : error ? null : assessments.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-8 text-center">
              <div className="rounded-xl bg-gray-100 p-4 w-fit mx-auto mb-4">
                <ClipboardIcon />
              </div>
              <h2 className="text-xl font-semibold mb-2">{t("viewAssessments.empty.title")}</h2>
              <p className="text-gray-600 mb-6">{t("viewAssessments.empty.body")}</p>
              <Button variant="dark" onClick={() => navigate("/")}>
                {t("viewAssessments.empty.button")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:border-gray-300 transition-colors"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div className="flex gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="rounded-xl bg-gray-100 p-2 sm:p-3 h-fit shrink-0">
                        <ClipboardIcon />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg sm:text-xl font-semibold mb-1 wrap-break-word">
                          {assessment.name}
                        </h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">
                              {t("viewAssessments.field.birthDate")}
                            </span>{" "}
                            {assessment.birthDate}
                          </p>
                          <p>
                            <span className="font-medium">{t("viewAssessments.field.grade")}</span>{" "}
                            {assessment.grade}
                          </p>
                          <p className="wrap-break-word">
                            <span className="font-medium">{t("viewAssessments.field.school")}</span>{" "}
                            {assessment.school}
                          </p>
                          <p>
                            <span className="font-medium">
                              {t("viewAssessments.field.started")}
                            </span>{" "}
                            {formatDate(assessment.createdAtIsoTimestamp)}
                          </p>
                          {assessment.currentSection !== undefined && (
                            <p>
                              <span className="font-medium">
                                {t("viewAssessments.field.progress")}
                              </span>{" "}
                              {t("viewAssessments.section")} {assessment.currentSection + 1}
                              {assessment.currentQuestion !== undefined &&
                                `, ${t("viewAssessments.question")} ${assessment.currentQuestion + 1}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:shrink-0">
                      <Button
                        variant="dark"
                        className="w-full sm:w-auto whitespace-nowrap"
                        onClick={() =>
                          window.open(
                            `/assessment/${assessment.id}/s/${assessment.currentSection}/q/${assessment.currentQuestion}`,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        {t("viewAssessments.continue")}
                      </Button>
                      <Button
                        variant="muted"
                        className="w-full sm:w-auto whitespace-nowrap"
                        onClick={() => setScoreModalId(assessment.id)}
                      >
                        {t("viewAssessments.viewScore")}
                      </Button>
                      <ArchiveButton
                        busy={archive.pendingId === assessment.id}
                        disabled={archive.pendingId !== null}
                        onClick={() =>
                          void archive.setArchived(assessment.id, assessment.name, true)
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {scoreModalId && (
        <ScoreModal
          assessmentId={scoreModalId}
          onClose={() => setScoreModalId(null)}
          onGoToGrading={() => navigate(`/grade/${scoreModalId}`)}
        />
      )}
    </div>
  );
}
