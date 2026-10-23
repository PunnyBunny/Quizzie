import { useRef, useState } from "react";
import type { SetAssessmentArchivedInput } from "../../../functions/src/types/zod/routes/assessments";
import type { SetAssessmentArchivedOutput } from "../../../functions/src/types/assessments";
import { useCallable } from "../lib/firebase-hooks";
import { toUserMessage } from "../lib/errors";
import { useTranslation } from "./useTranslation";

export interface ArchiveMessage {
  key: "archive.success" | "archive.restoreSuccess";
  name: string;
}

export function useAssessmentArchive(onSuccess: (id: string) => void) {
  const { t } = useTranslation();
  const [save] = useCallable<SetAssessmentArchivedInput, SetAssessmentArchivedOutput>(
    "api/set-assessment-archived",
  );
  const lock = useRef(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<ArchiveMessage | null>(null);

  async function setArchived(id: string, name: string, archived: boolean) {
    if (lock.current) return;
    lock.current = true;
    setPendingId(id);
    setError(null);
    setMessage(null);
    try {
      await save({ assessmentId: id, archived });
      onSuccess(id);
      setMessage({ key: archived ? "archive.success" : "archive.restoreSuccess", name });
    } catch (err) {
      setError(toUserMessage(err, t("archive.errorSave")));
    } finally {
      lock.current = false;
      setPendingId(null);
    }
  }

  return { setArchived, pendingId, error, message };
}
