import type { ReactNode } from "react";

interface AssessmentHeaderProps {
  title: string;
  assessmentId: string;
  sectionIndex: number;
  questionIndex?: number;
  right?: ReactNode;
  below?: ReactNode;
}

export function AssessmentHeader({
  title,
  assessmentId,
  sectionIndex,
  questionIndex,
  right,
  below,
}: AssessmentHeaderProps) {
  return (
    <header className="w-full flex flex-col gap-4 sm:gap-6 p-4 sm:p-6 bg-white shadow">
      <div className="w-full flex flex-col sm:flex-row sm:justify-between gap-3 mx-auto">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">{title}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 break-all">
            Assessment ID {assessmentId} • Section {sectionIndex + 1}
            {questionIndex != null && ` • Question ${questionIndex + 1}`}
          </p>
        </div>
        {right}
      </div>
      {below}
    </header>
  );
}
