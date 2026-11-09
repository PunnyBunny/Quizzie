import type { GetOptionAudioPlaybackInput } from "@vaca/contracts";

// Preserve the namespace used by existing browser preferences and playback counts.
const STORAGE_NAMESPACE = "quizzie";

export const storageKeys = {
  language: `${STORAGE_NAMESPACE}.language`,
  optionAudioPlays: ({ assessmentId, section, question }: GetOptionAudioPlaybackInput) =>
    `${STORAGE_NAMESPACE}.optionAudioPlays:${JSON.stringify([assessmentId, section, question])}`,
} as const;
