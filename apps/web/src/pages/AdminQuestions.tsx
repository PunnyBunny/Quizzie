import React, { useEffect, useState } from "react";
import { useCallable } from "../lib/firebase-hooks";
import { toUserMessage } from "../lib/errors";
import type {
  GetQuestionsOutput,
  SaveQuestionSectionOutput,
} from "../../../functions/src/types/questions";
import type { SaveQuestionSectionInput } from "../../../functions/src/types/questions-inputs";
import type {
  QuestionSectionDto,
  SectionInstruction,
} from "../../../functions/src/types/models/questions-dto";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { AssetUploader } from "../components/AssetUploader";
import { useTranslation } from "../hooks/useTranslation";

type Kind = "mc" | "audio";
const KINDS: Kind[] = ["mc", "audio"];

const INPUT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500";

const SMALL_INPUT_CLASSES =
  "border border-gray-300 rounded-md px-2 py-1 text-sm focus:border-blue-500 focus:ring-blue-500";

interface ChoicePair {
  key: string;
  value: string;
}

interface QuestionRow {
  question: string;
  audio: string;
  choices: ChoicePair[];
  correctAnswer: string;
  image: string; // "" = null
}

interface FormState {
  id: string;
  title: string;
  kind: Kind;
  goal: string;
  instructionText: string;
  instructionAudio: string;
  rows: QuestionRow[];
  questionsNull: boolean;
  choicesEnabled: boolean;
  correctAnswersEnabled: boolean;
  imagesEnabled: boolean;
}

const DEFAULT_CHOICE_KEYS = ["A", "B", "C", "D"];

const PAGE_SIZE = 1;

function blankRow(choicesEnabled: boolean): QuestionRow {
  return {
    question: "",
    audio: "",
    choices: choicesEnabled ? DEFAULT_CHOICE_KEYS.map((key) => ({ key, value: "" })) : [],
    correctAnswer: "",
    image: "",
  };
}

const blankForm = (id = ""): FormState => ({
  id,
  title: "",
  kind: "mc",
  goal: "",
  instructionText: "",
  instructionAudio: "",
  rows: [],
  questionsNull: false,
  choicesEnabled: true,
  correctAnswersEnabled: true,
  imagesEnabled: false,
});

function recordToChoicePairs(record: Record<string, string>): ChoicePair[] {
  return Object.entries(record).map(([key, value]) => ({ key, value }));
}

function sectionToForm(section: QuestionSectionDto): FormState {
  const length = section.length;
  const rows: QuestionRow[] = [];
  for (let i = 0; i < length; i++) {
    rows.push({
      question: section.questions?.[i] ?? "",
      audio: section.audios[i] ?? "",
      choices: section.choices?.[i] ? recordToChoicePairs(section.choices[i]) : [],
      correctAnswer: section.correctAnswers?.[i] ?? "",
      image: section.images?.[i] ?? "",
    });
  }
  return {
    id: section.id,
    title: section.title,
    kind: section.kind,
    goal: section.goal,
    instructionText: section.instructions.text,
    instructionAudio: section.instructions.audio,
    rows,
    questionsNull: section.questions === null,
    choicesEnabled: section.choices !== undefined,
    correctAnswersEnabled: section.correctAnswers !== undefined,
    imagesEnabled: section.images !== undefined,
  };
}

function buildInput(
  form: FormState,
  t: (key: string, vars?: Record<string, string | number>) => string,
): {
  input?: SaveQuestionSectionInput;
  error?: string;
} {
  const id = form.id.trim();
  if (!id) return { error: t("adminQuestions.errorIdRequired") };

  const instructions: SectionInstruction = {
    text: form.instructionText,
    audio: form.instructionAudio,
  };

  const length = form.rows.length;
  const questions = form.questionsNull ? null : form.rows.map((r) => r.question);
  const audios = form.rows.map((r) => r.audio);

  let choices: Record<string, string>[] | undefined;
  if (form.choicesEnabled) {
    choices = [];
    for (const [idx, row] of form.rows.entries()) {
      const record: Record<string, string> = {};
      for (const { key, value } of row.choices) {
        const k = key.trim();
        if (!k) return { error: t("adminQuestions.errorChoiceKeyEmpty", { n: idx + 1 }) };
        if (k in record)
          return { error: t("adminQuestions.errorChoiceKeyDup", { n: idx + 1, key: k }) };
        record[k] = value;
      }
      choices.push(record);
    }
  }

  const correctAnswers = form.correctAnswersEnabled
    ? form.rows.map((r) => r.correctAnswer)
    : undefined;

  const images = form.imagesEnabled
    ? form.rows.map((r) => (r.image === "" ? null : r.image))
    : undefined;

  const input: SaveQuestionSectionInput = {
    id,
    title: form.title,
    kind: form.kind,
    length,
    goal: form.goal,
    questions,
    audios,
    instructions,
    ...(choices !== undefined && { choices }),
    ...(correctAnswers !== undefined && { correctAnswers }),
    ...(images !== undefined && { images }),
  };

  return { input };
}

