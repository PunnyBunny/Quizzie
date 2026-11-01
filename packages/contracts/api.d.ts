import type {
  AdminCreateUserInput,
  AdminCreateUserOutput,
  AdminExportAssessmentsInput,
  AdminExportAssessmentsOutput,
  AdminGetAssessmentsInput,
  AdminGetAssessmentsOutput,
  AdminGetUsersOutput,
  AdminRemoveUserInput,
  AdminRemoveUserOutput,
  AdminResetPasswordInput,
  AdminResetPasswordOutput,
} from "./admin";
import type {
  CreateAssessmentInput,
  CreateAssessmentOutput,
  FinishAssessmentInput,
  GetAssessmentsInput,
  GetAssessmentsOutput,
  SetAssessmentArchivedInput,
} from "./assessments";
import type { OkOutput } from "./common";
import type { SubmitAudioGradeInput, UpdateAudioTranscriptInput } from "./grading";
import type {
  AdminSaveQuestionSectionInput,
  AdminSaveQuestionSectionOutput,
  GetQuestionsOutput,
} from "./questions";
import type {
  GetAssessmentStudentResponsesInput,
  GetAssessmentStudentResponsesOutput,
  SubmitAudioAnswerInput,
  SubmitAudioMcAnswerInput,
  SubmitMcAnswerInput,
} from "./submissions";
import type {
  AdminDeleteSubtaskInput,
  AdminDeleteSubtaskOutput,
  AdminSaveSubtaskInput,
  AdminSaveSubtaskOutput,
  GetSubtasksOutput,
} from "./subtasks";

interface Endpoint<Input, Output> {
  input: Input;
  output: Output;
}

export interface ApiEndpoints {
  "api/create-assessment": Endpoint<CreateAssessmentInput, CreateAssessmentOutput>;
  "api/get-assessments": Endpoint<GetAssessmentsInput, GetAssessmentsOutput>;
  "api/finish-assessment": Endpoint<FinishAssessmentInput, OkOutput>;
  "api/set-assessment-archived": Endpoint<SetAssessmentArchivedInput, OkOutput>;
  "api/get-questions": Endpoint<void, GetQuestionsOutput>;
  "api/submit-mc-answer": Endpoint<SubmitMcAnswerInput, OkOutput>;
  "api/submit-audio-answer": Endpoint<SubmitAudioAnswerInput, OkOutput>;
  "api/submit-audio-mc-answer": Endpoint<SubmitAudioMcAnswerInput, OkOutput>;
  "api/get-assessment-student-responses": Endpoint<
    GetAssessmentStudentResponsesInput,
    GetAssessmentStudentResponsesOutput
  >;
  "api/submit-audio-grade": Endpoint<SubmitAudioGradeInput, OkOutput>;
  "api/update-audio-transcript": Endpoint<UpdateAudioTranscriptInput, OkOutput>;
  "api/get-subtasks": Endpoint<{}, GetSubtasksOutput>;
  "api/admin/save-question-section": Endpoint<
    AdminSaveQuestionSectionInput,
    AdminSaveQuestionSectionOutput
  >;
  "api/admin/save-subtask": Endpoint<AdminSaveSubtaskInput, AdminSaveSubtaskOutput>;
  "api/admin/delete-subtask": Endpoint<AdminDeleteSubtaskInput, AdminDeleteSubtaskOutput>;
  "api/admin/get-assessments": Endpoint<
    AdminGetAssessmentsInput | undefined,
    AdminGetAssessmentsOutput
  >;
  "api/admin/export-assessments": Endpoint<
    AdminExportAssessmentsInput,
    AdminExportAssessmentsOutput
  >;
  "api/admin/get-users": Endpoint<{}, AdminGetUsersOutput>;
  "api/admin/create-user": Endpoint<AdminCreateUserInput, AdminCreateUserOutput>;
  "api/admin/reset-password": Endpoint<AdminResetPasswordInput, AdminResetPasswordOutput>;
  "api/admin/remove-user": Endpoint<AdminRemoveUserInput, AdminRemoveUserOutput>;
}
