export interface NormStats {
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
    S1: NormStats | null;
    S3: NormStats | null;
    S5: NormStats | null;
  };
}
