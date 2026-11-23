import { Alert, AlertDescription, AlertAction } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AudioPlayer } from "./AudioPlayer";
import { useOptionAudioPlayback } from "../hooks/useOptionAudioPlayback";
import { useStorageUrl } from "../hooks/useStorageUrl";
import { audioStoragePath } from "../lib/asset-paths";
import { useTranslation } from "../hooks/useTranslation";
import type { GetOptionAudioPlaybackInput } from "@vaca/contracts";

interface BaseMcOptionsProps {
  keys: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  disabled: boolean;
}

interface TextMcOptionsProps extends BaseMcOptionsProps {
  optionFormat: "text_option";
  choices: Record<string, string>;
}

interface AudioMcOptionsProps extends BaseMcOptionsProps, GetOptionAudioPlaybackInput {
  optionFormat: "audio_option";
  audios: Record<string, string>;
  maxPlays: number;
}

type McOptionsProps = TextMcOptionsProps | AudioMcOptionsProps;

export function McOptions(props: McOptionsProps) {
  return props.optionFormat === "audio_option" ? (
    <AudioMcOptions {...props} />
  ) : (
    <TextMcOptions {...props} />
  );
}

function TextMcOptions({ keys, choices, selectedIndex, onSelect, disabled }: TextMcOptionsProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="mb-3 text-sm text-muted-foreground">{t("question.alertSelect")}</legend>
      {keys.map((key, index) => (
        <label
          key={key}
          className={`flex items-start gap-3 rounded-md border-2 bg-white p-3 focus-within:border-primary ${
            disabled ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
          }`}
        >
          <input
            type="radio"
            name="choice"
            value={key}
            checked={selectedIndex === index}
            disabled={disabled}
            onChange={() => onSelect(index)}
            className="mt-1 h-4 w-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          <span className="font-medium wrap-anywhere">{key}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap wrap-anywhere">
            {Object.hasOwn(choices, key) ? choices[key] : ""}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function AudioMcOptions({
  assessmentId,
  section,
  question,
  keys,
  audios,
  selectedIndex,
  onSelect,
  disabled,
  maxPlays,
}: AudioMcOptionsProps) {
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
            {key}
          </label>
          <OptionRecording
            path={Object.hasOwn(audios, key) ? audios[key] : ""}
            label={key}
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
