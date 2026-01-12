import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";

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
  creatorEmail: string;
  finished: boolean;
}

interface AdminGetAssessmentsResponse {
  assessments: Assessment[];
}

export default function AdminViewAssessments() {
  const navigate = useNavigate();

  const [adminGetAssessments, loading, error] = useHttpsCallable<{}, AdminGetAssessmentsResponse>(
    functions,
    "api/admin/get-assessments",
  );

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [filterSchool, setFilterSchool] = useState<string>("all");
  const [filterCreator, setFilterCreator] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "school">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    void adminGetAssessments().then((response) => {
      if (response?.data?.assessments) {
        setAssessments(response.data.assessments);
      }
    });
  }, [adminGetAssessments]);

  // Get unique schools and creators for filters
  const schools = useMemo(() => {
    const uniqueSchools = new Set(assessments.map((a) => a.school));
    return Array.from(uniqueSchools).sort();
  }, [assessments]);

  const creators = useMemo(() => {
    const uniqueCreators = new Set(assessments.map((a) => a.creatorEmail));
    return Array.from(uniqueCreators).sort();
  }, [assessments]);

  // TODO: maybe use UI lib for the table
  // Filter and sort assessments
  const filteredAndSortedAssessments = useMemo(() => {
    let filtered = assessments;

    if (filterSchool !== "all") {
      filtered = filtered.filter((a) => a.school === filterSchool);
    }

    if (filterCreator !== "all") {
      filtered = filtered.filter((a) => a.creatorEmail === filterCreator);
    }

    return [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date":
          comparison =
            new Date(a.createdAtIsoTimestamp).getTime() -
            new Date(b.createdAtIsoTimestamp).getTime();
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "school":
          comparison = a.school.localeCompare(b.school);
          break;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  }, [assessments, filterSchool, filterCreator, sortBy, sortOrder]);

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

  const toggleSort = (field: "date" | "name" | "school") => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/admin")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <BackArrowIcon />
            </button>
            <div>
              <h1 className="text-3xl font-bold">Assessment Management</h1>
              <p className="text-gray-600 mt-1">
                View and grade all assessments across the platform
              </p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="text-sm text-blue-600 font-medium mb-1">Total Assessments</div>
            <div className="text-2xl font-bold text-gray-900">{assessments.length}</div>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-100">
            <div className="text-sm text-green-600 font-medium mb-1">Schools</div>
            <div className="text-2xl font-bold text-gray-900">{schools.length}</div>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-100">
            <div className="text-sm text-purple-600 font-medium mb-1">Creators</div>
            <div className="text-2xl font-bold text-gray-900">{creators.length}</div>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            {/* School Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by School
              </label>
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="all">All Schools</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            {/* Creator Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filter by Creator
              </label>
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="all">All Creators</option>
                {creators.map((creator) => (
                  <option key={creator} value={creator}>
                    {creator}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date" | "name" | "school")}
                className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
              >
                <option value="date">Date Created</option>
                <option value="name">Student Name</option>
                <option value="school">School</option>
              </select>
            </div>

            {/* Sort Order */}
            <div className="flex items-end">
              <button
                onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                {sortOrder === "asc" ? "↑ Ascending" : "↓ Descending"}
              </button>
            </div>
          </div>

          {/* Active Filters Display */}
          {(filterSchool !== "all" || filterCreator !== "all") && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {filterSchool !== "all" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  School: {filterSchool}
                  <button
                    onClick={() => setFilterSchool("all")}
                    className="ml-1 hover:text-blue-900"
                  >
                    ×
                  </button>
                </span>
              )}
              {filterCreator !== "all" && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                  Creator: {filterCreator}
                  <button
                    onClick={() => setFilterCreator("all")}
                    className="ml-1 hover:text-purple-900"
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setFilterSchool("all");
                  setFilterCreator("all");
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            </div>
          )}
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
        ) : filteredAndSortedAssessments.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <ClipboardCheckIcon />
              </div>
            </div>
            <h2 className="text-xl font-semibold text-gray-700 mt-4">No assessments found</h2>
            <p className="text-gray-500 mt-2">
              {assessments.length === 0
                ? "No completed assessments yet."
                : "No assessments match your current filters."}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("name")}
                    >
                      <div className="flex items-center gap-1">
                        Student Name
                        {sortBy === "name" && (
                          <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("school")}
                    >
                      <div className="flex items-center gap-1">
                        School
                        {sortBy === "school" && (
                          <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Grade</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Age</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Creator</th>
                    <th
                      className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleSort("date")}
                    >
                      <div className="flex items-center gap-1">
                        Date Created
                        {sortBy === "date" && (
                          <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSortedAssessments.map((assessment) => (
                    <tr
                      key={assessment.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/admin/grade/${assessment.id}`)}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900">{assessment.name}</td>
                      <td className="px-4 py-3 text-gray-600">{assessment.school}</td>
                      <td className="px-4 py-3 text-gray-600">Grade {assessment.grade}</td>
                      <td className="px-4 py-3 text-gray-600">{assessment.age}</td>
                      <td className="px-4 py-3 text-gray-600 text-sm">{assessment.creatorEmail}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {formatDate(assessment.createdAtIsoTimestamp)}
                      </td>
                      <td className="px-4 py-3">
                        {assessment.finished ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Finished
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            In Progress
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (assessment.finished) {
                              navigate(`/admin/grade/${assessment.id}`);
                            }
                          }}
                          disabled={!assessment.finished}
                          className={`px-3 py-1 text-sm rounded-md ${
                            assessment.finished
                              ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          }`}
                        >
                          Grade
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Results Summary */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Showing {filteredAndSortedAssessments.length} of {assessments.length} assessments
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
