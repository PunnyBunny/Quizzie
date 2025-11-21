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

export default function Home() {
  return (
    <div className="p-6">
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
    </div>
  );
}
