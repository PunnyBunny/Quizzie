import { useCallback, useEffect, useMemo, useState } from "react";
import { httpsCallable, type HttpsCallableResult } from "firebase/functions";
import { onAuthStateChanged, type Auth, type User } from "firebase/auth";
import { functions } from "./firebase";

export type CallableHook<Input, Output> = readonly [
  (data?: Input) => Promise<HttpsCallableResult<Output>>,
  boolean,
];

/**
 * Wraps a Firebase callable function. The returned `call` throws on error,
 * so callers can use plain try/catch and surface messages via `toUserMessage`.
 */
export function useCallable<Input = void, Output = void>(
  name: string,
): CallableHook<Input, Output> {
  const fn = useMemo(() => httpsCallable<Input, Output>(functions, name), [name]);
  const [loading, setLoading] = useState(false);

  const call = useCallback(
    async (data?: Input): Promise<HttpsCallableResult<Output>> => {
      setLoading(true);
      try {
        return await fn(data as Input);
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  return [call, loading] as const;
}

export type AuthStateHook = readonly [User | null, boolean, Error | undefined];

/** Subscribes to Firebase auth state; loading is true until the first callback fires. */
export function useAuthState(auth: Auth): AuthStateHook {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(
      auth,
      (u) => {
        setUser(u);
        setError(undefined);
      },
      (err) => setError(err),
    );
    return unsub;
  }, [auth]);

  return [user ?? null, user === undefined, error] as const;
}
