import type { SectionInstruction } from "../providers/QuestionProvider.tsx";
import { useStorageUrl } from "../hooks/useStorageUrl.ts";
import { audioStoragePath } from "../lib/asset-paths.ts";

interface SectionInstructionBodyProps {
  instruction: SectionInstruction | null | undefined;
}

export function SectionInstructionBody({ instruction }: SectionInstructionBodyProps) {
  const audio = useStorageUrl(instruction?.audio ? audioStoragePath(instruction.audio) : null);
  const text = instruction?.text ?? "No instructions provided for this section.";

  return (
    <div className="flex flex-col gap-4">
      {audio.url && (
        <audio controls src={audio.url} className="w-full">
          Your browser does not support the audio element.
        </audio>
      )}
      <div className="prose max-w-none text-gray-800">
        <p className="text-base sm:text-lg md:text-xl leading-relaxed sm:leading-8 whitespace-pre-line">
          {text}
        </p>
      </div>
    </div>
  );
}
