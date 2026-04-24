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
    <header className="w-full flex flex-col gap-6 p-6 bg-white shadow">
      <div className="w-full flex justify-between mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
          <p className="text-sm text-gray-500 mt-1">
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
