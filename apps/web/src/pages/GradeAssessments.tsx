import { useNavigate } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { useEffect, useState } from "react";
import ScoreModal from "../components/ScoreModal";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ClipboardCheckIcon } from "../components/icons";
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
  currentSection: number;
  currentQuestion: number;
}
interface GetAssessmentsRequest {
  finished: boolean;
}
interface GetAssessmentsResponse {
  assessments: Assessment[];
}

export default function GradeAssessments() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const [getAssessments, loading] = useCallable<GetAssessmentsRequest, GetAssessmentsResponse>(
    "api/get-assessments",
  );

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [scoreModalId, setScoreModalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAssessments({ finished: true })
      .then((response) => setAssessments(response.data.assessments))
      .catch((err) => setError(toUserMessage(err, t("gradeAssessments.errorLoad"))));
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
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={t("gradeAssessments.title")}
          subtitle={t("gradeAssessments.subtitle")}
          backTo="/"
        />

        {error && (
          <Alert kind="error" className="mb-6">
            {error}
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">{t("gradeAssessments.loading")}</div>
          </div>
        ) : assessments.length === 0 ? (
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
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/grade/${assessment.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <ClipboardCheckIcon />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{assessment.name}</h3>
                      <p className="text-gray-500 text-sm">
                        {assessment.school} • {t("gradeAssessments.grade")} {assessment.grade} •{" "}
                        {t("gradeAssessments.born")} {assessment.birthDate}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {formatDate(assessment.createdAtIsoTimestamp)}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/grade/${assessment.id}`);
                        }}
                      >
                        {t("adminView.action.grade")}
                      </Button>
                      <Button
                        size="sm"
                        variant="muted"
                        onClick={(e) => {
                          e.stopPropagation();
                          setScoreModalId(assessment.id);
                        }}
                      >
                        {t("gradeAssessments.score")}
                      </Button>
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
