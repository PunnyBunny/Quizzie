import { useEffect, useState } from "react";
import { type User } from "firebase/auth";

export default function useIsAdmin(user: User | null | undefined) {
  // if user is null, then they are not logged in, so they are not an admin
  const [isAdmin, setIsAdmin] = useState<boolean | null>(user ? null : false);

  useEffect(() => {
    void user
      ?.getIdTokenResult()
      .then((token) => setIsAdmin((token.claims.isAdmin as boolean | undefined) ?? false));
  }, [user]);

  return { loading: isAdmin == null, isAdmin };
}
