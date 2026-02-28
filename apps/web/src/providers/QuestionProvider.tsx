import React, { createContext, useContext, useEffect, useState } from "react";
import { useHttpsCallable } from "react-firebase-hooks/functions";
import { functions } from "../lib/firebase.ts";

export interface Question {
  kind: "audio" | "mc";
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
  images?: (string | null)[];
  instructions: SectionInstruction;
}

interface GetQuestionsResponse {
  sections: ApiSection[];
}

function transformSections(apiSections: ApiSection[]): Section[] {
  return apiSections.map(
    ({ title, kind, length, goal, questions, audios, choices, images, instructions }) => {
      const section: Section = { title, goal, instruction: instructions, questions: [] };
      section.questions = Array.from({ length }).map((_, i) => {
        return {
          kind: kind === "audio" || kind === "mc" ? kind : "mc",
          question: questions?.[i] ?? null,
          choices: choices?.[i]
            ? Object.entries(choices[i]).sort(([a], [b]) => Number(a) - Number(b)).map(([, v]) => v)
            : [],
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
  const [getQuestions, loading, error] = useHttpsCallable<void, GetQuestionsResponse>(
    functions,
    "api/get-questions",
  );

  useEffect(() => {
    void getQuestions().then((response) => {
      if (response?.data) {
        setSections(transformSections(response.data.sections));
      }
    });
  }, [getQuestions]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading questions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          Error loading questions: {error.message}
        </div>
      </div>
    );
  }

  if (!sections) {
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
