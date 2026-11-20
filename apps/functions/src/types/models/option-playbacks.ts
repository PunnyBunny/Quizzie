import type { QuestionSectionDto, UpdateOptionAudioPlaybackInput } from "@vaca/contracts";
import { admin, FieldValue } from "../../firebase";
import type { StudentResponseDoc } from "./student-responses";
import { getOptionPlayCounts, getStudentResponseSnapshot } from "./student-responses";

export const DEFAULT_MAX_OPTION_PLAYS = 2;

/**
 * Build a response update with an empty UUID list for each option of one question.
 * Example: { optionPlaybackIds: { "0": { A: [], B: [] } } }.
 * McOptions creates a UUID after audio starts; this helper builds the empty lists.
 * An absent optionAudios entry leaves legacy questions without playback tracking.
 */
export function initialOptionPlaybackIds(config: QuestionSectionDto, question: number) {
  if (!config.optionAudios?.[question]) return {};
  return {
    optionPlaybackIds: {
      [question]: Object.fromEntries(
        Object.keys(config.choices?.[question] ?? {}).map((key) => [key, [] as string[]]),
      ),
    },
  };
}

/**
 * Record a successful start after playback begins. The UUID deduplicates background
 * save retries; the frontend owns the play limit. Late saves retain submitted answers.
 */
export async function updateOptionAudioPlayback(
  input: UpdateOptionAudioPlaybackInput,
  config: QuestionSectionDto,
) {
  const { assessmentId, section, question, optionKey, playbackId } = input;
  const maxPlays = config.maxOptionPlays ?? DEFAULT_MAX_OPTION_PLAYS;
  return admin.firestore().runTransaction(async (transaction) => {
    const current = await getStudentResponseSnapshot(transaction, assessmentId, section);
    const response = current.data();
    const options =
      response?.optionPlaybackIds?.[question] ??
      initialOptionPlaybackIds(config, question).optionPlaybackIds?.[question] ??
      {};
    const ids = new Set(
      Object.prototype.hasOwnProperty.call(options, optionKey) ? options[optionKey] : [],
    );
    ids.add(playbackId);

    const base = {
      "assessment-id": assessmentId,
      section,
      createdAt: FieldValue.serverTimestamp(),
    };
    const next: StudentResponseDoc =
      response ??
      (config.kind === "mc"
        ? { ...base, type: "mc", studentResponses: {} }
        : { ...base, type: "audio_mc", files: {}, transcripts: {}, attempts: {} });
    next.optionPlaybackIds = {
      ...next.optionPlaybackIds,
      [question]: { ...options, [optionKey]: [...ids] },
    };
    next.updatedAt = FieldValue.serverTimestamp();
    transaction.set(current.ref, next);
    return { counts: getOptionPlayCounts(next)[question], maxPlays };
  });
}
