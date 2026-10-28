import { ArchiveButton, ArchiveFeedback } from "../components/AssessmentArchive";
import { useAssessmentArchive } from "../hooks/useAssessmentArchive";
import { useNavigate } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { useEffect, useState } from "react";
import ScoreModal from "../components/ScoreModal";
import { PageHeader } from "../components/PageHeader";
import { Button } from "@/components/ui/button";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { ClipboardCheckIcon } from "../components/icons";
import { useTranslation } from "../hooks/useTranslation";

import type { AssessmentDto } from "../../../functions/src/types/models/assessments-dto";
import type { GetAssessmentsInput } from "../../../functions/src/types/zod/routes/assessments";
import type { GetAssessmentsOutput } from "../../../functions/src/types/assessments";

export default function GradeAssessments() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [getAssessments, loading] = useCallable<GetAssessmentsInput, GetAssessmentsOutput>(
    "api/get-assessments",
  );

  const [assessments, setAssessments] = useState<AssessmentDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const archive = useAssessmentArchive((id) => {
    setAssessments((items) => items.filter((item) => item.id !== id));
  });

  useEffect(() => {
    let active = true;
    setError(null);
    void getAssessments({ finished: true, archived: false })
      .then((response) => {
        if (active) setAssessments(response.data.assessments);
      })
      .catch((err) => {
        if (active) setError(toUserMessage(err, t("gradeAssessments.errorLoad")));
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
          title={t("gradeAssessments.title")}
          subtitle={t("gradeAssessments.subtitle")}
          actions={
            <Button variant="outline" onClick={() => navigate("/archived-assessments")}>
              {t("archive.title")}
            </Button>
          }
          backTo="/"
        />

        <ArchiveFeedback error={archive.error} message={archive.message} />

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
            <AlertAction>
              <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
                {t("common.retry")}
              </Button>
            </AlertAction>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">{t("gradeAssessments.loading")}</div>
          </div>
        ) : error ? null : assessments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <ClipboardCheckIcon />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mt-4">
              {t("gradeAssessments.empty.title")}
            </h2>
            <p className="text-gray-500 mt-2">{t("gradeAssessments.empty.body")}</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex items-start gap-3 sm:gap-4 min-w-0 flex-1">
                    <div className="p-2 bg-green-100 rounded-lg shrink-0">
                      <ClipboardCheckIcon />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-base sm:text-lg wrap-break-word">
                        {assessment.name}
                      </h3>
                      <p className="text-gray-500 text-sm wrap-break-word">
                        {assessment.school} • {t("gradeAssessments.grade")} {assessment.grade} •{" "}
                        {t("gradeAssessments.born")} {assessment.birthDate}
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right flex flex-col sm:items-end gap-2 sm:shrink-0">
                    <p className="text-xs sm:text-sm text-gray-500">
                      {formatDate(assessment.createdAtIsoTimestamp)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <ArchiveButton
                        busy={archive.pendingId === assessment.id}
                        disabled={archive.pendingId !== null}
                        onClick={() =>
                          void archive.setArchived(assessment.id, assessment.name, true)
                        }
                      />
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/grade/${assessment.id}`);
                        }}
                      >
                        {t("adminView.action.grade")}
                      </Button>
                      <ScoreModal
                        assessmentId={assessment.id}
                        trigger={
                          <Button size="sm" variant="secondary">
                            {t("gradeAssessments.score")}
                          </Button>
                        }
                        onGoToGrading={() => navigate(`/grade/${assessment.id}`)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
