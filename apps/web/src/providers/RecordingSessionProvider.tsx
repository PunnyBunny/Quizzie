import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "../hooks/useTranslation";

type RecordingStatus = "idle" | "starting" | "recording" | "finalizing" | "error";
interface RecordingIssue {
  key: string;
  severity: "error" | "warning";
}
interface RecordingSessionContextType {
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  resetAudio: () => void;
  audioBlob: Blob | null;
  transcript: string;
  interimTranscript: string;
  status: RecordingStatus;
  error: string;
  errorSeverity: RecordingIssue["severity"] | null;
  browserSupport: boolean;
  audioBlobUrl: string;
}
interface Session {
  stream: MediaStream | null;
  recorder: MediaRecorder | null;
  recognition: SpeechRecognition | null;
  recorderDone: boolean;
  recognitionDone: boolean;
  stopping: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}
const RecordingSessionContext = createContext<RecordingSessionContextType | undefined>(undefined);
type SpeechWindow = Window & {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
};
const recognitionConstructor = (source: Window = window) => {
  const browser = source as SpeechWindow;
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
};
// Retain the existing feature probe for recognition.start(MediaStreamTrack).
function supportsStartWithTrack(): boolean {
  const frame = document.body.appendChild(document.createElement("iframe"));
  const Constructor = frame.contentWindow ? recognitionConstructor(frame.contentWindow) : undefined;
  frame.remove();
  if (!Constructor) return false;
  const recognition = new Constructor();
  try {
    recognition.start(0 as unknown as MediaStreamTrack);
    recognition.stop();
    return false;
  } catch (error) {
    return (
      typeof error === "object" && error !== null && "name" in error && error.name === "TypeError"
    );
  }
}
export function RecordingSessionProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [issue, setIssue] = useState<RecordingIssue | null>(null);
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState("");
  const urlRef = useRef("");
  const sessionRef = useRef<Session | null>(null);
  const browserSupport = useMemo(
    () =>
      Boolean(recognitionConstructor()) &&
      typeof MediaRecorder !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function",
    [],
  );
  const canPassTrack = useMemo(() => browserSupport && supportsStartWithTrack(), [browserSupport]);

  const resetAudio = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null; // Invalidate ALL asynchronous success/error callbacks first.
    if (session) {
      if (session.timer) clearTimeout(session.timer);
      try {
        session.recognition?.abort();
      } catch {
        /* Already ended. */
      }
      if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
      session.stream?.getTracks().forEach((track) => track.stop());
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = "";
    setAudioBlobUrl("");
    setAudioBlob(null);
    setTranscript("");
    setInterimTranscript("");
    setIssue(null);
    setStatus("idle");
  }, []);
  useEffect(() => resetAudio, [resetAudio]);

  const settle = useCallback((session: Session) => {
    if (
      sessionRef.current !== session ||
      !session.stopping ||
      !session.recorderDone ||
      !session.recognitionDone
    )
      return;
    if (session.timer) clearTimeout(session.timer);
    session.timer = null;
    session.stream?.getTracks().forEach((track) => track.stop());
    setInterimTranscript("");
    setStatus("idle");
  }, []);

  const stopSession = useCallback(
    (session: Session) => {
      if (sessionRef.current !== session || session.stopping) return;
      session.stopping = true;
      setStatus("finalizing");
      if (!session.recognitionDone) {
        try {
          session.recognition?.stop();
        } catch {
          session.recognitionDone = true;
        }
        // Speech service failure must not strand a finalized recording indefinitely.
        session.timer = setTimeout(() => {
          if (sessionRef.current !== session || session.recognitionDone) return;
          session.recognitionDone = true;
          try {
            session.recognition?.abort();
          } catch {
            /* Already ended. */
          }
          setIssue((current) =>
            current?.severity === "error"
              ? current
              : { key: "recording.transcriptionTimeout", severity: "warning" },
          );
          settle(session);
        }, 4000);
      }
      if (session.recorder && session.recorder.state !== "inactive") session.recorder.stop();
      // An inactive recorder may still have final data/onstop queued. Only onstop
      // publishes the blob and marks it finalized, including the error path.
      settle(session);
    },
    [settle],
  );
  const stopRecording = useCallback(() => {
    if (sessionRef.current) stopSession(sessionRef.current);
  }, [stopSession]);

  const startRecording = useCallback(async () => {
    const previous = sessionRef.current;
    if (previous && (!previous.recorderDone || !previous.recognitionDone)) return;
    resetAudio();
    if (!browserSupport) {
      setIssue({ key: "recording.unsupported", severity: "error" });
      setStatus("error");
      return;
    }
    const session: Session = {
      stream: null,
      recorder: null,
      recognition: null,
      recorderDone: true,
      recognitionDone: true,
      stopping: false,
      timer: null,
    };
    sessionRef.current = session;
    setStatus("starting");
    let recorderStarted = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      session.stream = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 128000 } : undefined,
      );
      session.recorder = recorder;
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (event) => {
        if (sessionRef.current === session && event.data.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (sessionRef.current !== session) return;
        if (chunks.length) {
          const blob = new Blob(chunks, { type: recorder.mimeType });
          setAudioBlob(blob);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = URL.createObjectURL(blob);
          setAudioBlobUrl(urlRef.current);
        }
        chunks.length = 0;
        session.recorderDone = true;
        if (!session.stopping) stopSession(session);
        settle(session);
      };
      recorder.onerror = () => {
        if (sessionRef.current !== session) return;
        setIssue({ key: "recording.captureFailed", severity: "error" });
        stopSession(session);
      };
      session.recorderDone = false;
      recorder.start(100);
      recorderStarted = true;
      const Constructor = recognitionConstructor();
      if (!Constructor) throw new Error("Speech recognition unavailable");
      const recognition = new Constructor();
      session.recognition = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "yue";
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        if (sessionRef.current !== session || session.recognitionDone) return;
        let final = "",
          interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) final += event.results[i][0].transcript + " ";
          else interim += event.results[i][0].transcript;
        }
        if (final) setTranscript((previousText) => previousText + final);
        setInterimTranscript(interim);
      };
      recognition.onerror = (event) => {
        if (sessionRef.current !== session) return;
        if (event.error !== "aborted")
          setIssue((current) =>
            current?.severity === "error"
              ? current
              : {
                  key:
                    event.error === "no-speech"
                      ? "recording.noSpeech"
                      : "recording.transcriptionFailed",
                  severity: "warning",
                },
          );
      };
      recognition.onend = () => {
        if (sessionRef.current !== session) return;
        session.recognitionDone = true;
        settle(session);
      };
      session.recognitionDone = false;
      if (canPassTrack) recognition.start(stream.getAudioTracks()[0]);
      else recognition.start();
      setStatus("recording");
    } catch {
      if (sessionRef.current !== session) return; // A previous microphone rejection cannot cancel a new question.
      setIssue({ key: "recording.captureFailed", severity: "error" });
      if (recorderStarted && session.recorder && !session.recorderDone) {
        session.recognitionDone = true;
        try {
          session.recognition?.abort();
        } catch {
          /* Failed to start. */
        }
        stopSession(session); // Preserve any audio captured before recognition startup failed.
      } else {
        session.stream?.getTracks().forEach((track) => track.stop());
        sessionRef.current = null;
        setStatus("error");
      }
    }
  }, [browserSupport, canPassTrack, resetAudio, settle, stopSession]);
  return (
    <RecordingSessionContext.Provider
      value={{
        startRecording,
        stopRecording,
        resetAudio,
        audioBlob,
        transcript,
        interimTranscript,
        status,
        error: issue ? t(issue.key) : "",
        errorSeverity: issue?.severity ?? null,
        browserSupport,
        audioBlobUrl,
      }}
    >
      {children}
    </RecordingSessionContext.Provider>
  );
}

export function useRecordingSession() {
  const context = useContext(RecordingSessionContext);
  if (!context)
    throw new Error("useRecordingSession must be used within a RecordingSessionProvider");
  return context;
}
export function useRecordingState() {
  const { status, error, errorSeverity } = useRecordingSession();
  return { status, error, errorSeverity };
}
export function useTranscriptText() {
  const { transcript, interimTranscript } = useRecordingSession();
  return { transcript, interimTranscript };
}
export function useAudioRecording() {
  const { audioBlob, audioBlobUrl } = useRecordingSession();
  return { audioBlob, audioBlobUrl };
}
export function useBrowserSupport() {
  return useRecordingSession().browserSupport;
}
export function useRecordingControls() {
  const { startRecording, stopRecording, resetAudio } = useRecordingSession();
  return { startRecording, stopRecording, resetAudio };
}
