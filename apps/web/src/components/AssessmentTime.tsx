import { useEffect, useState } from "react";
import type { GetAssessmentTimeOutput } from "@vaca/contracts";
import { useTranslation } from "../hooks/useTranslation";

interface AssessmentTimeProps {
  openingTotals: GetAssessmentTimeOutput | null;
  getElapsedSeconds: () => number;
  error: boolean;
}

function formatTime(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

/** Own the display tick here so audio players and recording controls do not rerender each second. */
export function AssessmentTime({ openingTotals, getElapsedSeconds, error }: AssessmentTimeProps) {
  const { t } = useTranslation();
  const [elapsedSeconds, setElapsedSeconds] = useState(getElapsedSeconds);

  useEffect(() => {
    const update = () => setElapsedSeconds(getElapsedSeconds());
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, [getElapsedSeconds]);

  const values = [
    {
      label: "assessment.sectionTime",
      seconds: openingTotals ? openingTotals.sectionSeconds + elapsedSeconds : null,
    },
    {
      label: "assessment.overallTime",
      seconds: openingTotals ? openingTotals.overallSeconds + elapsedSeconds : null,
    },
  ];

  return (
    <div className="space-y-3">
      <div role="timer" aria-live="off" aria-label={t("assessment.elapsedTime")}>
        <dl
          aria-busy={!openingTotals && !error}
          className="grid grid-cols-2 gap-4 sm:flex sm:gap-8"
        >
          {values.map(({ label, seconds }) => (
            <div key={label} className="min-w-0">
              <dt className="text-xs sm:text-sm text-muted-foreground">{t(label)}</dt>
              <dd className="mt-1 w-[8ch] whitespace-nowrap text-lg sm:text-xl font-medium tabular-nums">
                {seconds === null ? (
                  <span aria-label={t(error ? "assessment.timeUnavailable" : "common.loading")}>
                    --:--:--
                  </span>
                ) : (
                  <time dateTime={`PT${seconds}S`}>{formatTime(seconds)}</time>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
