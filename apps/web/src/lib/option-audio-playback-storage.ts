import type { GetOptionAudioPlaybackInput, GetOptionAudioPlaybackOutput } from "@vaca/contracts";
import { storageKeys } from "./storage-keys";

type PlayCounts = GetOptionAudioPlaybackOutput["counts"];

/** Restore valid counts immediately, even when the backend is unavailable. */
export function readOptionPlayCounts(question: GetOptionAudioPlaybackInput): PlayCounts {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(storageKeys.optionAudioPlays(question)) ?? "{}",
    );
    if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
    const entries: [string, number][] = [];
    for (const [option, count] of Object.entries(stored))
      if (typeof count === "number" && Number.isSafeInteger(count) && count >= 0)
        entries.push([option, count]);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function writeOptionPlayCounts(question: GetOptionAudioPlaybackInput, counts: PlayCounts) {
  try {
    localStorage.setItem(storageKeys.optionAudioPlays(question), JSON.stringify(counts));
  } catch {
    // The hook retains its in-memory allowance when browser storage is unavailable.
  }
}
