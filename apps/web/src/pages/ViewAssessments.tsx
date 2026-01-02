import { useNavigate } from "react-router-dom";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";
import { useEffect, useState } from "react";

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

function ClipboardIcon() {
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
        d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z"
      />
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
  currentSection: number;
  currentQuestion: number;
}

interface GetUnfinishedAssessmentsResponse {
  assessments: Assessment[];
}

export default function ViewAssessments() {
  const navigate = useNavigate();

  const [getUnfinishedAssessments, loading, error] = useHttpsCallable<
    void,
    GetUnfinishedAssessmentsResponse
  >(functions, "api/get-unfinished-assessments");

  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    void getUnfinishedAssessments().then((response) => {
      if (response?.data?.assessments) {
        setAssessments(response.data.assessments);
      }
    });
  }, [getUnfinishedAssessments]);

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
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <BackArrowIcon />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Unfinished Assessments</h1>
              <p className="text-gray-600 mt-1">Continue assessments from previous sessions</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-4 py-3">
            <p className="font-medium">Error loading assessments</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
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
              <button
                onClick={() => navigate("/")}
                className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800"
              >
                Go to Home
              </button>
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
                            <span className="font-medium">Age:</span> {assessment.age} years
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
                      <button
                        onClick={() =>
                          window.open(
                            `/assessment/${assessment.id}/s/${assessment.currentSection}/q/${assessment.currentQuestion}`,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 whitespace-nowrap"
                      >
                        Continue Assessment
                      </button>
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
