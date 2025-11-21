import React, { createContext, useContext } from "react";
import questionsJson from "../assets/questions.json" with { type: "json" };

export type Question = {
  kind: "audio" | "mc";
  question: string | null;
  choices: string[] | null;
  correctAnswer: string | null;
  image: string | null;
  audio: string;
};

export type SectionInstruction = {
  audio: string;
  text: string;
};

export type Section = {
  title: string;
  goal: string;
  questions: Question[];
  instruction: SectionInstruction;
};

const QuestionContext = createContext<Section[] | undefined>(undefined);

export function QuestionProvider({ children }: { children: React.ReactNode }) {
  const sections = questionsJson.map(
    ({
      title,
      kind,
      length,
      goal,
      questions,
      audios,
      choices,
      correctAnswers,
      images,
      instructions,
    }) => {
      const section: Section = { title, goal, instruction: instructions, questions: [] };
      section["questions"] = Array.from({ length }).map((_, i) => {
        return {
          kind: (kind === "audio" || kind === "mc") ? kind : "mc",
          question: questions?.[i] ?? null,
          choices: choices?.[i] ?? [],
          correctAnswer: correctAnswers?.[i] ?? "",
          image: images?.[i] ?? null,
          audio: audios?.[i] ?? "",
        } satisfies Question;
      });
      return section;
    },
  );

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
