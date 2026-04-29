import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Alert } from "../components/Alert";
import {
  ArrowDownIcon,
  ArrowsUpDownIcon,
  ArrowUpIcon,
  ClipboardCheckIcon,
} from "../components/icons";

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
  creatorEmail: string;
  currentSection: number;
  currentQuestion: number;
  finished: boolean;
}

interface AdminGetAssessmentsResponse {
  assessments: Assessment[];
}

const SELECT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500 shadow-sm";

function SortGlyph({ active, order }: { active: boolean; order: "asc" | "desc" }) {
  if (!active) return <ArrowsUpDownIcon className="w-3.5 h-3.5 text-gray-300" />;
  const Icon = order === "asc" ? ArrowUpIcon : ArrowDownIcon;
  return <Icon className="w-3.5 h-3.5 text-gray-700" />;
}

export default function AdminViewAssessments() {
  const navigate = useNavigate();

  const [adminGetAssessments, loading] = useCallable<{}, AdminGetAssessmentsResponse>(
    "api/admin/get-assessments",
  );

  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filterSchool, setFilterSchool] = useState<string>("all");
  const [filterCreator, setFilterCreator] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "finished" | "in-progress">("all");
  const [sortBy, setSortBy] = useState<"date" | "name" | "school">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    void adminGetAssessments()
      .then((response) => {
        setAssessments(response.data.assessments);
        setError(null);
      })
      .catch((err) => {
        setError(toUserMessage(err, "Could not load assessments."));
      });
  }, [adminGetAssessments]);

  const schools = useMemo(() => {
    const uniqueSchools = new Set(assessments.map((a) => a.school));
    return Array.from(uniqueSchools).sort();
  }, [assessments]);

  const creators = useMemo(() => {
    const uniqueCreators = new Set(assessments.map((a) => a.creatorEmail));
    return Array.from(uniqueCreators).sort();
  }, [assessments]);

  const filteredAndSortedAssessments = useMemo(() => {
    let filtered = assessments;

    if (filterSchool !== "all") {
      filtered = filtered.filter((a) => a.school === filterSchool);
    }

    if (filterCreator !== "all") {
      filtered = filtered.filter((a) => a.creatorEmail === filterCreator);
    }

    if (filterStatus !== "all") {
      filtered = filtered.filter((a) =>
        filterStatus === "finished" ? a.finished : !a.finished,
      );
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
  }, [assessments, filterSchool, filterCreator, filterStatus, sortBy, sortOrder]);

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
    <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title="Assessment Management"
          subtitle="View and grade all assessments across the platform"
          backTo="/admin"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
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

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4 sm:mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Filters</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">School</label>
              <select
                value={filterSchool}
                onChange={(e) => setFilterSchool(e.target.value)}
                className={SELECT_CLASSES}
              >
                <option value="all">All Schools</option>
                {schools.map((school) => (
                  <option key={school} value={school}>
                    {school}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Creator</label>
              <select
                value={filterCreator}
                onChange={(e) => setFilterCreator(e.target.value)}
                className={SELECT_CLASSES}
              >
                <option value="all">All Creators</option>
                {creators.map((creator) => (
                  <option key={creator} value={creator}>
                    {creator}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-w-0">
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as "all" | "finished" | "in-progress")
                }
                className={SELECT_CLASSES}
              >
                <option value="all">All Statuses</option>
                <option value="finished">Finished</option>
                <option value="in-progress">In Progress</option>
              </select>
            </div>
          </div>

          {(filterSchool !== "all" || filterCreator !== "all" || filterStatus !== "all") && (
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
              {filterStatus !== "all" && (
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    filterStatus === "finished"
                      ? "bg-green-100 text-green-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  Status: {filterStatus === "finished" ? "Finished" : "In Progress"}
                  <button
                    onClick={() => setFilterStatus("all")}
                    className={`ml-1 ${
                      filterStatus === "finished" ? "hover:text-green-900" : "hover:text-amber-900"
                    }`}
                  >
                    ×
                  </button>
                </span>
              )}
              <button
                onClick={() => {
                  setFilterSchool("all");
                  setFilterCreator("all");
                  setFilterStatus("all");
                }}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {error && (
          <Alert kind="error" className="mb-6">
            {error}
          </Alert>
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
                  <tr className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th
                      className="px-4 py-3 text-left cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleSort("name")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Student
                        <SortGlyph active={sortBy === "name"} order={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">Birth Date</th>
                    <th className="px-4 py-3 text-left">Creator</th>
                    <th
                      className="px-4 py-3 text-left cursor-pointer select-none hover:bg-gray-100"
                      onClick={() => toggleSort("date")}
                    >
                      <span className="inline-flex items-center gap-1">
                        Created
                        <SortGlyph active={sortBy === "date"} order={sortOrder} />
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredAndSortedAssessments.map((assessment) => (
                    <tr key={assessment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{assessment.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {assessment.school} · Grade {assessment.grade}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {assessment.birthDate}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <span
                          className="block max-w-[180px] truncate"
                          title={assessment.creatorEmail}
                        >
                          {assessment.creatorEmail}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(assessment.createdAtIsoTimestamp)}
                      </td>
                      <td className="px-4 py-3">
                        {assessment.finished ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Finished
                          </span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 w-fit">
                              In Progress
                            </span>
                            <span className="text-xs text-gray-500">
                              Section {assessment.currentSection + 1}, Question{" "}
                              {assessment.currentQuestion + 1}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Button
                          size="sm"
                          variant={assessment.finished ? "primary" : "secondary"}
                          onClick={() => navigate(`/admin/grade/${assessment.id}`)}
                        >
                          {assessment.finished ? "Grade" : "View"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
              Showing {filteredAndSortedAssessments.length} of {assessments.length} assessments
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
