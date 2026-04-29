import React, { useEffect, useState } from "react";
import { useCallable } from "../lib/firebase-hooks";
import type { NormStats, SubtaskDef, QuizSection } from "../lib/scoring";
import type {
  GetSubtasksOutput,
  SaveSubtaskOutput,
} from "../../../functions/src/types/subtasks";
import type {
  SaveSubtaskInput,
  DeleteSubtaskInput,
} from "../../../functions/src/types/subtasks-inputs";
import type { GetQuestionsOutput } from "../../../functions/src/types/questions";
import { PageHeader } from "../components/PageHeader";
import { Button } from "../components/Button";
import { Modal } from "../components/Modal";
import { Alert } from "../components/Alert";
import { toUserMessage } from "../lib/errors";
import { useTranslation } from "../hooks/useTranslation";

type NormGrade = "S1" | "S3" | "S5";
const NORM_GRADES: NormGrade[] = ["S1", "S3", "S5"];
const NORM_FIELDS: (keyof NormStats)[] = ["min", "max", "n", "stdDev", "mean"];

const EMPTY_NORMS: { S1: NormStats | null; S3: NormStats | null; S5: NormStats | null } = {
  S1: null,
  S3: null,
  S5: null,
};

const INPUT_CLASSES =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500";

export default function AdminSubtasks() {
  const { t } = useTranslation();

  const [getSubtasks, loadingSubtasks] = useCallable<{}, GetSubtasksOutput>("api/get-subtasks");
  const [saveSubtask, saving] = useCallable<SaveSubtaskInput, SaveSubtaskOutput>(
    "api/admin/save-subtask",
  );
  const [deleteSubtask, deleting] = useCallable<DeleteSubtaskInput>("api/admin/delete-subtask");
  const [getQuestions] = useCallable<void, GetQuestionsOutput>("api/get-questions");

  const [subtasks, setSubtasks] = useState<SubtaskDef[]>([]);
  const [sections, setSections] = useState<QuizSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit modal state
  const [editing, setEditing] = useState<SubtaskDef | null>(null); // null = closed, empty id = new
  const [formName, setFormName] = useState("");
  const [formQuestionIds, setFormQuestionIds] = useState<
    { sectionIndex: number; questionIndex: number }[]
  >([]);
  // Draft norm input strings (so partial typing like "3." isn't lost)
  const [normDrafts, setNormDrafts] = useState<Record<NormGrade, Record<keyof NormStats, string>>>({
    S1: { min: "", max: "", n: "", stdDev: "", mean: "" },
    S3: { min: "", max: "", n: "", stdDev: "", mean: "" },
    S5: { min: "", max: "", n: "", stdDev: "", mean: "" },
  });

  useEffect(() => {
    void Promise.all([getSubtasks({}), getQuestions()])
      .then(([subtasksRes, questionsRes]) => {
        setSubtasks(subtasksRes.data.subtasks);
        setSections(questionsRes.data.sections);
        setLoadError(null);
      })
      .catch((err) => {
        setLoadError(toUserMessage(err, t("adminSubtasks.errorLoad")));
      });
  }, [getSubtasks, getQuestions, t]);

  const refreshSubtasks = async () => {
    const res = await getSubtasks({});
    setSubtasks(res.data.subtasks);
  };

  const openNew = () => {
    setEditing({ id: "", name: "", questionIds: [], norms: { ...EMPTY_NORMS } });
    setFormName("");
    setFormQuestionIds([]);
    setNormDrafts({
      S1: { min: "", max: "", n: "", stdDev: "", mean: "" },
      S3: { min: "", max: "", n: "", stdDev: "", mean: "" },
      S5: { min: "", max: "", n: "", stdDev: "", mean: "" },
    });
    setError(null);
  };

  const openEdit = (subtask: SubtaskDef) => {
    setEditing(subtask);
    setFormName(subtask.name);
    setFormQuestionIds([...subtask.questionIds]);
    const drafts = {} as Record<NormGrade, Record<keyof NormStats, string>>;
    for (const g of NORM_GRADES) {
      const row = subtask.norms[g];
      drafts[g] = {
        min: row?.min?.toString() ?? "",
        max: row?.max?.toString() ?? "",
        n: row?.n?.toString() ?? "",
        stdDev: row?.stdDev?.toString() ?? "",
        mean: row?.mean?.toString() ?? "",
      };
    }
    setNormDrafts(drafts);
    setError(null);
  };

  const closeModal = () => setEditing(null);

  const toggleQuestion = (sectionIndex: number, questionIndex: number) => {
    setFormQuestionIds((prev) => {
      const exists = prev.some(
        (q) => q.sectionIndex === sectionIndex && q.questionIndex === questionIndex,
      );
      if (exists) {
        return prev.filter(
          (q) => !(q.sectionIndex === sectionIndex && q.questionIndex === questionIndex),
        );
      }
      return [...prev, { sectionIndex, questionIndex }];
    });
  };

  const isQuestionSelected = (sectionIndex: number, questionIndex: number) =>
    formQuestionIds.some(
      (q) => q.sectionIndex === sectionIndex && q.questionIndex === questionIndex,
    );

  const toggleAllInSection = (sectionIndex: number, sectionLength: number) => {
    const allSelected = Array.from({ length: sectionLength }, (_, i) => i).every((qi) =>
      isQuestionSelected(sectionIndex, qi),
    );

    setFormQuestionIds((prev) => {
      const without = prev.filter((q) => q.sectionIndex !== sectionIndex);
      if (allSelected) return without;
      const all = Array.from({ length: sectionLength }, (_, i) => ({
        sectionIndex,
        questionIndex: i,
      }));
      return [...without, ...all];
    });
  };

  const handleNormDraftChange = (grade: NormGrade, field: keyof NormStats, value: string) => {
    setNormDrafts((prev) => ({
      ...prev,
      [grade]: { ...prev[grade], [field]: value },
    }));
  };

  const buildNormsFromDrafts = (): {
    S1: NormStats | null;
    S3: NormStats | null;
    S5: NormStats | null;
  } => {
    const result = {} as Record<NormGrade, NormStats | null>;
    for (const g of NORM_GRADES) {
      const d = normDrafts[g];
      const allEmpty = NORM_FIELDS.every((f) => d[f].trim() === "");
      if (allEmpty) {
        result[g] = null;
      } else {
        result[g] = {
          min: parseFloat(d.min) || 0,
          max: parseFloat(d.max) || 0,
          n: parseInt(d.n) || 0,
          stdDev: parseFloat(d.stdDev) || 0,
          mean: parseFloat(d.mean) || 0,
        };
      }
    }
    return result;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formName.trim()) {
      setError(t("adminSubtasks.errorNameRequired"));
      return;
    }
    if (formQuestionIds.length === 0) {
      setError(t("adminSubtasks.errorPickQuestion"));
      return;
    }

    const norms = buildNormsFromDrafts();
    const input: SaveSubtaskInput = {
      ...(editing?.id ? { id: editing.id } : {}),
      name: formName.trim(),
      questionIds: formQuestionIds,
      norms,
    };

    try {
      await saveSubtask(input);
      closeModal();
      await refreshSubtasks();
    } catch (err) {
      setError(toUserMessage(err, t("adminSubtasks.errorSave")));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("adminSubtasks.confirmDelete"))) return;
    setListError(null);
    try {
      await deleteSubtask({ id });
      await refreshSubtasks();
    } catch (err) {
      console.error("Failed to delete subtask:", err);
      setListError(toUserMessage(err, t("adminSubtasks.errorDelete")));
    }
  };

  const normConfiguredBadge = (norms: SubtaskDef["norms"], grade: NormGrade) =>
    norms[grade] ? (
      <span className="inline-block w-5 text-center text-green-600 font-medium">Y</span>
    ) : (
      <span className="inline-block w-5 text-center text-gray-300">-</span>
    );

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">
        <PageHeader
          title={t("admin.subtasks.title")}
          subtitle={t("admin.subtasks.description")}
          backTo="/admin"
        />

        <div className="mb-4 flex justify-end">
          <Button onClick={openNew}>{t("adminSubtasks.new")}</Button>
        </div>

        {loadError && (
          <div className="mb-4">
            <Alert kind="error">{loadError}</Alert>
          </div>
        )}
        {listError && (
          <div className="mb-4">
            <Alert kind="error">{listError}</Alert>
          </div>
        )}

        {/* Subtask list */}
        <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 sm:px-6 py-3 font-medium">{t("adminSubtasks.col.name")}</th>
                  <th className="px-3 sm:px-6 py-3 font-medium text-center whitespace-nowrap">
                    {t("adminSubtasks.col.numQuestions")}
                  </th>
                  <th className="px-2 sm:px-6 py-3 font-medium text-center">S1</th>
                  <th className="px-2 sm:px-6 py-3 font-medium text-center">S3</th>
                  <th className="px-2 sm:px-6 py-3 font-medium text-center">S5</th>
                  <th className="px-4 sm:px-6 py-3 font-medium">{t("adminUsers.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loadingSubtasks && (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                      {t("common.loadingDots")}
                    </td>
                  </tr>
                )}
                {!loadingSubtasks && subtasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 sm:px-6 py-8 text-center text-gray-500">
                      {t("adminSubtasks.empty")}
                    </td>
                  </tr>
                )}
                {subtasks.map((st) => (
                  <tr key={st.id} className="hover:bg-gray-50">
                    <td className="px-4 sm:px-6 py-3 font-medium text-gray-900">{st.name}</td>
                    <td className="px-3 sm:px-6 py-3 text-center">{st.questionIds.length}</td>
                    <td className="px-2 sm:px-6 py-3 text-center">
                      {normConfiguredBadge(st.norms, "S1")}
                    </td>
                    <td className="px-2 sm:px-6 py-3 text-center">
                      {normConfiguredBadge(st.norms, "S3")}
                    </td>
                    <td className="px-2 sm:px-6 py-3 text-center">
                      {normConfiguredBadge(st.norms, "S5")}
                    </td>
                    <td className="px-4 sm:px-6 py-3 whitespace-nowrap space-x-2">
                      <Button size="sm" onClick={() => openEdit(st)}>
                        {t("common.edit")}
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={deleting}
                        onClick={() => handleDelete(st.id)}
                      >
                        {t("common.delete")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {editing && (
        <Modal onClose={closeModal}>
          <h2 className="text-xl font-semibold mb-4">
            {editing.id ? t("adminSubtasks.editTitle") : t("adminSubtasks.newTitle")}
          </h2>

          <form onSubmit={handleSave} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t("adminSubtasks.col.name")}</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className={INPUT_CLASSES}
                placeholder={t("adminSubtasks.namePlaceholder")}
                required
              />
            </div>

            {/* Question picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("adminSubtasks.questionsLabel", { count: formQuestionIds.length })}
              </label>
              <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                {sections.map((section, sIdx) => {
                  const allSelected = Array.from({ length: section.length }, (_, i) => i).every(
                    (qi) => isQuestionSelected(sIdx, qi),
                  );
                  const selectedCount = Array.from(
                    { length: section.length },
                    (_, i) => i,
                  ).filter((qi) => isQuestionSelected(sIdx, qi)).length;

                  return (
                    <div key={sIdx} className="border-b border-gray-100 last:border-b-0">
                      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() => toggleAllInSection(sIdx, section.length)}
                          className="rounded"
                        />
                        <span className="text-sm font-medium text-gray-700">
                          {section.title}{" "}
                          <span className="text-gray-400 font-normal">
                            {t("adminSubtasks.sectionMeta", {
                              kind: section.kind.toUpperCase(),
                              count: section.length,
                              selected:
                                selectedCount > 0
                                  ? t("adminSubtasks.selectedSuffix", { count: selectedCount })
                                  : "",
                            })}
                          </span>
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1 px-3 py-2">
                        {Array.from({ length: section.length }, (_, qIdx) => (
                          <button
                            key={qIdx}
                            type="button"
                            onClick={() => toggleQuestion(sIdx, qIdx)}
                            className={`w-8 h-8 text-xs rounded font-medium transition-colors ${
                              isQuestionSelected(sIdx, qIdx)
                                ? "bg-blue-600 text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            }`}
                          >
                            {qIdx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Norm stats grid */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t("adminSubtasks.normsLabel")}
              </label>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="pb-1 text-gray-500">
                      <th className="pr-2 text-left font-medium">{t("adminSubtasks.col.grade")}</th>
                      <th className="px-1 text-left font-medium">{t("adminSubtasks.col.min")}</th>
                      <th className="px-1 text-left font-medium">{t("adminSubtasks.col.max")}</th>
                      <th className="px-1 text-left font-medium">{t("adminSubtasks.col.n")}</th>
                      <th className="px-1 text-left font-medium">{t("adminSubtasks.col.std")}</th>
                      <th className="px-1 text-left font-medium">{t("adminSubtasks.col.mean")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {NORM_GRADES.map((grade) => (
                      <tr key={grade}>
                        <td className="py-1 pr-2 font-medium text-gray-700">{grade}</td>
                        {NORM_FIELDS.map((field) => (
                          <td key={field} className="py-1 px-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={normDrafts[grade][field]}
                              onChange={(e) =>
                                handleNormDraftChange(grade, field, e.target.value)
                              }
                              className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center focus:border-blue-500 focus:ring-blue-500"
                              placeholder="-"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <Alert kind="error">{error}</Alert>}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={closeModal}>
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