export default function AdminQuestions() {
  const { t } = useTranslation();
  const [getQuestions, loadingSections] = useCallable<void, GetQuestionsOutput>(
    "api/get-questions",
  );
  const [saveSection, saving] = useCallable<SaveQuestionSectionInput, SaveQuestionSectionOutput>(
    "api/admin/save-question-section",
  );

  const [sections, setSections] = useState<QuestionSectionDto[]>([]);
  const [editing, setEditing] = useState<{ isNew: boolean } | null>(null);
  const [form, setForm] = useState<FormState>(blankForm());
  const [initialFormJson, setInitialFormJson] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  const isDirty = editing !== null && JSON.stringify(form) !== initialFormJson;

  const totalPages = Math.max(1, Math.ceil(form.rows.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages - 1);
  const pageStart = clampedPage * PAGE_SIZE;
  const pageRows = form.rows.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = async () => {
    try {
      const res = await getQuestions();
      setSections(res.data.sections);
    } catch (err) {
      setError(toUserMessage(err, t("adminQuestions.errorLoad")));
    }
  };

  const openNew = () => {
    const nextId = sections.length.toString();
    const initial = blankForm(nextId);
    setForm(initial);
    setInitialFormJson(JSON.stringify(initial));
    setEditing({ isNew: true });
    setError(null);
    setPage(0);
    setShowSettings(true);
  };

  const openEdit = (section: QuestionSectionDto) => {
    const initial = sectionToForm(section);
    setForm(initial);
    setInitialFormJson(JSON.stringify(initial));
    setEditing({ isNew: false });
    setError(null);
    setPage(0);
    setShowSettings(false);
  };

  const closeModal = () => setEditing(null);

  const requestClose = () => {
    if (isDirty && !window.confirm(t("adminQuestions.confirmDiscard"))) return;
    closeModal();
  };

  const updateForm = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateRow = (index: number, patch: Partial<QuestionRow>) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    }));
  };

  const addRow = () => {
    setForm((prev) => {
      const rows = [...prev.rows, blankRow(prev.choicesEnabled)];
      setPage(Math.floor((rows.length - 1) / PAGE_SIZE));
      return { ...prev, rows };
    });
  };

  const removeRow = (index: number) => {
    setForm((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== index) }));
  };

  const addChoice = (rowIndex: number) => {
    setForm((prev) => {
      const row = prev.rows[rowIndex];
      const usedKeys = new Set(row.choices.map((c) => c.key));
      const nextDefaultKey = DEFAULT_CHOICE_KEYS.find((k) => !usedKeys.has(k)) ?? "";
      return {
        ...prev,
        rows: prev.rows.map((r, i) =>
          i === rowIndex ? { ...r, choices: [...r.choices, { key: nextDefaultKey, value: "" }] } : r,
        ),
      };
    });
  };

  const updateChoice = (rowIndex: number, choiceIndex: number, patch: Partial<ChoicePair>) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) =>
        i === rowIndex
          ? {
              ...r,
              choices: r.choices.map((c, ci) => (ci === choiceIndex ? { ...c, ...patch } : c)),
            }
          : r,
      ),
    }));
  };

  const removeChoice = (rowIndex: number, choiceIndex: number) => {
    setForm((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) =>
        i === rowIndex ? { ...r, choices: r.choices.filter((_, ci) => ci !== choiceIndex) } : r,
      ),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const { input, error: buildError } = buildInput(form, t);
    if (!input) {
      setError(buildError ?? t("adminQuestions.errorInvalidForm"));
      return;
    }

    try {
      await saveSection(input);
      closeModal();
      await refresh();
    } catch (err) {
      setError(toUserMessage(err, t("adminQuestions.errorSave")));
    }
  };

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={t("admin.questions.title")}
          subtitle={t("adminQuestions.subtitle")}
          backTo="/admin"
        />

        <div className="mb-4 flex justify-end">
          <Button onClick={openNew}>{t("adminQuestions.new")}</Button>
        </div>

        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-6 py-3 font-medium">{t("adminQuestions.col.id")}</th>
                <th className="px-6 py-3 font-medium">{t("adminQuestions.col.title")}</th>
                <th className="px-6 py-3 font-medium">{t("adminQuestions.col.kind")}</th>
                <th className="px-6 py-3 font-medium text-center">{t("adminQuestions.col.length")}</th>
                <th className="px-6 py-3 font-medium">{t("adminQuestions.col.goal")}</th>
                <th className="px-6 py-3 font-medium">{t("adminQuestions.col.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loadingSections && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t("common.loadingDots")}
                  </td>
                </tr>
              )}
              {!loadingSections && sections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    {t("adminQuestions.empty")}
                  </td>
                </tr>
              )}
              {sections.map((section) => (
                <tr key={section.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-xs text-gray-500">{section.id}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">{section.title}</td>
                  <td className="px-6 py-3 uppercase text-xs">{section.kind}</td>
                  <td className="px-6 py-3 text-center">{section.length}</td>
                  <td className="px-6 py-3 text-gray-600 truncate max-w-xs" title={section.goal}>
                    {section.goal}
                  </td>
                  <td className="px-6 py-3">
                    <Button size="sm" onClick={() => openEdit(section)}>
                      {t("common.edit")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <Modal onClose={requestClose}>
          <h2 className="text-xl font-semibold mb-4">
            {editing.isNew ? t("adminQuestions.new") : t("adminQuestions.editTitle", { id: form.id })}
          </h2>

          <form onSubmit={handleSave} className="space-y-5">
            <div className="border border-gray-200 rounded-md">
              <button
                type="button"
                onClick={() => setShowSettings((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                aria-expanded={showSettings}
              >
                <span>{t("adminQuestions.settings")}</span>
                <span className="text-gray-400 text-xs">
                  {showSettings ? t("adminQuestions.hide") : t("adminQuestions.show")}
                </span>
              </button>

              {showSettings && (
                <div className="border-t border-gray-200 px-4 py-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {t("adminQuestions.sectionId")}
                      </label>
                      <input
                        type="text"
                        value={form.id}
                        onChange={(e) => updateForm("id", e.target.value)}
                        className={INPUT_CLASSES}
                        placeholder="e.g. 0"
                        disabled={!editing.isNew}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("adminQuestions.kind")}</label>
                      <select
                        value={form.kind}
                        onChange={(e) => updateForm("kind", e.target.value as Kind)}
                        className={INPUT_CLASSES}
                      >
                        {KINDS.map((k) => (
                          <option key={k} value={k}>
                            {k.toUpperCase()}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("adminQuestions.titleField")}</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={(e) => updateForm("title", e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t("adminQuestions.goal")}</label>
                    <input
                      type="text"
                      value={form.goal}
                      onChange={(e) => updateForm("goal", e.target.value)}
                      className={INPUT_CLASSES}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("adminQuestions.instructionsText")}
                    </label>
                    <textarea
                      value={form.instructionText}
                      onChange={(e) => updateForm("instructionText", e.target.value)}
                      className={INPUT_CLASSES}
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {t("adminQuestions.instructionsAudio")}
                    </label>
                    <AssetUploader
                      kind="audio"
                      sectionId={form.id || "instructions"}
                      value={form.instructionAudio}
                      onChange={(p) => updateForm("instructionAudio", p)}
                      placeholder="e.g. instructions/section-0.mp3"
                    />
                  </div>

                  <fieldset className="border border-gray-200 rounded-md px-4 py-3">
                    <legend className="text-sm font-medium text-gray-700 px-1">
                      {t("adminQuestions.perQuestionFields")}
                    </legend>
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-700">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!form.questionsNull}
                          onChange={(e) => updateForm("questionsNull", !e.target.checked)}
                        />
                        {t("adminQuestions.questionText")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.choicesEnabled}
                          onChange={(e) => updateForm("choicesEnabled", e.target.checked)}
                        />
                        {t("adminQuestions.choices")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.correctAnswersEnabled}
                          onChange={(e) => updateForm("correctAnswersEnabled", e.target.checked)}
                        />
                        {t("adminQuestions.correctAnswers")}
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.imagesEnabled}
                          onChange={(e) => updateForm("imagesEnabled", e.target.checked)}
                        />
                        {t("adminQuestions.images")}
                      </label>
                    </div>
                  </fieldset>
                </div>
              )}
            </div>

            {/* Per-question cards */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">
                  {t("adminQuestions.questionsLabel", { count: form.rows.length })}
                </label>
                <Button type="button" size="sm" onClick={addRow}>
                  {t("adminQuestions.addQuestion")}
                </Button>
              </div>

              {form.rows.length === 0 && (
                <p className="text-sm text-gray-500 py-4 text-center border border-dashed border-gray-200 rounded-md">
                  {t("adminQuestions.noQuestions")}
                </p>
              )}

              <div className="space-y-3">
                {pageRows.map((row, pageIdx) => {
                  const rowIdx = pageStart + pageIdx;
                  return (
                  <div
                    key={rowIdx}
                    className="border border-gray-200 rounded-md p-3 bg-gray-50 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{t("adminQuestions.qShort")}{rowIdx + 1}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => removeRow(rowIdx)}
                      >
                        {t("common.remove")}
                      </Button>
                    </div>

                    {!form.questionsNull && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {t("adminQuestions.questionText")}
                        </label>
                        <textarea
                          value={row.question}
                          onChange={(e) => updateRow(rowIdx, { question: e.target.value })}
                          className={INPUT_CLASSES}
                          rows={2}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {t("adminQuestions.audio")}
                      </label>
                      <AssetUploader
                        kind="audio"
                        sectionId={form.id}
                        value={row.audio}
                        onChange={(p) => updateRow(rowIdx, { audio: p })}
                        placeholder="e.g. section-0/q1.mp3"
                      />
                    </div>

                    {form.imagesEnabled && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {t("adminQuestions.image")}
                        </label>
                        <AssetUploader
                          kind="image"
                          sectionId={form.id}
                          value={row.image}
                          onChange={(p) => updateRow(rowIdx, { image: p })}
                        />
                      </div>
                    )}

                    {form.choicesEnabled && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium text-gray-600">
                            {t("adminQuestions.choices")}
                          </label>
                          <button
                            type="button"
                            onClick={() => addChoice(rowIdx)}
                            className="text-xs text-blue-600 hover:text-blue-800"
                          >
                            {t("adminQuestions.addChoice")}
                          </button>
                        </div>
                        <div className="space-y-1">
                          {row.choices.map((choice, choiceIdx) => (
                            <div key={choiceIdx} className="flex items-center gap-2">
                              <input
                                type="text"
                                value={choice.key}
                                onChange={(e) =>
                                  updateChoice(rowIdx, choiceIdx, { key: e.target.value })
                                }
                                className={`${SMALL_INPUT_CLASSES} w-16 font-medium`}
                                placeholder={t("adminQuestions.choiceKey")}
                              />
                              <input
                                type="text"
                                value={choice.value}
                                onChange={(e) =>
                                  updateChoice(rowIdx, choiceIdx, { value: e.target.value })
                                }
                                className={`${SMALL_INPUT_CLASSES} flex-1`}
                                placeholder={t("adminQuestions.choiceValue")}
                              />
                              <button
                                type="button"
                                onClick={() => removeChoice(rowIdx, choiceIdx)}
                                className="text-xs text-red-600 hover:text-red-800 px-2"
                                aria-label={t("adminQuestions.removeChoice", {
                                  label: choice.key || choiceIdx + 1,
                                })}
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          {row.choices.length === 0 && (
                            <p className="text-xs text-gray-400 italic">{t("adminQuestions.noChoices")}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {form.correctAnswersEnabled && (
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          {t("adminQuestions.correctAnswer")}
                        </label>
                        <input
                          type="text"
                          value={row.correctAnswer}
                          onChange={(e) =>
                            updateRow(rowIdx, { correctAnswer: e.target.value })
                          }
                          className={INPUT_CLASSES}
                          placeholder={
                            form.choicesEnabled && row.choices.length > 0
                              ? `e.g. ${row.choices[0].key}`
                              : ""
                          }
                        />
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {form.rows.length > PAGE_SIZE && (
                <div className="flex items-center justify-between mt-3 text-sm">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={clampedPage === 0}
                    onClick={() => setPage(clampedPage - 1)}
                  >
                    {t("common.previous")}
                  </Button>
                  <div className="text-gray-600">
                    {t("adminQuestions.questionPager", {
                      current: clampedPage + 1,
                      total: totalPages,
                    })}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={clampedPage >= totalPages - 1}
                    onClick={() => setPage(clampedPage + 1)}
                  >
                    {t("common.next")}
                  </Button>
                </div>
              )}
            </div>

            {error && <Alert kind="error">{error}</Alert>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={requestClose}>
                {t("common.cancel")}
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
