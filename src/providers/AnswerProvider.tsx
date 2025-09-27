import React, { createContext, useContext, useState } from "react";

type LastAnsweredQuestion = {
  sectionIndex: number;
  questionIndex: number;
} | null;

const AnswerContext = createContext<
  | {
      lastAnsweredQuestion: LastAnsweredQuestion;
      setLastAnsweredQuestion: React.Dispatch<React.SetStateAction<LastAnsweredQuestion>>;
    }
  | undefined
>(undefined);

export function AnswerProvider({ children }: { children: React.ReactNode }) {
  const [lastAnsweredQuestion, setLastAnsweredQuestion] = useState<LastAnsweredQuestion>(null);

  return (
    <AnswerContext.Provider value={{ lastAnsweredQuestion, setLastAnsweredQuestion }}>
      {children}
    </AnswerContext.Provider>
  );
}

export function useAnswer() {
  const context = useContext(AnswerContext);
  if (context === undefined) {
    throw new Error("useAnswer must be used within an AnswerProvider");
  }
  return context;
}
