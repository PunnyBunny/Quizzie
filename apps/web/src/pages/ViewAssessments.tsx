import { useNavigate } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { useEffect, useState } from "react";
import ScoreModal from "../components/ScoreModal";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import { ClipboardIcon } from "../components/icons";

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

export default function ViewAssessments() {
  const navigate = useNavigate();

  const [getAssessments, loading] = useCallable<GetAssessmentsRequest, GetAssessmentsResponse>(
    "api/get-assessments",
  );

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [scoreModalId, setScoreModalId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getAssessments({ finished: false })
      .then((response) => setAssessments(response.data.assessments))
      .catch((err) => setError(toUserMessage(err, "Could not load assessments.")));
  }, [getAssessments]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
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
          title="Unfinished Assessments"
          subtitle="Continue assessments from previous sessions"
          backTo="/"
        />

        {error && (
          <Alert kind="error" className="mb-4">
            <p className="font-medium">Error loading assessments</p>
            <p className="text-sm mt-1">{error}</p>
          </Alert>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="p-8 text-center">
              <div className="rounded-xl bg-gray-100 p-4 w-fit mx-auto mb-4">
                <ClipboardIcon />
              </div>
              <h2 className="text-xl font-semibold mb-2">No unfinished assessments</h2>
              <p className="text-gray-600 mb-6">
                All assessments have been completed. Start a new assessment to begin.
              </p>
              <Button variant="dark" onClick={() => navigate("/")}>
                Go to Home
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {assessments.map((assessment) => (
              <div
                key={assessment.id}
                className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden hover:border-gray-300 transition-colors"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4 flex-1">
                      <div className="rounded-xl bg-gray-100 p-3 h-fit">
                        <ClipboardIcon />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold mb-1">{assessment.name}</h3>
                        <div className="text-sm text-gray-600 space-y-1">
                          <p>
                            <span className="font-medium">Birth Date:</span>{" "}
                            {assessment.birthDate}
                          </p>
                          <p>
                            <span className="font-medium">Grade:</span> {assessment.grade}
                          </p>
                          <p>
                            <span className="font-medium">School:</span> {assessment.school}
                          </p>
                          <p>
                            <span className="font-medium">Started:</span>{" "}
                            {formatDate(assessment.createdAtIsoTimestamp)}
                          </p>
                          {assessment.currentSection !== undefined && (
                            <p>
                              <span className="font-medium">Progress:</span> Section{" "}
                              {assessment.currentSection + 1}
                              {assessment.currentQuestion !== undefined &&
                                `, Question ${assessment.currentQuestion + 1}`}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        variant="dark"
                        className="whitespace-nowrap"
                        onClick={() =>
                          window.open(
                            `/assessment/${assessment.id}/s/${assessment.currentSection}/q/${assessment.currentQuestion}`,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                      >
                        Continue Assessment
                      </Button>
                      <Button
                        variant="muted"
                        className="whitespace-nowrap"
                        onClick={() => setScoreModalId(assessment.id)}
                      >
                        View Score
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
