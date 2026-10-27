import { Alert } from "./Alert";
import { Button } from "@/components/ui/button";
import { useTranslation } from "../hooks/useTranslation";
import type { ArchiveMessage } from "../hooks/useAssessmentArchive";

export function ArchiveFeedback({
  error,
  message,
}: {
  error: string | null;
  message: ArchiveMessage | null;
}) {
  const { t } = useTranslation();
  const [beforeName, afterName] = message ? t(message.key).split("{{name}}") : [];
  return (
    <div aria-live="polite" aria-atomic="true">
      {error && (
        <Alert kind="error" className="mb-4">
          {error}
        </Alert>
      )}
      {message && (
        <Alert kind="success" className="mb-4">
          {beforeName}
          <strong>{message.name}</strong>
          {afterName}
        </Alert>
      )}
    </div>
  );
}

export function ArchiveButton({
  archived = false,
  busy,
  disabled,
  onClick,
}: {
  archived?: boolean;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      aria-busy={busy}
      onClick={onClick}
      className="relative min-w-24"
    >
      <span className={busy ? "invisible" : ""}>
        {t(archived ? "archive.restore" : "archive.action")}
      </span>
      {busy && (
        <span className="absolute inset-0 flex items-center justify-center">
          {t("common.saving")}
        </span>
      )}
    </Button>
  );
}
