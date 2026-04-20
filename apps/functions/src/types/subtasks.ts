import type { SubtaskDto } from "./models/subtasks-dto";

export interface GetSubtasksOutput {
  subtasks: SubtaskDto[];
}

export interface SaveSubtaskOutput {
  id: string;
}

export interface DeleteSubtaskOutput {
  success: boolean;
}
