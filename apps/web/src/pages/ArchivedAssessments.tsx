import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { AssessmentDto } from "../../../functions/src/types/models/assessments-dto";
import type { GetAssessmentsInput } from "../../../functions/src/types/zod/routes/assessments";
import type { GetAssessmentsOutput } from "../../../functions/src/types/assessments";
import { useCallable } from "../lib/firebase-hooks";
import { toUserMessage } from "../lib/errors";
import { useTranslation } from "../hooks/useTranslation";
import { useAssessmentArchive } from "../hooks/useAssessmentArchive";
import { ArchiveButton, ArchiveFeedback } from "../components/AssessmentArchive";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";

export default function ArchivedAssessments() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [getAssessments] = useCallable<GetAssessmentsInput, GetAssessmentsOutput>(
    "api/get-assessments",
  );
  const [assessments, setAssessments] = useState<AssessmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [visibleCount, setVisibleCount] = useState(20);
  const archive = useAssessmentArchive((id) => {
    setAssessments((items) => items.filter((item) => item.id !== id));
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void getAssessments({ archived: true })
      .then(({ data }) => {
        if (active)
          setAssessments(
            data.assessments.sort((a, b) =>
              b.createdAtIsoTimestamp.localeCompare(a.createdAtIsoTimestamp),
            ),
          );
      })
      .catch((err) => {
        if (active) setError(toUserMessage(err, t("archive.errorLoad")));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [getAssessments, t, reload]);

  return (
    <div className="p-4 sm:p-6">
      <PageHeader
        title={t("archive.title")}
        subtitle={t("archive.subtitle")}
        backTo="/"
        actions={
          <Button variant="secondary" onClick={() => navigate("/view-assessments")}>
            {t("archive.active")}
          </Button>
        }
      />
      <ArchiveFeedback error={archive.error} message={archive.message} />
      {loading ? (
        <p role="status" className="py-12 text-center">
          {t("common.loading")}
        </p>
      ) : error ? (
        <Alert kind="error">
          {error}{" "}
          <Button variant="secondary" onClick={() => setReload((value) => value + 1)}>
            {t("common.retry")}
          </Button>
        </Alert>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <h2 className="text-xl font-semibold">{t("archive.empty")}</h2>
          <p className="mt-2 text-gray-600">{t("archive.emptyBody")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assessments.slice(0, visibleCount).map((assessment) => (
            <div
              key={assessment.id}
              className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="min-w-0 space-y-1">
                <h2 className="text-lg font-semibold wrap-break-word">{assessment.name}</h2>
                <p className="text-sm text-gray-600 wrap-break-word">
                  {assessment.school} · {t("gradeAssessments.grade")} {assessment.grade} ·{" "}
                  {assessment.birthDate}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(assessment.createdAtIsoTimestamp).toLocaleString(
                    language === "zh-Hant" ? "zh-Hant" : "en-US",
                  )}
                </p>
                <p className="text-sm font-medium">
                  {t(
                    assessment.finished
                      ? "adminView.filter.finished"
                      : "adminView.filter.inProgress",
                  )}
                </p>
                {!assessment.finished && (
                  <p className="text-sm text-gray-600">
                    {t("adminView.section")} {assessment.currentSection + 1},{" "}
                    {t("adminView.question")} {assessment.currentQuestion + 1}
                  </p>
                )}
              </div>
              <ArchiveButton
                archived
                busy={archive.pendingId === assessment.id}
                disabled={archive.pendingId !== null}
                onClick={() => void archive.setArchived(assessment.id, assessment.name, false)}
              />
            </div>
          ))}
          {visibleCount < assessments.length && (
            <Button variant="secondary" onClick={() => setVisibleCount((value) => value + 20)}>
              {t("archive.loadMore")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
