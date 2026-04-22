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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="px-3 py-1.5 rounded-md text-sm font-medium bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {loading ? "Signing out..." : "Log out"}
      </button>
    </div>
  );
}

export default function DashboardLayout() {
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
