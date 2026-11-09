import { useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { ChevronsLeft, ChevronsRight, Pause, Play, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "../hooks/useTranslation";

interface AudioPlayerProps {
  src: string;
  label: string;
  variant?: "simple" | "grading";
  ref?: Ref<HTMLAudioElement>;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const remainder = String(whole % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}`
    : `${minutes}:${remainder}`;
}

export function AudioPlayer(props: AudioPlayerProps) {
  return <AudioPlayerSource key={props.src} {...props} />;
}

function AudioPlayerSource({ src, label, variant = "simple", ref }: AudioPlayerProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const active = useRef(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);
  const grading = variant === "grading";
  const canSeek = duration !== null && duration > 0;

  useLayoutEffect(() => {
    active.current = true;
    const audio = audioRef.current!;
    const updatePlayback = () => {
      setDuration(Number.isFinite(audio.duration) ? audio.duration : null);
      setCurrentTime(audio.currentTime);
      setPlaying(!audio.paused && !audio.ended);
    };
    const ready = () => {
      updatePlayback();
      setStatus("idle");
    };
    const events: [keyof HTMLMediaElementEventMap, () => void][] = [
      ["loadstart", () => setStatus("loading")],
      ["loadedmetadata", ready],
      ["durationchange", updatePlayback],
      ["timeupdate", updatePlayback],
      ["waiting", () => setStatus("loading")],
      ["canplay", ready],
      ["playing", ready],
      ["play", updatePlayback],
      [
        "pause",
        () => {
          updatePlayback();
          setStatus((current) => (current === "loading" ? "idle" : current));
        },
      ],
      ["ended", ready],
      ["error", () => setStatus("error")],
    ];
    events.forEach(([event, listener]) => audio.addEventListener(event, listener));
    audio.src = src;
    audio.load();
    return () => {
      active.current = false;
      events.forEach(([event, listener]) => audio.removeEventListener(event, listener));
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    };
  }, [src]);
  useImperativeHandle(ref, () => audioRef.current!);

  const play = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.error) audio.load();
    try {
      await audio.play();
    } catch (error) {
      if (active.current && !(error instanceof DOMException && error.name === "AbortError")) {
        setStatus("error");
      }
    }
  };

  const seek = (time: number) => {
    const audio = audioRef.current;
    if (!audio || !canSeek || audio.readyState === 0) return;
    audio.currentTime = Math.min(duration, Math.max(0, time));
    setCurrentTime(audio.currentTime);
  };

  const replay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    if (audio.readyState > 0) audio.currentTime = 0;
  };

  return (
    <div>
      <div
        role="group"
        aria-label={label}
        className={`rounded-lg border border-border bg-card p-3 ${grading ? "w-full" : "w-fit max-w-full"}`}
      >
        <audio ref={audioRef} preload="metadata" hidden />
        {grading && (
          <div className="flex items-center gap-3 text-sm text-muted-foreground tabular-nums">
            <span>{formatTime(currentTime)}</span>
            <input
              type="range"
              aria-label={t("audio.seek")}
              min={0}
              max={duration ?? 0}
              step="any"
              value={Math.min(currentTime, duration ?? 0)}
              disabled={!canSeek}
              onChange={(event) => seek(Number(event.target.value))}
              className="min-w-0 flex-1 cursor-pointer accent-primary disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            />
            <span>{duration === null ? "--:--" : formatTime(duration)}</span>
          </div>
        )}
        <div className={`flex items-center gap-3 ${grading ? "mt-2" : ""}`}>
          {grading && (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("audio.rewind")}
              title={t("audio.rewind")}
              disabled={!canSeek}
              onClick={() => seek(currentTime - 10)}
            >
              <ChevronsLeft aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            size="icon-lg"
            aria-label={t(playing ? "audio.pause" : "audio.play")}
            title={t(playing ? "audio.pause" : "audio.play")}
            onClick={() => {
              if (audioRef.current?.paused === false) audioRef.current.pause();
              else void play();
            }}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </Button>
          {grading && (
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              aria-label={t("audio.forward")}
              title={t("audio.forward")}
              disabled={!canSeek}
              onClick={() => seek(currentTime + 10)}
            >
              <ChevronsRight aria-hidden="true" />
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={replay}>
            <RotateCcw aria-hidden="true" />
            {t("audio.replay")}
          </Button>
        </div>
      </div>
      <p
        role="status"
        className={`min-h-5 px-3 text-xs ${status === "error" ? "text-destructive" : "text-muted-foreground"}`}
      >
        {status === "loading" ? t("common.loading") : status === "error" ? t("audio.error") : ""}
      </p>
    </div>
  );
}
