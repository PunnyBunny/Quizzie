import { useEffect, useMemo, useRef, useState } from "react";
import type { GetAssessmentStudentResponsesOutput } from "@vaca/contracts";
import { useCallable } from "../lib/firebase-hooks";

type Recording = { status: "ready"; url: string } | { status: "failed" };

/**
 * Downloads recordings for the selected section and makes each one available as it finishes.
 * Successful downloads are cached as blob URLs for reuse across sections and retries.
 * Results from previous loads are ignored, but their downloads can finish in the background.
 * The cache belongs to one assessment page; unmounting releases all cached URLs.
 */
export function useGradingAudio(
  assessmentId: string,
  data: GetAssessmentStudentResponsesOutput | null,
  sectionIndex: number,
) {
  const [getResponses] = useCallable("api/get-assessment-student-responses");
  const [recordings, setRecordings] = useState<Record<string, Recording | undefined>>({});
  const [attempt, setAttempt] = useState(0);
  const cache = useRef(new Map<string, string>());
  const questions = useMemo(() => {
    const section = data?.sections[sectionIndex];
    const answers = data?.studentResponsesBySection[sectionIndex];
    if (!section || section.kind === "mc" || !answers || answers.type === "mc") return [];
    return Array.from({ length: section.length }, (_, question) => question).filter(
      (question) => answers.files[question],
    );
  }, [data, sectionIndex]);

  // Releases the cached audios on unmount.
  useEffect(() => {
    const urls = cache.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  useEffect(() => {
    const pending = questions.filter(
      (question) => !cache.current.has(`${sectionIndex}:${question}`),
    );
    if (!pending.length) return;
    let isUnmounted = false;
    const publish = (question: number, recording: Recording | undefined) => {
      if (!isUnmounted) {
        setRecordings((previous) => ({ ...previous, [`${sectionIndex}:${question}`]: recording }));
      }
    };
    // Reset the URLs.
    pending.forEach((question) => publish(question, undefined));

    const load = async () => {
      // Get fresh URLs before downloading uncached recordings.
      const { data: fresh } = await getResponses({ assessmentId });
      if (isUnmounted) return;
      const answers = fresh.studentResponsesBySection[sectionIndex];
      await Promise.all(
        pending.map(async (question) => {
          try {
            const source = answers?.type !== "mc" ? answers?.files[question] : null;
            if (!source) throw new Error("Recording URL is unavailable");
            const blob = await downloadGradingAudio(source);
            if (isUnmounted) return;
            const url = URL.createObjectURL(blob);
            cache.current.set(`${sectionIndex}:${question}`, url);
            publish(question, { status: "ready", url });
          } catch {
            publish(question, { status: "failed" });
          }
        }),
      );
    };
    void load().catch(() => pending.forEach((question) => publish(question, { status: "failed" })));

    return () => {
      // Ignore late results after a section change, retry, or unmount.
      isUnmounted = true;
    };
  }, [assessmentId, sectionIndex, questions, attempt, getResponses]);

  return { recordings, retry: () => setAttempt((previous) => previous + 1) };
}

/** Download the complete recording while its signed URL is valid. */
export async function downloadGradingAudio(url: string): Promise<Blob> {
  const signal = AbortSignal.timeout(60_000);
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Recording download failed");
  const blob = await response.blob();
  signal.throwIfAborted();
  if (!blob.size) throw new Error("Recording is empty");
  return blob;
}
