import type { NormStats } from "./models/subtasks-dto";

export interface SaveSubtaskInput {
  id?: string;
  name: string;
  questionIds: { sectionIndex: number; questionIndex: number }[];
  norms: {
    S1: NormStats | null;
    S3: NormStats | null;
    S5: NormStats | null;
  };
}

export interface DeleteSubtaskInput {
  id: string;
}
