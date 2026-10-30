export interface NormStatsDto {
  min: number;
  max: number;
  n: number;
  stdDev: number;
  mean: number;
}

export interface SubtaskDto {
  id: string;
  name: string;
  questionIds: { sectionIndex: number; questionIndex: number }[];
  norms: {
    S1: NormStatsDto | null;
    S3: NormStatsDto | null;
    S5: NormStatsDto | null;
  };
}

export interface AdminSaveSubtaskInput {
  id?: string;
  name: string;
  questionIds: { sectionIndex: number; questionIndex: number }[];
  norms: {
    S1: NormStatsDto | null;
    S3: NormStatsDto | null;
    S5: NormStatsDto | null;
  };
}

export interface AdminDeleteSubtaskInput {
  id: string;
}

export interface GetSubtasksOutput {
  subtasks: SubtaskDto[];
}

export interface AdminSaveSubtaskOutput {
  id: string;
}

export interface AdminDeleteSubtaskOutput {
  success: boolean;
}
