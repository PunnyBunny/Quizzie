import React, { useRef, useState } from "react";
import SimpleReactValidator from "simple-react-validator";
import useForceUpdate from "use-force-update";

export default function NewAssessment() {
  const [studentName, setStudentName] = useState("");
  const [age, setAge] = useState("");
  const [grade, setGrade] = useState("");
  const [school, setSchool] = useState("");

  const forceUpdate = useForceUpdate();

  const validator = useRef<SimpleReactValidator>(
    new SimpleReactValidator({
      autoForceUpdate: { forceUpdate },
      element: (message: string) => <p className="mt-1 text-xs text-red-600">{message}</p>,
    }),
  );

  const formValid = validator.current.allValid(); // note: messages are only revealed on submit

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValid) {
      validator.current.showMessages();
      return;
    }
    window.location.href = `/assessment?name=${encodeURIComponent(studentName)}&age=${encodeURIComponent(age)}&grade=${encodeURIComponent(grade)}&school=${encodeURIComponent(school)}`;
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Student Information</h1>
          <p className="text-gray-600 mt-1">Please enter the student's details to begin</p>
        </div>

        <div className="bg-white rounded-2xl shadow border border-gray-200">
          <form onSubmit={submitForm} noValidate className="p-6 md:p-8 flex flex-col gap-4">
            <h2 className="text-lg font-semibold">Participant Details</h2>

            <div className="space-y-1">
              <label htmlFor="studentName" className="block text-sm font-medium text-gray-800">
                Student Name <span className="text-red-500">*</span>
              </label>
              <input
                id="studentName"
                type="text"
                className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                  !validator.current.fieldValid("studentName")
                    ? "border-red-300"
                    : "border-gray-300"
                }`}
                placeholder="Enter student's full name"
                value={studentName}
                onChange={(e) => {
                  setStudentName(e.target.value);
                }}
                autoComplete="name"
              />
              <span>{validator.current.message("studentName", studentName, "required|min:2")}</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="age" className="block text-sm font-medium text-gray-800">
                Age <span className="text-red-500">*</span>
              </label>
              <input
                id="age"
                type="number"
                inputMode="numeric"
                className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                  !validator.current.fieldValid("age") ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="Enter age"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value);
                }}
                min={1}
              />
              <span>{validator.current.message("age", age, "required|numeric|min:1,num")}</span>
            </div>

            <div className="space-y-1">
              <label htmlFor="grade" className="block text-sm font-medium text-gray-800">
                Grade/Form <span className="text-red-500">*</span>
              </label>
              <input
                id="grade"
                type="text"
                className={`w-full rounded-lg border bg-gray-50 px-4 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 ${
                  !validator.current.fieldValid("grade") ? "border-red-300" : "border-gray-300"
                }`}
                placeholder="e.g., Form 1, Form 3, Form 5"
                value={grade}
                onChange={(e) => {
                  setGrade(e.target.value);
                }}
              />
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

            <button
              type="submit"
              className="w-full rounded-lg bg-gray-700 text-white py-3 text-base font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Assessment
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
