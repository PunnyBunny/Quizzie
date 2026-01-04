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

function ClipboardCheckIcon() {
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
        d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75"
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
interface GetAssessmentsRequest {
  finished: boolean;
}
interface GetAssessmentsResponse {
  assessments: Assessment[];
}

export default function GradeAssessments() {
  const navigate = useNavigate();

  const [getAssessments, loading, error] = useHttpsCallable<
    GetAssessmentsRequest,
    GetAssessmentsResponse
  >(functions, "api/get-assessments");

  const [assessments, setAssessments] = useState<Assessment[]>([]);

  useEffect(() => {
    void getAssessments({ finished: true }).then((response) => {
      if (response?.data?.assessments) {
        setAssessments(response.data.assessments);
      }
    });
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
              <h1 className="text-3xl font-bold">Completed Assessments</h1>
              <p className="text-gray-600 mt-1">View and grade completed assessments</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg mb-6">
            Error loading assessments: {error.message}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="text-gray-500">Loading assessments...</div>
          </div>
        ) : assessments.length === 0 ? (
          <div className="text-center py-12">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <ClipboardCheckIcon />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mt-4">No completed assessments</h2>
            <p className="text-gray-500 mt-2">
              Completed assessments will appear here for grading.
            </p>
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
                        {assessment.school} • Grade {assessment.grade} • Age {assessment.age}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">
                      {formatDate(assessment.createdAtIsoTimestamp)}
                    </p>
                    <button
                      className="mt-2 px-4 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/grade/${assessment.id}`);
                      }}
                    >
                      Grade
                    </button>
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
