// Offline source-level schema checks; no Firebase initialization or cloud access.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const { createRequire } = require("node:module");
const root = path.resolve(__dirname, "../apps/functions/src/types/zod");
const cache = new Map();
function load(relative) {
  const filename = path.resolve(root, relative);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} };
  cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const localRequire = createRequire(filename);
  new Function("require", "module", "exports", code)(
    (name) =>
      name.startsWith(".")
        ? load(path.relative(root, path.resolve(path.dirname(filename), name + ".ts")))
        : localRequire(name),
    module,
    module.exports,
  );
  return module.exports;
}
const a = load("routes/assessments.ts");
const s = load("routes/submissions.ts");
const g = load("routes/grading.ts");
const q = load("routes/questions.ts");
const t = load("routes/subtasks.ts");
const address = { assessmentId: "existing", section: 0, question: 1 };
const section = {
  id: "0",
  title: "",
  kind: "mc",
  length: 0,
  goal: "",
  questions: null,
  audios: [],
  instructions: { audio: "", text: "" },
};
const subtask = {
  name: "Task",
  questionIds: [{ sectionIndex: 0, questionIndex: 1 }],
  norms: { S1: null, S3: null, S5: null },
};
const cases = [
  [a.FinishAssessmentSchema, address, "assessmentId"],
  [a.SetAssessmentArchivedSchema, { ...address, archived: true }, "assessmentId"],
  [s.SubmitMcAnswerSchema, { ...address, answer: null }, "assessmentId"],
  [s.SubmitAudioAnswerSchema, { ...address, transcript: null, gsUri: null }, "assessmentId"],
  [
    s.SubmitAudioMcAnswerSchema,
    {
      ...address,
      transcript: null,
      gsUri: null,
      assistanceOffered: false,
      selectedOption: null,
      skipped: true,
    },
    "assessmentId",
  ],
  [s.GetAssessmentStudentResponsesSchema, address, "assessmentId"],
  [g.SubmitAudioGradeSchema, { ...address, grade: 5 }, "assessmentId"],
  [g.UpdateAudioTranscriptSchema, { ...address, transcript: "" }, "assessmentId"],
  [q.AdminSaveQuestionSectionSchema, section, "id"],
  [t.AdminSaveSubtaskSchema, { ...subtask, id: "existing" }, "id"],
  [t.AdminDeleteSubtaskSchema, { id: "existing" }, "id"],
];
let checks = 0;
function rejects(schema, payload, expectedPath) {
  const result = schema.safeParse(payload);
  assert.equal(result.success, false, JSON.stringify(payload));
  assert.ok(
    result.error.issues.some(
      (issue) => JSON.stringify(issue.path) === JSON.stringify(expectedPath),
    ),
    JSON.stringify(result.error.issues),
  );
  checks++;
}
for (const [schema, payload, field] of cases) {
  for (const id of [
    "",
    "/",
    "parent/child",
    ".",
    "..",
    "__reserved__",
    "____",
    "__line\nbreak__",
    "a".repeat(1501),
    "字".repeat(501),
    0,
    null,
  ]) {
    rejects(schema, { ...payload, [field]: id }, [field]);
  }
  for (const id of [
    "existing-ID_123",
    "0",
    "001",
    "中文",
    " spaced ID ",
    " ",
    "...",
    "__",
    "___",
    "__prefix",
    "suffix__",
    "a".repeat(1500),
    "字".repeat(500),
  ]) {
    assert.equal(schema.parse({ ...payload, [field]: id })[field], id);
    checks++;
  }
  if (schema !== t.AdminSaveSubtaskSchema) {
    const missing = { ...payload };
    delete missing[field];
    rejects(schema, missing, [field]);
  }
}
assert.equal(t.AdminSaveSubtaskSchema.parse(subtask).id, undefined);
checks++;
rejects(a.SetAssessmentArchivedSchema, { ...address, archived: "true" }, ["archived"]);
rejects(s.SubmitMcAnswerSchema, { ...address, answer: "" }, ["answer"]);
rejects(s.SubmitMcAnswerSchema, { ...address, section: -1, answer: null }, ["section"]);
rejects(s.SubmitAudioAnswerSchema, { ...address, question: 0.5, transcript: null, gsUri: null }, [
  "question",
]);
rejects(s.SubmitAudioAnswerSchema, { ...address, transcript: null, gsUri: "" }, ["gsUri"]);
rejects(
  s.SubmitAudioMcAnswerSchema,
  {
    ...address,
    transcript: null,
    gsUri: null,
    assistanceOffered: true,
    selectedOption: null,
    skipped: false,
  },
  [],
);
for (const grade of [-1, 6, 1.5])
  rejects(g.SubmitAudioGradeSchema, { ...address, grade }, ["grade"]);
rejects(
  g.UpdateAudioTranscriptSchema,
  { ...address, transcript: "a".repeat(g.TRANSCRIPT_MAX_LENGTH + 1) },
  ["transcript"],
);
g.UpdateAudioTranscriptSchema.parse({
  ...address,
  transcript: "a".repeat(g.TRANSCRIPT_MAX_LENGTH),
});
checks++;
rejects(q.AdminSaveQuestionSectionSchema, { ...section, length: -1 }, ["length"]);
rejects(
  q.AdminSaveQuestionSectionSchema,
  {
    ...section,
    kind: "audio_mc",
    length: 1,
    choices: [{ a: "A", b: "B" }],
    correctAnswers: ["missing"],
  },
  ["choices", 0],
);
rejects(t.AdminSaveSubtaskSchema, { ...subtask, name: "" }, ["name"]);
rejects(
  t.AdminSaveSubtaskSchema,
  { ...subtask, questionIds: [{ sectionIndex: -1, questionIndex: 0 }] },
  ["questionIds", 0, "sectionIndex"],
);
rejects(t.AdminSaveSubtaskSchema, { ...subtask, norms: { ...subtask.norms, S1: { min: "0" } } }, [
  "norms",
  "S1",
  "min",
]);
console.log(
  "API validation regression checks passed (" +
    checks +
    " checks across " +
    cases.length +
    " ID schemas).",
);
