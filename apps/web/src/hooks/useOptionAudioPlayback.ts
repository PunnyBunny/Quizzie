import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GetOptionAudioPlaybackInput, UpdateOptionAudioPlaybackInput } from "@vaca/contracts";
import { useCallable } from "../lib/firebase-hooks";
import { readOptionPlayCounts, writeOptionPlayCounts } from "../lib/option-audio-playback-storage";

/** Owns one question's local allowance and background saves. Playback never waits for it. */
export function useOptionAudioPlayback({
  assessmentId,
  section,
  question,
}: GetOptionAudioPlaybackInput) {
  const address = useMemo(
    () => ({ assessmentId, section, question }),
    [assessmentId, section, question],
  );
  const [getPlayback] = useCallable("api/get-option-audio-playback");
  const [savePlayback] = useCallable("api/update-option-audio-playback");
  const [counts, setCounts] = useState(() => readOptionPlayCounts(address));
  const [error, setError] = useState(false);
  const countsRef = useRef(counts);
  const active = useRef(true);
  const unsavedPlays = useRef(new Map<string, UpdateOptionAudioPlaybackInput>());

  const mergeCounts = useCallback(
    (incoming: Record<string, number>) => {
      const merged = new Map(Object.entries(countsRef.current));
      for (const [key, count] of Object.entries(incoming))
        merged.set(key, Math.max(merged.get(key) ?? 0, count));
      const next = Object.fromEntries(merged);
      countsRef.current = next;
      writeOptionPlayCounts(address, next);
      if (active.current) setCounts(next);
    },
    [address],
  );

  const savePlay = useCallback(
    async (input: UpdateOptionAudioPlaybackInput) => {
      try {
        const { data } = await savePlayback(input);
        unsavedPlays.current.delete(input.playbackId);
        mergeCounts(data.counts);
        if (active.current && unsavedPlays.current.size === 0) setError(false);
      } catch {
        if (active.current) setError(true);
      }
    },
    [savePlayback, mergeCounts],
  );

  const refreshCounts = useCallback(async () => {
    try {
      const { data } = await getPlayback(address);
      mergeCounts(data.counts);
      if (active.current && unsavedPlays.current.size === 0) setError(false);
    } catch {
      if (active.current) setError(true);
    }
  }, [address, getPlayback, mergeCounts]);

  useEffect(() => {
    active.current = true;
    void refreshCounts();
    return () => {
      active.current = false;
    };
  }, [refreshCounts]);

  function recordPlay(optionKey: string) {
    const count = Object.hasOwn(countsRef.current, optionKey) ? countsRef.current[optionKey] : 0;
    mergeCounts({ [optionKey]: count + 1 });
    const input = { ...address, optionKey, playbackId: crypto.randomUUID() };
    unsavedPlays.current.set(input.playbackId, input);
    void savePlay(input);
  }

  function retry() {
    void refreshCounts();
    for (const input of unsavedPlays.current.values()) void savePlay(input);
  }

  return { counts, error, recordPlay, retry };
}
