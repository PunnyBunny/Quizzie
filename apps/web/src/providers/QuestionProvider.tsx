import React, { createContext, useContext, useEffect, useState } from "react";
import { useCallable } from "../lib/firebase-hooks.ts";
import { toUserMessage } from "../lib/errors.ts";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface Question {
  kind: "audio" | "mc" | "audio_mc";
  choicesAudio: string | null;
  choiceKeys: string[];
  question: string | null;
  choices: string[] | null;
  correctAnswer: string | null;
  image: string | null;
  audio: string;
}

export interface SectionInstruction {
  audio: string;
  text: string;
}

export interface Section {
  title: string;
  goal: string;
  questions: Question[];
  instruction: SectionInstruction;
}

interface ApiSection {
  title: string;
  kind: string;
  length: number;
  goal: string;
  questions: string[] | null;
  audios: string[];
  choices?: Record<string, string>[];
  choicesAudios?: string[];
  images?: (string | null)[];
  instructions: SectionInstruction;
}

interface GetQuestionsResponse {
  sections: ApiSection[];
}

function transformSections(apiSections: ApiSection[]): Section[] {
  return apiSections.map(
    ({
      title,
      kind,
      length,
      goal,
      questions,
      audios,
      choices,
      choicesAudios,
      images,
      instructions,
    }) => {
      const section: Section = { title, goal, instruction: instructions, questions: [] };
      section.questions = Array.from({ length }).map((_, i) => {
        const choiceEntries = Object.entries(choices?.[i] ?? {}).sort(([a], [b]) =>
          a.localeCompare(b),
        );
        return {
          kind: kind === "audio" || kind === "mc" || kind === "audio_mc" ? kind : "mc",
          question: questions?.[i] ?? null,
          choices: choiceEntries.map(([, label]) => label),
          choiceKeys: choiceEntries.map(([key]) => key),
          choicesAudio: choicesAudios?.[i] ?? null,
          correctAnswer: null,
          image: images?.[i] ?? null,
          audio: audios?.[i] ?? "",
        } satisfies Question;
      });
      return section;
    },
  );
}

const QuestionContext = createContext<Section[] | undefined>(undefined);

export function QuestionProvider({ children }: { children: React.ReactNode }) {
  const [sections, setSections] = useState<Section[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [getQuestions, loading] = useCallable<void, GetQuestionsResponse>("api/get-questions");

  useEffect(() => {
    let cancelled = false;
    setSections(null);
    setError(null);
    void getQuestions()
      .then((response) => {
        if (!cancelled) {
          setSections(transformSections(response.data.sections));
        }
      })
      .catch((err) => {
        if (!cancelled) setError(toUserMessage(err, "Could not load questions."));
      });
    return () => {
      cancelled = true;
    };
  }, [getQuestions]);

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (loading || !sections) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading questions...</div>
      </div>
    );
  }

  return <QuestionContext.Provider value={sections}>{children}</QuestionContext.Provider>;
}

export function useQuestion(section: number, index: number) {
  const sections = useContext(QuestionContext);
  if (sections === undefined) {
    throw new Error("useQuestions must be used within a QuestionProvider");
  }

  return sections[section].questions[index];
}

export function useSection(section: number) {
  const sections = useContext(QuestionContext);
  if (sections === undefined) {
    throw new Error("useQuestions must be used within a QuestionProvider");
  }

  return { section: sections[section], totalSections: sections.length };
}
