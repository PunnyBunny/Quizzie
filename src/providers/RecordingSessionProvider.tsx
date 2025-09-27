import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

type RecordingStatus = "idle" | "recording" | "error";

type RecordingSessionContextType = {
  // Functions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cleanup: () => void;

  // State
  audioBlob: Blob | null;
  transcript: string;
  interimTranscript: string;
  status: RecordingStatus;
  error: string;

  // Support status
  browserSupport: boolean;

  // Audio info
  audioBlobUrl: string;
};

const RecordingSessionContext = createContext<RecordingSessionContextType | undefined>(undefined);

// Hacky workaround until the feature detection of [start(MediaStreamTrack)] is reliable
// https://github.com/WebAudio/web-speech-api/issues/126#issuecomment-3320824852
function isMediaStreamTrackArgInSpeechRecognitionStartSupported() {
  const frame = document.body.appendChild(document.createElement("iframe"));
  const contentWindow = frame.contentWindow;
  const SpeechRecognition =
    (contentWindow as any).SpeechRecognition || (contentWindow as any).webkitSpeechRecognition;
  if (!SpeechRecognition) {
    return false;
  }

  const recognition = new SpeechRecognition();
  frame.remove();

  try {
    recognition.start(0);
    recognition.stop();
    return false;
  } catch (error) {
    return (error as Error)?.name === "TypeError";
  }
}

export function RecordingSessionProvider({ children }: { children: React.ReactNode }) {
  // State management
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<RecordingStatus>("idle");
  const browserSupport = useMemo(
    () => isMediaStreamTrackArgInSpeechRecognitionStartSupported(),
    [],
  );

  // Audio recording state
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioBlobUrl, setAudioBlobUrl] = useState("");

  // Refs for cleanup
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const webmMimeType = "audio/webm;codecs=opus";

  const cleanup = () => {
    setError("");
    setStatus("idle");
    setTranscript("");
    setInterimTranscript("");
    setAudioBlob(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (audioBlobUrl) {
      URL.revokeObjectURL(audioBlobUrl);
      setAudioBlobUrl("");
    }
  };

  const startRecording = useCallback(async () => {
    if (!browserSupport) {
      throw new Error("Browser not supported. Use latest versions of Chrome or Edge.");
    }

    const setupMediaRecorder = (stream: MediaStream) => {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: webmMimeType,
        audioBitsPerSecond: 128000,
      });

      let chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      let startTime: Date | null = null;

      mediaRecorder.onstart = () => {
        startTime = new Date();
      };

      mediaRecorder.onstop = () => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, {
            type: webmMimeType,
          });

          setAudioBlob(blob);

          // Clean up previous download URL
          if (audioBlobUrl) {
            URL.revokeObjectURL(audioBlobUrl);
          }

          // Create new download URL
          const newDownloadUrl = URL.createObjectURL(blob);
          setAudioBlobUrl(newDownloadUrl);
        }

        const endTime = new Date();
        const recordingTime = (endTime.getTime() - (startTime?.getTime() ?? 0)) / 1000;
        console.log(`Recording time: ${recordingTime} seconds`);

        chunks = [];
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder error:", event);
        setError("Recording failed. Please try again.");
        setStatus("error");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // Collect data every 1000 ms
    };

    const setupSpeechRecognition = (stream: MediaStream) => {
      const SpeechRecognition_ =
        window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition: SpeechRecognition = new SpeechRecognition_();

      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "yue";
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          setTranscript((prev) => prev + finalTranscript);
        }
        setInterimTranscript(interimTranscript);
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        let errorMessage = "Speech recognition failed. ";

        switch (event.error) {
          case "no-speech":
            errorMessage += "No speech detected. Please try speaking clearly.";
            break;
          case "audio-capture":
            errorMessage += "Audio capture failed. Please check your microphone.";
            break;
          case "not-allowed":
            errorMessage +=
              "Microphone access denied. Please allow microphone access and try again.";
            break;
          case "network":
            errorMessage += "Network error. Please check your internet connection.";
            break;
          default:
            errorMessage += "Please try again.";
        }

        setError(errorMessage);
        setStatus("error");
      };

      recognitionRef.current = recognition;

      const audioTrack = stream.getAudioTracks()[0];
      recognition.start(audioTrack);
    };

    cleanup();

    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      setupMediaRecorder(stream);

      setupSpeechRecognition(stream);

      setStatus("recording");
    } catch (err) {
      console.error("Error starting recording:", err);
      setError(err instanceof Error ? err.message : "Failed to start recording. Please try again.");
      setStatus("error");
      cleanup();
    }
  }, [browserSupport, cleanup]);

  const stopRecording = useCallback(() => {
    setStatus("idle");
    setInterimTranscript("");

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const value: RecordingSessionContextType = {
    // Functions
    startRecording,
    stopRecording,
    cleanup,

    // State
    audioBlob,
    transcript,
    interimTranscript,
    status,
    error,

    // Support status
    browserSupport,

    // Audio info
    audioBlobUrl,
  };

  return (
    <RecordingSessionContext.Provider value={value}>{children}</RecordingSessionContext.Provider>
  );
}

export function useRecordingSession() {
  const context = useContext(RecordingSessionContext);
  if (context === undefined) {
    throw new Error("useRecordingSession must be used within a RecordingSessionProvider");
  }
  return context;
}

export function useRecordingState() {
  const { status, error } = useRecordingSession();
  return { status, error };
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
  const { browserSupport } = useRecordingSession();
  return browserSupport;
}

export function useRecordingControls() {
  const { startRecording, stopRecording, cleanup } = useRecordingSession();
  return { startRecording, stopRecording, cleanup };
}
