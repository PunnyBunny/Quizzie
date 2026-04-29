import type { SectionInstruction } from "../providers/QuestionProvider.tsx";
import { useStorageUrl } from "../hooks/useStorageUrl.ts";
import { audioStoragePath } from "../lib/asset-paths.ts";
import { useTranslation } from "../i18n/LanguageProvider";

interface SectionInstructionBodyProps {
  instruction: SectionInstruction | null | undefined;
}

export function SectionInstructionBody({ instruction }: SectionInstructionBodyProps) {
  const audio = useStorageUrl(instruction?.audio ? audioStoragePath(instruction.audio) : null);
  const { t } = useTranslation();
  const text = instruction?.text ?? t("instruction.none");

  return (
    <div className="flex flex-col gap-4">
      {audio.url && (
        <audio controls src={audio.url} className="w-full">
          {t("instruction.audioFallback")}
        </audio>
      )}
      <div className="prose max-w-none text-gray-800">
        <p className="text-xl leading-8 whitespace-pre-line">{text}</p>
      </div>
    </div>
  );
}
