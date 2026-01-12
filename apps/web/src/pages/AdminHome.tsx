import { useNavigate } from "react-router-dom";

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

function ChartBarIcon() {
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
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.5"
      stroke="currentColor"
      className="size-6"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

export default function AdminHome() {
  const navigate = useNavigate();
  return (
    <div className="p-6 flex flex-col gap-6">
      <div className="flex items-center gap-6">
        <button
          onClick={() => navigate("/")}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <BackArrowIcon />
        </button>
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p>See or grade all assessments and manage users.</p>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-200 p-2">
              <ChartBarIcon />
            </div>

            <div>
              <h2 className="text-2xl font-semibold">Assessment Management</h2>
              <p className="text-gray-600">
                View, filter, and grade all assessments across the platform
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate("/admin/assessments")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Manage Assessments
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gray-200 p-2">
              <UsersIcon />
            </div>

            <div>
              <h2 className="text-2xl font-semibold">User Management</h2>
              <p className="text-gray-600">Manage users, reset passwords, and add new users</p>
            </div>
          </div>

          <button
            onClick={() => navigate("/admin/users")}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Manage Users
          </button>
        </div>
      </div>
    </div>
  );
}
