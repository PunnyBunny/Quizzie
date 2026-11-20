import { AudioPlayer } from "./AudioPlayer";
import type { SectionInstructionDto } from "@vaca/contracts";
import { useStorageUrl } from "../hooks/useStorageUrl.ts";
import { audioStoragePath } from "../lib/asset-paths.ts";
import { useTranslation } from "../hooks/useTranslation";

interface SectionInstructionBodyProps {
  instruction: SectionInstructionDto | null | undefined;
}

export function SectionInstructionBody({ instruction }: SectionInstructionBodyProps) {
  const audio = useStorageUrl(instruction?.audio ? audioStoragePath(instruction.audio) : null);
  const { t } = useTranslation();
  const text = instruction?.text ?? t("instruction.none");

  return (
    <div className="flex flex-col gap-4">
      {audio.url && <AudioPlayer src={audio.url} label={t("instruction.title")} />}
      <div className="prose max-w-none text-gray-800">
        <p className="text-base sm:text-lg md:text-xl leading-relaxed sm:leading-8 whitespace-pre-line">
          {text}
        </p>
      </div>
    </div>
  );
}
