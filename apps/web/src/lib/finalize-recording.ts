import { fixParsedWebmDuration } from "@fix-webm-duration/fix";
import { WebmFile } from "@fix-webm-duration/parser";

// Element IDs as exposed by the WebM parser (without EBML's length marker).
const SEGMENT = 0x8538067;
const INFO = 0x549a966;
const DURATION = 0x489;
const TIMECODE_SCALE = 0xad7b1;

/** Write the captured audio's duration into WebM before previewing or uploading it. */
export async function finalizeRecording(blob: Blob): Promise<Blob> {
  if (blob.type.split(";", 1)[0] !== "audio/webm") return blob;

  const repair = async () => {
    const bytes = await blob.arrayBuffer();
    const file = new WebmFile(new Uint8Array(bytes));
    const info = file.getSectionById(SEGMENT)?.getSectionById(INFO);
    const existingDuration = info?.getSectionById(DURATION)?.getValue();
    if (existingDuration && Number.isFinite(existingDuration) && existingDuration > 0) return blob;
    // The repair library writes a 1 ms time scale without rescaling packet timestamps.
    if (info?.getSectionById(TIMECODE_SCALE)?.getValue() !== 1_000_000) {
      throw new Error("Recording uses an unsupported WebM time scale");
    }
    // Decode without an output device. Sample duration excludes microphone permission,
    // speech-recognition latency, and delays delivering MediaRecorder's final events.
    const decoder = new OfflineAudioContext(1, 1, 48_000);
    const audio = await decoder.decodeAudioData(bytes.slice(0));
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) {
      throw new Error("Recording has no measurable audio duration");
    }
    // The high-level fixWebmDuration silently returns the input after failures.
    // Use the parsed API so unsupported files are reported and retained as evidence.
    if (!fixParsedWebmDuration(file, audio.duration * 1000, { logger: false })) {
      throw new Error("Recording duration metadata could not be written");
    }
    return file.toBlob(blob.type);
  };

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      repair(),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Recording finalization timed out")), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}
