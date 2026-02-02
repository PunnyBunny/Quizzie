import React, { useRef, useState } from "react";
import SimpleReactValidator from "simple-react-validator";
import useForceUpdate from "use-force-update";
import { useBrowserSupport } from "../providers/RecordingSessionProvider.tsx";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";

type Language = "cantonese" | "mandarin" | "english" | "other";
type Gender = "male" | "female";

interface LanguageEntry {
  language: Language;
  otherSpecify?: string;
}

function BrowserSupportCheck({ children }: { children: React.ReactNode }) {
  const browserSupport = useBrowserSupport();

  if (!browserSupport) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <h1 className="text-3xl mb-4">Browser Not Supported</h1>
        <p className="text-lg mb-4">
          Please use the latest versions of Chrome or Edge. Using a mobile browser is currently not
          supported.
        </p>
      </div>
    );
  }

  return children;
}

interface CreateAssessmentRequest {
  name: string;
  birthDate: string;
  gender: Gender;
  grade: string;
  school: string;
  motherTongue: LanguageEntry;
  otherLanguages: LanguageEntry[];
}

interface CreateAssessmentResponse {
  id: string;
}

export default function NewAssessment() {
  const [studentName, setStudentName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");
  const [motherTongue, setMotherTongue] = useState<LanguageEntry>({ language: "" as Language });
  const [motherTongueOther, setMotherTongueOther] = useState("");
  const [otherLanguages, setOtherLanguages] = useState<LanguageEntry[]>([]);

  const forceUpdate = useForceUpdate();

  const validator = useRef<SimpleReactValidator>(
    new SimpleReactValidator({
      autoForceUpdate: { forceUpdate },
      element: (message: string) => <p className="mt-1 text-xs text-red-600">{message}</p>,
    }),
  );

  const [createAssessmentFunc, , error] = useHttpsCallable<
    CreateAssessmentRequest,
    CreateAssessmentResponse
  >(functions, "api/create-assessment");

  const [submitting, setSubmitting] = useState(false);

  const formValid = validator.current.allValid(); // note: messages are only revealed on submit

  const submitForm = async (e: React.FormEvent) => {
    try {
      e.preventDefault();
      setSubmitting(true);
      if (!formValid) {
        validator.current.showMessages();
        return;
      }

      // Build mother tongue with otherSpecify if needed
      const finalMotherTongue: LanguageEntry = {
        language: motherTongue.language,
        ...(motherTongue.language === "other" && motherTongueOther
          ? { otherSpecify: motherTongueOther }
          : {}),
      };

      const response = await createAssessmentFunc({
        name: studentName,
        birthDate: `${birthYear}-${birthMonth.padStart(2, "0")}`,
        gender: gender as Gender,
        grade,
        school,
        motherTongue: finalMotherTongue,
        otherLanguages,
      });
      if (!response) {
        // TODO: handle error
        throw new Error("Failed to create assessment");
      }

      const { id: assessmentId } = response.data;

      console.log("Created new assessment. ID:", assessmentId);

      window.location.href = `/assessment/${assessmentId}/s/0/instruction`;
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BrowserSupportCheck>
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Student Information</h1>
            <p className="text-gray-600 mt-1">Please enter the student's details to begin</p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
              {error.message}
            </div>
          )}

          <div className="bg-white rounded-2xl shadow border border-gray-200">
            <form onSubmit={submitForm} noValidate className="p-6 md:p-8 flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Participant Details</h2>

              <div className="space-y-1">
                <label htmlFor="studentName" className="block text-sm font-medium text-gray-800">
                  Student Name (Surname & Initials) <span className="text-red-500">*</span>
                </label>
                <input
                  id="studentName"
                  type="text"
                  className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                    !validator.current.fieldValid("studentName")
                      ? "border-red-300"
                      : "border-gray-300"
                  }`}
                  placeholder="e.g., Chan TM for Chan Tai Man"
                  value={studentName}
                  onChange={(e) => {
                    setStudentName(e.target.value);
                  }}
                  autoComplete="name"
                />
                <span>
                  {validator.current.message("studentName", studentName, "required|min:2")}
                </span>
              </div>

              <div className="space-y-1">
                <label htmlFor="birthYear" className="block text-sm font-medium text-gray-800">
                  Birth Year & Month <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <select
                      id="birthYear"
                      className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                        !validator.current.fieldValid("birthYear")
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      value={birthYear}
                      onChange={(e) => setBirthYear(e.target.value)}
                    >
                      <option value="">Year</option>
                      {Array.from({ length: 30 }, (_, i) => new Date().getFullYear() - i).map(
                        (year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ),
                      )}
                    </select>
                    <span>{validator.current.message("birthYear", birthYear, "required")}</span>
                  </div>
                  <div className="flex-1">
                    <select
                      id="birthMonth"
                      className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                        !validator.current.fieldValid("birthMonth")
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      value={birthMonth}
                      onChange={(e) => setBirthMonth(e.target.value)}
                    >
                      <option value="">Month</option>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <option key={month} value={month}>
                          {month}
                        </option>
                      ))}
                    </select>
                    <span>{validator.current.message("birthMonth", birthMonth, "required")}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-800">
                  Gender <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="male"
                      checked={gender === "male"}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span>Male</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="gender"
                      value="female"
                      checked={gender === "female"}
                      onChange={(e) => setGender(e.target.value as Gender)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span>Female</span>
                  </label>
                </div>
                <span>{validator.current.message("gender", gender, "required")}</span>
              </div>

              <div className="space-y-1">
                <label htmlFor="grade" className="block text-sm font-medium text-gray-800">
                  Grade/Form <span className="text-red-500">*</span>
                </label>
                <select
                  id="grade"
                  className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                    !validator.current.fieldValid("grade") ? "border-red-300" : "border-gray-300"
                  }`}
                  value={grade}
                  onChange={(e) => {
                    setGrade(e.target.value);
                  }}
                >
                  <option value="">Select Grade</option>
                  {["S1", "S2", "S3", "S4", "S5", "S6"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <span>{validator.current.message("grade", grade, "required|min:1")}</span>
              </div>

              <div className="space-y-1">
                <label htmlFor="school" className="block text-sm font-medium text-gray-800">
                  School <span className="text-red-500">*</span>
                </label>
                <input
                  id="school"
                  type="text"
                  className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                    !validator.current.fieldValid("school") ? "border-red-300" : "border-gray-300"
                  }`}
                  placeholder="Enter school name"
                  value={school}
                  onChange={(e) => {
                    setSchool(e.target.value);
                  }}
                />
                <span>{validator.current.message("school", school, "required")}</span>
              </div>

              {/* Mother Tongue */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-800">
                  Mother Tongue <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2">
                  <select
                    className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                      !validator.current.fieldValid("motherTongue")
                        ? "border-red-300"
                        : "border-gray-300"
                    }`}
                    value={motherTongue.language}
                    onChange={(e) => {
                      setMotherTongue({ language: e.target.value as Language });
                      if (e.target.value !== "other") {
                        setMotherTongueOther("");
                      }
                    }}
                  >
                    <option value="">Please select</option>
                    <option value="cantonese">Cantonese</option>
                    <option value="mandarin">Mandarin</option>
                    <option value="english">English</option>
                    <option value="other">Other (please specify)</option>
                  </select>
                  <span>
                    {validator.current.message("motherTongue", motherTongue.language, "required")}
                  </span>
                  {motherTongue.language === "other" && (
                    <input
                      type="text"
                      className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                        motherTongue.language === "other" && !motherTongueOther
                          ? "border-red-300"
                          : "border-gray-300"
                      }`}
                      placeholder="Please specify mother tongue"
                      value={motherTongueOther}
                      onChange={(e) => setMotherTongueOther(e.target.value)}
                    />
                  )}
                </div>
              </div>

              {/* Other Capable Languages */}
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-800">
                  Other Capable Languages
                </label>
                <div className="flex flex-col gap-2">
                  {otherLanguages.map((entry, index) => (
                    <div key={index} className="flex gap-2 items-start">
                      <div className="flex-1 flex flex-col gap-2">
                        <select
                          className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                            !validator.current.fieldValid(`otherLanguage-${index}`)
                              ? "border-red-300"
                              : "border-gray-300"
                          }`}
                          value={entry.language}
                          onChange={(e) => {
                            const updated = [...otherLanguages];
                            updated[index] = { language: e.target.value as Language };
                            setOtherLanguages(updated);
                          }}
                        >
                          <option value="">Please select</option>
                          <option value="cantonese">Cantonese</option>
                          <option value="mandarin">Mandarin</option>
                          <option value="english">English</option>
                          <option value="other">Other (please specify)</option>
                        </select>
                        <span>
                          {validator.current.message(
                            `otherLanguage-${index}`,
                            entry.language,
                            "required",
                          )}
                        </span>
                        {entry.language === "other" && (
                          <input
                            type="text"
                            className="w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 border-gray-300"
                            placeholder="Please specify language"
                            value={entry.otherSpecify ?? ""}
                            onChange={(e) => {
                              const updated = [...otherLanguages];
                              updated[index] = { ...entry, otherSpecify: e.target.value };
                              setOtherLanguages(updated);
                            }}
                          />
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setOtherLanguages(otherLanguages.filter((_, i) => i !== index));
                        }}
                        className="px-3 py-2.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setOtherLanguages([...otherLanguages, { language: "" as Language }])
                    }
                    className="text-left text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                  >
                    + Add another language
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-gray-700 text-white py-3 text-base font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={submitting}
              >
                {!submitting ? "Start Assessment" : "Starting Assessment..."}
              </button>
            </form>
          </div>
        </div>
      </div>
    </BrowserSupportCheck>
  );
}
