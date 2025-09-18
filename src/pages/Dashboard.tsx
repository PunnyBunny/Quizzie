import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useSignOut } from "react-firebase-hooks/auth";
import { auth } from "../lib/firebase.ts";

function LogoutButton() {
  const navigate = useNavigate();
  const [signOut, loading, error] = useSignOut(auth);

  if (error) {
    alert("Error signing out: " + error.message);
    return;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={async () => {
          const success = await signOut();
          if (success) {
            navigate("/login");
          } else {
            alert("Failed to sign out");
          }
        }}
        disabled={loading}
        aria-busy={loading}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Signing out..." : "Log out"}
      </button>
    </div>
  );
}

export default function Dashboard() {
  return (
    <>
      <header className="bg-white shadow">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex items-center justify-between h-16">
            <div>
              <NavLink to="/" end>
                <span className="rounded px-1 py-1 hover:bg-gray-100 font-semibold text-lg">
                  Quizzie
                </span>
              </NavLink>
            </div>
            <div className="flex items-center gap-4">
              <NavLink to="/" end>
                <span className="rounded px-1 py-1 hover:bg-gray-100">Home</span>
              </NavLink>
              <LogoutButton />
            </div>
          </nav>
        </div>
      </header>
      <Outlet />
    </>
  );
}
