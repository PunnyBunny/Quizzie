import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../lib/firebase.ts";
import useIsAdmin from "./useIsAdmin.tsx";

/**
 * Hook for managing Firebase authentication and admin status.
 *
 * @returns
 *   * user - undefined=loading, null=not logged in
 *   * loading - Loading auth state or checking admin status
 *   * error
 *   * isAdmin - Whether user is an admin
 */
export default function useAuth() {
  const [user, loading, error] = useAuthState(auth);
  const { loading: isAdminLoading, isAdmin } = useIsAdmin(user);

  return { user, loading: loading || isAdminLoading, error, isAdmin };
}
