import { Alert, AlertDescription, AlertAction } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "./AudioPlayer";
import { useOptionAudioPlayback } from "../hooks/useOptionAudioPlayback";
import { useStorageUrl } from "../hooks/useStorageUrl";
import { audioStoragePath } from "../lib/asset-paths";
import { useTranslation } from "../hooks/useTranslation";
import type { GetOptionAudioPlaybackInput } from "@vaca/contracts";

interface McOptionsProps extends GetOptionAudioPlaybackInput {
  keys: string[];
  audios: Record<string, string>;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled: boolean;
  maxPlays: number;
}

export function McOptions({
  assessmentId,
  section,
  question,
  keys,
  audios,
  selectedIndex,
  onSelect,
  disabled,
  maxPlays,
}: McOptionsProps) {
  const { t } = useTranslation();
  const { counts, error, recordPlay, retry } = useOptionAudioPlayback({
    assessmentId,
    section,
    question,
  });

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm text-muted-foreground">
        {t("question.optionInstructions", { max: maxPlays })}
      </legend>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{t("question.optionPlaybackError")}</AlertDescription>
          <AlertAction>
            <Button type="button" variant="outline" onClick={retry}>
              {t("common.retry")}
            </Button>
          </AlertAction>
        </Alert>
      )}
      {keys.map((key, index) => (
        <div
          key={key}
          className="flex flex-wrap items-center gap-3 rounded-md border-2 bg-white p-3 focus-within:border-primary"
        >
          <label className="flex cursor-pointer items-center gap-3 py-2 font-medium">
            <input
              type="radio"
              name="choice"
              value={key}
              checked={selectedIndex === index}
              disabled={disabled}
              onChange={() => onSelect(index)}
              className="h-4 w-4 accent-primary"
            />
            {t("question.option", { key })}
          </label>
          <OptionRecording
            path={Object.hasOwn(audios, key) ? audios[key] : ""}
            label={t("question.option", { key })}
            count={Object.hasOwn(counts, key) ? counts[key] : 0}
            maxPlays={maxPlays}
            disabled={disabled}
            onPlayed={() => recordPlay(key)}
          />
        </div>
      ))}
    </fieldset>
  );
}

function OptionRecording({
  path,
  label,
  count,
  maxPlays,
  disabled,
  onPlayed,
}: {
  path: string;
  label: string;
  count: number;
  maxPlays: number;
  disabled: boolean;
  onPlayed: () => void;
}) {
  const { t } = useTranslation();
  const audio = useStorageUrl(path ? audioStoragePath(path) : null);
  return (
    <div className="min-w-0 flex-1">
      {!path || audio.error ? (
        <p role="alert" className="text-sm text-destructive">
          {t("question.optionAudioMissing")}
        </p>
      ) : audio.url ? (
        <AudioPlayer
          src={audio.url}
          label={label}
          variant="option"
          playCount={count}
          maxPlays={maxPlays}
          disabled={disabled}
          onPlay={onPlayed}
        />
      ) : (
        <p role="status">{t("common.loading")}</p>
      )}
    </div>
  );
}
