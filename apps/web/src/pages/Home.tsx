import { useNavigate } from "react-router-dom";

function AddIcon() {
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
        d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z"
      />
    </svg>
  );
}
function EyeIcon() {
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
        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
function PencilSquareIcon() {
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
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}
function ShieldIcon() {
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
        d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
      />
    </svg>
  );
}
// TODO: strip transcript
export default function Home() {
  const navigate = useNavigate();
  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-200 p-2">
              <AddIcon />
            </div>

            <div>
              <h2 className="text-2xl font-semibold">Start New Test</h2>
              <p className="text-gray-600">Begin assessment for a new student</p>
            </div>
          </div>

          <button
            onClick={() => window.open("/new-assessment", "_blank", "noopener,noreferrer")}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Start New Assessment
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-200 p-2">
              <EyeIcon />
            </div>

            <div>
              <h2 className="text-2xl font-semibold">View existing assessments</h2>
              <p className="text-gray-600">View unfinished assessments from previous sessions</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/view-assessments")}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            View Assessments
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-200 p-2">
              <PencilSquareIcon />
            </div>

            <div>
              <h2 className="text-2xl font-semibold">Grade finished assessments</h2>
              <p className="text-gray-600">
                View and grade finished assessments from previous sessions
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/grade-assessments")}
            className="bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800"
          >
            Grade Assessments
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-200 p-2">
              <ShieldIcon />
            </div>

            <div>
              <h2 className="text-2xl font-semibold">Admin Panel</h2>
              <p className="text-gray-600">Manage users, view all results, and override grades</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/admin")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Open Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
}
