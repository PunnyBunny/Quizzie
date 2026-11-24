import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { DebugContext } from "../hooks/useDebugMode";
import { storageKeys } from "../lib/storage-keys";

export function DebugProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading, error, isAdmin } = useAuth();
  const authorized = !!user && !loading && !error && isAdmin === true;
  const debug = new URLSearchParams(location.search).get("debug");
  const [rememberedDebug, setRememberedDebug] = useState(() => {
    try {
      return window.sessionStorage.getItem(storageKeys.debug) === "1";
    } catch {
      return false;
    }
  });
  const preference = debug === "1" || (debug !== "0" && rememberedDebug);

  useEffect(() => {
    if (loading && !error) {
      // Preserve a flag across redirects while verifying, without exposing debug UI.
      if (debug === "1" || debug === "0") setRememberedDebug(debug === "1");
      return;
    }
    if (!authorized) {
      setRememberedDebug(false);
      try {
        window.sessionStorage.removeItem(storageKeys.debug);
      } catch {
        // The preference is still cleared in memory.
      }
      const params = new URLSearchParams(location.search);
      if (params.has("debug")) {
        params.delete("debug");
        const state: unknown = location.state;
        navigate(
          { pathname: location.pathname, search: params.toString(), hash: location.hash },
          { replace: true, state },
        );
      }
      return;
    }
    setRememberedDebug(preference);
    try {
      window.sessionStorage.setItem(storageKeys.debug, preference ? "1" : "0");
    } catch {
      // Keep the in-memory preference when browser storage is unavailable.
    }
  }, [authorized, debug, error, loading, location, navigate, preference]);

  return <DebugContext.Provider value={authorized && preference}>{children}</DebugContext.Provider>;
}
