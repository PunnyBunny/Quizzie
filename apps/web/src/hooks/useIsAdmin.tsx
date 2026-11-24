import { useEffect, useState } from "react";
import type { User } from "firebase/auth";

export default function useIsAdmin(user: User | null | undefined) {
  const [result, setResult] = useState<{ user: User; isAdmin: boolean } | null>(null);

  useEffect(() => {
    let active = true;
    setResult(null);
    if (user) {
      void user.getIdTokenResult().then(
        (token) => {
          if (active) setResult({ user, isAdmin: token.claims.isAdmin === true });
        },
        () => {
          if (active) setResult({ user, isAdmin: false });
        },
      );
    }
    return () => {
      active = false;
    };
  }, [user]);

  return {
    loading: !!user && result?.user !== user,
    isAdmin: !!user && result?.user === user && result.isAdmin,
  };
}
