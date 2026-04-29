import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../lib/firebase.ts";
import { toUserMessage } from "../lib/errors.ts";

function LogoutButton() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      alert(toUserMessage(err, "Failed to sign out."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 whitespace-nowrap"
    >
      {loading ? "Signing out..." : "Log out"}
    </button>
  );
}

export default function DashboardLayout() {
  return (
    <>
      <header className="bg-white shadow sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-3 sm:px-4">
          <nav className="flex items-center justify-between gap-3 h-14 sm:h-16">
            <NavLink to="/" end className="rounded px-1 py-1 hover:bg-gray-100 font-semibold text-base sm:text-lg">
              Quizzie
            </NavLink>
            <div className="flex items-center gap-2 sm:gap-4">
              <NavLink
                to="/"
                end
                className="rounded px-2 py-1 hover:bg-gray-100 text-sm sm:text-base"
              >
                Home
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
