import { useEffect, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../lib/firebase.ts";

const cache = new Map<string, Promise<string>>();

function fetchUrl(path: string): Promise<string> {
  let p = cache.get(path);
  if (!p) {
    p = getDownloadURL(storageRef(storage, path)).catch((err) => {
      cache.delete(path);
      throw err;
    });
    cache.set(path, p);
  }
  return p;
}

export interface StorageUrlState {
  url: string | null;
  loading: boolean;
  error: Error | null;
}

export function useStorageUrl(path: string | null | undefined): StorageUrlState {
  const [state, setState] = useState<StorageUrlState>(() => ({
    url: null,
    loading: !!path,
    error: null,
  }));

  useEffect(() => {
    if (!path) {
      setState({ url: null, loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState({ url: null, loading: true, error: null });
    fetchUrl(path)
      .then((url) => {
        if (!cancelled) setState({ url, loading: false, error: null });
      })
      .catch((err: Error) => {
        if (!cancelled) setState({ url: null, loading: false, error: err });
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  return state;
}

export function invalidateStorageUrl(path: string) {
  cache.delete(path);
}
