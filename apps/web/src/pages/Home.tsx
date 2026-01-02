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
    </div>
  );
}
