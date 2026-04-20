import { FieldValue } from "../../firebase";
import type { Timestamp } from "firebase-admin/firestore";
import { BaseCollection } from "./base";
import type { NormStats, SubtaskDto } from "./subtasks-dto";

export type { NormStats, SubtaskDto } from "./subtasks-dto";

/**
 * Subtask document stored in Firestore.
 * Each subtask is a custom grouping of questions with normative data per grade.
 */
export interface SubtaskDoc {
  name: string;
  questionIds: { sectionIndex: number; questionIndex: number }[];
  norms: {
    S1: NormStats | null;
    S3: NormStats | null;
    S5: NormStats | null;
  };
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
}

export const subtasks = new BaseCollection<SubtaskDoc>(
  "subtasks",
  (data) => data as SubtaskDoc,
);

export function toSubtaskDto(
  doc: FirebaseFirestore.QueryDocumentSnapshot<SubtaskDoc>,
): SubtaskDto {
  const data = doc.data();
  return {
    id: doc.id,
    name: data.name,
    questionIds: data.questionIds,
    norms: data.norms,
  };
}
