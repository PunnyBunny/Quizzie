import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { GetAssessmentTimeInput, GetAssessmentTimeOutput } from "@vaca/contracts";
import { useCallable } from "../lib/firebase-hooks";

/** Measures answering time without persistent browser storage. */
export function useQuestionTime({ assessmentId, section, question }: GetAssessmentTimeInput) {
  const questionAddress = useMemo(
    () => ({ assessmentId, section, question }),
    [assessmentId, section, question],
  );
  const [readTime] = useCallable("api/get-assessment-time");
  const [persistQuestionTimeApi] = useCallable("api/update-question-time");
  const [openingTotalTime, setOpeningTotalTime] = useState<GetAssessmentTimeOutput | null>(null);
  const openingTotalTimeRef = useRef<GetAssessmentTimeOutput | null>(null);
  const pendingTotalTimeRequestRef = useRef<Promise<GetAssessmentTimeOutput> | null>(null);
  const elapsedMs = useRef(0);
  const startedAt = useRef<number | null>(null);
  const savedSeconds = useRef(-1);
  const active = useRef(false);
  const [error, setError] = useState(false);

  const getElapsedSeconds = useCallback(() => {
    const runningMs = startedAt.current === null ? 0 : Math.max(0, Date.now() - startedAt.current);
    return Math.floor((elapsedMs.current + runningMs) / 1000);
  }, []);

  const loadOpeningTotalTime = useCallback(async () => {
    if (openingTotalTimeRef.current) return openingTotalTimeRef.current;
    pendingTotalTimeRequestRef.current ??= readTime(questionAddress)
      .then(({ data }) => {
        openingTotalTimeRef.current = data;
        if (active.current) setOpeningTotalTime(data);
        return data;
      })
      .catch((err: unknown) => {
        if (active.current) setError(true);
        throw err;
      })
      .finally(() => {
        pendingTotalTimeRequestRef.current = null;
      });
    return pendingTotalTimeRequestRef.current;
  }, [questionAddress, readTime]);

  const stop = useCallback(() => {
    if (startedAt.current !== null) {
      elapsedMs.current += Math.max(0, Date.now() - startedAt.current);
      startedAt.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    startedAt.current ??= Date.now();
  }, []);

  // Changes the hook's state without API calls.
  const recordSavedTotalSeconds = useCallback((totalSeconds: number | undefined) => {
    if (totalSeconds === undefined) return;
    savedSeconds.current = Math.max(savedSeconds.current, totalSeconds);
    if (active.current) setError(false);
  }, []);

  const stopAndGetTotalSeconds = useCallback(async (): Promise<number | undefined> => {
    stop();
    try {
      const openingTotalTime = await loadOpeningTotalTime();
      return openingTotalTime.questionSeconds + getElapsedSeconds();
    } catch {
      // A failed timing read must not discard the student's answer.
      return undefined;
    }
  }, [stop, loadOpeningTotalTime, getElapsedSeconds]);

  const save = useCallback(async () => {
    const baseline = await loadOpeningTotalTime();
    const totalSeconds = baseline.questionSeconds + getElapsedSeconds();
    if (totalSeconds <= savedSeconds.current) return;
    try {
      await persistQuestionTimeApi({ ...questionAddress, totalSeconds });
      recordSavedTotalSeconds(totalSeconds);
    } catch (err) {
      if (active.current && totalSeconds > savedSeconds.current) setError(true);
      throw err;
    }
  }, [
    questionAddress,
    persistQuestionTimeApi,
    loadOpeningTotalTime,
    getElapsedSeconds,
    recordSavedTotalSeconds,
  ]);

  useEffect(() => {
    active.current = true;
    resume();
    void loadOpeningTotalTime().catch(() => undefined);
    const checkpoint = () => {
      void save().catch(() => undefined);
    };
    const pageRestored = (event: PageTransitionEvent) => {
      if (event.persisted) resume();
    };
    const interval = window.setInterval(checkpoint, 10_000);
    window.addEventListener("pagehide", stop);
    window.addEventListener("pageshow", pageRestored);
    window.addEventListener("online", checkpoint);
    return () => {
      active.current = false;
      window.clearInterval(interval);
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("pageshow", pageRestored);
      window.removeEventListener("online", checkpoint);
      stop();
    };
  }, [resume, save, stop, loadOpeningTotalTime]);

  const retry = useCallback(() => {
    void save().catch(() => undefined);
  }, [save]);
  return {
    openingTotalTime,
    getElapsedSeconds,
    stopAndGetTotalSeconds,
    stop,
    resume,
    save,
    recordSavedTotalSeconds,
    error,
    retry,
  };
}
